'use client'

import { Attempt, LetterStatus, SCORING } from '@/types'

interface WordGridProps {
  attempts: Attempt[]
  currentAttempt: string
  gameOver: boolean
}

const statusColors: Record<LetterStatus, string> = {
  correct: 'bg-green-600 border-green-600 text-white',
  present: 'bg-yellow-500 border-yellow-500 text-white',
  absent:  'bg-zinc-600 border-zinc-600 text-white',
  empty:   'bg-transparent border-zinc-600 text-white',
}

function LetterCell({ letter, status }: { letter: string; status: LetterStatus }) {
  return (
    <div
      className={`
        w-14 h-14 flex items-center justify-center
        border-2 text-2xl font-bold uppercase
        transition-all duration-300
        ${statusColors[status]}
      `}
    >
      {letter}
    </div>
  )
}

export default function WordGrid({ attempts, currentAttempt, gameOver }: WordGridProps) {
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
                  letter={currentAttempt[colIndex] || ''}
                  status={currentAttempt[colIndex] ? 'empty' : 'empty'}
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
