export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('current_streak, tokens, last_played_at')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { current_streak, tokens, last_played_at } = userData

    // Validar: precisa ter token, streak ativo, e ter faltado um dia
    if (tokens <= 0) {
      return NextResponse.json({ error: 'Sem tokens disponíveis' }, { status: 400 })
    }
    if (current_streak <= 0) {
      return NextResponse.json({ error: 'Nenhum streak para restaurar' }, { status: 400 })
    }
    if (!last_played_at) {
      return NextResponse.json({ error: 'Nenhum jogo anterior registrado' }, { status: 400 })
    }

    const lastDate = new Date(last_played_at)
    const todayDate = new Date(new Date().toISOString().split('T')[0])
    const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000)

    if (diffDays < 2) {
      return NextResponse.json({ error: 'Streak não precisa de restauração' }, { status: 400 })
    }

    // Gastar token e marcar last_played_at como ontem
    // Isso faz com que o startGame veja apenas 1 dia de diferença → streak preservado
    const yesterday = new Date(todayDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        tokens: tokens - 1,
        last_played_at: yesterdayStr,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao restaurar streak' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        streak: current_streak,
        tokensLeft: tokens - 1,
      },
    })
  } catch (err) {
    console.error('[game/restore-streak]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
