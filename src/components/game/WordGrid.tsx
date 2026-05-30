'use client'

import { Attempt, LetterStatus, SCORING } from '@/types'

interface WordGridProps {
  attempts: Attempt[]
  currentLetters: string[]   // array de 5 elementos
  cursorPos: number          // posição do cursor na linha atual
  gameOver: boolean
  onCellClick?: (col: number) => void
}

const statusColors: Record<LetterStatus, string> = {
  correct: 'bg-green-600 border-green-600 text-white',
  present: 'bg-yellow-500 border-yellow-500 text-white',
  absent:  'bg-zinc-600 border-zinc-600 text-white',
  empty:   'bg-transparent border-zinc-600 text-white',
}

function LetterCell({
  letter,
  status,
  isCursor = false,
  onClick,
}: {
  letter: string
  status: LetterStatus
  isCursor?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`
        w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
        border-2 text-xl sm:text-2xl font-bold uppercase
        transition-all duration-300
        ${statusColors[status]}
        ${isCursor ? 'border-zinc-300 shadow-[0_0_6px_1px_rgba(255,255,255,0.2)] bg-zinc-800' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {letter}
    </div>
  )
}

export default function WordGrid({ attempts, currentLetters, cursorPos, gameOver, onCellClick }: WordGridProps) {
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
                <LetterCell key={colIndex} letter={r.letter} status={r.status} />
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
                />
              ))}
            </div>
          )
        }

        // Linha vazia futura
        return (
          <div key={rowIndex} className="flex gap-1.5">
            {Array(5).fill(null).map((_, colIndex) => (
              <LetterCell key={colIndex} letter="" status="empty" />
            ))}
          </div>
        )
      })}
    </div>
  )
}
