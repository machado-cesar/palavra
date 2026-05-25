'use client'

import { useEffect, useState } from 'react'
import { SCORING } from '@/types'

interface TimerBarProps {
  timerEndsAt: string   // ISO string
  onExpire: () => void
  onSkip: () => void
  skipPenalty: number
  isSkipping?: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimerBar({ timerEndsAt, onExpire, onSkip, skipPenalty, isSkipping }: TimerBarProps) {
  const totalSeconds = SCORING.TIMER_MINUTES * 60
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds)

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(timerEndsAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) onExpire()
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timerEndsAt, onExpire])

  const percentage = (secondsLeft / totalSeconds) * 100

  return (
    <div className="w-full max-w-sm mx-auto space-y-3 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
      <div className="flex justify-between items-center">
        <span className="text-zinc-400 text-sm">Próxima tentativa em</span>
        <span className="text-white font-mono text-xl font-bold tabular-nums">
          {formatTime(secondsLeft)}
        </span>
      </div>

      {/* Barra do timer */}
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 bg-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Botão de skip */}
      <button
        onClick={onSkip}
        disabled={isSkipping}
        className="w-full py-2 text-sm font-medium text-zinc-400 border border-zinc-600 rounded-lg
          hover:border-zinc-400 hover:text-white transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSkipping ? 'Aguarde...' : `Pular timer (−${skipPenalty} pts)`}
      </button>
    </div>
  )
}
