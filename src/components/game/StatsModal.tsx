'use client'

import { useEffect, useState } from 'react'
import type { UserStats } from '@/app/api/stats/route'

interface StatsModalProps {
  authToken: string
  onClose: () => void
}

export default function StatsModal({ authToken, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Evento GA4
    window.gtag?.('event', 'stats_opened')

    fetch('/api/stats', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) setStats(json.data)
      })
      .catch(() => {/* silencioso */})
      .finally(() => setLoading(false))
  }, [authToken])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const maxDist = stats ? Math.max(...stats.distribuicao, 1) : 1

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative w-full max-w-sm transition-all duration-300 ease-out
          ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-2xl space-y-5">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">
              Estatísticas
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full
                text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {loading && (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando…</p>
          )}

          {!loading && stats && (
            <>
              {/* Métricas principais */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Jogadas', value: stats.jogadas },
                  { label: '% Vitórias', value: stats.pctVitorias },
                  { label: 'Streak', value: stats.streakAtual },
                  { label: 'Melhor', value: stats.melhorStreak },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-2xl font-bold tabular-nums">{value}</div>
                    <div className="text-zinc-500 text-xs mt-0.5 leading-tight">{label}</div>
                  </div>
                ))}
              </div>

              {/* Métricas de pontuação */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-zinc-700 pt-4">
                {[
                  { label: 'Total acumulado', value: stats.totalScore.toLocaleString('pt-BR') },
                  { label: 'Melhor partida', value: stats.melhorScore.toLocaleString('pt-BR') },
                  { label: 'Média', value: stats.mediaScore.toLocaleString('pt-BR') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-lg font-bold tabular-nums">{value}</div>
                    <div className="text-zinc-500 text-xs mt-0.5 leading-tight">{label}</div>
                  </div>
                ))}
              </div>

              {/* Distribuição de tentativas */}
              <div className="border-t border-zinc-700 pt-4 space-y-1.5">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">
                  Distribuição de tentativas
                </p>
                {stats.distribuicao.map((count, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-zinc-400 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="h-5 rounded bg-zinc-600 flex items-center justify-end pr-2 transition-all duration-500 min-w-[1.25rem]"
                        style={{ width: `${Math.max((count / maxDist) * 100, 8)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !stats && (
            <p className="text-center text-zinc-500 text-sm py-6">
              Não foi possível carregar as estatísticas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
