export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFreeSession, setFreeSession } from '@/lib/redis'
import { getRandomWord, normalizeWord } from '@/lib/words'
import { getTodayBRT } from '@/lib/date'

/**
 * POST /api/free/start
 *
 * Inicia uma nova partida no modo incansável.
 * - Preserva wordsWon e recentWordIds do dia (estatísticas cross-partida)
 * - Exclui a palavra do dia do modo diário
 * - Exclui as últimas 10 palavras jogadas na sessão
 * - NÃO afeta streak, tokens, leaderboard diário ou game_sessions
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
    // Preservar estatísticas do dia caso já exista sessão
    const existing = await getFreeSession(user.id)
    const wordsWon = existing?.wordsWon ?? 0
    const recentWordIds = existing?.recentWordIds ?? []

    // Buscar palavra do dia para excluir
    const today = getTodayBRT()
    const { data: dailyWord } = await supabaseAdmin
      .from('words')
      .select('id')
      .eq('used_at', today)
      .single()

    // Lista de exclusão: últimas 10 + palavra do dia
    const excludeIds = [...recentWordIds]
    if (dailyWord?.id && !excludeIds.includes(dailyWord.id)) {
      excludeIds.push(dailyWord.id)
    }

    const wordData = await getRandomWord(supabaseAdmin, excludeIds)
    if (!wordData) {
      return NextResponse.json({ error: 'Nenhuma palavra disponível' }, { status: 503 })
    }

    const normalizedWord = normalizeWord(wordData.word.trim())

    await setFreeSession(user.id, {
      wordsWon,
      recentWordIds,
      wordId: wordData.id,
      word: normalizedWord,
      attemptsCount: 0,
      wrongAttempts: 0,
      gameActive: true,
      startedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, data: { wordsWon } })
  } catch (err) {
    console.error('[free/start]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
