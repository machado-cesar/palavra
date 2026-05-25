export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const USERNAME_REGEX = /^[a-zA-Z0-9_À-ÿ]{3,15}$/

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { username } = body

    if (!username || !USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Apelido inválido. Use 3–15 caracteres (letras, números ou _).' },
        { status: 400 }
      )
    }

    // Verificar se já está em uso
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Apelido já em uso.' }, { status: 409 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ username, username_confirmed: true })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar apelido.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, username })
  } catch (err) {
    console.error('[user/username]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
