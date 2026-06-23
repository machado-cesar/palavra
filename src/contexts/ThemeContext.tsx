'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeContextValue {
  copaTheme: boolean
  toggleCopaTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  copaTheme: true,
  toggleCopaTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [copaTheme, setCopaTheme] = useState(true)

  // Hidratar do localStorage após montagem
  useEffect(() => {
    const stored = localStorage.getItem('char5_copa_theme')
    setCopaTheme(stored !== '0')
  }, [])

  // Aplicar/remover classe no body
  useEffect(() => {
    if (copaTheme) {
      document.body.classList.add('copa')
    } else {
      document.body.classList.remove('copa')
    }
  }, [copaTheme])

  function toggleCopaTheme() {
    const next = !copaTheme
    setCopaTheme(next)
    localStorage.setItem('char5_copa_theme', next ? '1' : '0')
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'copa_theme_toggled', { enabled: next })
    }
  }

  return (
    <ThemeContext.Provider value={{ copaTheme, toggleCopaTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
