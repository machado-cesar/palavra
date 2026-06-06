interface OnboardingModalProps {
  onConfirm: () => void
}

export default function OnboardingModal({ onConfirm }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl">

        <div className="text-center space-y-1">
          <div className="text-3xl">🟩</div>
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
              Se um timer aparecer, você pode <span className="text-white font-medium">esperar</span> (mantém ou ganha pontos)
              ou <span className="text-white font-medium">pular</span> (perde pontos).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 mt-0.5">3.</span>
            <span>Volte todo dia para construir seu streak e subir no ranking.</span>
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
