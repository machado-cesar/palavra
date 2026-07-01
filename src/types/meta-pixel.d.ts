interface Window {
  fbq?: (
    type: 'track' | 'init' | 'trackCustom',
    eventName: string,
    params?: Record<string, unknown>
  ) => void
}
