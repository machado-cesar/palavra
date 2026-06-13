export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/notifications/subscribe
 *
 * Salva ou remove a subscription push do usuário autenticado.
 * Body: { subscription: PushSubscriptionJSON | null }
 * - subscription != null → opt-in: salva no banco
 * - subscription == null → opt-out: zera no banco
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { subscription } = body

    const { error } = await supabaseAdmin
      .from('users')
      .update({ push_subscription: subscription ?? null })
      .eq('id', user.id)

    if (error) {
      console.error('[notifications/subscribe]', error)
      return NextResponse.json({ error: 'Erro ao salvar subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/subscribe]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
