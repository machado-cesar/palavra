'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import ScoreDisplay from '@/components/game/ScoreDisplay'
import TimerBar from '@/components/game/TimerBar'
import SkipModal from '@/components/game/SkipModal'
import { Attempt, GameStatus, LetterStatus, SCORING } from '@/types'
import { normalizeWord } from '@/lib/words'

// ─── Helpers de evento GA ─────────────────────────────────────────────────────

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GamePage() {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [currentAttempt, setCurrentAttempt] = useState('')
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterStatus>>({})
  const [currentMaxScore, setCurrentMaxScore] = useState(SCORING.MAX_SCORE)
  const [timerEndsAt, setTimerEndsAt] = useState<string | null>(null)
  const [skips, setSkips] = useState(0)
  const [showSkipModal, setShowSkipModal] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [message, setMessage] = useState('')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Auth anônimo automático ───────────────────────────────────────────────

  useEffect(() => {
    async function initAuth() {
      const supabase = getSupabase()

      // Verificar se já tem sessão ativa
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setAuthToken(session.access_token)
        setIsLoading(false)
        return
      }

      // Criar sessão anônima automaticamente
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Erro ao criar sessão anônima:', error)
        setIsLoading(false)
        return
      }

      setAuthToken(data.session?.access_token ?? null)
      setIsLoading(false)
    }

    initAuth()

    // Ouvir mudanças de sessão
    const supabase = getSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthToken(session?.access_token ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ─── Verificar status do jogo ao carregar ──────────────────────────────────

  useEffect(() => {
    if (!authToken) return

    async function fetchStatus() {
      const res = await fetch('/api/game/status', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      const json = await res.json()
      if (!json.success) return

      const { timerEndsAt: timer, currentSession } = json.data

      if (timer && new Date(timer) > new Date()) {
        setTimerEndsAt(timer)
        setStatus('waiting_timer')
        if (currentSession) setCurrentMaxScore(currentSession.maxPossibleScore)
      } else if (currentSession) {
        setStatus('playing')
        setCurrentMaxScore(currentSession.maxPossibleScore)
      }
    }

    fetchStatus()
  }, [authToken])

  // ─── Iniciar jogo ──────────────────────────────────────────────────────────

  async function startGame() {
    if (!authToken) return
    setIsLoading(true)

    const res = await fetch('/api/game/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const json = await res.json()
    setIsLoading(false)

    if (!json.success) {
      setMessage(json.error || 'Erro ao iniciar jogo')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setStatus('playing')
    setAttempts([])
    setCurrentAttempt('')
    setKeyboardState({})
    setCurrentMaxScore(SCORING.MAX_SCORE)
    setSkips(0)
    trackEvent('game_started')
  }

  // ─── Teclado físico ───────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (status !== 'playing') return
      if (e.key === 'Enter') handleEnter()
      else if (e.key === 'Backspace') handleBackspace()
      else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) handleKey(e.key.toUpperCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, currentAttempt, attempts])

  // ─── Handlers de input ─────────────────────────────────────────────────────

  function handleKey(key: string) {
    if (currentAttempt.length < 5) {
      setCurrentAttempt(prev => prev + key)
    }
  }

  function handleBackspace() {
    setCurrentAttempt(prev => prev.slice(0, -1))
  }

  async function handleEnter() {
    if (currentAttempt.length !== 5) {
      setMessage('A palavra precisa ter 5 letras')
      setTimeout(() => setMessage(''), 2000)
      return
    }

    if (!authToken) return

    const normalized = normalizeWord(currentAttempt)

    const res = await fetch('/api/game/attempt', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guess: normalized }),
    })

    const json = await res.json()
    if (!json.success) {
      setMessage(json.error || 'Erro ao enviar tentativa')
      setTimeout(() => setMessage(''), 2000)
      return
    }

    const { result, score, won, gameOver, timerEndsAt: timer } = json.data

    const newAttempt: Attempt = {
      word: normalized,
      result,
      timestamp: new Date().toISOString(),
    }
    setAttempts(prev => [...prev, newAttempt])
    setCurrentAttempt('')

    setKeyboardState(prev => {
      const updated = { ...prev }
      result.forEach(({ letter, status }: { letter: string; status: LetterStatus }) => {
        const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
        if (!updated[letter] || priority[status] > priority[updated[letter]]) {
          updated[letter] = status
        }
      })
      return updated
    })

    trackEvent('attempt_made', { won, game_over: gameOver })

    if (won) {
      setCurrentMaxScore(score)
      setStatus('won')
      setMessage(`Parabéns! +${score} pontos`)
      trackEvent('game_won', { score, attempts: attempts.length + 1 })
    } else if (gameOver) {
      setStatus('lost')
      setMessage('Que pena! Tente novamente amanhã.')
      trackEvent('game_lost', { attempts: attempts.length + 1 })
    } else {
      setCurrentMaxScore(score)
      if (timer) {
        setTimerEndsAt(timer)
        setStatus('waiting_timer')
        trackEvent('timer_activated')
      }
    }
  }

  // ─── Skip ─────────────────────────────────────────────────────────────────

  async function handleSkipConfirm() {
    if (!authToken) return
    setIsSkipping(true)

    const res = await fetch('/api/game/skip', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const json = await res.json()
    setIsSkipping(false)
    setShowSkipModal(false)

    if (!json.success) {
      setMessage(json.error || 'Erro ao pular timer')
      return
    }

    const { penaltyApplied, newMaxScore } = json.data
    setCurrentMaxScore(newMaxScore)
    setSkips(prev => prev + 1)
    setTimerEndsAt(null)
    setStatus('playing')
    trackEvent('timer_skipped', { penalty: penaltyApplied })
  }

  const handleTimerExpire = useCallback(() => {
    setTimerEndsAt(null)
    setStatus('playing')
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-sm animate-pulse">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 gap-4 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-3">
        <span className="text-2xl font-bold tracking-widest">PALAVRA</span>
        <a href="/leaderboard" className="text-zinc-400 hover:text-white text-sm transition-colors">
          Ranking
        </a>
      </header>

      {/* Pontuação */}
      <ScoreDisplay currentMaxScore={currentMaxScore} skips={skips} />

      {/* Mensagem de feedback */}
      {message && (
        <div className="px-4 py-2 bg-zinc-700 rounded-lg text-sm text-center">
          {message}
        </div>
      )}

      {/* Grid */}
      <WordGrid
        attempts={attempts}
        currentAttempt={currentAttempt}
        gameOver={status === 'won' || status === 'lost'}
      />

      {/* Timer */}
      {status === 'waiting_timer' && timerEndsAt && (
        <TimerBar
          timerEndsAt={timerEndsAt}
          onExpire={handleTimerExpire}
          onSkip={() => setShowSkipModal(true)}
          skipPenalty={SCORING.PENALTY_PER_SKIP}
          isSkipping={isSkipping}
        />
      )}

      {/* Teclado */}
      {status === 'playing' && (
        <div className="w-full mt-auto">
          <Keyboard
            keyboardState={keyboardState}
            onKey={handleKey}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
          />
        </div>
      )}

      {/* Botão iniciar */}
      {status === 'idle' && (
        <button
          onClick={startGame}
          className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg transition-colors"
        >
          Jogar
        </button>
      )}

      {/* Modal de skip */}
      {showSkipModal && (
        <SkipModal
          currentMaxScore={currentMaxScore}
          skipPenalty={SCORING.PENALTY_PER_SKIP}
          onConfirm={handleSkipConfirm}
          onCancel={() => setShowSkipModal(false)}
          isLoading={isSkipping}
        />
      )}
    </div>
  )
}
