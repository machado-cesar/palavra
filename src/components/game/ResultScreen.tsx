'use client'

import { useEffect, useState } from 'react'
import { Attempt } from '@/types'

interface ResultScreenProps {
  won: boolean
  score: number
  attempts: Attempt[]
  streak: number
  correctWord?: string
  authToken?: string | null
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

export default function ResultScreen({ won, score, attempts, streak, correctWord, authToken, onClose }: ResultScreenProps) {
  const countdown = useNextWordCountdown()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userRank, setUserRank] = useState<number | null>(null)

  // Entra com animação após um breve delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

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
    /* Backdrop */
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
        {won && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">
                {attempts.length === 1
                  ? 'Acertou de primeira!'
                  : `${attempts.length - 1} erro${attempts.length - 1 > 1 ? 's' : ''} · pontos recuperados incluídos`}
              </span>
            </div>
            <div className="border-t border-zinc-600 pt-2 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold text-green-400">+{score}</span>
            </div>
          </div>
        )}

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

        {/* Próxima palavra */}
        <div className="text-center bg-zinc-900 rounded-xl py-3">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Próxima palavra em
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
      </div>
      </div>
    </div>
  )
}
