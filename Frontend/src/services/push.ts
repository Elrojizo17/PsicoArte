import { api } from './api'

function withTimeout<T>(operation: Promise<T>, milliseconds = 3000) {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Operation timed out')), milliseconds)),
  ]).catch(() => undefined)
}

export function logoutCurrentSession(token: string | null) {
  if (!token) return
  void withTimeout(api.post('/logout/', {}, {
    headers: { Authorization: `Token ${token}` },
    timeout: 3000,
  }))
  void withTimeout((async () => {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
  })())
}
