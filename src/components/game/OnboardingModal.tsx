'use client'

import { useState } from 'react'

interface OnboardingModalProps {
  onConfirm: () => void
}

function TileRow({ tiles }: { tiles: { letter: string; bg: string }[] }) {
  return (
    <div className="flex gap-1.5">
      {tiles.map(({ letter, bg }, i) => (
        <div
          key={i}
          className={`${bg} w-9 h-9 flex items-center justify-center rounded text-white font-bold text-sm font-mono`}
        >
          {letter}
        </div>
      ))}
    </div>
  )
}

export default function OnboardingModal({ onConfirm }: OnboardingModalProps) {
  const [page, setPage] = useState(0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-2xl p-6 shadow-2xl">

        {/* Logo */}
        <div className="flex justify-center gap-1.5 mb-4">
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

        {page === 0 ? (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-center">Como jogar</h2>

            <p className="text-sm text-zinc-400 text-center">
              Adivinhe a palavra de 5 letras em até 6 tentativas.<br />
              Após cada tentativa, as peças indicam o quão perto você está.
            </p>

            <div className="space-y-4">
              {/* Verde */}
              <div className="space-y-1.5">
                <TileRow tiles={[
                  { letter: 'T', bg: 'bg-green-600' },
                  { letter: 'R', bg: 'bg-zinc-700' },
                  { letter: 'I', bg: 'bg-zinc-700' },
                  { letter: 'L', bg: 'bg-zinc-700' },
                  { letter: 'H', bg: 'bg-zinc-700' },
                ]} />
                <p className="text-sm text-zinc-300">
                  <span className="text-green-400 font-semibold">T</span> está na posição certa.
                </p>
              </div>

              {/* Amarelo */}
              <div className="space-y-1.5">
                <TileRow tiles={[
                  { letter: 'C', bg: 'bg-zinc-700' },
                  { letter: 'H', bg: 'bg-zinc-700' },
                  { letter: 'O', bg: 'bg-yellow-500' },
                  { letter: 'R', bg: 'bg-zinc-700' },
                  { letter: 'O', bg: 'bg-zinc-700' },
                ]} />
                <p className="text-sm text-zinc-300">
                  <span className="text-yellow-400 font-semibold">O</span> está na palavra, mas em outra posição.
                </p>
              </div>

              {/* Cinza */}
              <div className="space-y-1.5">
                <TileRow tiles={[
                  { letter: 'P', bg: 'bg-zinc-700' },
                  { letter: 'L', bg: 'bg-zinc-700' },
                  { letter: 'U', bg: 'bg-zinc-700' },
                  { letter: 'M', bg: 'bg-zinc-900' },
                  { letter: 'A', bg: 'bg-zinc-700' },
                ]} />
                <p className="text-sm text-zinc-300">
                  <span className="text-zinc-500 font-semibold">M</span> não está na palavra.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              Acentos são preenchidos automaticamente e ignorados nas dicas.
            </p>

            <button
              onClick={() => setPage(1)}
              className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900
                rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
            >
              Próximo
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-center">Pontuação e sequência</h2>

            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex gap-3">
                <span className="text-zinc-500 mt-0.5 shrink-0">1.</span>
                <span>
                  Cada tentativa errada reduz sua pontuação — mas você pode <span className="text-white font-medium">recuperar até 100 pontos</span> esperando antes da próxima tentativa.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-zinc-500 mt-0.5 shrink-0">2.</span>
                <span>Volte todo dia para construir seu streak e subir no ranking.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-zinc-500 mt-0.5 shrink-0">3.</span>
                <span>
                  A cada 3 dias de sequência você ganha 1 escudo 🛡️. Se perder uma partida, pode usá-lo para não perder o streak.
                </span>
              </li>
            </ul>

            <div className="flex gap-2">
              <button
                onClick={() => setPage(0)}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-700
                  rounded-lg hover:bg-zinc-600 active:scale-95 transition-all"
              >
                ← Voltar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 text-sm font-semibold bg-white text-zinc-900
                  rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
              >
                Jogar!
              </button>
            </div>
          </div>
        )}

        {/* Indicador de página */}
        <div className="flex justify-center gap-1.5 mt-4">
          {[0, 1].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-white' : 'w-1.5 bg-zinc-600'}`}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
