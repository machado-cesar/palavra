export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRanking, getUserRank } from '@/lib/redis'
import { getTodayBRT } from '@/lib/date'

export async function GET(request: NextRequest) {
  try {
    // Auth opcional — se enviado, retorna posição do usuário
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      userId = user?.id ?? null
    }

    // Top 20 do dia
    const entries = await getRanking('daily', 20)

    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        data: { leaderboard: [], userRank: null, userEntry: null },
      })
    }

    // Buscar usernames no Supabase
    const userIds = entries.map(e => e.userId)
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .in('id', userIds)

    const usernameMap: Record<string, string> = {}
    for (const u of users ?? []) {
      usernameMap[u.id] = u.username
    }

    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      username: usernameMap[entry.userId] ?? 'Anônimo',
      score: entry.score,
      isCurrentUser: entry.userId === userId,
    }))

    // Posição do usuário logado (se não estiver no top 20)
    let userRank: number | null = null
    let userEntry: { rank: number; username: string; score: number } | null = null

    if (userId) {
      const inTop = leaderboard.find(e => e.isCurrentUser)
      if (!inTop) {
        userRank = await getUserRank(userId, 'daily')
        if (userRank !== null) {
          const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('username')
            .eq('id', userId)
            .single()

          // Buscar score do usuário no ranking
          const { data: sessionData } = await supabaseAdmin
            .from('leaderboard_daily')
            .select('score')
            .eq('user_id', userId)
            .eq('date', getTodayBRT())
            .single()

          userEntry = {
            rank: userRank,
            username: userProfile?.username ?? 'Você',
            score: sessionData?.score ?? 0,
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { leaderboard, userRank, userEntry },
    })
  } catch (error) {
    console.error('[leaderboard]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
