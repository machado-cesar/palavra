'use client'

import { useEffect, useState } from 'react'
import { SCORING } from '@/types'

interface RecoveryBarProps {
  recoveryStartedAt: string
  onRecoveryUpdate: (recovered: number) => void
}

export default function RecoveryBar({ recoveryStartedAt, onRecoveryUpdate }: RecoveryBarProps) {
  const [recovered, setRecovered] = useState(0)

  useEffect(() => {
    function compute() {
      const elapsed = Math.floor((Date.now() - new Date(recoveryStartedAt).getTime()) / 1000)
      return Math.min(elapsed, SCORING.RECOVERY_DURATION)
    }

    // Calcula imediatamente e notifica
    const initial = compute()
    setRecovered(initial)
    onRecoveryUpdate(initial)

    if (initial >= SCORING.MAX_RECOVERY) return

    const interval = setInterval(() => {
      const pts = compute()
      setRecovered(pts)
      onRecoveryUpdate(pts)
      if (pts >= SCORING.MAX_RECOVERY) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [recoveryStartedAt])

  if (recovered <= 0) return null

  const pct = Math.round((recovered / SCORING.MAX_RECOVERY) * 100)

  return (
    <div className="w-full flex items-center gap-3 px-1">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-green-400 text-xs font-semibold tabular-nums whitespace-nowrap">
        +{recovered} recuperados
      </span>
    </div>
  )
}
