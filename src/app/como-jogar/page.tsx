import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como Jogar',
  description: 'Aprenda as regras do char[5]: pontuação, timer progressivo, streak e tokens.',
}

function LetterBox({
  letter,
  color,
}: {
  letter: string
  color: 'correct' | 'present' | 'absent' | 'empty'
}) {
  const colors = {
    correct: 'bg-green-600 border-green-600 text-white',
    present: 'bg-yellow-500 border-yellow-500 text-white',
    absent:  'bg-zinc-600 border-zinc-600 text-white',
    empty:   'border-zinc-600 text-white',
  }
  return (
    <div
      className={`w-12 h-12 flex items-center justify-center border-2 text-xl font-bold uppercase ${colors[color]}`}
    >
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

export default function ComoJogarPage() {
  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 gap-6 max-w-lg mx-auto">

      {/* Header */}
      <header className="w-full flex justify-between items-center border-b border-zinc-700 pb-3">
        <a href="/game" className="text-2xl font-bold tracking-widest font-mono hover:text-zinc-300 transition-colors">
          char[5]
        </a>
        <div className="flex items-center gap-4">
          <a href="/leaderboard" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Ranking
          </a>
          <a href="/game" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Jogar
          </a>
        </div>
      </header>

      <h1 className="text-xl font-bold w-full">Como jogar</h1>

      {/* Objetivo */}
      <Section title="Objetivo">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Adivinhe a palavra secreta de <strong className="text-white">5 letras</strong> em até{' '}
          <strong className="text-white">6 tentativas</strong>. Uma nova palavra aparece todo dia à meia-noite.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Digite uma palavra e pressione <strong className="text-white">Enter</strong>. As cores das letras
          revelam o quanto você se aproximou.
        </p>
      </Section>

      {/* Cores */}
      <Section title="O que as cores significam">
        <div className="space-y-4">

          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="C" color="correct" />
              <LetterBox letter="A" color="empty" />
              <LetterBox letter="R" color="empty" />
              <LetterBox letter="T" color="empty" />
              <LetterBox letter="A" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-green-400 font-semibold">Verde</span> — letra correta na posição certa.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="P" color="empty" />
              <LetterBox letter="L" color="present" />
              <LetterBox letter="A" color="empty" />
              <LetterBox letter="N" color="empty" />
              <LetterBox letter="O" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-yellow-400 font-semibold">Amarelo</span> — letra existe na palavra, mas está na posição errada.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1 shrink-0">
              <LetterBox letter="T" color="empty" />
              <LetterBox letter="R" color="empty" />
              <LetterBox letter="E" color="absent" />
              <LetterBox letter="M" color="empty" />
              <LetterBox letter="O" color="empty" />
            </div>
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-400 font-semibold">Cinza</span> — letra não está na palavra.
            </p>
          </div>

        </div>
      </Section>

      {/* Timer */}
      <Section title="Timer progressivo">
        <p className="text-zinc-300 text-sm leading-relaxed">
          A partir do <strong className="text-white">2º erro</strong>, um timer de espera de 2 minutos é ativado antes da próxima tentativa.
          O timer sempre começa em 2 minutos — mas cada skip que você der aumenta o tempo do próximo:
        </p>
        <div className="w-full rounded-xl border border-zinc-700 overflow-hidden text-sm">
          <div className="grid grid-cols-2 bg-zinc-800 text-zinc-400 text-xs uppercase tracking-wide px-4 py-2">
            <span>Skips já usados</span>
            <span className="text-right">Próximo timer</span>
          </div>
          {[
            { skips: '0 skips', tempo: '2 minutos' },
            { skips: '1 skip',  tempo: '5 minutos' },
            { skips: '2 skips', tempo: '10 minutos' },
            { skips: '3 ou mais', tempo: '30 minutos' },
          ].map(({ skips, tempo }, i) => (
            <div
              key={i}
              className="grid grid-cols-2 px-4 py-3 border-t border-zinc-700/50 text-zinc-300"
            >
              <span>{skips}</span>
              <span className="text-right text-zinc-400">{tempo}</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-xs">
          Cada skip tem uma penalidade de <span className="text-white">−100 pontos</span>.
        </p>
      </Section>

      {/* Pontuação */}
      <Section title="Pontuação">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Você começa com <strong className="text-white">1.500 pontos</strong>. Cada erro ou skip reduz essa pontuação:
        </p>
        <div className="w-full rounded-xl border border-zinc-700 overflow-hidden text-sm">
          {[
            { label: 'Pontuação base', valor: '1.500 pts', cor: 'text-zinc-200' },
            { label: 'Por cada tentativa errada', valor: '−200 pts', cor: 'text-red-400' },
            { label: 'Por cada skip de timer',    valor: '−100 pts', cor: 'text-red-400' },
            { label: 'Mínimo ao acertar',         valor: '100 pts',  cor: 'text-green-400' },
          ].map(({ label, valor, cor }, i) => (
            <div
              key={i}
              className="flex justify-between px-4 py-3 border-t border-zinc-700/50 first:border-t-0 text-zinc-300"
            >
              <span>{label}</span>
              <span className={`font-semibold tabular-nums ${cor}`}>{valor}</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-xs">
          Perder (esgotar as 6 tentativas) resulta em <span className="text-white">0 pontos</span> e não entra no ranking do dia.
        </p>
      </Section>

      {/* Streak */}
      <Section title="Sequência (streak)">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Jogar todos os dias mantém sua <strong className="text-white">sequência 🔥</strong>. O número aparece
          no header e representa quantos dias consecutivos você jogou.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          A sequência só é mantida se você acertar a palavra <strong className="text-white">sem usar nenhum skip</strong>.
          Usar skip, perder todas as 6 tentativas ou não jogar no dia faz a sequência voltar a zero —
          a menos que um token a proteja.
        </p>
      </Section>

      {/* Tokens */}
      <Section title="Tokens 🛡️">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Tokens protegem sua sequência nos dias difíceis. Você os ganha por consistência e os gasta automaticamente quando precisa.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <span className="text-xl shrink-0">🪙</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Como ganhar</p>
              <p className="text-sm text-zinc-400">A cada 3 dias consecutivos de streak você ganha 1 token. Máximo de 5 acumulados.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <span className="text-xl shrink-0">🛡️</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Proteção automática</p>
              <p className="text-sm text-zinc-400">Se você perder uma partida e tiver tokens, 1 token é gasto automaticamente para preservar sua sequência.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
            <span className="text-xl shrink-0">🔄</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Dia perdido</p>
              <p className="text-sm text-zinc-400">Se você não jogou ontem e tem tokens, ao abrir o jogo aparecerá a opção de usar 1 token para restaurar sua sequência.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Ranking */}
      <Section title="Ranking">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Ao final de cada partida vencida, sua pontuação entra no ranking do dia. O top 10 fica visível
          na página de <a href="/leaderboard" className="text-zinc-300 underline hover:text-white transition-colors">Ranking</a>.
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Para aparecer no ranking com um nome, escolha um apelido após sua primeira partida.
          Se pular, você aparece como anônimo.
        </p>
      </Section>

      {/* CTA */}
      <a
        href="/game"
        className="w-full py-3 text-center text-sm font-semibold bg-white text-zinc-900
          rounded-xl hover:bg-zinc-100 active:scale-95 transition-all mt-2"
      >
        Jogar agora →
      </a>

    </div>
  )
}
