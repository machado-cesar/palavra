import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como Jogar — Modo Incansável',
  description: 'Regras do modo incansável do char[5]: jogue sem limite, acumule palavras e dispute o ranking diário.',
}

function LetterBox({ letter, color }: { letter: string; color: 'correct' | 'present' | 'absent' | 'empty' }) {
  const colors = {
    correct: 'bg-green-600 border-green-600 text-white',
    present: 'bg-yellow-500 border-yellow-500 text-white',
    absent:  'bg-zinc-600 border-zinc-600 text-white',
    empty:   'border-zinc-600 text-white',
  }
  return (
    <div className={`w-12 h-12 flex items-center justify-center border-2 text-xl font-bold uppercase ${colors[color]}`}>
      {letter}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full space-y-3">
      <h2 className="text-base font-bold text-zinc-200 uppercase tracking-widest border-b border-zinc-700 pb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function IncansavelRegrasPage() {
  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 gap-6 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-3">
        <div className="flex items-center gap-3">
          <a href="/incansavel" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Incansável
          </a>
          <span className="text-xl font-bold tracking-widest font-mono">
            char[5] <span className="text-zinc-500 text-sm font-normal">· incansável</span>
          </span>
        </div>
        <a href="/incansavel/ranking" className="text-zinc-400 hover:text-white text-sm transition-colors">
          Ranking
        </a>
      </header>

      <h1 className="text-xl font-bold w-full">Modo Incansável</h1>

      {/* O que é */}
      <Section title="O que é">
        <p className="text-zinc-300 text-sm leading-relaxed">
          O modo incansável é para quem quer praticar sem parar. Não há limite de partidas por dia —
          cada palavra acertada conta para o seu placar do dia.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          O objetivo não é pontuar numa escala de 1.500 pts, mas sim{' '}
          <strong className="text-white">acertar o maior número de palavras possível no dia</strong>.
        </p>
      </Section>

      {/* Diferenças do modo diário */}
      <Section title="Diferenças do modo diário">
        <div className="space-y-2">
          {[
            { icon: '∞',  label: 'Partidas ilimitadas',     desc: 'Jogue quantas vezes quiser. Ao terminar uma palavra, clique em "Próxima palavra".' },
            { icon: '🔢', label: 'Placar por quantidade',   desc: 'O que conta é quantas palavras você acertou no dia, não a pontuação de cada partida.' },
            { icon: '🚫', label: 'Sem score nem recovery',  desc: 'Não há barra de pontuação nem timer de recuperação. Tente o quanto quiser, sem penalidade de tempo.' },
            { icon: '🔥', label: 'Sem impacto no streak',   desc: 'Jogar aqui não afeta sua sequência diária nem seus escudos do modo principal.' },
            { icon: '🃏', label: 'Palavras diferentes',     desc: 'A palavra do dia do modo principal nunca aparece aqui. As últimas 10 palavras jogadas também são evitadas.' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex gap-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
              <span className="text-xl shrink-0 w-7 text-center">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{label}</p>
                <p className="text-sm text-zinc-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cores */}
      <Section title="O que as cores significam">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="C" color="correct" />
              <LetterBox letter="A" color="empty" />
              <LetterBox letter="S" color="empty" />
              <LetterBox letter="A" color="empty" />
              <LetterBox letter="L" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-green-400 font-semibold">Verde</span> — letra correta na posição certa.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="P" color="empty" />
              <LetterBox letter="R" color="present" />
              <LetterBox letter="A" color="empty" />
              <LetterBox letter="Z" color="empty" />
              <LetterBox letter="O" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-yellow-400 font-semibold">Amarelo</span> — existe na palavra, mas na posição errada.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="T" color="empty" />
              <LetterBox letter="R" color="empty" />
              <LetterBox letter="U" color="absent" />
              <LetterBox letter="Q" color="empty" />
              <LetterBox letter="E" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-400 font-semibold">Cinza</span> — letra não está na palavra.
            </p>
          </div>
        </div>
      </Section>

      {/* Ranking */}
      <Section title="Ranking">
        <p className="text-zinc-300 text-sm leading-relaxed">
          O ranking do modo incansável é separado do modo diário e classifica quem acertou mais palavras no dia.
          Ele reseta à meia-noite, junto com a palavra do modo principal.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Seu placar no ranking atualiza automaticamente a cada palavra acertada — sem precisar sair do jogo.
        </p>
      </Section>

      {/* Troféus */}
      <Section title="Troféu de campeão 🏆">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Quem acertar mais palavras no dia leva um troféu. Em caso de empate, todos os empatados são premiados.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Os troféus acumulam a cada dia de campeonato e aparecem no ranking ao lado do seu nome — exibidos
          como <span className="text-yellow-400 font-semibold">🏆²</span>, onde o número indica quantos dias
          você foi campeão.
        </p>
      </Section>

      {/* CTAs */}
      <div className="w-full flex flex-col gap-2 mt-2">
        <a
          href="/incansavel"
          className="w-full py-3 text-center text-sm font-semibold bg-white text-zinc-900
            rounded-xl hover:bg-zinc-100 active:scale-95 transition-all"
        >
          Jogar agora →
        </a>
        <a
          href="/como-jogar"
          className="w-full py-2.5 text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Ver regras do modo diário
        </a>
      </div>

    </div>
  )
}
