'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import ScoreDisplay from '@/components/game/ScoreDisplay'
import RecoveryBar from '@/components/game/RecoveryBar'
import ResultScreen from '@/components/game/ResultScreen'
import UsernameModal from '@/components/game/UsernameModal'
import OnboardingModal from '@/components/game/OnboardingModal'
import StreakRecoveryModal from '@/components/game/StreakRecoveryModal'
import { Attempt, GameStatus, LetterStatus } from '@/types'
import { normalizeWord } from '@/lib/words'
import { isValidPortugueseWord } from '@/lib/valid-words'
import { useNotifications } from '@/hooks/useNotifications'
import { useTheme } from '@/contexts/ThemeContext'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params)
}

export default function GamePage() {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [currentLetters, setCurrentLetters] = useState<string[]>(['', '', '', '', ''])
  const [cursorPos, setCursorPos] = useState(0)
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterStatus>>({})
  const [currentMaxScore, setCurrentMaxScore] = useState(1500)
  const [recoveryStartedAt, setRecoveryStartedAt] = useState<string | null>(null)
  const [recoveredPoints, setRecoveredPoints] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)  // bloqueia duplo envio
  const [message, setMessage] = useState('')
  const [correctWord, setCorrectWord] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [usernameConfirmed, setUsernameConfirmed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [tokens, setTokens] = useState(0)
  const [showStreakRestorePrompt, setShowStreakRestorePrompt] = useState(false)
  const [streakAtRiskInfo, setStreakAtRiskInfo] = useState<{ streak: number; tokens: number } | null>(null)
  const [isRestoringStreak, setIsRestoringStreak] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [wordUnavailable, setWordUnavailable] = useState(false)
  const recoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recoveredPointsRef = useRef(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [showStreakRecovery, setShowStreakRecovery] = useState(false)
  const [streakRecoveryInfo, setStreakRecoveryInfo] = useState<{ prevStreak: number; tokens: number } | null>(null)
  const [isRecoveringStreak, setIsRecoveringStreak] = useState(false)
  const { isSubscribed, isLoading: notifLoading, subscribe, unsubscribe, supported: notifSupported } = useNotifications()
  const { copaTheme, toggleCopaTheme } = useTheme()
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showChangeNickModal, setShowChangeNickModal] = useState(false)
  const [dailyFrase, setDailyFrase] = useState<import('@/types').DailyFrase | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  // ─── Recovery interval — gerenciado aqui para cancelamento síncrono ─────────

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

  // ─── Fechar settings ao clicar fora ──────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false)
      }
    }
    if (showSettingsMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettingsMenu])

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

      const { currentSession, completedSession, streak: userStreak, usernameConfirmed: confirmed, tokens: userTokens, streakAtRisk, isReturning, username: savedUsername } = json.data
      if (userStreak) setStreak(userStreak)
      if (confirmed) setUsernameConfirmed(true)
      if (userTokens) setTokens(userTokens)
      if (savedUsername) setCurrentUsername(savedUsername)

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
        setStatus(completedSession.won ? 'won' : 'lost')
        if (!completedSession.won && completedSession.correctWord) {
          setCorrectWord(completedSession.correctWord)
        }
        if (completedSession.frase) setDailyFrase(completedSession.frase)
        setShowResult(true)
        return
      }

      // Função auxiliar para reconstruir estado a partir das tentativas salvas
      function restoreSessionState(session: typeof currentSession) {
        if (!session) return
        setCurrentMaxScore(session.maxPossibleScore)
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

      // Sessão em andamento (retornou no meio do jogo)
      if (currentSession) {
        restoreSessionState(currentSession)
        if (currentSession.recoveryStartedAt) {
          setRecoveryStartedAt(currentSession.recoveryStartedAt)
        }
        setStatus('playing')
        return
      }

      // Streak em risco — mostrar prompt antes de iniciar
      if (streakAtRisk && userStreak > 0 && userTokens > 0) {
        setStreakAtRiskInfo({ streak: userStreak, tokens: userTokens })
        setShowStreakRestorePrompt(true)
        return
      }

      // Nenhum estado ativo — iniciar jogo automaticamente
      // session_return: só quem já jogou antes (last_played_at existe no banco)
      if (isReturning) {
        trackEvent('session_return', { streak: userStreak })
      }
      // streak_return: retorno mantendo sequência ativa — candidato ao evento α
      if (isReturning && userStreak >= 1) {
        trackEvent('streak_return', { streak: userStreak })
      }

      // Onboarding: exibe apenas na primeira visita
      const seen = localStorage.getItem('char5_onboarding_seen')
      if (!seen) {
        setShowOnboarding(true)
        setPendingStart(true)
        return
      }

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
      if (json.error === 'Nenhuma palavra configurada para hoje') {
        setWordUnavailable(true)
      } else {
        setMessage(json.error || 'Erro ao iniciar jogo')
        setTimeout(() => setMessage(''), 3000)
      }
      return
    }

    setWordUnavailable(false)

    setStatus('playing')
    setAttempts([])
    setCurrentLetters(['', '', '', '', ''])
    setCursorPos(0)
    setKeyboardState({})
    setCurrentMaxScore(1500)
    trackEvent('game_started')
  }

  // ─── Teclado físico ───────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (status !== 'playing' || isSubmitting || showStreakRecovery || showOnboarding) return
      if (e.key === 'Enter') handleEnter()
      else if (e.key === 'Backspace') handleBackspace()
      else if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) handleKey(e.key.toUpperCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, currentLetters, cursorPos, attempts, isSubmitting, showStreakRecovery, showOnboarding])

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
      // Limpa a letra na posição atual, mantém cursor
      setCurrentLetters(prev => {
        const next = [...prev]
        next[cursorPos] = ''
        return next
      })
    } else if (cursorPos > 0) {
      // Posição atual já vazia — recua cursor e limpa anterior
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

    // Cancela intervalo e usa ref para ler o valor exato — evita race condition de closure
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

    const { result, score, won, gameOver } = json.data

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
      result.forEach(({ letter, status }: { letter: string; status: LetterStatus }) => {
        const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
        if (!updated[letter] || priority[status] > priority[updated[letter]]) {
          updated[letter] = status
        }
      })
      return updated
    })

    trackEvent('attempt_made', { won, game_over: gameOver })

    function proceedAfterGame() {
      if (!usernameConfirmed) setShowUsernameModal(true)
      else setShowResult(true)
    }

    if (won || gameOver) {
      if (json.data.frase) setDailyFrase(json.data.frase)
    }

    if (won) {
      setCurrentMaxScore(score)
      setStatus('won')
      setStreak(prev => prev + 1)
      if (json.data.tokenEarned) {
        setTokens(prev => Math.min(prev + 1, 3))
        setMessage('🛡️ +1 Escudo ganho pela sequência!')
        setTimeout(() => setMessage(''), 3000)
      }
      proceedAfterGame()
      trackEvent('game_won', { score, attempts: attempts.length + 1 })
      trackEvent('game_complete', { won: true, score, attempts: attempts.length + 1 })
    } else if (gameOver) {
      setStatus('lost')
      if (json.data.correctWord) setCorrectWord(json.data.correctWord)
      trackEvent('game_lost', { attempts: attempts.length + 1 })
      trackEvent('game_complete', { won: false, score: 0, attempts: attempts.length + 1 })

      // Oferecer recuperação de streak via token, se disponível
      if (json.data.streakCanBeSaved) {
        setStreakRecoveryInfo({ prevStreak: json.data.prevStreak, tokens: json.data.tokens })
        setShowStreakRecovery(true)
      } else {
        proceedAfterGame()
      }
    } else {
      setCurrentMaxScore(score)
      if (json.data.recoveryStartedAt) {
        setRecoveryStartedAt(json.data.recoveryStartedAt)
      }
    }
  }

  // ─── Restauração de streak ─────────────────────────────────────────────────

  async function handleRestoreStreak() {
    if (!authToken) return
    setIsRestoringStreak(true)

    const res = await fetch('/api/game/restore-streak', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const json = await res.json()
    setIsRestoringStreak(false)

    if (!json.success) {
      setMessage(json.error || 'Erro ao restaurar streak')
      setTimeout(() => setMessage(''), 3000)
      setShowStreakRestorePrompt(false)
      await startGame(authToken)
      return
    }

    setTokens(json.data.tokensLeft)
    setShowStreakRestorePrompt(false)
    setStreakAtRiskInfo(null)
    await startGame(authToken)
  }

  async function handleSkipStreakRestore() {
    setShowStreakRestorePrompt(false)
    setStreakAtRiskInfo(null)
    await startGame(authToken!)
  }

  // ─── Recuperação de streak via token ──────────────────────────────────────

  function proceedAfterStreakDecision() {
    setShowStreakRecovery(false)
    setStreakRecoveryInfo(null)
    if (!usernameConfirmed) setShowUsernameModal(true)
    else setShowResult(true)
  }

  async function handleStreakRecover() {
    if (!authToken || !streakRecoveryInfo) return
    setIsRecoveringStreak(true)

    const res = await fetch('/api/game/recover-streak', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prevStreak: streakRecoveryInfo.prevStreak }),
    })
    const json = await res.json()
    setIsRecoveringStreak(false)

    if (json.success) {
      setStreak(json.data.streak)
      setTokens(json.data.tokensLeft)
    }
    proceedAfterStreakDecision()
  }

  function handleStreakDecline() {
    proceedAfterStreakDecision()
  }

  // ─── Onboarding ───────────────────────────────────────────────────────────

  async function handleOnboardingConfirm() {
    localStorage.setItem('char5_onboarding_seen', '1')
    setShowOnboarding(false)
    if (pendingStart && authToken) {
      setPendingStart(false)
      await startGame(authToken)
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

  if (wordUnavailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6 max-w-lg mx-auto text-center">
        <div className="text-4xl">⏳</div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold">A palavra de hoje está sendo preparada</h2>
          <p className="text-zinc-400 text-sm">
            O jogo é atualizado à meia-noite. Se você está vendo isso, é porque o processo
            ainda não terminou. Tente novamente em alguns instantes.
          </p>
        </div>
        <button
          onClick={() => authToken && startGame(authToken)}
          className="px-6 py-2.5 text-sm font-semibold bg-white text-zinc-900
            rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const gameOver = status === 'won' || status === 'lost'

  return (
    <div className={`flex flex-col items-center min-h-[100dvh] px-4 pt-4 pb-2 gap-2 max-w-lg mx-auto ${copaTheme ? 'bg-gradient-to-b from-[#071a0e] to-[#020c1a]' : ''}`}>

      {/* Header */}
      <header className={`w-full flex justify-between items-center border-b pb-2 ${copaTheme ? 'border-yellow-500' : 'border-zinc-700'}`}>
        <span className="text-2xl font-bold tracking-widest font-mono">
          {copaTheme && <span className="mr-1">⚽</span>}char[5]
        </span>

        <div className="flex items-center gap-3">
          {tokens > 0 && (
            <span className="text-sm font-semibold text-zinc-300 tabular-nums" title="Escudos de proteção de streak">
              🛡️ {tokens}
            </span>
          )}
          {streak > 0 && (
            <span className="text-sm font-semibold text-orange-400 tabular-nums">
              🔥 {streak}
            </span>
          )}
          <a href="/incansavel" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Incansável
          </a>
          <a href="/como-jogar" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Regras
          </a>
          <a href="/leaderboard" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Ranking
          </a>
          {authToken && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettingsMenu(v => !v)}
                title="Configurações"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 top-7 z-50 w-52 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                  {/* Nick */}
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Apelido</p>
                    <p className="text-white text-sm font-medium truncate">{currentUsername || '—'}</p>
                    <button
                      onClick={() => { setShowSettingsMenu(false); setShowChangeNickModal(true) }}
                      className="mt-2 w-full text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg py-1.5 transition-colors"
                    >
                      Mudar apelido
                    </button>
                  </div>

                  {/* Divisor */}
                  {notifSupported && <div className="border-t border-zinc-700 mx-4" />}

                  {/* Notificações */}
                  {notifSupported && (
                    <div className="px-4 py-3">
                      <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Notificações</p>
                      <button
                        onClick={async () => {
                          if (isSubscribed) {
                            await unsubscribe(authToken)
                            trackEvent('notification_opted_out')
                          } else {
                            const ok = await subscribe(authToken)
                            trackEvent(ok ? 'notification_opted_in' : 'notification_permission_denied')
                          }
                        }}
                        disabled={notifLoading}
                        className="w-full flex items-center justify-between text-sm rounded-lg px-3 py-2 bg-zinc-900 hover:bg-zinc-700 transition-colors disabled:opacity-40"
                      >
                        <span>{isSubscribed ? 'Ativadas' : 'Desativadas'}</span>
                        <span className={`text-xs font-semibold ${isSubscribed ? 'text-green-400' : 'text-zinc-500'}`}>
                          {isSubscribed ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Tema Copa */}
                  <div className="border-t border-zinc-700 mx-4" />
                  <div className="px-4 py-3">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Tema</p>
                    <button
                      onClick={toggleCopaTheme}
                      className="w-full flex items-center justify-between text-sm rounded-lg px-3 py-2 bg-zinc-900 hover:bg-zinc-700 transition-colors"
                    >
                      <span>⚽ Copa do Mundo</span>
                      <span className={`text-xs font-semibold ${copaTheme ? 'text-yellow-400' : 'text-zinc-500'}`}>
                        {copaTheme ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Pontuação */}
      <ScoreDisplay currentMaxScore={currentMaxScore + recoveredPoints} />

      {/* Toasts flutuantes — não deslocam o layout */}
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
          copaTheme={copaTheme}
        />
      </div>

      {/* Modal de resultado */}
      {gameOver && showResult && (
        <ResultScreen
          won={status === 'won'}
          score={currentMaxScore}
          attempts={attempts}
          streak={streak}
          correctWord={correctWord}
          authToken={authToken}
          frase={dailyFrase}
          onClose={() => setShowResult(false)}
        />
      )}

      {/* Recovery bar — visível enquanto recuperação ativa */}
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
            copaTheme={copaTheme}
          />
        </div>
      )}

      {/* Modal de restauração de streak */}
      {showStreakRestorePrompt && streakAtRiskInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-3xl">🛡️</div>
              <h2 className="text-lg font-bold">Sequência em risco!</h2>
              <p className="text-zinc-400 text-sm">
                Você não jogou ontem. Quer usar um token para manter sua sequência de{' '}
                <span className="text-orange-400 font-semibold">{streakAtRiskInfo.streak} dias</span>?
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleRestoreStreak}
                disabled={isRestoringStreak}
                className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
                  rounded-lg hover:bg-zinc-100 active:scale-95 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoringStreak
                  ? 'Restaurando…'
                  : `Usar 🛡️ token (${streakAtRiskInfo.tokens} disponível${streakAtRiskInfo.tokens > 1 ? 'is' : ''})`
                }
              </button>
              <button
                onClick={handleSkipStreakRestore}
                disabled={isRestoringStreak}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Jogar assim mesmo (sequência zera)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de recuperação de streak */}
      {showStreakRecovery && streakRecoveryInfo && (
        <StreakRecoveryModal
          prevStreak={streakRecoveryInfo.prevStreak}
          tokens={streakRecoveryInfo.tokens}
          onRecover={handleStreakRecover}
          onDecline={handleStreakDecline}
          isLoading={isRecoveringStreak}
        />
      )}

      {/* Modal de onboarding — aparece apenas na primeira visita */}
      {showOnboarding && (
        <OnboardingModal onConfirm={handleOnboardingConfirm} />
      )}

      {/* Modal de apelido — aparece após primeiro jogo */}
      {showUsernameModal && authToken && (
        <UsernameModal
          authToken={authToken}
          onSaved={(username) => {
            setUsernameConfirmed(true)
            setCurrentUsername(username)
            setShowUsernameModal(false)
            setShowResult(true)
          }}
          onSkip={() => {
            setShowUsernameModal(false)
            setShowResult(true)
          }}
        />
      )}

      {/* Modal de troca de apelido — aberto via menu de configurações */}
      {showChangeNickModal && authToken && (
        <UsernameModal
          authToken={authToken}
          onSaved={(username) => {
            setCurrentUsername(username)
            setUsernameConfirmed(true)
            setShowChangeNickModal(false)
          }}
          onSkip={() => setShowChangeNickModal(false)}
        />
      )}
    </div>
  )
}
