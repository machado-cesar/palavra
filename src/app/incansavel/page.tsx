'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import WordGrid from '@/components/game/WordGrid'
import Keyboard from '@/components/game/Keyboard'
import UsernameModal from '@/components/game/UsernameModal'
import { Attempt, GameStatus, LetterStatus } from '@/types'
import { normalizeWord } from '@/lib/words'
import { isValidPortugueseWord } from '@/lib/valid-words'
import { useNotifications } from '@/hooks/useNotifications'
import { useTheme } from '@/contexts/ThemeContext'

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, { mode: 'incansavel', ...params })
}

export default function IncansavelPage() {
  const { copaTheme, toggleCopaTheme } = useTheme()
  const { isSubscribed, isLoading: notifLoading, subscribe, unsubscribe, supported: notifSupported } = useNotifications()
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showChangeNickModal, setShowChangeNickModal] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
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
  const firstCompleteFired = useRef(false)

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

  // ─── Buscar username ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!authToken) return
    fetch('/api/game/status', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setCurrentUsername(json.data.username ?? '') })
      .catch(() => {})
  }, [authToken])

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
    const wordsWonToday = json.data.wordsWon ?? 0
    setWordsWon(wordsWonToday)
    // Se já ganhou palavras hoje, game_complete já foi disparado anteriormente
    if (wordsWonToday > 0) firstCompleteFired.current = true
    setStatus('playing')
    trackEvent('game_started', { wordsWon: wordsWonToday })
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
      trackEvent('game_complete_tireless', { won, wordsWon: updatedCount })
      if (!firstCompleteFired.current) {
        trackEvent('game_complete', { won, wordsWon: updatedCount })
        firstCompleteFired.current = true
      }
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
    <div className="flex flex-col min-h-[100dvh]">

      {/* Header — full width */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 px-4 sm:px-8 py-3">
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
          {authToken && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettingsMenu(v => !v)}
                title="Configurações"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="sm:hidden" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                <svg className="hidden sm:block" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

                  {/* Notificações */}
                  {notifSupported && <div className="border-t border-zinc-700 mx-4" />}
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
        </nav>
      </header>

      {/* Conteúdo centralizado */}
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-2 gap-2 w-full max-w-lg mx-auto">

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
          copaTheme={copaTheme}
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
            copaTheme={copaTheme}
          />
        </div>
      )}

      </div>{/* fim do conteúdo centralizado */}

      {/* Modal de troca de apelido */}
      {showChangeNickModal && authToken && (
        <UsernameModal
          authToken={authToken}
          onSaved={(username) => {
            setCurrentUsername(username)
            setShowChangeNickModal(false)
          }}
          onSkip={() => setShowChangeNickModal(false)}
        />
      )}
    </div>
  )
}
