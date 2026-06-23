export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFreeSession, setFreeSession, clearFreeSession, updateIncansavelRanking, getTodayKey } from '@/lib/redis'
import { evaluateAttempt, normalizeWord, isValidGuess } from '@/lib/words'
import { isGameOver } from '@/lib/scoring'

/**
 * POST /api/free/attempt
 *
 * Valida uma tentativa no modo incansável.
 * - Sem scoring, sem recovery, sem penalidades
 * - Conta palavras ganhas no dia (wordsWon)
 * - Mantém lista das últimas 10 palavras jogadas (recentWordIds)
 * - Atualiza ranking:incansavel:{date} com wordsWon
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
    if (!session || !session.gameActive) {
      return NextResponse.json({ error: 'Nenhuma sessão ativa' }, { status: 404 })
    }

    const normalizedGuess = normalizeWord(guess)
    const answer = session.word
    const result = evaluateAttempt(normalizedGuess, answer)
    const won = normalizedGuess === answer

    const newAttemptsCount = session.attemptsCount + 1
    const newWrongAttempts = won ? session.wrongAttempts : session.wrongAttempts + 1
    const gameOver = !won && isGameOver(newAttemptsCount)

    if (won || gameOver) {
      // Atualizar lista das últimas 10 palavras
      const newRecentWordIds = [...session.recentWordIds, session.wordId].slice(-10)
      const newWordsWon = won ? session.wordsWon + 1 : session.wordsWon

      // Salvar sessão com game inativo (stats do dia preservados)
      await setFreeSession(user.id, {
        ...session,
        wordsWon: newWordsWon,
        recentWordIds: newRecentWordIds,
        attemptsCount: newAttemptsCount,
        wrongAttempts: newWrongAttempts,
        gameActive: false,
      })

      // Atualizar ranking incansável do dia (Redis)
      if (newWordsWon > 0) {
        await updateIncansavelRanking(user.id, newWordsWon)
      }

      // Persistir no Supabase para histórico e troféus
      if (won) {
        const today = getTodayKey()
        await supabaseAdmin
          .from('incansavel_completions')
          .upsert(
            { user_id: user.id, date: today, words_completed: newWordsWon, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
          )
      }

      return NextResponse.json({
        success: true,
        data: {
          result,
          won,
          gameOver,
          correctWord: gameOver && !won ? answer : undefined,
          wordsWon: newWordsWon,
        },
      })
    }

    // Jogo continua — só atualizar contadores
    await setFreeSession(user.id, {
      ...session,
      attemptsCount: newAttemptsCount,
      wrongAttempts: newWrongAttempts,
    })

    return NextResponse.json({
      success: true,
      data: { result, won: false, gameOver: false, wordsWon: session.wordsWon },
    })
  } catch (err) {
    console.error('[free/attempt]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
