'use client'

import { use, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface RankEntry {
  userId: string
  username: string
  score: number | null
  rank: number | null
  isCurrentUser: boolean
}

interface GroupData {
  group: {
    id: string
    name: string
    code: string
    createdAt: string
    isOwner: boolean
    memberCount: number
  }
  isMember: boolean
  leaderboard: RankEntry[]
  date: string
}

export default function GroupRankingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [data, setData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: s }) => {
      const token = s.session?.access_token ?? null
      setAuthToken(token)
      fetchGroup(token)
    })
  }, [code])

  useEffect(() => {
    window.gtag?.('event', 'group_ranking_opened')
  }, [])

  async function fetchGroup(token: string | null) {
    setLoading(true)
    try {
      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/groups/${code}`, { headers })
      if (res.status === 404) { setNotFound(true); return }
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  async function handleJoin() {
    if (!authToken) return
    setJoining(true)
    setJoinError('')
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code: code }),
      })
      const json = await res.json()
      if (!json.success) { setJoinError(json.error ?? 'Erro ao entrar'); return }
      window.gtag?.('event', 'group_joined')
      window.gtag?.('set', 'user_properties', { in_group: 'true' })
      await fetchGroup(authToken)
    } catch {
      setJoinError('Erro ao entrar no grupo')
    } finally {
      setJoining(false)
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/grupos/${code}`
    navigator.clipboard.writeText(url).then(() => {
      window.gtag?.('event', 'group_link_copied')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const today = data?.date
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : ''

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Carregando…</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Grupo não encontrado.</p>
        <a href="/grupos" className="text-sm text-zinc-500 hover:text-white transition-colors">← Meus grupos</a>
      </main>
    )
  }

  if (!data) return null

  const { group, isMember, leaderboard } = data
  const playedToday = leaderboard.filter(e => e.score !== null)
  const notPlayedToday = leaderboard.filter(e => e.score === null)

  return (
    <main className="min-h-screen bg-zinc-900 text-white flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/grupos" className="text-zinc-500 hover:text-white transition-colors text-sm">← Grupos</a>
        </div>

        {/* Info do grupo */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{group.name}</h1>
          <p className="text-zinc-500 text-sm">
            {group.memberCount} membro{group.memberCount !== 1 ? 's' : ''} · código{' '}
            <span className="font-mono text-zinc-400 tracking-widest">{group.code}</span>
          </p>
        </div>

        {/* Ações */}
        <div className="flex gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 py-2 text-sm font-semibold bg-zinc-700 text-white
              rounded-lg hover:bg-zinc-600 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {copied ? 'Copiado!' : 'Convidar'}
          </button>
          {!isMember && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 py-2 text-sm font-semibold bg-white text-zinc-900
                rounded-lg hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-40"
            >
              {joining ? '…' : 'Entrar no grupo'}
            </button>
          )}
        </div>

        {joinError && (
          <p className="text-red-400 text-sm">{joinError}</p>
        )}

        {/* Ranking do dia */}
        <section className="space-y-2 border-t border-zinc-800 pt-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider">
            Ranking de hoje · {today}
          </p>

          {leaderboard.length === 0 && (
            <p className="text-zinc-600 text-sm">Nenhum membro ainda.</p>
          )}

          {/* Jogaram hoje */}
          {playedToday.map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                ${entry.isCurrentUser
                  ? 'bg-zinc-700 border-zinc-600'
                  : 'bg-zinc-800 border-zinc-700'}`}
            >
              <span className="text-zinc-400 font-mono text-sm w-5 text-right shrink-0">
                {entry.rank}º
              </span>
              <span className={`flex-1 text-sm font-medium truncate ${entry.isCurrentUser ? 'text-white' : 'text-zinc-300'}`}>
                {entry.username}
                {entry.isCurrentUser && <span className="text-zinc-500 font-normal ml-1">(você)</span>}
              </span>
              <span className="text-sm font-bold tabular-nums text-green-400">
                {entry.score?.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}

          {/* Não jogaram hoje */}
          {notPlayedToday.length > 0 && (
            <>
              {playedToday.length > 0 && <div className="border-t border-zinc-800 my-1" />}
              {notPlayedToday.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800
                    ${entry.isCurrentUser ? 'bg-zinc-800' : 'bg-zinc-900'}`}
                >
                  <span className="text-zinc-700 font-mono text-sm w-5 text-right shrink-0">—</span>
                  <span className="flex-1 text-sm text-zinc-600 truncate">
                    {entry.username}
                    {entry.isCurrentUser && <span className="ml-1">(você)</span>}
                  </span>
                  <span className="text-xs text-zinc-700">não jogou</span>
                </div>
              ))}
            </>
          )}
        </section>

        {/* Link para jogar */}
        <p className="text-center text-xs text-zinc-600 pt-2">
          <a href="/game" className="text-zinc-500 hover:text-white underline transition-colors">
            Jogar agora →
          </a>
        </p>

      </div>
    </main>
  )
}
