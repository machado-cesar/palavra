import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Inicialização lazy — clientes só são criados quando chamados pela primeira vez,
// evitando erro de "supabaseUrl is required" durante o build do Next.js.

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

// Cliente para uso no browser (componentes e client-side)
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Variáveis de ambiente do Supabase não configuradas')
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Cliente com privilégios de admin — usar apenas em API Routes (server-side)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) throw new Error('Variáveis de ambiente do Supabase Admin não configuradas')
    _supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _supabaseAdmin
}

// Atalhos para compatibilidade com código existente
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  }
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop]
  }
})
