export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getIncansavelRanking, redis, keys, getTodayKey } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    // Auth opcional — se enviado, retorna posição e contagem do usuário
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      userId = user?.id ?? null
    }

    // Top 20 do dia por palavras acertadas
    const entries = await getIncansavelRanking(20)

    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        data: { leaderboard: [], userRank: null, userEntry: null },
      })
    }

    // Buscar usernames
    const userIds = entries.map(e => e.userId)
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .in('id', userIds)

    const usernameMap: Record<string, string> = {}
    for (const u of users ?? []) usernameMap[u.id] = u.username

    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      username: usernameMap[entry.userId] ?? 'Anônimo',
      wordsWon: entry.wordsWon,
      isCurrentUser: entry.userId === userId,
    }))

    // Posição do usuário se fora do top 20
    let userRank: number | null = null
    let userEntry: { rank: number; username: string; wordsWon: number } | null = null

    if (userId && !leaderboard.find(e => e.isCurrentUser)) {
      const rank = await redis.zrevrank(keys.rankingIncansavel(getTodayKey()), userId)
      if (rank !== null) {
        userRank = rank + 1
        const wordsWonRaw = await redis.zscore(keys.rankingIncansavel(getTodayKey()), userId)
        const { data: userProfile } = await supabaseAdmin
          .from('users').select('username').eq('id', userId).single()

        userEntry = {
          rank: userRank,
          username: userProfile?.username ?? 'Você',
          wordsWon: wordsWonRaw !== null ? Number(wordsWonRaw) : 0,
        }
      }
    }

    return NextResponse.json({ success: true, data: { leaderboard, userRank, userEntry } })
  } catch (error) {
    console.error('[incansavel/leaderboard]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
