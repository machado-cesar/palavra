'use client'

import { Attempt, LetterStatus, SCORING } from '@/types'

interface WordGridProps {
  attempts: Attempt[]
  currentLetters: string[]   // array de 5 elementos
  cursorPos: number          // posição do cursor na linha atual
  gameOver: boolean
  onCellClick?: (col: number) => void
  copaTheme?: boolean
}

const statusColors: Record<LetterStatus, string> = {
  correct: 'bg-green-600 border-green-600 text-white',
  present: 'bg-yellow-500 border-yellow-500 text-white',
  absent:  'bg-zinc-600 border-zinc-600 text-white',
  empty:   'bg-transparent border-zinc-600 text-white',
}

const statusColorsCopa: Record<LetterStatus, string> = {
  correct: 'bg-[#009c3b] border-[#009c3b] text-white',
  present: 'bg-[#f5c400] border-[#f5c400] text-zinc-900',
  absent:  'bg-[#0d2240] border-[#0d2240] text-zinc-300',
  empty:   'bg-transparent border-[#1a3a5c] text-white',
}

function LetterCell({
  letter,
  status,
  isCursor = false,
  onClick,
  copaTheme = false,
}: {
  letter: string
  status: LetterStatus
  isCursor?: boolean
  onClick?: () => void
  copaTheme?: boolean
}) {
  const colors = copaTheme ? statusColorsCopa : statusColors
  return (
    <div
      onClick={onClick}
      className={`
        w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
        border-2 text-xl sm:text-2xl font-bold uppercase
        transition-all duration-300
        ${colors[status]}
        ${isCursor ? 'border-[#f5c400] shadow-[0_0_8px_2px_rgba(245,196,0,0.3)] bg-[#071a0e]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {letter}
    </div>
  )
}

export default function WordGrid({ attempts, currentLetters, cursorPos, gameOver, onCellClick, copaTheme }: WordGridProps) {
  const rows = Array(SCORING.MAX_ATTEMPTS).fill(null)

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((_, rowIndex) => {
        const attempt = attempts[rowIndex]

        // Linha já jogada
        if (attempt) {
          return (
            <div key={rowIndex} className="flex gap-1.5">
              {attempt.result.map((r, colIndex) => (
                <LetterCell key={colIndex} letter={r.letter} status={r.status} copaTheme={copaTheme} />
              ))}
            </div>
          )
        }

        // Linha atual (digitando)
        if (rowIndex === attempts.length && !gameOver) {
          return (
            <div key={rowIndex} className="flex gap-1.5">
              {Array(5).fill(null).map((_, colIndex) => (
                <LetterCell
                  key={colIndex}
                  letter={currentLetters[colIndex] || ''}
                  status="empty"
                  isCursor={colIndex === cursorPos}
                  onClick={() => onCellClick?.(colIndex)}
                  copaTheme={copaTheme}
                />
              ))}
            </div>
          )
        }

        // Linha vazia futura
        return (
          <div key={rowIndex} className="flex gap-1.5">
            {Array(5).fill(null).map((_, colIndex) => (
              <LetterCell key={colIndex} letter="" status="empty" copaTheme={copaTheme} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
