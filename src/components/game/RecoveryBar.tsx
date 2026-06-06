'use client'

interface RecoveryBarProps {
  recovered: number
  maxRecovery?: number
}

export default function RecoveryBar({ recovered, maxRecovery = 100 }: RecoveryBarProps) {
  if (recovered <= 0) return null

  const pct = Math.round((recovered / maxRecovery) * 100)

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
