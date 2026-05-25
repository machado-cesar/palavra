export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTimer, getActiveSession } from '@/lib/redis'

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
      .select('current_streak, username_confirmed, username')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      const generated = 'Jogador' + Math.floor(Math.random() * 9000 + 1000)
      const { data: created } = await supabaseAdmin
        .from('users')
        .upsert({ id: user.id, username: generated })
        .select('current_streak, username_confirmed, username')
        .single()
      userProfile = created
    }

    const streak = userProfile?.current_streak ?? 0
    const usernameConfirmed = userProfile?.username_confirmed ?? false

    // Buscar palavra do dia
    const today = new Date().toISOString().split('T')[0]
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
        // Buscar a palavra para revelar se o jogador perdeu
        const { data: wordData } = await supabaseAdmin
          .from('words')
          .select('word')
          .eq('id', word.id)
          .single()

        return NextResponse.json({
          success: true,
          data: {
            streak,
            usernameConfirmed,
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
            },
          },
        })
      }
    }

    // Verificar timer ativo
    const timerEndsAt = await getTimer(user.id)

    // Verificar sessão ativa em andamento
    const activeSession = await getActiveSession(user.id)

    // Buscar tentativas já realizadas no banco
    let existingAttempts: unknown[] = []
    let timerSkips = 0
    if (activeSession) {
      const { data: dbSession } = await supabaseAdmin
        .from('game_sessions')
        .select('attempts, timer_skips')
        .eq('id', activeSession.sessionId)
        .single()

      existingAttempts = dbSession?.attempts || []
      timerSkips = dbSession?.timer_skips || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        streak,
        usernameConfirmed,
        canPlay: !timerEndsAt || new Date(timerEndsAt) <= new Date(),
        timerEndsAt: timerEndsAt,
        completedSession: null,
        currentSession: activeSession ? {
          id: activeSession.sessionId,
          userId: user.id,
          wordId: activeSession.wordId,
          startedAt: activeSession.startedAt,
          score: 0,
          maxPossibleScore: activeSession.currentMaxScore,
          timerSkips: timerSkips,
          tokenUsed: false,
          attempts: existingAttempts,
        } : null,
      },
    })
  } catch (error) {
    console.error('[game/status]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
