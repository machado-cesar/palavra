export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/notifications/send
 *
 * Envia push notification para todos os assinantes.
 * Protegida por CRON_SECRET — uso interno apenas (chamada pelo cron daily-word).
 * Body: { title?: string, body?: string, url?: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('[notifications/send] VAPID keys não configuradas')
    return NextResponse.json({ error: 'VAPID não configurado' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  try {
    const body = await request.json()
    const payload = JSON.stringify({
      title: body.title || 'char[5] — nova palavra!',
      body: body.body || 'A palavra de hoje está disponível. Venha defender sua sequência.',
      url: body.url || '/game',
    })

    // Buscar todos os usuários com subscription ativa
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, push_subscription')
      .not('push_subscription', 'is', null)

    if (error) {
      console.error('[notifications/send] Erro ao buscar assinantes:', error)
      return NextResponse.json({ error: 'Erro ao buscar assinantes' }, { status: 500 })
    }

    if (!users?.length) {
      return NextResponse.json({ success: true, sent: 0, message: 'Nenhum assinante' })
    }

    let sent = 0
    let failed = 0
    const expiredIds: string[] = []

    await Promise.allSettled(
      users.map(async u => {
        try {
          await webpush.sendNotification(u.push_subscription, payload)
          sent++
        } catch (err: unknown) {
          const pushErr = err as { statusCode?: number }
          // 410 Gone = subscription expirada ou cancelada pelo browser
          if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
            expiredIds.push(u.id)
          } else {
            console.warn(`[notifications/send] Falha para ${u.id}:`, pushErr?.statusCode)
            failed++
          }
        }
      })
    )

    // Limpar subscriptions expiradas
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from('users')
        .update({ push_subscription: null })
        .in('id', expiredIds)
      console.log(`[notifications/send] ${expiredIds.length} subscriptions expiradas removidas`)
    }

    console.log(`[notifications/send] sent=${sent} failed=${failed} expired=${expiredIds.length}`)
    return NextResponse.json({ success: true, sent, failed, expired: expiredIds.length })
  } catch (err) {
    console.error('[notifications/send]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
