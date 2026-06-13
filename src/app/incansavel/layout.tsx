import type { Metadata } from 'next'

const BASE_URL = 'https://char5.com.br'
const TITLE = 'Modo Incansável — char[5]'
const DESCRIPTION = 'Jogue sem parar. Acumule palavras e dispute o ranking diário.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/incansavel`,
    siteName: 'char[5]',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: `${BASE_URL}/og-incansavel.png`,
        width: 1200,
        height: 630,
        alt: 'char[5] · Modo Incansável',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/og-incansavel.png`],
  },
}

export default function IncansavelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
