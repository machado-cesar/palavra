'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import { Attempt, GameStatus, LetterStatus } from '@/types'
import { normalizeWord } from '@/lib/words'
import { isValidPortugueseWord } from '@/lib/valid-words'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, { mode: 'incansavel', ...params })
}

export default function IncansavelPage() {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [currentLetters, setCurrentLetters] = useState<string[]>(['', '', '', '', ''])
  const [cursorPos, setCursorPos] = useState(0)
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterStatus>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [correctWord, setCorrectWord] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [lastWon, setLastWon] = useState(false)
  const [wordsWon, setWordsWon] = useState(0)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Auth ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initAuth() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setAuthToken(session.access_token)
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Erro ao criar sessão anônima:', error)
        setIsLoading(false)
        return
      }
      setAuthToken(data.session?.access_token ?? null)
    }

    initAuth()

    const supabase = getSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthToken(session?.access_token ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authToken) return
    startGame(authToken).finally(() => setIsLoading(false))
  }, [authToken])

  // ─── Iniciar partida ──────────────────────────────────────────────────────

  async function startGame(token: string) {
    setStatus('idle')
    setAttempts([])
    setCurrentLetters(['', '', '', '', ''])
    setCursorPos(0)
    setKeyboardState({})
    setCorrectWord(undefined)
    setShowResult(false)
    setLastWon(false)

    const res = await fetch('/api/free/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()

    if (!json.success) {
      setMessage(json.error || 'Erro ao iniciar modo incansável')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // Manter o wordsWon retornado pelo servidor (contador do dia)
    setWordsWon(json.data.wordsWon ?? 0)
    setStatus('playing')
    trackEvent('game_started', { wordsWon: json.data.wordsWon ?? 0 })
  }

  // ─── Teclado físico ──────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (status !== 'playing' || isSubmitting) return
      if (e.key === 'Enter') handleEnter()
      else if (e.key === 'Backspace') handleBackspace()
      else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) handleKey(e.key.toUpperCase())
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, currentLetters, cursorPos, attempts, isSubmitting])

  function handleKey(key: string) {
    setCurrentLetters(prev => {
      const next = [...prev]
      next[cursorPos] = key
      return next
    })
    setCursorPos(prev => Math.min(prev + 1, 4))
  }

  function handleBackspace() {
    if (currentLetters[cursorPos] !== '') {
      setCurrentLetters(prev => { const n = [...prev]; n[cursorPos] = ''; return n })
    } else if (cursorPos > 0) {
      setCursorPos(cursorPos - 1)
      setCurrentLetters(prev => { const n = [...prev]; n[cursorPos - 1] = ''; return n })
    }
  }

  function handleCellClick(col: number) { setCursorPos(col) }

  async function handleEnter() {
    const currentAttempt = currentLetters.join('')
    if (currentAttempt.length !== 5 || currentLetters.some(l => l === '')) {
      setMessage('A palavra precisa ter 5 letras')
      setTimeout(() => setMessage(''), 2000)
      return
    }
    if (!authToken || isSubmitting) return

    const normalized = normalizeWord(currentAttempt)
    if (!isValidPortugueseWord(normalized)) {
      setMessage('Palavra inválida')
      setTimeout(() => setMessage(''), 1500)
      return
    }

    setIsSubmitting(true)

    const res = await fetch('/api/free/attempt', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guess: normalized }),
    })

    const json = await res.json()
    setIsSubmitting(false)

    if (!json.success) {
      setMessage(json.error || 'Erro ao enviar tentativa')
      setTimeout(() => setMessage(''), 2000)
      return
    }

    const { result, won, gameOver, wordsWon: updatedCount } = json.data

    setAttempts(prev => [...prev, { word: normalized, result, timestamp: new Date().toISOString() }])
    setCurrentLetters(['', '', '', '', ''])
    setCursorPos(0)

    setKeyboardState(prev => {
      const updated = { ...prev }
      result.forEach(({ letter, status: s }: { letter: string; status: LetterStatus }) => {
        const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
        if (!updated[letter] || priority[s] > priority[updated[letter]]) updated[letter] = s
      })
      return updated
    })

    if (won || gameOver) {
      setWordsWon(updatedCount)
      setLastWon(won)
      if (!won && json.data.correctWord) setCorrectWord(json.data.correctWord)
      setStatus(won ? 'won' : 'lost')
      setShowResult(true)
      trackEvent('game_complete', { won, wordsWon: updatedCount })
    }
  }

  // ─── Share ────────────────────────────────────────────────────────────────

  async function handleShare() {
    const text = `char[5] · modo incansável\n\n${wordsWon} palavra${wordsWon !== 1 ? 's' : ''}. Sem parar.\nMe supera se conseguir.\n\nhttps://char5.com.br/incansavel`
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (typeof navigator.share === 'function' && isMobile) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setMessage('✓ Copiado!')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setMessage('✓ Copiado!')
        setTimeout(() => setMessage(''), 2000)
      } catch { /* silencioso */ }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-sm animate-pulse">Carregando...</div>
      </div>
    )
  }

  const gameOver = status === 'won' || status === 'lost'

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-4 pt-4 pb-2 gap-2 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-2">
        <div className="flex items-center gap-3">
          <a href="/game" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Diário
          </a>
          <span className="text-xl font-bold tracking-widest font-mono">
            char[5] <span className="text-zinc-500 text-sm font-normal">· incansável</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <a href="/incansavel/regras" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Regras
          </a>
          <a href="/incansavel/ranking" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Ranking
          </a>
        </nav>
      </header>

      {/* Contador de palavras do dia */}
      <div className="w-full flex items-center justify-center py-1">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
          <span className="text-zinc-400 text-sm">palavras hoje</span>
          <span className="text-2xl font-bold tabular-nums text-white">{wordsWon}</span>
        </div>
      </div>

      {/* Toasts */}
      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 bg-zinc-700 border border-zinc-500 rounded-full shadow-lg
          text-white text-sm font-medium pointer-events-none animate-[fadeIn_0.15s_ease]">
          {message}
        </div>
      )}
      {isSubmitting && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-full shadow-lg
          text-zinc-300 text-xs font-medium animate-pulse pointer-events-none">
          Verificando…
        </div>
      )}

      {/* Grid */}
      <div className="relative">
        <WordGrid
          attempts={attempts}
          currentLetters={currentLetters}
          cursorPos={cursorPos}
          gameOver={gameOver}
          onCellClick={status === 'playing' ? handleCellClick : undefined}
        />
      </div>

      {/* Tela de resultado */}
      {showResult && (
        <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-xl mx-auto mt-2">
          <div className="text-center space-y-1">
            <div className="text-3xl">{lastWon ? '🎉' : '😔'}</div>
            <h2 className="text-lg font-bold">{lastWon ? 'Acertou!' : 'Não foi dessa vez'}</h2>
            {!lastWon && correctWord && (
              <p className="text-zinc-400 text-sm">
                A palavra era{' '}
                <span className="text-white font-bold tracking-widest">{correctWord}</span>
              </p>
            )}
          </div>

          {/* Placar do dia */}
          <div className="text-center bg-zinc-900 rounded-xl py-3 px-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">palavras hoje</p>
            <p className="text-4xl font-bold tabular-nums">{wordsWon}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 text-sm text-zinc-400 border border-zinc-600
                rounded-lg hover:border-zinc-400 hover:text-white transition-colors"
            >
              Compartilhar
            </button>
            <button
              onClick={() => authToken && startGame(authToken)}
              className="flex-1 py-2.5 text-sm font-semibold bg-white text-zinc-900
                rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
            >
              Próxima palavra
            </button>
          </div>

          <a
            href="/game"
            className="block text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Voltar ao modo diário
          </a>
        </div>
      )}

      {/* Teclado */}
      {status === 'playing' && (
        <div className="w-full mt-auto pt-1">
          <Keyboard
            keyboardState={keyboardState}
            onKey={handleKey}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
            disabled={isSubmitting}
          />
        </div>
      )}
    </div>
  )
}
