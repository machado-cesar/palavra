'use client'

import { LetterStatus } from '@/types'

interface KeyboardProps {
  keyboardState: Record<string, LetterStatus>
  onKey: (key: string) => void
  onEnter: () => void
  onBackspace: () => void
  disabled?: boolean
  copaTheme?: boolean
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['⌫', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER'],
]

const statusColors: Record<LetterStatus, string> = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent:  'bg-zinc-900 text-zinc-500',
  empty:   'bg-zinc-600 text-white hover:bg-zinc-500',
}

const statusColorsCopa: Record<LetterStatus, string> = {
  correct: 'bg-[#009c3b] text-white',
  present: 'bg-[#f5c400] text-zinc-900',
  absent:  'bg-[#0d2240] text-zinc-400',
  empty:   'bg-[#1a3a5c] text-white hover:bg-[#1f4a73]',
}

export default function Keyboard({ keyboardState, onKey, onEnter, onBackspace, disabled, copaTheme }: KeyboardProps) {
  const colors = copaTheme ? statusColorsCopa : statusColors
  function handleClick(key: string) {
    if (disabled) return
    if (key === 'ENTER') onEnter()
    else if (key === '⌫') onBackspace()
    else onKey(key)
  }

  return (
    <div className="flex flex-col gap-1 sm:gap-1.5 w-full max-w-lg mx-auto">
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
                  ${isWide ? 'px-2 text-xs min-w-[44px] sm:px-3 sm:text-sm sm:min-w-[56px]' : 'w-8 sm:w-10'}
                  h-12 sm:h-14 rounded font-bold uppercase
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${colors[status as LetterStatus]}
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
