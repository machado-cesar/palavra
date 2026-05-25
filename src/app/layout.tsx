import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = 'https://palavra-xck5.vercel.app'
const TITLE = 'char[5] — O Wordle em português'
const DESCRIPTION = 'Adivinhe a palavra de 5 letras. Um novo desafio todo dia.'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: TITLE,
    template: `%s | char[5]`,
  },
  description: DESCRIPTION,
  applicationName: 'char[5]',
  keywords: ['wordle', 'palavra', 'jogo', 'português', 'char5', 'letras'],
  authors: [{ name: 'char[5]' }],
  robots: { index: true, follow: true },
  themeColor: '#18181b',
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE_URL,
    siteName: 'char[5]',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body className={`${inter.className} bg-zinc-900 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
