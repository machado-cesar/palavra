export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFreeSession, setFreeSession, clearFreeSession } from '@/lib/redis'
import { getRandomWord, normalizeWord } from '@/lib/words'
import { SCORING } from '@/types'

/**
 * POST /api/free/start
 *
 * Inicia uma nova sessão no modo livre (ilimitado).
 * - Escolhe uma palavra aleatória ativa do banco
 * - NÃO afeta streak, tokens, leaderboard ou game_sessions
 * - Se já houver sessão livre ativa, descarta e inicia nova
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
    // Descartar sessão livre anterior (se existir)
    await clearFreeSession(user.id)

    // Buscar palavra aleatória
    const wordData = await getRandomWord(supabaseAdmin)
    if (!wordData) {
      return NextResponse.json({ error: 'Nenhuma palavra disponível' }, { status: 503 })
    }

    const normalizedWord = normalizeWord(wordData.word.trim())

    // Criar sessão livre no Redis
    await setFreeSession(user.id, {
      wordId: wordData.id,
      word: normalizedWord,
      attemptsCount: 0,
      currentMaxScore: SCORING.MAX_SCORE,
      wrongAttempts: 0,
      startedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, data: { wordLength: 5 } })
  } catch (err) {
    console.error('[free/start]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
