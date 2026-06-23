'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface RankingEntry {
  rank: number
  username: string
  trophies: number
  wordsWon: number
  isCurrentUser: boolean
}

interface RankingData {
  leaderboard: RankingEntry[]
  userRank: number | null
  userEntry: { rank: number; username: string; trophies: number; wordsWon: number } | null
}

function TrophyBadge({ count }: { count: number }) {
  if (!count) return null
  const sup = count.toString().split('').map(d =>
    '⁰¹²³⁴⁵⁶⁷⁸⁹'[parseInt(d)]
  ).join('')
  return (
    <span className="ml-1.5 text-yellow-400 text-base leading-none" title={`${count} dia${count !== 1 ? 's' : ''} campeão`}>
      🏆{sup}
    </span>
  )
}

function getRankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export default function IncansavelRankingPage() {
  const [data, setData] = useState<RankingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchRanking() {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()

        const headers: Record<string, string> = {}
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        const res = await fetch('/api/incansavel/leaderboard', { headers })
        const json = await res.json()

        if (!json.success) { setError('Erro ao carregar ranking.'); return }
        setData(json.data)
      } catch {
        setError('Erro ao carregar ranking.')
      } finally {
        setLoading(false)
      }
    }
    fetchRanking()
  }, [])

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 gap-6 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-3">
        <div className="flex items-center gap-3">
          <a href="/incansavel" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Incansável
          </a>
          <span className="text-xl font-bold tracking-widest font-mono">
            char[5] <span className="text-zinc-500 text-sm font-normal">· incansável</span>
          </span>
        </div>
      </header>

      {/* Título */}
      <div className="w-full text-center space-y-1">
        <h1 className="text-xl font-bold">Ranking — Modo Incansável</h1>
        <p className="text-zinc-500 text-sm capitalize">{today}</p>
        <p className="text-zinc-600 text-xs">Palavras acertadas hoje</p>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-zinc-400 text-sm animate-pulse mt-8">Carregando...</div>
      ) : error ? (
        <div className="text-red-400 text-sm mt-8">{error}</div>
      ) : !data || data.leaderboard.length === 0 ? (
        <div className="flex flex-col items-center gap-3 mt-8 text-center">
          <div className="text-4xl">🏜️</div>
          <p className="text-zinc-400 text-sm">Ninguém jogou ainda hoje.</p>
          <p className="text-zinc-600 text-xs">Seja o primeiro a aparecer aqui!</p>
          <a
            href="/incansavel"
            className="mt-2 px-5 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Jogar agora
          </a>
        </div>
      ) : (
        <div className="w-full space-y-2">
          {data.leaderboard.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                ${entry.isCurrentUser
                  ? 'bg-zinc-700 border-zinc-500 ring-1 ring-zinc-400'
                  : 'bg-zinc-800/60 border-zinc-700/50'
                }`}
            >
              {/* Rank */}
              <div className="w-10 text-center text-sm font-bold tabular-nums shrink-0">
                {entry.rank <= 3
                  ? <span className="text-lg">{getRankIcon(entry.rank)}</span>
                  : <span className="text-zinc-400">{getRankIcon(entry.rank)}</span>
                }
              </div>

              {/* Nome */}
              <div className="flex-1 truncate flex items-center">
                <span className={`text-sm font-medium ${entry.isCurrentUser ? 'text-white' : 'text-zinc-200'}`}>
                  {entry.username}
                </span>
                <TrophyBadge count={entry.trophies} />
                {entry.isCurrentUser && (
                  <span className="ml-2 text-xs text-zinc-400 font-normal">você</span>
                )}
              </div>

              {/* Palavras */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-lg font-bold tabular-nums text-white">{entry.wordsWon}</span>
                <span className="text-xs text-zinc-500">
                  palavra{entry.wordsWon !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}

          {/* Posição do usuário fora do top 20 */}
          {data.userEntry && !data.leaderboard.some(e => e.isCurrentUser) && (
            <>
              <div className="text-center text-zinc-600 text-xs py-1">• • •</div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-zinc-700 border-zinc-500 ring-1 ring-zinc-400">
                <div className="w-10 text-center text-sm font-bold text-zinc-400 tabular-nums shrink-0">
                  #{data.userEntry.rank}
                </div>
                <div className="flex-1 truncate flex items-center">
                  <span className="text-sm font-medium text-white">
                    {data.userEntry.username}
                  </span>
                  <TrophyBadge count={data.userEntry.trophies} />
                  <span className="ml-2 text-xs text-zinc-400 font-normal">você</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-lg font-bold tabular-nums text-white">{data.userEntry.wordsWon}</span>
                  <span className="text-xs text-zinc-500">
                    palavra{data.userEntry.wordsWon !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CTA */}
      {data && data.leaderboard.length > 0 && (
        <a
          href="/incansavel"
          className="mt-auto w-full py-2.5 text-center text-sm font-semibold bg-zinc-800 hover:bg-zinc-700
            border border-zinc-700 rounded-xl text-zinc-200 transition-colors"
        >
          ← Voltar ao jogo
        </a>
      )}
    </div>
  )
}
