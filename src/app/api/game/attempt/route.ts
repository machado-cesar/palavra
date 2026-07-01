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
import { AttemptResponse } from '@/types'
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

    // Busca palavra e tentativas existentes em paralelo
    const [wordResult, dbSessionResult] = await Promise.all([
      supabaseAdmin.from('words').select('word').eq('id', activeSession.wordId).single(),
      supabaseAdmin.from('game_sessions').select('attempts').eq('id', activeSession.sessionId).single(),
    ])

    if (wordResult.error || !wordResult.data) {
      return NextResponse.json({ error: 'Erro ao buscar palavra' }, { status: 500 })
    }

    const normalizedGuess = normalizeWord(guess)
    const answer = normalizeWord(wordResult.data.word.trim())
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

    const allAttempts = [...(dbSessionResult.data?.attempts || []), attempt]

    // ─── Calcular pontuação com recovery ────────────────────────────────────────
    const recoveredPoints = activeSession.recoveryStartedAt
      ? getRecoveredPoints(activeSession.recoveryStartedAt)
      : 0
    const scoreAfterRecovery = activeSession.currentMaxScore + recoveredPoints
    const penalty = won ? 0 : getPenalty(activeSession.wrongAttempts)
    const newMaxScore = Math.max(scoreAfterRecovery - penalty, 0)
    const newRecoveryStartedAt = (!won && !gameOver) ? new Date().toISOString() : undefined

    let finalScore = 0
    let tokenEarned = false
    let response_streakCanBeSaved = false
    let response_prevStreak = 0
    let response_tokens = 0
    let frase = null

    if (won || gameOver) {
      finalScore = won ? newMaxScore : 0
      const today = getTodayBRT()

      // Salvar sessão concluída
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

      if (won) {
        // Leaderboard, ranking Redis, streak+token, clearSession e frase em paralelo
        const results = await Promise.all([
          supabaseAdmin.from('leaderboard_daily').upsert({ user_id: user.id, date: today, score: finalScore }),
          updateRanking(user.id, finalScore),
          (async () => {
            await supabaseAdmin.rpc('increment_streak', { user_id: user.id })
            const { data } = await supabaseAdmin
              .from('users').select('current_streak, tokens').eq('id', user.id).single()
            return data
          })(),
          clearActiveSession(user.id),
          getDailyFrase(today),
        ] as const)

        frase = results[4]

        const updatedUser = results[2]
        const newStreak = updatedUser?.current_streak ?? 0
        if (newStreak > 0 && newStreak % 3 === 0) {
          const newTokens = Math.min((updatedUser?.tokens ?? 0) + 1, 3)
          await supabaseAdmin.from('users').update({ tokens: newTokens }).eq('id', user.id)
          tokenEarned = true
        }
      } else {
        // Derrota — leaderboard, clearSession, fetch user e frase em paralelo
        const results = await Promise.all([
          supabaseAdmin.from('leaderboard_daily').upsert({ user_id: user.id, date: today, score: finalScore }),
          clearActiveSession(user.id),
          supabaseAdmin.from('users').select('current_streak, tokens').eq('id', user.id).single(),
          getDailyFrase(today),
        ] as const)

        frase = results[3]
        const userData = results[2].data

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
    } else {
      // Jogo continua — salvar tentativa e sessão Redis em paralelo
      await Promise.all([
        supabaseAdmin
          .from('game_sessions')
          .update({ attempts: allAttempts, max_possible_score: newMaxScore })
          .eq('id', activeSession.sessionId),
        setActiveSession(user.id, {
          ...activeSession,
          attemptsCount: newAttemptsCount,
          currentMaxScore: newMaxScore,
          wrongAttempts: newWrongAttempts,
          recoveryStartedAt: newRecoveryStartedAt,
        }),
      ])
    }

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
