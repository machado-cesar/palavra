'use client'

import { useState, useEffect } from 'react'

const SURVEY_URL = 'https://forms.gle/1jnyLdAaCLj1EWmb9'
const STORAGE_KEY = 'char5_project_end_seen'

interface ProjectEndModalProps {
  onClose: () => void
}

export default function ProjectEndModal({ onClose }: ProjectEndModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, '1')
    onClose()
  }

  function handleSurveyClick() {
    window.gtag?.('event', 'project_end_survey_clicked', { source: 'project_end_modal' })
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={`relative w-full max-w-sm transition-all duration-300 ease-out
          ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-4 shadow-2xl">

          {/* Botão fechar */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
              rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>

          {/* Cabeçalho */}
          <div className="text-center space-y-1 pt-1">
            <div className="text-3xl">😀</div>
            <h2 className="text-lg font-bold leading-snug">
              Chegamos ao final do projeto <span className="font-mono tracking-widest">char[5]</span>!
            </h2>
          </div>

          {/* Corpo */}
          <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
            <p>
              Foram <strong className="text-white">milhares</strong> de partidas e muito aprendizado.
              Graças à participação de vocês, alcançamos os objetivos do projeto.
            </p>
            <p>
              Muito obrigado a todos que jogaram, divulgaram o projeto e compartilharam suas experiências.
            </p>
            <p>
              <strong className="text-white">O char[5] continuará disponível por mais um ano</strong>, então a diversão continua!
            </p>
            <p>
              Antes de encerrar, <em className="text-zinc-200">temos um último pedido</em>:{' '}
              <strong className="text-white">se você jogou o char[5] pelo menos uma vez</strong>,
              responda ao nosso questionário. Ele leva cerca de 2 minutos.
            </p>
          </div>

          {/* Botão principal */}
          <a
            href={SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleSurveyClick}
            className="block w-full py-3 text-center text-sm font-bold
              bg-green-600 hover:bg-green-500 text-white
              rounded-xl active:scale-95 transition-all shadow-lg"
          >
            Responda nossa pesquisa! →
          </a>

          {/* Rodapé */}
          <div className="text-center space-y-1">
            <p className="text-zinc-300 text-sm">Obrigado por fazer parte dessa jornada!</p>
            <p className="text-zinc-500 text-xs font-mono tracking-wider">Equipe char[5]</p>
          </div>

          {/* Link para continuar */}
          <button
            onClick={handleClose}
            className="block w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
          >
            Ver resultado do jogo →
          </button>

        </div>
      </div>
    </div>
  )
}
