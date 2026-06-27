'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Group {
  id: string
  name: string
  code: string
  isOwner: boolean
  memberCount: number
  myScoreToday: number | null
}

export default function GruposPage() {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // Formulários
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? null
      setAuthToken(token)
      if (token) fetchGroups(token)
      else setLoading(false)
    })
  }, [])

  // Evento GA4
  useEffect(() => {
    window.gtag?.('event', 'group_page_opened')
  }, [])

  async function fetchGroups(token: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setGroups(json.data.groups)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!authToken || !newName.trim()) return
    setCreating(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!json.success) {
        setErrorMsg(json.error ?? 'Erro ao criar grupo')
        return
      }
      window.gtag?.('event', 'group_created')
      window.gtag?.('set', 'user_properties', { in_group: 'true' })
      setNewName('')
      setSuccessMsg(`Grupo "${json.data.group.name}" criado! Código: ${json.data.group.code}`)
      await fetchGroups(authToken)
    } catch {
      setErrorMsg('Erro ao criar grupo')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!authToken || !joinCode.trim()) return
    setJoining(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const json = await res.json()
      if (!json.success) {
        setErrorMsg(json.error ?? 'Erro ao entrar no grupo')
        return
      }
      if (json.data.alreadyMember) {
        setSuccessMsg('Você já é membro desse grupo.')
      } else {
        window.gtag?.('event', 'group_joined')
        window.gtag?.('set', 'user_properties', { in_group: 'true' })
        setSuccessMsg(`Você entrou em "${json.data.group.name}"!`)
      }
      setJoinCode('')
      await fetchGroups(authToken)
    } catch {
      setErrorMsg('Erro ao entrar no grupo')
    } finally {
      setJoining(false)
    }
  }

  const atLimit = groups.length >= 3

  return (
    <main className="min-h-screen bg-zinc-900 text-white flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/game" className="text-zinc-500 hover:text-white transition-colors text-sm">← Voltar</a>
          <h1 className="text-lg font-bold tracking-widest font-mono">Grupos</h1>
        </div>

        {/* Meus grupos */}
        <section className="space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">
            Meus grupos ({groups.length}/3)
          </p>

          {loading && <p className="text-zinc-600 text-sm">Carregando…</p>}

          {!loading && groups.length === 0 && (
            <p className="text-zinc-600 text-sm">Você ainda não participa de nenhum grupo.</p>
          )}

          {groups.map(g => (
            <a
              key={g.id}
              href={`/grupos/${g.code}`}
              className="flex items-center justify-between bg-zinc-800 border border-zinc-700
                rounded-xl px-4 py-3 hover:border-zinc-500 transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{g.name}</p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {g.memberCount} membro{g.memberCount !== 1 ? 's' : ''} · código{' '}
                  <span className="font-mono text-zinc-400">{g.code}</span>
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-zinc-600">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          ))}
        </section>

        {/* Feedback */}
        {errorMsg && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg px-3 py-2">
            {successMsg}
          </p>
        )}

        {/* Criar grupo */}
        <section className="space-y-2 border-t border-zinc-800 pt-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Criar grupo</p>
          {atLimit ? (
            <p className="text-zinc-600 text-sm">Limite de 3 grupos atingido.</p>
          ) : (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome do grupo"
                maxLength={30}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm
                  placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg
                  hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? '…' : 'Criar'}
              </button>
            </form>
          )}
        </section>

        {/* Entrar por código */}
        <section className="space-y-2 border-t border-zinc-800 pt-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Entrar com código</p>
          {atLimit ? (
            <p className="text-zinc-600 text-sm">Limite de 3 grupos atingido.</p>
          ) : (
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                maxLength={6}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm
                  font-mono placeholder-zinc-600 tracking-widest uppercase
                  focus:outline-none focus:border-zinc-500 transition-colors"
              />
              <button
                type="submit"
                disabled={joining || joinCode.length < 6}
                className="px-4 py-2 bg-zinc-700 text-white text-sm font-semibold rounded-lg
                  hover:bg-zinc-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {joining ? '…' : 'Entrar'}
              </button>
            </form>
          )}
        </section>

      </div>
    </main>
  )
}
