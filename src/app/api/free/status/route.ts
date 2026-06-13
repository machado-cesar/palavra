export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFreeSession } from '@/lib/redis'

/**
 * GET /api/free/status
 *
 * Verifica se há uma sessão livre ativa para o usuário.
 * Retorna o estado atual da sessão (tentativas, score) sem revelar a palavra.
 */
export async function GET(request: NextRequest) {
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
    const session = await getFreeSession(user.id)

    if (!session) {
      return NextResponse.json({ success: true, data: { hasActiveSession: false } })
    }

    return NextResponse.json({
      success: true,
      data: {
        hasActiveSession: true,
        attemptsCount: session.attemptsCount,
        maxPossibleScore: session.currentMaxScore,
        recoveryStartedAt: session.recoveryStartedAt,
      },
    })
  } catch (err) {
    console.error('[free/status]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
