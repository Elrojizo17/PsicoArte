import { useEffect, useRef, useState } from 'react'
import { Bell, BellRing, MessageCircle } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { api, endpoints } from '../services/api'
import type { Conversacion } from '../types'

interface Props { to: string; label: string; compact?: boolean }

export function MessageNotifications({ to, label, compact = false }: Props) {
  const [unread, setUnread] = useState(0)
  const [notice, setNotice] = useState('')
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const previousUnread = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const { data } = await api.get<Conversacion[]>(endpoints.conversaciones)
        if (!active) return
        const total = data.reduce((sum, conversation) => sum + conversation.no_leidos, 0)
        const previous = previousUnread.current
        previousUnread.current = total
        setUnread(total)
        if (previous !== null && total > previous) {
          const difference = total - previous
          const text = `${difference} mensaje${difference === 1 ? '' : 's'} nuevo${difference === 1 ? '' : 's'}`
          setNotice(text)
          window.setTimeout(() => setNotice(''), 5000)
          if ('Notification' in window && Notification.permission === 'granted') {
            const desktop = new Notification('PsicoArte - Mensajes', { body: text, tag: 'psicoarte-mensajes' })
            desktop.onclick = () => { window.focus(); window.location.assign(to) }
          }
        }
      } catch { /* Keep the last known unread count while offline. */ }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [to])

  const requestPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().then(setPermission)
    }
  }

  return <>
    <NavLink to={to} onClick={requestPermission} className={({ isActive }) => `${compact ? 'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:bg-primary-dark lg:justify-start lg:px-4' : 'group flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark lg:justify-start lg:px-4'} ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}>
      <MessageCircle size={18} strokeWidth={2.4}/><span>{label}</span>
      {permission !== 'unsupported' && (permission === 'granted' ? <BellRing size={15} aria-label="Notificaciones de escritorio activas"/> : <Bell size={15} aria-label="Activar notificaciones de escritorio"/>)}
      {unread > 0 && <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-primary-dark" aria-label={`${unread} mensajes sin leer`}>{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
    {notice && <div role="status" className="fixed bottom-5 right-20 z-[60] flex items-center gap-3 rounded-xl bg-primary-dark px-4 py-3 text-sm font-bold text-white shadow-lg"><MessageCircle size={18}/>{notice}<NavLink to={to} className="underline">Ver</NavLink></div>}
  </>
}
