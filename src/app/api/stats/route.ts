export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export interface UserStats {
  jogadas: number
  vitorias: number
  pctVitorias: number
  streakAtual: number
  melhorStreak: number
  totalScore: number
  melhorScore: number
  mediaScore: number
  distribuicao: number[] // índice 0 = 1 tentativa, ..., índice 5 = 6 tentativas
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar dados do perfil
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('current_streak, max_streak, total_score')
      .eq('id', user.id)
      .single()

    // Buscar todas as sessões concluídas do usuário
    const { data: sessions } = await supabaseAdmin
      .from('game_sessions')
      .select('won, score, attempts')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)

    const jogadas = sessions?.length ?? 0
    const vitorias = sessions?.filter(s => s.won).length ?? 0
    const pctVitorias = jogadas > 0 ? Math.round((vitorias / jogadas) * 100) : 0

    // Distribuição de tentativas (apenas vitórias, 1–6)
    const distribuicao = [0, 0, 0, 0, 0, 0]
    for (const s of sessions ?? []) {
      if (s.won && Array.isArray(s.attempts)) {
        const n = s.attempts.length
        if (n >= 1 && n <= 6) distribuicao[n - 1]++
      }
    }

    // Métricas de pontuação (apenas vitórias)
    const scores = (sessions ?? []).filter(s => s.won && s.score > 0).map(s => s.score)
    const melhorScore = scores.length > 0 ? Math.max(...scores) : 0
    const mediaScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    const stats: UserStats = {
      jogadas,
      vitorias,
      pctVitorias,
      streakAtual: profile?.current_streak ?? 0,
      melhorStreak: profile?.max_streak ?? 0,
      totalScore: profile?.total_score ?? 0,
      melhorScore,
      mediaScore,
      distribuicao,
    }

    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('[stats]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
