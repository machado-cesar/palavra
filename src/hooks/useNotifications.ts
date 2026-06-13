'use client'

import { useState, useEffect, useCallback } from 'react'

export type NotificationPermission = 'default' | 'granted' | 'denied'

export interface UseNotificationsReturn {
  supported: boolean
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  subscribe: (authToken: string) => Promise<boolean>
  unsubscribe: (authToken: string) => Promise<boolean>
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useNotifications(): UseNotificationsReturn {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!isSupported) return

    setSupported(true)
    setPermission(Notification.permission as NotificationPermission)

    // Verificar se já tem subscription ativa
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    })

    // Registrar o service worker
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[char5] Service worker registration failed:', err)
    })
  }, [])

  const subscribe = useCallback(async (authToken: string): Promise<boolean> => {
    if (!supported) return false
    setIsLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready

      // Pedir permissão se necessário
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission()
        setPermission(result as NotificationPermission)
        if (result !== 'granted') {
          setIsLoading(false)
          return false
        }
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('[char5] NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada')
        setIsLoading(false)
        return false
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      })

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (!res.ok) {
        console.error('[char5] Erro ao salvar subscription:', await res.text())
        setIsLoading(false)
        return false
      }

      setIsSubscribed(true)
      setPermission('granted')
      return true
    } catch (err) {
      console.error('[char5] Erro ao subscrever:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supported])

  const unsubscribe = useCallback(async (authToken: string): Promise<boolean> => {
    if (!supported) return false
    setIsLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ subscription: null }),
      })

      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error('[char5] Erro ao desinscrever:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supported])

  return { supported, permission, isSubscribed, isLoading, subscribe, unsubscribe }
}
