export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  setTimer,
  updateRanking,
} from '@/lib/redis'
import { evaluateAttempt, normalizeWord, isValidGuess } from '@/lib/words'
import {
  shouldActivateTimer,
  isGameOver,
  calculateFinalScore,
  getMaxScoreForAttempt,
} from '@/lib/scoring'
import { SCORING, AttemptResponse, getTimerMinutes } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { guess } = body

    if (!guess || !isValidGuess(guess)) {
      return NextResponse.json({ error: 'Tentativa inválida' }, { status: 400 })
    }

    // Buscar sessão ativa
    const activeSession = await getActiveSession(user.id)
    if (!activeSession) {
      return NextResponse.json({ error: 'Nenhuma sessão ativa' }, { status: 404 })
    }

    // Buscar a palavra correta (nunca enviada ao cliente)
    const { data: wordData, error: wordError } = await supabaseAdmin
      .from('words')
      .select('word')
      .eq('id', activeSession.wordId)
      .single()

    if (wordError || !wordData) {
      return NextResponse.json({ error: 'Erro ao buscar palavra' }, { status: 500 })
    }

    const normalizedGuess = normalizeWord(guess)
    const answer = normalizeWord(wordData.word.trim())
    const result = evaluateAttempt(normalizedGuess, answer)
    const won = normalizedGuess === answer

    // Atualizar contadores
    const newAttemptsCount = activeSession.attemptsCount + 1
    const newWrongAttempts = won ? activeSession.wrongAttempts : activeSession.wrongAttempts + 1
    const newMaxScore = getMaxScoreForAttempt(newAttemptsCount)
    const gameOver = !won && isGameOver(newAttemptsCount)

    // Montar objeto da tentativa
    const attempt = {
      word: normalizedGuess,
      result,
      timestamp: new Date().toISOString(),
    }

    // Buscar sessão no banco para pegar o histórico completo
    const { data: dbSession } = await supabaseAdmin
      .from('game_sessions')
      .select('attempts, timer_skips')
      .eq('id', activeSession.sessionId)
      .single()

    const allAttempts = [...(dbSession?.attempts || []), attempt]
    const timerSkips = dbSession?.timer_skips || 0

    let finalScore = 0
    let timerEndsAt: string | null = null
    let streakSaved = false
    let tokenEarned = false

    if (won || gameOver) {
      // Jogo terminou — calcular pontuação final
      finalScore = won ? calculateFinalScore(newAttemptsCount, timerSkips) : 0

      // Atualizar sessão no banco
      await supabaseAdmin
        .from('game_sessions')
        .update({
          attempts: allAttempts,
          completed_at: new Date().toISOString(),
          score: finalScore,
          max_possible_score: newMaxScore,
          won,
        })
        .eq('id', activeSession.sessionId)

      // Atualizar placar diário
      const today = new Date().toISOString().split('T')[0]
      await supabaseAdmin
        .from('leaderboard_daily')
        .upsert({
          user_id: user.id,
          date: today,
          score: finalScore,
        })

      // Atualizar ranking no Redis
      if (won) {
        await updateRanking(user.id, finalScore)
      }

      // Atualizar streak do usuário (com lógica de tokens)
      if (won && timerSkips === 0) {
        // Vitória perfeita — incrementa streak
        await supabaseAdmin.rpc('increment_streak', { user_id: user.id })

        // Verificar se ganhou um token (a cada 3 dias de streak)
        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('current_streak, tokens')
          .eq('id', user.id)
          .single()

        const newStreak = updatedUser?.current_streak ?? 0
        if (newStreak > 0 && newStreak % 3 === 0) {
          const newTokens = Math.min((updatedUser?.tokens ?? 0) + 1, 5)
          await supabaseAdmin
            .from('users')
            .update({ tokens: newTokens })
            .eq('id', user.id)
          tokenEarned = true
        }
      } else {
        // Derrota ou vitória com skips — tentar gastar token para preservar streak
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('current_streak, tokens')
          .eq('id', user.id)
          .single()

        const currentStreak = userData?.current_streak ?? 0
        const currentTokens = userData?.tokens ?? 0

        if (currentTokens > 0 && currentStreak > 0) {
          // Gasta token, preserva streak
          await supabaseAdmin
            .from('users')
            .update({ tokens: currentTokens - 1, last_played_at: today })
            .eq('id', user.id)
          streakSaved = true
        } else {
          // Sem tokens — reseta streak
          await supabaseAdmin
            .from('users')
            .update({ current_streak: 0, last_played_at: today })
            .eq('id', user.id)
        }
      }

      // Limpar sessão ativa do Redis
      await clearActiveSession(user.id)
    } else {
      // Jogo continua — salvar tentativa e ativar timer se necessário
      await supabaseAdmin
        .from('game_sessions')
        .update({
          attempts: allAttempts,
          max_possible_score: newMaxScore,
        })
        .eq('id', activeSession.sessionId)

      // Ativar timer se necessário (progressivo: 2min→5min→10min→30min)
      if (shouldActivateTimer(newWrongAttempts)) {
        timerEndsAt = await setTimer(user.id, getTimerMinutes(newWrongAttempts))
      }

      // Atualizar sessão no Redis
      await setActiveSession(user.id, {
        ...activeSession,
        attemptsCount: newAttemptsCount,
        currentMaxScore: newMaxScore,
        wrongAttempts: newWrongAttempts,
      })
    }

    const response: AttemptResponse = {
      result,
      score: won || gameOver ? finalScore : newMaxScore,
      won,
      gameOver,
      timerEndsAt,
      correctWord: gameOver && !won ? answer : undefined,
      streakSaved: streakSaved || undefined,
      tokenEarned: tokenEarned || undefined,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('[game/attempt]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
