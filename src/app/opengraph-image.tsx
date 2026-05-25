import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'char[5] — O Wordle em português'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SQUARES = [
  { letter: 'C', color: '#16a34a' },  // green
  { letter: 'H', color: '#ca8a04' },  // yellow
  { letter: 'A', color: '#16a34a' },  // green
  { letter: 'R', color: '#52525b' },  // gray
  { letter: '5', color: '#16a34a' },  // green
]

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#18181b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          padding: '0 80px',
        }}
      >
        {/* Quadrados decorativos */}
        <div style={{ display: 'flex', gap: 12 }}>
          {SQUARES.map(({ letter, color }, i) => (
            <div
              key={i}
              style={{
                width: 80,
                height: 80,
                background: color,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: 'monospace',
              }}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Título */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-4px',
            fontFamily: 'monospace',
            lineHeight: 1,
          }}
        >
          char[5]
        </div>

        {/* Subtítulo */}
        <div
          style={{
            fontSize: 28,
            color: '#a1a1aa',
            letterSpacing: 6,
            fontFamily: 'sans-serif',
            textTransform: 'uppercase',
          }}
        >
          O Wordle em Português
        </div>

        {/* Descrição */}
        <div
          style={{
            fontSize: 22,
            color: '#71717a',
            fontFamily: 'sans-serif',
            marginTop: -16,
          }}
        >
          Adivinhe a palavra de 5 letras. Um novo desafio todo dia.
        </div>
      </div>
    ),
    { ...size }
  )
}
