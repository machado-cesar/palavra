'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import ScoreDisplay from '@/components/game/ScoreDisplay'
import RecoveryBar from '@/components/game/RecoveryBar'
import { Attempt, GameStatus, LetterStatus } from '@/types'
import { normalizeWord } from '@/lib/words'
import { isValidPortugueseWord } from '@/lib/valid-words'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, { mode: 'free', ...params })
}

export default function JogoLivrePage() {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [currentLetters, setCurrentLetters] = useState<string[]>(['', '', '', '', ''])
  const [cursorPos, setCursorPos] = useState(0)
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterStatus>>({})
  const [currentMaxScore, setCurrentMaxScore] = useState(1500)
  const [recoveryStartedAt, setRecoveryStartedAt] = useState<string | null>(null)
  const [recoveredPoints, setRecoveredPoints] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [correctWord, setCorrectWord] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [won, setWon] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const recoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recoveredPointsRef = useRef(0)

  // ─── Recovery interval ────────────────────────────────────────────────────

  useEffect(() => {
    if (recoveryIntervalRef.current) {
      clearInterval(recoveryIntervalRef.current)
      recoveryIntervalRef.current = null
    }

    if (!recoveryStartedAt) {
      recoveredPointsRef.current = 0
      setRecoveredPoints(0)
      return
    }

    function compute() {
      const elapsed = Math.floor((Date.now() - new Date(recoveryStartedAt!).getTime()) / 1000)
      return Math.min(elapsed, 100)
    }

    const initial = compute()
    recoveredPointsRef.current = initial
    setRecoveredPoints(initial)

    const interval = setInterval(() => {
      const pts = compute()
      recoveredPointsRef.current = pts
      setRecoveredPoints(pts)
      if (pts >= 100) {
        clearInterval(interval)
        recoveryIntervalRef.current = null
      }
    }, 1000)

    recoveryIntervalRef.current = interval
    return () => {
      clearInterval(interval)
      recoveryIntervalRef.current = null
    }
  }, [recoveryStartedAt])

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

  // ─── Iniciar ao obter token ───────────────────────────────────────────────

  useEffect(() => {
    if (!authToken) return
    startGame(authToken).finally(() => setIsLoading(false))
  }, [authToken])

  // ─── Iniciar jogo ─────────────────────────────────────────────────────────

  async function startGame(token: string) {
    setStatus('idle')
    setAttempts([])
    setCurrentLetters(['', '', '', '', ''])
    setCursorPos(0)
    setKeyboardState({})
    setCurrentMaxScore(1500)
    setRecoveryStartedAt(null)
    setRecoveredPoints(0)
    setCorrectWord(undefined)
    setShowResult(false)
    setWon(false)
    setFinalScore(0)

    const res = await fetch('/api/free/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()

    if (!json.success) {
      setMessage(json.error || 'Erro ao iniciar jogo livre')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setStatus('playing')
    trackEvent('game_started')
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
      setCurrentLetters(prev => {
        const next = [...prev]
        next[cursorPos] = ''
        return next
      })
    } else if (cursorPos > 0) {
      setCursorPos(cursorPos - 1)
      setCurrentLetters(prev => {
        const next = [...prev]
        next[cursorPos - 1] = ''
        return next
      })
    }
  }

  function handleCellClick(col: number) {
    setCursorPos(col)
  }

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

    // Cancela intervalo e captura valor de recovery
    if (recoveryIntervalRef.current) {
      clearInterval(recoveryIntervalRef.current)
      recoveryIntervalRef.current = null
    }
    const pointsToCommit = recoveredPointsRef.current
    recoveredPointsRef.current = 0
    setCurrentMaxScore(prev => prev + pointsToCommit)
    setRecoveryStartedAt(null)
    setRecoveredPoints(0)
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

    const { result, score, won: gameWon, gameOver } = json.data

    const newAttempt: Attempt = {
      word: normalized,
      result,
      timestamp: new Date().toISOString(),
    }
    setAttempts(prev => [...prev, newAttempt])
    setCurrentLetters(['', '', '', '', ''])
    setCursorPos(0)

    setKeyboardState(prev => {
      const updated = { ...prev }
      result.forEach(({ letter, status: s }: { letter: string; status: LetterStatus }) => {
        const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
        if (!updated[letter] || priority[s] > priority[updated[letter]]) {
          updated[letter] = s
        }
      })
      return updated
    })

    trackEvent('attempt_made', { won: gameWon, game_over: gameOver })

    if (gameWon) {
      setCurrentMaxScore(score)
      setFinalScore(score)
      setWon(true)
      setStatus('won')
      setShowResult(true)
      trackEvent('game_complete', { won: true, score, attempts: attempts.length + 1 })
    } else if (gameOver) {
      setFinalScore(0)
      setWon(false)
      setStatus('lost')
      if (json.data.correctWord) setCorrectWord(json.data.correctWord)
      setShowResult(true)
      trackEvent('game_complete', { won: false, score: 0, attempts: attempts.length + 1 })
    } else {
      setCurrentMaxScore(score)
      if (json.data.recoveryStartedAt) {
        setRecoveryStartedAt(json.data.recoveryStartedAt)
      }
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
          <a
            href="/game"
            className="text-zinc-400 hover:text-white text-sm transition-colors"
            aria-label="Voltar ao modo diário"
          >
            ← Diário
          </a>
          <span className="text-xl font-bold tracking-widest font-mono">
            char[5] <span className="text-zinc-500 text-sm font-normal">· livre</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a href="/como-jogar" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Regras
          </a>
        </div>
      </header>

      {/* Pontuação */}
      <ScoreDisplay currentMaxScore={currentMaxScore + recoveredPoints} />

      {/* Toasts */}
      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 bg-zinc-700 border border-zinc-500 rounded-full shadow-lg
          text-white text-sm font-medium pointer-events-none
          animate-[fadeIn_0.15s_ease]">
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

      {/* Tela de resultado inline — sem modal para o modo livre */}
      {showResult && (
        <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-xl mx-auto mt-2">
          <div className="text-center">
            <div className="text-3xl mb-1">{won ? '🎉' : '😔'}</div>
            <h2 className="text-lg font-bold">{won ? 'Acertou!' : 'Não foi dessa vez'}</h2>
            {!won && correctWord && (
              <p className="text-zinc-400 text-sm mt-1">
                A palavra era{' '}
                <span className="text-white font-bold tracking-widest">{correctWord}</span>
              </p>
            )}
            {won && (
              <p className="text-green-400 text-lg font-bold mt-1">+{finalScore} pts</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => authToken && startGame(authToken)}
              className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
                rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
            >
              Jogar de novo
            </button>
            <a
              href="/game"
              className="w-full py-2 text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Voltar ao modo diário
            </a>
          </div>
        </div>
      )}

      {/* Recovery bar */}
      {status === 'playing' && recoveryStartedAt && (
        <RecoveryBar recovered={recoveredPoints} />
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
