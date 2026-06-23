export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTodayBRT } from '@/lib/date'

/**
 * GET /api/cron/daily-word
 *
 * Chamado pelo Vercel Cron às 03:00 UTC (= meia-noite BRT).
 * Seleciona uma palavra aleatória ainda não usada e define como palavra do dia.
 * Protegido por CRON_SECRET no header Authorization.
 */
export async function GET(request: NextRequest) {
  // Verificar segredo do cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const today = getTodayBRT()

    // Verificar se a palavra do dia já foi definida
    const { data: existing } = await supabaseAdmin
      .from('words')
      .select('id, word')
      .eq('used_at', today)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Palavra já definida para hoje',
        word: existing.word,
      })
    }

    // Buscar um pool de palavras ainda não usadas (priorizando dificuldade 1 e 2)
    const { data: pool, error } = await supabaseAdmin
      .from('words')
      .select('id, word, difficulty')
      .is('used_at', null)
      .eq('active', true)
      .in('difficulty', [1, 2])   // preferir palavras mais acessíveis
      .limit(100)

    if (error || !pool?.length) {
      // Fallback: tentar qualquer dificuldade
      const { data: fallback, error: fallbackError } = await supabaseAdmin
        .from('words')
        .select('id, word')
        .is('used_at', null)
        .eq('active', true)
        .limit(50)

      if (fallbackError || !fallback?.length) {
        console.error('[cron/daily-word] Nenhuma palavra disponível')
        return NextResponse.json(
          { error: 'Nenhuma palavra disponível. Banco esgotado?' },
          { status: 503 }
        )
      }

      const chosen = fallback[Math.floor(Math.random() * fallback.length)]
      await supabaseAdmin
        .from('words')
        .update({ used_at: today })
        .eq('id', chosen.id)

      console.log(`[cron/daily-word] Fallback — palavra do dia: ${chosen.word}`)
      await awardIncansavelTrophies(today)
      await sendPushNotifications(request)
      return NextResponse.json({ success: true, word: chosen.word })
    }

    // Escolher aleatoriamente do pool
    const chosen = pool[Math.floor(Math.random() * pool.length)]

    const { error: updateError } = await supabaseAdmin
      .from('words')
      .update({ used_at: today })
      .eq('id', chosen.id)

    if (updateError) {
      console.error('[cron/daily-word] Erro ao atualizar palavra:', updateError)
      return NextResponse.json({ error: 'Erro ao definir palavra' }, { status: 500 })
    }

    console.log(`[cron/daily-word] Palavra do dia: ${chosen.word} (dificuldade ${chosen.difficulty})`)

    // Premiar campeões do incansável de ontem
    await awardIncansavelTrophies(today)

    // Enviar push notifications para assinantes opt-in
    await sendPushNotifications(request)

    return NextResponse.json({
      success: true,
      word: chosen.word,
      difficulty: chosen.difficulty,
    })
  } catch (err) {
    console.error('[cron/daily-word]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * Premia os campeões do incansável de ontem.
 * today = data de hoje em BRT; ontem = today - 1 dia.
 * Idempotente: verifica incansavel_trophy_log antes de premiar.
 */
async function awardIncansavelTrophies(today: string): Promise<void> {
  try {
    // Calcular ontem
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    // Verificar se já foi premiado
    const { data: existing } = await supabaseAdmin
      .from('incansavel_trophy_log')
      .select('user_id')
      .eq('date', yesterday)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`[cron/trophies] ${yesterday} já premiado`)
      return
    }

    // Buscar o máximo de palavras de ontem
    const { data: completions } = await supabaseAdmin
      .from('incansavel_completions')
      .select('user_id, words_completed')
      .eq('date', yesterday)
      .order('words_completed', { ascending: false })

    if (!completions?.length) {
      console.log(`[cron/trophies] Nenhuma completion em ${yesterday}`)
      return
    }

    const maxWords = completions[0].words_completed
    if (maxWords === 0) return

    const winners = completions.filter(c => c.words_completed === maxWords)

    // Inserir no log e incrementar troféus
    await supabaseAdmin.from('incansavel_trophy_log').insert(
      winners.map(w => ({ date: yesterday, user_id: w.user_id, words_completed: w.words_completed }))
    )

    for (const winner of winners) {
      await supabaseAdmin.rpc('increment_incansavel_trophies', { uid: winner.user_id })
    }

    console.log(`[cron/trophies] ${yesterday}: ${winners.length} campeão(ões) com ${maxWords} palavras`)
  } catch (err) {
    console.warn('[cron/trophies] Erro ao premiar campeões:', err)
  }
}

/**
 * Dispara push notifications internamente após definir a palavra do dia.
 * Falhas aqui não abortam o cron — são apenas logadas.
 */
async function sendPushNotifications(request: NextRequest): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
    const res = await fetch(`${appUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        title: 'char[5] — nova palavra!',
        body: 'A palavra de hoje está disponível. Venha defender sua sequência.',
        url: '/game',
      }),
    })
    const data = await res.json()
    console.log(`[cron/daily-word] Push enviado: sent=${data.sent} expired=${data.expired}`)
  } catch (err) {
    console.warn('[cron/daily-word] Falha ao enviar push notifications:', err)
  }
}
