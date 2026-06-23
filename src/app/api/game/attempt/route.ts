export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  updateRanking,
  getDailyFrase,
} from '@/lib/redis'
import { evaluateAttempt, normalizeWord, isValidGuess } from '@/lib/words'
import {
  getPenalty,
  getRecoveredPoints,
  isGameOver,
} from '@/lib/scoring'
import { SCORING, AttemptResponse } from '@/types'
import { getTodayBRT } from '@/lib/date'

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

    const activeSession = await getActiveSession(user.id)
    if (!activeSession) {
      return NextResponse.json({ error: 'Nenhuma sessão ativa' }, { status: 404 })
    }

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

    const newAttemptsCount = activeSession.attemptsCount + 1
    const newWrongAttempts = won ? activeSession.wrongAttempts : activeSession.wrongAttempts + 1
    const gameOver = !won && isGameOver(newAttemptsCount)

    const attempt = {
      word: normalizedGuess,
      result,
      timestamp: new Date().toISOString(),
    }

    const { data: dbSession } = await supabaseAdmin
      .from('game_sessions')
      .select('attempts')
      .eq('id', activeSession.sessionId)
      .single()

    const allAttempts = [...(dbSession?.attempts || []), attempt]

    // ─── Calcular pontuação com recovery ──────────────────────────────────────

    // Pontos recuperados desde o último erro (se houver)
    const recoveredPoints = activeSession.recoveryStartedAt
      ? getRecoveredPoints(activeSession.recoveryStartedAt)
      : 0

    // Score após recovery
    const scoreAfterRecovery = activeSession.currentMaxScore + recoveredPoints

    // Penalidade do erro atual (se errou)
    const penalty = won ? 0 : getPenalty(activeSession.wrongAttempts)

    // Novo score máximo
    const newMaxScore = Math.max(scoreAfterRecovery - penalty, 0)

    // Recovery começa imediatamente após erro (se o jogo continua)
    const newRecoveryStartedAt = (!won && !gameOver) ? new Date().toISOString() : undefined

    let finalScore = 0
    let tokenEarned = false
    let response_streakCanBeSaved = false
    let response_prevStreak = 0
    let response_tokens = 0

    if (won || gameOver) {
      finalScore = won ? newMaxScore : 0

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

      const today = getTodayBRT()
      await supabaseAdmin
        .from('leaderboard_daily')
        .upsert({ user_id: user.id, date: today, score: finalScore })

      if (won) {
        await updateRanking(user.id, finalScore)
      }

      // Streak: qualquer vitória conta
      if (won) {
        await supabaseAdmin.rpc('increment_streak', { user_id: user.id })

        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('current_streak, tokens')
          .eq('id', user.id)
          .single()

        const newStreak = updatedUser?.current_streak ?? 0
        if (newStreak > 0 && newStreak % 3 === 0) {
          const newTokens = Math.min((updatedUser?.tokens ?? 0) + 1, 3)
          await supabaseAdmin
            .from('users')
            .update({ tokens: newTokens })
            .eq('id', user.id)
          tokenEarned = true
        }
      } else {
        // Derrota — resetar streak e oferecer recovery via token
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('current_streak, tokens')
          .eq('id', user.id)
          .single()

        const currentStreak = userData?.current_streak ?? 0
        const currentTokens = userData?.tokens ?? 0

        await supabaseAdmin
          .from('users')
          .update({ current_streak: 0, last_played_at: today })
          .eq('id', user.id)

        if (currentTokens > 0 && currentStreak > 0) {
          response_streakCanBeSaved = true
          response_prevStreak = currentStreak
          response_tokens = currentTokens
        }
      }

      await clearActiveSession(user.id)
    } else {
      // Jogo continua — salvar tentativa e atualizar sessão
      await supabaseAdmin
        .from('game_sessions')
        .update({
          attempts: allAttempts,
          max_possible_score: newMaxScore,
        })
        .eq('id', activeSession.sessionId)

      await setActiveSession(user.id, {
        ...activeSession,
        attemptsCount: newAttemptsCount,
        currentMaxScore: newMaxScore,
        wrongAttempts: newWrongAttempts,
        recoveryStartedAt: newRecoveryStartedAt,
      })
    }

    const frase = (won || gameOver) ? await getDailyFrase(getTodayBRT()) : null

    const response: AttemptResponse = {
      result,
      score: won || gameOver ? finalScore : newMaxScore,
      won,
      gameOver,
      correctWord: gameOver && !won ? answer : undefined,
      tokenEarned: tokenEarned || undefined,
      streakCanBeSaved: response_streakCanBeSaved || undefined,
      prevStreak: response_prevStreak || undefined,
      tokens: response_tokens || undefined,
      recoveryStartedAt: newRecoveryStartedAt,
      frase: frase ?? null,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('[game/attempt]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
