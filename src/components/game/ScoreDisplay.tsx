'use client'

import { SCORING } from '@/types'
import { getScorePercentage, getScoreBarColor } from '@/lib/scoring'

interface ScoreDisplayProps {
  currentMaxScore: number
  skips: number
}

export default function ScoreDisplay({ currentMaxScore, skips }: ScoreDisplayProps) {
  const percentage = getScorePercentage(currentMaxScore)
  const barColor = getScoreBarColor(percentage)

  return (
    <div className="w-full max-w-sm mx-auto space-y-1">
      <div className="flex justify-between items-center text-sm text-zinc-400">
        <span>Pontuação máxima</span>
        <span className="font-bold text-white text-lg tabular-nums">
          {currentMaxScore}
        </span>
      </div>

      {/* Barra de pontuação */}
      <div className="w-full h-4 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      {/* Penalidades */}
      {skips > 0 && (
        <p className="text-xs text-zinc-500 text-right">
          {skips} skip{skips > 1 ? 's' : ''} · −{skips * SCORING.PENALTY_PER_SKIP} pts
        </p>
      )}
    </div>
  )
}
