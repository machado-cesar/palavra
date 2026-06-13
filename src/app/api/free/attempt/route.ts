export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFreeSession, setFreeSession, clearFreeSession } from '@/lib/redis'
import { evaluateAttempt, normalizeWord, isValidGuess } from '@/lib/words'
import { getPenalty, getRecoveredPoints, isGameOver } from '@/lib/scoring'
import { SCORING, AttemptResponse } from '@/types'

/**
 * POST /api/free/attempt
 *
 * Valida uma tentativa no modo livre.
 * Mesma lógica de scoring e recovery do modo principal, mas:
 * - NÃO atualiza streak
 * - NÃO concede tokens
 * - NÃO entra no ranking
 * - NÃO persiste em game_sessions
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { guess } = body

    if (!guess || !isValidGuess(guess)) {
      return NextResponse.json({ error: 'Tentativa inválida' }, { status: 400 })
    }

    const session = await getFreeSession(user.id)
    if (!session) {
      return NextResponse.json({ error: 'Nenhuma sessão livre ativa' }, { status: 404 })
    }

    const normalizedGuess = normalizeWord(guess)
    const answer = session.word  // já normalizada ao criar a sessão
    const result = evaluateAttempt(normalizedGuess, answer)
    const won = normalizedGuess === answer

    const newAttemptsCount = session.attemptsCount + 1
    const newWrongAttempts = won ? session.wrongAttempts : session.wrongAttempts + 1
    const gameOver = !won && isGameOver(newAttemptsCount)

    // ─── Cálculo de pontuação com recovery ─────────────────────────────────────

    const recoveredPoints = session.recoveryStartedAt
      ? getRecoveredPoints(session.recoveryStartedAt)
      : 0

    const scoreAfterRecovery = session.currentMaxScore + recoveredPoints
    const penalty = won ? 0 : getPenalty(session.wrongAttempts)
    const newMaxScore = Math.max(scoreAfterRecovery - penalty, 0)
    const newRecoveryStartedAt = (!won && !gameOver) ? new Date().toISOString() : undefined

    let finalScore = 0

    if (won || gameOver) {
      finalScore = won ? newMaxScore : 0
      await clearFreeSession(user.id)
    } else {
      // Atualizar sessão com o novo estado
      await setFreeSession(user.id, {
        ...session,
        attemptsCount: newAttemptsCount,
        currentMaxScore: newMaxScore,
        wrongAttempts: newWrongAttempts,
        recoveryStartedAt: newRecoveryStartedAt,
      })
    }

    const response: AttemptResponse = {
      result,
      score: won || gameOver ? finalScore : newMaxScore,
      won,
      gameOver,
      correctWord: gameOver && !won ? answer : undefined,
      recoveryStartedAt: newRecoveryStartedAt,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (err) {
    console.error('[free/attempt]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
