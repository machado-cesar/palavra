/**
 * char[5] — Service Worker
 * Responsável por receber notificações push e exibi-las ao usuário.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'char[5]', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'char[5] — nova palavra!'
  const options = {
    body: data.body || 'A palavra de hoje está disponível. Venha jogar!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'char5-daily',          // substitui notificação anterior do mesmo dia
    renotify: false,
    data: { url: data.url || '/game' },
    actions: [
      { action: 'play', title: 'Jogar agora' },
      { action: 'dismiss', title: 'Depois' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/game'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Focar janela existente se já estiver aberta
        const existing = clients.find(c => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(targetUrl)
          return
        }
        // Abrir nova janela
        return self.clients.openWindow(targetUrl)
      })
  )
})
