export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTodayBRT } from '@/lib/date'

const MAX_GROUPS = 3

function generateCode(): string {
  // Sem caracteres ambíguos (0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function getUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data } = await supabaseAdmin.from('groups').select('id').eq('code', code).single()
    if (!data) return code
  }
  throw new Error('Não foi possível gerar um código único')
}

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

// GET /api/groups — lista grupos do usuário com contagem de membros e ranking do dia
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: memberships } = await supabaseAdmin
      .from('group_members')
      .select('group_id, groups(id, name, code, created_by)')
      .eq('user_id', user.id)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ success: true, data: { groups: [] } })
    }

    const today = getTodayBRT()
    const groupIds = memberships.map(m => m.group_id)

    // Contagem de membros por grupo
    const { data: counts } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)

    const memberCount: Record<string, number> = {}
    for (const row of counts ?? []) {
      memberCount[row.group_id] = (memberCount[row.group_id] ?? 0) + 1
    }

    // Posição do usuário em cada grupo hoje
    const { data: userScores } = await supabaseAdmin
      .from('leaderboard_daily')
      .select('score')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    const groups = memberships.map(m => {
      const g = m.groups as unknown as { id: string; name: string; code: string; created_by: string } | null
      return {
        id: g?.id,
        name: g?.name,
        code: g?.code,
        isOwner: g?.created_by === user.id,
        memberCount: memberCount[m.group_id] ?? 1,
        myScoreToday: userScores?.score ?? null,
      }
    })

    return NextResponse.json({ success: true, data: { groups } })
  } catch (error) {
    console.error('[groups GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/groups — cria um grupo
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const name = (body.name ?? '').trim()
    if (!name || name.length > 30) {
      return NextResponse.json({ error: 'Nome inválido (1–30 caracteres)' }, { status: 400 })
    }

    // Verificar limite de grupos
    const { count } = await supabaseAdmin
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= MAX_GROUPS) {
      return NextResponse.json({ error: `Limite de ${MAX_GROUPS} grupos atingido` }, { status: 400 })
    }

    const code = await getUniqueCode()

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({ name, code, created_by: user.id })
      .select('id, name, code')
      .single()

    if (groupError || !group) {
      return NextResponse.json({ error: 'Erro ao criar grupo' }, { status: 500 })
    }

    await supabaseAdmin
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id })

    return NextResponse.json({ success: true, data: { group } })
  } catch (error) {
    console.error('[groups POST]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
