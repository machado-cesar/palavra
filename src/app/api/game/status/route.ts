import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTimer, getActiveSession } from '@/lib/redis'
import { GameStatusResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Pegar o token do header Authorization
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar timer ativo
    const timerEndsAt = await getTimer(user.id)

    // Verificar sessão ativa
    const activeSession = await getActiveSession(user.id)

    const response: GameStatusResponse = {
      canPlay: !timerEndsAt || new Date(timerEndsAt) <= new Date(),
      timerEndsAt: timerEndsAt,
      currentSession: activeSession ? {
        id: activeSession.sessionId,
        userId: user.id,
        wordId: activeSession.wordId,
        startedAt: activeSession.startedAt,
        score: 0,
        maxPossibleScore: activeSession.currentMaxScore,
        timerSkips: 0,
        tokenUsed: false,
        attempts: [],
      } : null,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('[game/status]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
