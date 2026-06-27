export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTodayBRT } from '@/lib/date'

// GET /api/groups/[code] — info do grupo + ranking diário dos membros
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase()

    // Auth opcional — identifica o usuário atual no ranking
    let userId: string | null = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      userId = user?.id ?? null
    }

    // Buscar grupo
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, name, code, created_by, created_at')
      .eq('code', code)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
    }

    // Buscar membros
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)

    const memberIds = (members ?? []).map(m => m.user_id)

    // Usernames dos membros
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .in('id', memberIds)

    const usernameMap: Record<string, string> = {}
    for (const u of users ?? []) usernameMap[u.id] = u.username

    // Scores do dia
    const today = getTodayBRT()
    const { data: scores } = await supabaseAdmin
      .from('leaderboard_daily')
      .select('user_id, score')
      .in('user_id', memberIds)
      .eq('date', today)

    const scoreMap: Record<string, number> = {}
    for (const s of scores ?? []) scoreMap[s.user_id] = s.score

    // Montar ranking: membros com score primeiro (desc), depois sem score
    const ranked = memberIds
      .map(id => ({
        userId: id,
        username: usernameMap[id] ?? 'Anônimo',
        score: scoreMap[id] ?? null,
        isCurrentUser: id === userId,
      }))
      .sort((a, b) => {
        if (a.score !== null && b.score !== null) return b.score - a.score
        if (a.score !== null) return -1
        if (b.score !== null) return 1
        return 0
      })
      .map((entry, index) => ({
        ...entry,
        rank: entry.score !== null ? index + 1 : null,
      }))

    const isMember = userId ? memberIds.includes(userId) : false

    return NextResponse.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          code: group.code,
          createdAt: group.created_at,
          isOwner: group.created_by === userId,
          memberCount: memberIds.length,
        },
        isMember,
        leaderboard: ranked,
        date: today,
      },
    })
  } catch (error) {
    console.error('[groups/[code]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
