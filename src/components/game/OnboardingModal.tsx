interface OnboardingModalProps {
  onConfirm: () => void
}

export default function OnboardingModal({ onConfirm }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl">

        <div className="text-center space-y-3">
          <div className="flex justify-center gap-1.5">
            {[
              { letter: 'C', bg: 'bg-green-600' },
              { letter: 'H', bg: 'bg-yellow-500' },
              { letter: 'A', bg: 'bg-green-600' },
              { letter: 'R', bg: 'bg-zinc-600' },
              { letter: '5', bg: 'bg-green-600' },
            ].map(({ letter, bg }) => (
              <div
                key={letter}
                className={`${bg} w-9 h-9 flex items-center justify-center rounded text-white font-bold text-sm font-mono`}
              >
                {letter}
              </div>
            ))}
          </div>
          <h2 className="text-lg font-bold">Como funciona</h2>
        </div>

        <ul className="space-y-3 text-sm text-zinc-300">
          <li className="flex gap-3">
            <span className="text-zinc-500 mt-0.5">1.</span>
            <span>Adivinhe a palavra de 5 letras em até 6 tentativas.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 mt-0.5">2.</span>
            <span>
              Ao errar, você perde pontos — mas pode <span className="text-white font-medium">recuperar até 100</span> esperando antes da próxima tentativa. Quanto mais espera, mais recupera.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 mt-0.5">3.</span>
            <span>Volte todo dia para construir seu streak e subir no ranking.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 mt-0.5">4.</span>
            <span>
              A cada 3 dias de sequência você ganha 1 escudo 🛡️. Se perder uma partida, pode usá-lo para não perder o streak.
            </span>
          </li>
        </ul>

        <button
          onClick={onConfirm}
          className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
            rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
        >
          Entendi, jogar!
        </button>
      </div>
    </div>
  )
}
