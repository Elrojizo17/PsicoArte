import { useCallback, useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader } from '../components/PageHeader'
import { api, getApiErrorMessage } from '../services/api'
import { confirmAction } from '../services/alerts'

type DeviceSession = {
  id: number
  nombre: string
  creado: string
  ultimo_uso: string
  actual: boolean
}

export function DeviceSessionsPage() {
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closingId, setClosingId] = useState<number | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get<DeviceSession[]>('/devices/')
      setSessions(data)
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'No se pudieron cargar tus dispositivos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const closeSession = async (session: DeviceSession) => {
    if (!await confirmAction('¿Cerrar esta sesión?', `${session.nombre} dejará de tener acceso a tu cuenta.`)) return

    setClosingId(session.id)
    setError('')
    try {
      await api.delete(`/devices/${session.id}/`)
      if (session.actual) {
        try {
          const registration = await navigator.serviceWorker?.getRegistration()
          const subscription = await registration?.pushManager.getSubscription()
          if (subscription) await subscription.unsubscribe()
        } catch (reason) {
          console.warn('[PsicoArte notifications] could not unsubscribe after closing current device', reason)
        }
        localStorage.removeItem('token')
        localStorage.removeItem('session_id')
        localStorage.removeItem('tipo')
        localStorage.removeItem('grupo')
        localStorage.removeItem('nombre')
        window.location.assign('/login')
        return
      }
      setSessions(current => current.filter(item => item.id !== session.id))
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'No se pudo cerrar la sesión del dispositivo.'))
    } finally {
      setClosingId(null)
    }
  }

  return <section className="page-enter">
    <PageHeader title="Mis dispositivos" description="Revisa dónde está abierta tu cuenta y cierra las sesiones que ya no uses." />
    {error && <div className="mb-4"><ErrorState message={error} /></div>}
    {loading ? <LoadingState /> : sessions.length === 0
      ? <p className="rounded-xl border border-border bg-white p-5 text-sm text-ink/70">No hay sesiones activas registradas.</p>
      : <div className="grid gap-3">
        {sessions.map(session => (
          <article key={session.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary-light/70 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <Smartphone className="shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="font-semibold text-primary-dark">{session.nombre}{session.actual ? ' · Este dispositivo' : ''}</h2>
                <p className="text-sm text-ink/70">Último uso: {new Date(session.ultimo_uso).toLocaleString()}</p>
                <p className="text-xs text-ink/60">Sesión iniciada: {new Date(session.creado).toLocaleDateString()}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={closingId !== null}
              onClick={() => void closeSession(session)}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <X size={16} aria-hidden="true" />
              {closingId === session.id ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </article>
        ))}
      </div>}
  </section>
}
