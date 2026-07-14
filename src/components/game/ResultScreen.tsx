'use client'

import { useEffect, useState } from 'react'
import { Attempt, DailyFrase } from '@/types'
import { useNotifications } from '@/hooks/useNotifications'
import StatsModal from './StatsModal'

interface ResultScreenProps {
  won: boolean
  score: number
  attempts: Attempt[]
  streak: number
  correctWord?: string
  authToken?: string | null
  frase?: DailyFrase | null
  onClose: () => void
}

// Conta regressiva até às 03:00 UTC (meia-noite de Brasília)
function useNextWordCountdown(): string {
  const getSeconds = () => {
    const now = new Date()
    const next = new Date(now)
    next.setUTCHours(3, 0, 0, 0)
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1)
    }
    return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
  }

  const [secs, setSecs] = useState(getSeconds)

  useEffect(() => {
    const id = setInterval(() => setSecs(getSeconds()), 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Gera o grid de emojis para compartilhar
function buildShareText(attempts: Attempt[], won: boolean, score: number, streak: number, rank: number | null): string {
  const grid = attempts
    .map(a =>
      a.result
        .map(r =>
          r.status === 'correct' ? '🟩'
          : r.status === 'present' ? '🟨'
          : '⬛'
        )
        .join('')
    )
    .join('\n')

  const today = new Date().toLocaleDateString('pt-BR')

  let resultLine = won
    ? `✅ ${attempts.length}/6 tentativa${attempts.length > 1 ? 's' : ''} · +${score} pts`
    : `❌ Não acertei hoje`

  if (won && rank) resultLine += ` · *${rank}º lugar*`

  let challengeLine = ''
  if (won && rank && streak > 1) {
    challengeLine = `\n\n*🔥 ${streak} dias seguidos. Consegue me superar?*`
  } else if (won && rank) {
    challengeLine = `\n\n*Consegue me superar?*`
  } else if (won && streak > 1) {
    challengeLine = `\n\n*🔥 ${streak} dias seguidos. Entra e tenta me parar.*`
  }

  return `char[5] — ${today}\n${resultLine}${challengeLine}\n\n${grid}\n\nhttps://char5.com.br`
}

export default function ResultScreen({ won, score, attempts, streak, correctWord, authToken, frase, onClose }: ResultScreenProps) {
  const countdown = useNextWordCountdown()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userRank, setUserRank] = useState<number | null>(null)
  const [showStats, setShowStats] = useState(false)
  const { supported, subscribe } = useNotifications()

  // Entra com animação após um breve delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

  // Solicitar permissão de push diretamente ao browser na segunda partida concluída
  useEffect(() => {
    if (!supported || !authToken) return
    if (Notification.permission !== 'default') return // já decidido
    if (localStorage.getItem('char5_notif_asked')) return // já solicitado

    const count = parseInt(localStorage.getItem('char5_games_completed') || '0', 10) + 1
    localStorage.setItem('char5_games_completed', String(count))

    if (count >= 2) {
      localStorage.setItem('char5_notif_asked', '1')
      subscribe(authToken).then(ok => {
        window.gtag?.('event', ok ? 'notification_opted_in' : 'notification_permission_denied')
      })
    }
  }, [supported, authToken, subscribe])

  // Busca posição no ranking (só quando ganhou)
  useEffect(() => {
    if (!won || !authToken) return
    async function fetchRank() {
      try {
        const res = await fetch('/api/leaderboard', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const json = await res.json()
        if (!json.success) return
        const { leaderboard, userRank: rank } = json.data
        const inTop = leaderboard.find((e: { isCurrentUser: boolean; rank: number }) => e.isCurrentUser)
        setUserRank(inTop?.rank ?? rank ?? null)
      } catch { /* silencioso */ }
    }
    fetchRank()
  }, [won, authToken])

  async function handleShare() {
    const text = buildShareText(attempts, won, score, streak, userRank)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const useShare = typeof navigator.share === 'function' && isMobile

    try {
      if (useShare) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Usuário cancelou ou share falhou — tenta clipboard
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* silencioso */ }
    }
  }

  return (
    <>
    {/* Backdrop */}
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4
        transition-all duration-400 ease-out
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Overlay escuro — clique fora fecha */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div
        className={`relative w-full max-w-sm transition-all duration-400 ease-out
          ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl">

        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
            rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>

        {/* Título */}
        <div className="text-center">
          <div className="text-4xl mb-2">{won ? '🎉' : '😔'}</div>
          <h2 className="text-xl font-bold">
            {won ? 'Você acertou!' : 'Não foi dessa vez'}
          </h2>
          {!won && correctWord && (
            <p className="text-zinc-400 text-sm mt-1">
              A palavra era{' '}
              <span className="text-white font-bold tracking-widest">
                {correctWord}
              </span>
            </p>
          )}
        </div>

        {/* Pontuação final */}
        {won && (() => {
          const wrongAttempts = attempts.length - 1
          const totalPenalties = wrongAttempts === 0 ? 0 : 100 + 200 * (wrongAttempts - 1)
          const totalRecovered = wrongAttempts > 0 ? score - 1500 + totalPenalties : 0

          return (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Pontuação base</span>
                <span className="text-zinc-300">1.500</span>
              </div>
              {totalPenalties > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    {wrongAttempts} erro{wrongAttempts > 1 ? 's' : ''}
                  </span>
                  <span className="text-red-400">−{totalPenalties}</span>
                </div>
              )}
              {totalRecovered > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Recuperados por espera</span>
                  <span className="text-green-400">+{totalRecovered}</span>
                </div>
              )}
              <div className="border-t border-zinc-600 pt-2 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold text-green-400">+{score}</span>
              </div>
            </div>
          )
        })()}

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="text-2xl">🔥</span>
            <div>
              <span className="text-xl font-bold text-orange-400">{streak}</span>
              <span className="text-zinc-400 text-sm ml-1">
                dia{streak > 1 ? 's' : ''} seguido{streak > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Frase do dia */}
        {frase && (
          <div className="bg-zinc-900 rounded-xl px-4 py-3 space-y-1">
            <p className="text-zinc-300 text-sm italic leading-relaxed">
              &ldquo;{frase.texto}&rdquo;
            </p>
            {frase.tipo === 'ditado' && (
              <p className="text-zinc-600 text-xs">ditado popular</p>
            )}
            {frase.tipo === 'etimologia' && (
              <p className="text-zinc-600 text-xs">etimologia</p>
            )}
            {frase.tipo === 'improvisado' && (
              <p className="text-zinc-600 text-xs">ditado impopular</p>
            )}
          </div>
        )}

        {/* Próxima palavra */}
        <div className="text-center bg-zinc-900 rounded-xl py-3">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Uma palavra por dia · próxima em
          </p>
          <p className="text-2xl font-mono font-bold tabular-nums">{countdown}</p>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <a
            href="/leaderboard"
            className="flex-1 py-2.5 text-center text-sm text-zinc-400 border border-zinc-600
              rounded-lg hover:border-zinc-400 hover:text-white transition-colors"
          >
            Ranking
          </a>
          <button
            onClick={handleShare}
            className="flex-1 py-2.5 text-sm font-semibold bg-white text-zinc-900
              rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
          >
            {copied ? '✓ Copiado!' : 'Compartilhar'}
          </button>
        </div>

        {/* Estatísticas + Grupos */}
        <div className="flex gap-3">
          {authToken && (
            <button
              onClick={() => setShowStats(true)}
              className="flex-1 py-2.5 text-sm text-zinc-400 border border-zinc-700
                rounded-lg hover:border-zinc-500 hover:text-white transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Estatísticas
              </span>
            </button>
          )}
          <a
            href="/grupos"
            className="flex-1 py-2.5 text-center text-sm text-zinc-400 border border-zinc-700
              rounded-lg hover:border-zinc-500 hover:text-white transition-colors"
            onClick={() => window.gtag?.('event', 'group_page_opened', { source: 'result_screen' })}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Grupos
            </span>
          </a>
        </div>

        {/* Pesquisa de encerramento do projeto */}
        <a
          href="https://forms.gle/1jnyLdAaCLj1EWmb9"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => window.gtag?.('event', 'project_end_survey_clicked', { source: 'result_screen' })}
          className="block w-full py-3 text-center text-sm font-bold
            bg-green-600 hover:bg-green-500 text-white
            rounded-xl active:scale-95 transition-all shadow-lg"
        >
          Responda nossa pesquisa!
        </a>

        {/* Links secundários */}
        <div className="text-center text-xs text-zinc-600">
          <p>
            Quer praticar mais?{' '}
            <a href="/incansavel" className="text-zinc-400 hover:text-white underline transition-colors">
              Modo incansável
            </a>
          </p>
        </div>
      </div>
      </div>
    </div>

    {/* Modal de estatísticas */}
    {showStats && authToken && (
      <StatsModal authToken={authToken} onClose={() => setShowStats(false)} />
    )}
    </>
  )
}
