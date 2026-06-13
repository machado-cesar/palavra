declare module 'web-push' {
  interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  interface PushSubscriptionJSON {
    endpoint: string
    keys?: {
      p256dh: string
      auth: string
    }
  }

  interface RequestOptions {
    headers?: Record<string, string>
    TTL?: number
  }

  function generateVAPIDKeys(): VapidKeys
  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function sendNotification(
    subscription: PushSubscriptionJSON,
    payload?: string | Buffer,
    options?: RequestOptions
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>

  export { generateVAPIDKeys, setVapidDetails, sendNotification }
  export default { generateVAPIDKeys, setVapidDetails, sendNotification }
}
