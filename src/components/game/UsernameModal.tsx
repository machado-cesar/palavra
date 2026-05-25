'use client'

import { useState } from 'react'

const SUGGESTIONS = [
  'Onca', 'Cobra', 'Lobo', 'Arara', 'Tigre',
  'Puma', 'Corvo', 'Falcao', 'Aguia', 'Capivara',
  'Tucano', 'Jaguara', 'Gaviao', 'Lince', 'Harpia',
]

function randomSuggestion(): string {
  const animal = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]
  const num = Math.floor(Math.random() * 900 + 100)
  return `${animal}${num}`
}

interface UsernameModalProps {
  authToken: string
  onSaved: (username: string) => void
  onSkip: () => void
}

export default function UsernameModal({ authToken, onSaved, onSkip }: UsernameModalProps) {
  const [username, setUsername] = useState(randomSuggestion)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const trimmed = username.trim()
    if (trimmed.length < 3) {
      setError('Mínimo 3 caracteres.')
      return
    }
    if (trimmed.length > 15) {
      setError('Máximo 15 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/user/username', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: trimmed }),
    })

    const json = await res.json()
    setLoading(false)

    if (!json.success) {
      setError(json.error || 'Erro ao salvar.')
      return
    }

    onSaved(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl">

        <div className="text-center space-y-1">
          <div className="text-3xl">🏆</div>
          <h2 className="text-lg font-bold">Como quer aparecer no ranking?</h2>
          <p className="text-zinc-400 text-sm">
            Escolha um apelido para identificar suas pontuações.
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            maxLength={15}
            placeholder="Seu apelido"
            className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-2.5
              text-white placeholder-zinc-500 text-center font-medium
              focus:outline-none focus:border-zinc-400 transition-colors"
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <p className="text-zinc-600 text-xs text-center">
            3–15 caracteres · letras, números ou _
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
              rounded-lg hover:bg-zinc-100 active:scale-95 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando…' : 'Salvar apelido'}
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Pular por agora
          </button>
        </div>

      </div>
    </div>
  )
}
