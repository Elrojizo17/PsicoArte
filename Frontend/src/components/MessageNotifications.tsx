import { useEffect, useRef, useState } from 'react'
import { Bell, BellRing, MessageCircle } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { api, endpoints } from '../services/api'
import type { Conversacion } from '../types'

interface Props { to: string; label: string; compact?: boolean; onNavigate?: () => void }

export function MessageNotifications({ to, label, compact = false, onNavigate }: Props) {
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [notice, setNotice] = useState('')
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const previousUnread = useRef<number | null>(null)
  const pendingSummary = useRef<number | null>(null)

  const registerPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    try {
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription && Notification.permission !== 'granted') return

      const { data } = await api.get<{ publicKey: string }>('/push/public-key/')
      const decodeKey = (value: string) => {
        const padded = value + '='.repeat((4 - value.length % 4) % 4)
        const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
        return Uint8Array.from(raw, char => char.charCodeAt(0))
      }
      const applicationServerKey = decodeKey(data.publicKey)
      const hasCurrentKey = (current: PushSubscription) => {
        const key = current.options.applicationServerKey
        if (!key) return false
        const bytes = new Uint8Array(key)
        return bytes.length === applicationServerKey.length
          && bytes.every((byte, index) => byte === applicationServerKey[index])
      }

      if (subscription && !hasCurrentKey(subscription)) {
        await subscription.unsubscribe()
        subscription = null
      }
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      await api.post('/push/subscriptions/', subscription.toJSON())
    } catch (error) {
      console.error('[PsicoArte notifications] push subscription failed', error)
    }
  }

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return

    const requestPermission = () => {
      window.removeEventListener('click', requestPermission)
      window.removeEventListener('touchend', requestPermission)
      if (Notification.permission !== 'default') return
      console.log('[PsicoArte notifications] requesting permission after first user interaction')
      void Notification.requestPermission().then(result => {
        console.log('[PsicoArte notifications] permission request result', result)
        setPermission(result)
        if (result === 'granted') void registerPush()
      }).catch(error => console.error('[PsicoArte notifications] permission request failed', error))
    }

    window.addEventListener('click', requestPermission, { once: true })
    window.addEventListener('touchend', requestPermission, { once: true, passive: true })
    return () => {
      window.removeEventListener('click', requestPermission)
      window.removeEventListener('touchend', requestPermission)
    }
  }, [])

  useEffect(() => {
    void registerPush()
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      console.log('[PsicoArte notifications] polling conversations')
      try {
        const { data } = await api.get<Conversacion[]>(endpoints.conversaciones)
        if (!active) return
        const total = data.reduce((sum, conversation) => sum + conversation.no_leidos, 0)
        const previous = previousUnread.current
        console.log('[PsicoArte notifications] polling result', { unreadTotal: total, previousUnread: previous, permission: 'Notification' in window ? Notification.permission : 'unsupported' })
        previousUnread.current = total
        setUnread(total)
        const firstPollWithUnread = previous === null && total > 0
        if (firstPollWithUnread && !sessionStorage.getItem('psicoarte-unread-summary-shown')) pendingSummary.current = total
        const unreadIncreased = previous !== null && total > previous
        const hasPendingSummary = pendingSummary.current !== null && !sessionStorage.getItem('psicoarte-unread-summary-shown')
        if (hasPendingSummary || unreadIncreased) {
          const summaryKey = 'psicoarte-unread-summary-shown'
          const isSummary = hasPendingSummary
          const summaryTotal = pendingSummary.current ?? total
          const difference = unreadIncreased ? total - (previous || 0) : summaryTotal
          const text = isSummary
            ? `Tienes ${summaryTotal} mensajes sin leer`
            : `${difference} mensaje${difference === 1 ? '' : 's'} nuevo${difference === 1 ? '' : 's'}`
          setNotice(text)
          window.setTimeout(() => setNotice(''), 5000)
          const currentPermission = 'Notification' in window ? Notification.permission : 'unsupported'
          const isMessagingScreen = location.pathname === to || location.pathname.startsWith(`${to}/`)
          const shouldShowDesktop = document.visibilityState !== 'visible' || !isMessagingScreen
          console.log('[PsicoArte notifications] unread notification decision', { isSummary, difference, currentPermission, visibilityState: document.visibilityState, isMessagingScreen, shouldShowDesktop })
          if (isSummary && !shouldShowDesktop) {
            console.log('[PsicoArte notifications] initial summary suppressed on visible messaging screen')
            sessionStorage.setItem(summaryKey, '1')
            pendingSummary.current = null
            return
          }
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              if (!shouldShowDesktop) {
                console.log('[PsicoArte notifications] desktop notification suppressed on visible messaging screen')
                return
              }
              const desktop = new Notification('PsicoArte - Mensajes', { body: text, tag: 'psicoarte-mensajes' })
              if (isSummary) {
                sessionStorage.setItem(summaryKey, '1')
                pendingSummary.current = null
              }
              console.log('[PsicoArte notifications] desktop notification constructed')
              desktop.onclick = () => { window.focus(); window.location.assign(to) }
            } catch (error) {
              console.error('[PsicoArte notifications] desktop notification failed', error)
            }
          } else {
            console.log('[PsicoArte notifications] desktop notification skipped: permission unavailable or not granted', { currentPermission })
            if (currentPermission === 'denied' && isSummary) pendingSummary.current = null
          }
        }
      } catch (error) { console.error('[PsicoArte notifications] conversation polling failed', error) /* Keep the last known unread count while offline. */ }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [location.pathname, to])

  return <>
    <NavLink to={to} onClick={() => onNavigate?.()} className={({ isActive }) => `${compact ? 'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:bg-primary-dark lg:justify-start lg:px-4' : 'group flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark lg:justify-start lg:px-4'} ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}>
      <MessageCircle size={18} strokeWidth={2.4}/><span>{label}</span>
      {permission !== 'unsupported' && (permission === 'granted' ? <BellRing size={15} aria-label="Notificaciones de escritorio activas"/> : <Bell size={15} aria-label="Activar notificaciones de escritorio"/>)}
      {unread > 0 && <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-primary-dark" aria-label={`${unread} mensajes sin leer`}>{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
    {notice && <div role="status" className="fixed bottom-5 right-20 z-[60] flex items-center gap-3 rounded-xl bg-primary-dark px-4 py-3 text-sm font-bold text-white shadow-lg"><MessageCircle size={18}/>{notice}<NavLink to={to} className="underline">Ver</NavLink></div>}
  </>
}
