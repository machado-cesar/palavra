export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTimer, getActiveSession, setActiveSession } from '@/lib/redis'
import { SCORING } from '@/types'

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

    // Verificar se há timer ativo
    const timerEndsAt = await getTimer(user.id)
    if (timerEndsAt && new Date(timerEndsAt) > new Date()) {
      return NextResponse.json({
        error: 'Timer ativo',
        data: { timerEndsAt }
      }, { status: 429 })
    }

    // Verificar se já tem sessão ativa
    const existingSession = await getActiveSession(user.id)
    if (existingSession) {
      return NextResponse.json({
        success: true,
        data: { sessionId: existingSession.sessionId, alreadyStarted: true }
      })
    }

    // Buscar a palavra do dia
    const today = new Date().toISOString().split('T')[0]
    const { data: word, error: wordError } = await supabaseAdmin
      .from('words')
      .select('id, word')
      .eq('used_at', today)
      .single()

    if (wordError || !word) {
      return NextResponse.json({ error: 'Nenhuma palavra configurada para hoje' }, { status: 503 })
    }

    // Verificar se o usuário já jogou hoje
    const { data: existingGameSession } = await supabaseAdmin
      .from('game_sessions')
      .select('id, won, score')
      .eq('user_id', user.id)
      .eq('word_id', word.id)
      .not('completed_at', 'is', null)
      .single()

    if (existingGameSession) {
      return NextResponse.json({
        error: 'Você já jogou hoje',
        data: { alreadyPlayed: true, score: existingGameSession.score }
      }, { status: 409 })
    }

    // Criar sessão no banco
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .insert({
        user_id: user.id,
        word_id: word.id,
        max_possible_score: SCORING.MAX_SCORE,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Erro ao criar sessão' }, { status: 500 })
    }

    // Salvar sessão ativa no Redis
    await setActiveSession(user.id, {
      sessionId: session.id,
      wordId: word.id,
      attemptsCount: 0,
      currentMaxScore: SCORING.MAX_SCORE,
      wrongAttempts: 0,
      startedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      data: { sessionId: session.id }
    })
  } catch (error) {
    console.error('[game/start]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
