import { useEffect, useState } from 'react'
import { BellRing, Clock3, CreditCard, Save, Send, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/Feedback'
import { api, endpoints } from '../services/api'
import { confirmAction, showError, showSuccess } from '../services/alerts'

type Template = { tipo: string; texto: string; activo: boolean }
const cards = [
  { tipo: 'recordatorio_clase', titulo: 'Recordatorio de inicio de clase', icon: Clock3, placeholders: '{alumno}, {hora}, {jornada}', toggle: true },
  { tipo: 'recordatorio_recogida', titulo: 'Recordatorio de recogida', icon: BellRing, placeholders: '{alumno}, {hora}, {jornada}', toggle: true },
  { tipo: 'aviso_pago', titulo: 'Aviso de pago pendiente', icon: CreditCard, placeholders: '{alumno}', toggle: false },
]

export function AutomatizacionPage() {
  const [templates, setTemplates] = useState<Record<string, Template>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get<Template[]>(endpoints.plantillas).then(({ data }) => {
      setTemplates(Object.fromEntries(data.map(template => [template.tipo, template])))
    }).catch(() => setError('No se pudieron cargar las plantillas.')).finally(() => setLoading(false))
  }, [])

  const update = (tipo: string, changes: Partial<Template>) => setTemplates(current => ({ ...current, [tipo]: { ...current[tipo], ...changes } }))

  const save = async (tipo: string) => {
    const template = templates[tipo]
    if (!template) return
    setSaving(tipo)
    try {
      const { data } = await api.patch<Template>(`${endpoints.plantillas}${tipo}/`, { texto: template.texto, ...(tipo !== 'aviso_pago' ? { activo: template.activo } : {}) })
      setTemplates(current => ({ ...current, [tipo]: data }))
      await showSuccess('Plantilla guardada', 'Los cambios quedaron aplicados.')
    } catch { await showError('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.') }
    finally { setSaving(null) }
  }

  const sendNow = async () => {
    if (!await confirmAction('¿Enviar recordatorio de pago a todos los acudientes con pago pendiente?', 'Se enviará un mensaje a cada acudiente con alumnos sin pago o con pago vencido.')) return
    setSending(true)
    try {
      const { data } = await api.post<{ enviados: number }>(endpoints.avisoPagos)
      await showSuccess('Avisos enviados', `Se notificó a ${data.enviados} acudiente${data.enviados === 1 ? '' : 's'}.`)
    } catch { await showError('No se pudieron enviar los avisos', 'Revisa tu conexión e inténtalo de nuevo.') }
    finally { setSending(false) }
  }

  return <section className="page-enter">
    <PageHeader title="Automatización de mensajes" description="Edita los mensajes automáticos y gestiona los avisos de pago a las familias." />
    {error && <div className="mb-4"><ErrorState message={error} /></div>}
    {loading ? <LoadingState /> : <div className="grid gap-5 xl:grid-cols-2">
      {cards.map(({ tipo, titulo, icon: Icon, placeholders, toggle }) => {
        const template = templates[tipo]
        if (!template) return null
        return <article key={tipo} className="rounded-2xl border border-primary-light/60 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-background p-3 text-primary"><Icon size={21} /></span><h2 className="text-lg font-bold text-primary-dark">{titulo}</h2></div>
          <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor={tipo}>Texto del mensaje</label>
          <textarea id={tipo} rows={5} value={template.texto} onChange={event => update(tipo, { texto: event.target.value })} className="w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-primary-dark focus:ring-2 focus:ring-primary/15" />
          <p className="mt-2 text-xs text-slate-500">Puedes usar: {placeholders}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {toggle ? <button type="button" onClick={() => update(tipo, { activo: !template.activo })} aria-pressed={template.activo} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${template.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {template.activo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}{template.activo ? 'Activo' : 'Inactivo'}
            </button> : <span />}
            <div className="flex gap-2">
              {tipo === 'aviso_pago' && <button type="button" disabled={sending} onClick={() => void sendNow()} className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-background disabled:opacity-50"><Send size={16} />{sending ? 'Enviando…' : 'Enviar ahora'}</button>}
              <button type="button" disabled={saving === tipo} onClick={() => void save(tipo)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"><Save size={16} />{saving === tipo ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </article>
      })}
    </div>}
  </section>
}
