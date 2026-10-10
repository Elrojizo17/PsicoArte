import { api } from './api'

export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    try {
      await api.delete('/push/unsubscribe/', { data: { endpoint: subscription.endpoint } })
    } catch (error) {
      console.warn('[PsicoArte notifications] backend unsubscribe failed during logout', error)
    }

    try {
      await subscription.unsubscribe()
    } catch (error) {
      console.warn('[PsicoArte notifications] browser unsubscribe failed during logout', error)
    }
  } catch (error) {
    console.warn('[PsicoArte notifications] push cleanup failed during logout', error)
  }
}
