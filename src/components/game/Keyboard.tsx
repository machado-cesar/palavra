'use client'

import { LetterStatus } from '@/types'

interface KeyboardProps {
  keyboardState: Record<string, LetterStatus>
  onKey: (key: string) => void
  onEnter: () => void
  onBackspace: () => void
  disabled?: boolean
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]

const statusColors: Record<LetterStatus, string> = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent:  'bg-zinc-900 text-zinc-500',
  empty:   'bg-zinc-600 text-white hover:bg-zinc-500',
}

export default function Keyboard({ keyboardState, onKey, onEnter, onBackspace, disabled }: KeyboardProps) {
  function handleClick(key: string) {
    if (disabled) return
    if (key === 'ENTER') onEnter()
    else if (key === '⌫') onBackspace()
    else onKey(key)
  }

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-lg mx-auto">
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5">
          {row.map((key) => {
            const status = keyboardState[key] || 'empty'
            const isWide = key === 'ENTER' || key === '⌫'

            return (
              <button
                key={key}
                onClick={() => handleClick(key)}
                disabled={disabled}
                className={`
                  ${isWide ? 'px-3 text-sm min-w-[56px]' : 'w-10'}
                  h-14 rounded font-bold uppercase
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${statusColors[status as LetterStatus]}
                `}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
