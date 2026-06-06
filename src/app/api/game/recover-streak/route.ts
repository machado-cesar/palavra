export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
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
    const { prevStreak } = body

    if (!prevStreak || prevStreak <= 0) {
      return NextResponse.json({ error: 'Streak inválido' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('tokens, last_played_at, current_streak')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Validações: precisa ter token e ter jogado hoje (streak foi resetado nesta sessão)
    if (userData.tokens <= 0) {
      return NextResponse.json({ error: 'Sem tokens disponíveis' }, { status: 400 })
    }

    const today = getTodayBRT()
    if (userData.last_played_at !== today) {
      return NextResponse.json({ error: 'Recuperação só é possível no mesmo dia da partida' }, { status: 400 })
    }

    // Gastar token e restaurar streak ao valor anterior
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        tokens: userData.tokens - 1,
        current_streak: prevStreak,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao recuperar streak' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        streak: prevStreak,
        tokensLeft: userData.tokens - 1,
      },
    })
  } catch (err) {
    console.error('[game/recover-streak]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
