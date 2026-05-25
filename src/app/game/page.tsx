'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import ScoreDisplay from '@/components/game/ScoreDisplay'
import TimerBar from '@/components/game/TimerBar'
import SkipModal from '@/components/game/SkipModal'
import ResultScreen from '@/components/game/ResultScreen'
import { Attempt, GameStatus, LetterStatus, SCORING } from '@/types'
import { normalizeWord } from '@/lib/words'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params)
}

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
  const [isSubmitting, setIsSubmitting] = useState(false)  // bloqueia duplo envio
  const [message, setMessage] = useState('')
  const [correctWord, setCorrectWord] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Auth anônimo automático ───────────────────────────────────────────────

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

  // ─── Verificar status e iniciar automaticamente ────────────────────────────

  useEffect(() => {
    if (!authToken) return

    async function fetchStatusAndStart() {
      const res = await fetch('/api/game/status', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      const json = await res.json()
      setIsLoading(false)

      if (!json.success) return

      const { timerEndsAt: timer, currentSession, completedSession } = json.data

      // Jogo já concluído hoje — reconstruir estado do board
      if (completedSession) {
        const rebuiltKeyboard: Record<string, LetterStatus> = {}
        for (const attempt of completedSession.attempts) {
          for (const { letter, status } of attempt.result) {
            const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
            if (!rebuiltKeyboard[letter] || priority[status as LetterStatus] > priority[rebuiltKeyboard[letter]]) {
              rebuiltKeyboard[letter] = status as LetterStatus
            }
          }
        }
        setAttempts(completedSession.attempts)
        setKeyboardState(rebuiltKeyboard)
        setCurrentMaxScore(completedSession.score || completedSession.maxPossibleScore)
        setSkips(completedSession.timerSkips)
        setStatus(completedSession.won ? 'won' : 'lost')
        if (!completedSession.won && completedSession.correctWord) {
          setCorrectWord(completedSession.correctWord)
        }
        setShowResult(true)
        return
      }

      // Função auxiliar para reconstruir estado a partir das tentativas salvas
      function restoreSessionState(session: typeof currentSession) {
        if (!session) return
        setCurrentMaxScore(session.maxPossibleScore)
        setSkips(session.timerSkips || 0)
        if (session.attempts?.length > 0) {
          const rebuiltKeyboard: Record<string, LetterStatus> = {}
          for (const attempt of session.attempts) {
            for (const { letter, status } of attempt.result) {
              const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
              if (!rebuiltKeyboard[letter] || priority[status as LetterStatus] > priority[rebuiltKeyboard[letter]]) {
                rebuiltKeyboard[letter] = status as LetterStatus
              }
            }
          }
          setAttempts(session.attempts)
          setKeyboardState(rebuiltKeyboard)
        }
      }

      // Timer ativo (jogo em pausa)
      if (timer && new Date(timer) > new Date()) {
        restoreSessionState(currentSession)
        setTimerEndsAt(timer)
        setStatus('waiting_timer')
        return
      }

      // Sessão em andamento (retornou no meio do jogo)
      if (currentSession) {
        restoreSessionState(currentSession)
        setStatus('playing')
        return
      }

      // Nenhum estado ativo — iniciar jogo automaticamente
      await startGame(authToken!)
    }

    fetchStatusAndStart()
  }, [authToken])

  // ─── Iniciar jogo ──────────────────────────────────────────────────────────

  async function startGame(token: string) {
    const res = await fetch('/api/game/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()

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
      if (status !== 'playing' || isSubmitting) return
      if (e.key === 'Enter') handleEnter()
      else if (e.key === 'Backspace') handleBackspace()
      else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) handleKey(e.key.toUpperCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, currentAttempt, attempts, isSubmitting])

  function handleKey(key: string) {
    if (currentAttempt.length < 5) setCurrentAttempt(prev => prev + key)
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

    if (!authToken || isSubmitting) return

    setIsSubmitting(true)
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
    setIsSubmitting(false)

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
      setShowResult(true)
      trackEvent('game_won', { score, attempts: attempts.length + 1 })
    } else if (gameOver) {
      setStatus('lost')
      if (json.data.correctWord) setCorrectWord(json.data.correctWord)
      setShowResult(true)
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

  const gameOver = status === 'won' || status === 'lost'

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 gap-4 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-3">
        <span className="text-2xl font-bold tracking-widest font-mono">char[5]</span>
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

      {/* Toast flutuante de envio — não desloca o layout */}
      {isSubmitting && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-full shadow-lg
          text-zinc-300 text-xs font-medium animate-pulse pointer-events-none">
          Verificando…
        </div>
      )}

      {/* Grid */}
      <WordGrid
        attempts={attempts}
        currentAttempt={currentAttempt}
        gameOver={gameOver}
      />

      {/* Modal de resultado */}
      {gameOver && showResult && (
        <ResultScreen
          won={status === 'won'}
          score={currentMaxScore}
          skips={skips}
          attempts={attempts}
          correctWord={correctWord}
          onClose={() => setShowResult(false)}
        />
      )}

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

      {/* Teclado — desabilitado durante submissão ou jogo encerrado */}
      {status === 'playing' && (
        <div className="w-full mt-auto">
          <Keyboard
            keyboardState={keyboardState}
            onKey={handleKey}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
            disabled={isSubmitting}
          />
        </div>
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
