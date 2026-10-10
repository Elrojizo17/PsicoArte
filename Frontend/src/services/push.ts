import { api } from './api'

export async function logoutCurrentSession() {
  try {
    await api.post('/logout/')
  } catch {
    console.warn('[PsicoArte session] server logout failed; continuing with local logout')
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
  } catch {
    console.warn('[PsicoArte notifications] browser unsubscribe failed during logout')
  }
}
