'use client'

interface SkipModalProps {
  currentMaxScore: number
  skipPenalty: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export default function SkipModal({
  currentMaxScore,
  skipPenalty,
  onConfirm,
  onCancel,
  isLoading,
}: SkipModalProps) {
  const scoreAfterSkip = Math.max(currentMaxScore - skipPenalty, 10)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 className="text-white text-xl font-bold text-center">Pular o timer?</h2>

        <div className="bg-zinc-900 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Pontuação atual</span>
            <span className="text-white font-medium">{currentMaxScore} pts</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>Penalidade por skip</span>
            <span>−{skipPenalty} pts</span>
          </div>
          <div className="border-t border-zinc-700 pt-2 flex justify-between font-bold">
            <span className="text-zinc-300">Após o skip</span>
            <span className="text-white">{scoreAfterSkip} pts</span>
          </div>
        </div>

        <p className="text-zinc-400 text-sm text-center">
          Pular o timer também quebra o seu streak diário.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300
              hover:border-zinc-400 hover:text-white transition-colors font-medium
              disabled:opacity-50"
          >
            Aguardar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500
              text-white font-medium transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Pulando...' : 'Pular'}
          </button>
        </div>
      </div>
    </div>
  )
}
