'use client'

import { useNotifications } from '@/hooks/useNotifications'

interface NotificationsPromptProps {
  authToken: string
  onDismiss: () => void
}

/**
 * Modal de opt-in para notificações push.
 * Exibido uma única vez, após a primeira partida concluída.
 * Gate via localStorage: 'char5_notif_asked'.
 */
export default function NotificationsPrompt({ authToken, onDismiss }: NotificationsPromptProps) {
  const { supported, isLoading, subscribe } = useNotifications()

  // Se o browser não suporta push, não exibir
  if (!supported) return null

  async function handleAccept() {
    localStorage.setItem('char5_notif_asked', '1')
    const ok = await subscribe(authToken)

    // trackEvent via gtag direto (sem importar — a função existe no window)
    if (typeof window !== 'undefined') {
      window.gtag?.('event', ok ? 'notification_opted_in' : 'notification_permission_denied')
    }

    onDismiss()
  }

  function handleDecline() {
    localStorage.setItem('char5_notif_asked', '1')
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'notification_opted_out')
    }
    onDismiss()
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700">
      <p className="text-zinc-300 text-sm text-center mb-3 flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        Quer ser avisado quando a próxima palavra estiver disponível?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDecline}
          disabled={isLoading}
          className="flex-1 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors
            disabled:opacity-40"
        >
          Não, obrigado
        </button>
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="flex-1 py-2 text-sm font-semibold bg-zinc-700 text-white
            rounded-lg hover:bg-zinc-600 active:scale-95 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Aguarde…' : 'Sim, me avise'}
        </button>
      </div>
    </div>
  )
}
