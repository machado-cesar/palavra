export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSession, getDailyFrase } from '@/lib/redis'
import { SCORING } from '@/types'
import { getTodayBRT } from '@/lib/date'

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

    // Buscar perfil do usuário — criar se não existir (trigger falha para anônimos sem email)
    let { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('current_streak, username_confirmed, username, tokens, last_played_at')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      const generated = 'Jogador' + Math.floor(Math.random() * 9000 + 1000)
      const { data: created } = await supabaseAdmin
        .from('users')
        .upsert({ id: user.id, username: generated })
        .select('current_streak, username_confirmed, username, tokens, last_played_at')
        .single()
      userProfile = created
    }

    const streak = userProfile?.current_streak ?? 0
    const usernameConfirmed = userProfile?.username_confirmed ?? false
    const tokens = userProfile?.tokens ?? 0

    // Detectar se o streak está em risco (faltou dia(s) e tem tokens disponíveis)
    const lastPlayedAt = userProfile?.last_played_at ?? null
    let streakAtRisk = false
    if (lastPlayedAt && streak > 0 && tokens > 0) {
      const lastDate = new Date(lastPlayedAt)
      const todayDate = new Date(getTodayBRT())
      const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000)
      if (diffDays >= 2) streakAtRisk = true
    }

    // Buscar palavra do dia
    const today = getTodayBRT()
    const { data: word } = await supabaseAdmin
      .from('words')
      .select('id')
      .eq('used_at', today)
      .single()

    // Verificar se já completou o jogo hoje
    if (word) {
      const { data: completedSession } = await supabaseAdmin
        .from('game_sessions')
        .select('id, score, won, attempts, timer_skips, max_possible_score')
        .eq('user_id', user.id)
        .eq('word_id', word.id)
        .not('completed_at', 'is', null)
        .single()

      if (completedSession) {
        const [{ data: wordData }, frase] = await Promise.all([
          supabaseAdmin.from('words').select('word').eq('id', word.id).single(),
          getDailyFrase(today),
        ])

        return NextResponse.json({
          success: true,
          data: {
            streak,
            tokens,
            username: userProfile?.username ?? '',
            usernameConfirmed,
            streakAtRisk: false,
            canPlay: false,
            timerEndsAt: null,
            currentSession: null,
            completedSession: {
              score: completedSession.score,
              won: completedSession.won,
              attempts: completedSession.attempts,
              timerSkips: completedSession.timer_skips,
              maxPossibleScore: completedSession.max_possible_score,
              correctWord: completedSession.won ? undefined : wordData?.word,
              frase: frase ?? null,
            },
          },
        })
      }
    }

    // Verificar sessão ativa em andamento
    const activeSession = await getActiveSession(user.id)

    // Buscar tentativas já realizadas no banco
    let existingAttempts: unknown[] = []
    if (activeSession) {
      const { data: dbSession } = await supabaseAdmin
        .from('game_sessions')
        .select('attempts')
        .eq('id', activeSession.sessionId)
        .single()

      existingAttempts = dbSession?.attempts || []
    }

    const isReturning = !!userProfile?.last_played_at

    return NextResponse.json({
      success: true,
      data: {
        streak,
        tokens,
        username: userProfile?.username ?? '',
        usernameConfirmed,
        streakAtRisk,
        isReturning,
        canPlay: true,
        timerEndsAt: null,
        completedSession: null,
        currentSession: activeSession ? {
          id: activeSession.sessionId,
          userId: user.id,
          wordId: activeSession.wordId,
          startedAt: activeSession.startedAt,
          score: 0,
          maxPossibleScore: activeSession.currentMaxScore,
          timerSkips: 0,
          tokenUsed: false,
          attempts: existingAttempts,
          recoveryStartedAt: activeSession.recoveryStartedAt ?? null,
        } : null,
      },
    })
  } catch (error) {
    console.error('[game/status]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
