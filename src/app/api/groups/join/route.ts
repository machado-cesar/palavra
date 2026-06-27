export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_GROUPS = 3

// POST /api/groups/join — entra em um grupo pelo código
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const code = (body.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'Código inválido' }, { status: 400 })

    // Buscar grupo pelo código
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, name, code')
      .eq('code', code)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
    }

    // Verificar se já é membro
    const { data: existing } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, data: { group, alreadyMember: true } })
    }

    // Verificar limite de grupos
    const { count } = await supabaseAdmin
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= MAX_GROUPS) {
      return NextResponse.json({ error: `Limite de ${MAX_GROUPS} grupos atingido` }, { status: 400 })
    }

    await supabaseAdmin
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })

    return NextResponse.json({ success: true, data: { group, alreadyMember: false } })
  } catch (error) {
    console.error('[groups/join]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
