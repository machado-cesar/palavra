interface StreakRecoveryModalProps {
  prevStreak: number
  tokens: number
  onRecover: () => void
  onDecline: () => void
  isLoading: boolean
}

export default function StreakRecoveryModal({
  prevStreak,
  tokens,
  onRecover,
  onDecline,
  isLoading,
}: StreakRecoveryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl">

        <div className="text-center space-y-1">
          <div className="text-3xl">🛡️</div>
          <h2 className="text-lg font-bold">Sequência interrompida</h2>
          <p className="text-zinc-400 text-sm">
            Sua sequência de{' '}
            <span className="text-orange-400 font-semibold">{prevStreak} {prevStreak === 1 ? 'dia' : 'dias'}</span>{' '}
            foi interrompida. Você pode gastar 1 token para recuperá-la.
          </p>
        </div>

        <div className="bg-zinc-700/50 rounded-xl p-3 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Tokens disponíveis</span>
          <span className="font-semibold">🛡️ {tokens}</span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onRecover}
            disabled={isLoading}
            className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
              rounded-lg hover:bg-zinc-100 active:scale-95 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Recuperando…' : `Usar 1 token e manter sequência de ${prevStreak} dias`}
          </button>
          <button
            onClick={onDecline}
            disabled={isLoading}
            className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Perder a sequência e continuar
          </button>
        </div>
      </div>
    </div>
  )
}
