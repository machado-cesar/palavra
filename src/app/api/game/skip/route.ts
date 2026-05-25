import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTimer, clearTimer, getActiveSession, setActiveSession } from '@/lib/redis'
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

    // Verificar se há timer ativo para pular
    const timerEndsAt = await getTimer(user.id)
    if (!timerEndsAt || new Date(timerEndsAt) <= new Date()) {
      return NextResponse.json({ error: 'Nenhum timer ativo para pular' }, { status: 400 })
    }

    // Buscar sessão ativa
    const activeSession = await getActiveSession(user.id)
    if (!activeSession) {
      return NextResponse.json({ error: 'Nenhuma sessão ativa' }, { status: 404 })
    }

    const penaltyApplied = SCORING.PENALTY_PER_SKIP
    const newMaxScore = Math.max(activeSession.currentMaxScore - penaltyApplied, SCORING.MIN_SCORE)

    // Atualizar contagem de skips no banco
    await supabaseAdmin
      .from('game_sessions')
      .update({
        timer_skips: supabaseAdmin.rpc('increment_skips', { session_id: activeSession.sessionId }),
        max_possible_score: newMaxScore,
      })
      .eq('id', activeSession.sessionId)

    // Atualizar skips diretamente
    const { data: sessionData } = await supabaseAdmin
      .from('game_sessions')
      .select('timer_skips')
      .eq('id', activeSession.sessionId)
      .single()

    await supabaseAdmin
      .from('game_sessions')
      .update({ timer_skips: (sessionData?.timer_skips || 0) + 1 })
      .eq('id', activeSession.sessionId)

    // Atualizar sessão no Redis
    await setActiveSession(user.id, {
      ...activeSession,
      currentMaxScore: newMaxScore,
    })

    // Remover timer do Redis
    await clearTimer(user.id)

    return NextResponse.json({
      success: true,
      data: {
        penaltyApplied,
        newMaxScore,
      }
    })
  } catch (error) {
    console.error('[game/skip]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
