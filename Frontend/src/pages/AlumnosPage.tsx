import { Fragment, useEffect, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { Field, SelectField } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import { confirmAction, showSuccess } from '../services/alerts'
import type { Alumno, Acudiente, Clase } from '../types'

type FormData = { ti: string; nombre_1: string; nombre_2: string; apellido_1: string; apellido_2: string; identificacion: string; tipo_sangre: string; numero_documento_acudiente: string; fecha_nacimiento: string }
const empty: FormData = { ti: '', nombre_1: '', nombre_2: '', apellido_1: '', apellido_2: '', identificacion: '', tipo_sangre: '', numero_documento_acudiente: '', fecha_nacimiento: '' }

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function AlumnosPage() {
  const [items, setItems] = useState<Alumno[]>([])
  const [acudientes, setAcudientes] = useState<Acudiente[]>([])
  const [classes, setClasses] = useState<Clase[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [students, guardians, scheduledClasses] = await Promise.all([
        api.get<Alumno[]>(endpoints.alumnos),
        api.get<Acudiente[]>(endpoints.acudientes),
        api.get<Clase[]>(endpoints.clases),
      ])
      setItems(students.data)
      setAcudientes(guardians.data)
      setClasses(scheduledClasses.data)
    } catch {
      setError('No se pudieron cargar alumnos, acudientes y clases.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const wasEditing = Boolean(editing)
    try {
      const payload = { ...form, identificacion: form.identificacion || null, fecha_nacimiento: form.fecha_nacimiento || null }
      if (editing) await api.patch(`${endpoints.alumnos}${editing}/`, payload)
      else await api.post(endpoints.alumnos, payload)
      setOpen(false)
      setForm(empty)
      setEditing(null)
      await showSuccess(wasEditing ? 'Alumno actualizado' : 'Alumno creado', 'La información se guardó correctamente.')
      void load()
    } catch {
      setError('No se pudo guardar el alumno. Confirma que el acudiente exista.')
    }
  }

  const remove = async (id: string) => {
    if (!await confirmAction('¿Eliminar alumno?', 'Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`${endpoints.alumnos}${id}/`)
      await showSuccess('Alumno eliminado', 'El registro se eliminó correctamente.')
      void load()
    } catch {
      setError('No se pudo eliminar el alumno.')
    }
  }

  return <section className="page-enter">
    <PageHeader
      eyebrow="Estudiantes"
      title="Alumnos"
      description={<span>Información académica y familiar de cada estudiante. <span className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary-dark"><BookOpen size={15} className="text-primary" aria-hidden="true" />Haz clic en este ícono para ver las clases programadas de cada alumno.</span></span>}
      actionLabel="Nuevo Alumno"
      action={() => { setEditing(null); setForm(empty); setOpen(true) }}
    />
    {error && <div className="mb-4"><ErrorState message={error}/></div>}
    {loading ? <LoadingState/> : <div className="overflow-hidden rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">
      <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-primary-light/50 bg-background/60 px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-dark md:grid"><span>Alumno</span><span>TI</span><span>Acudiente</span><span>Clases</span><span/></div>
      {items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aún no hay alumnos registrados.</p>}
      {items.map(item => {
        const studentClasses = item.clases ?? []
        const isExpanded = expanded === item.ti
        return <Fragment key={item.ti}>
          <div className="grid gap-3 border-b border-primary-light/30 px-5 py-4 last:border-0 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
            <div><p className="font-bold text-primary-dark">{item.nombre_1} {item.nombre_2} {item.apellido_1} {item.apellido_2}</p><p className="text-xs text-slate-400">{item.tipo_sangre || 'Tipo de sangre no registrado'}</p></div>
            <span className="text-sm text-slate-600">{item.ti}</span>
            <span className="text-sm text-slate-600">{item.acudiente_detalle ? `${item.acudiente_detalle.nombre_1} ${item.acudiente_detalle.apellido_1}` : 'Sin acudiente'}</span>
            <button type="button" onClick={() => setExpanded(isExpanded ? null : item.ti)} className="flex items-center gap-2 text-left text-sm font-semibold text-primary-dark hover:text-primary" aria-expanded={isExpanded} aria-label={`Ver ${studentClasses.length} clases programadas`}>
              <BookOpen size={15} className="text-primary"/>{studentClasses.length}{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            <div className="flex gap-2"><button aria-label="Editar alumno" onClick={() => { setEditing(item.ti); setForm({ ti: item.ti, nombre_1: item.nombre_1, nombre_2: item.nombre_2 || '', apellido_1: item.apellido_1, apellido_2: item.apellido_2 || '', identificacion: item.identificacion || '', tipo_sangre: item.tipo_sangre || '', numero_documento_acudiente: item.numero_documento_acudiente || item.acudiente_detalle?.numero_documento || '', fecha_nacimiento: item.fecha_nacimiento || '' }); setOpen(true) }} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={17}/></button><button aria-label="Eliminar alumno" onClick={() => void remove(item.ti)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={17}/></button></div>
          </div>
          {isExpanded && <div className="border-b border-primary-light/30 bg-background/60 px-5 py-4 md:col-span-5"><p className="mb-3 text-sm font-bold text-primary-dark">Clases programadas</p>{studentClasses.length === 0 ? <p className="text-sm text-slate-500">Este alumno no tiene clases programadas.</p> : <div className="grid gap-3 md:grid-cols-2">{studentClasses.map(studentClass => { const classDetail = classes.find(scheduledClass => scheduledClass.id_clase === studentClass.id_clase); const journey = classDetail?.jornada_detalle; return <article key={studentClass.id_clase} className="rounded-xl border border-border bg-white p-3"><p className="font-bold text-primary-dark">{journey ? `${journey.dia_semana} · ${journey.tipo_jornada}` : `Jornada #${studentClass.jornada}`}</p><div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2"><span><strong>Fecha:</strong> {formatDate(studentClass.fecha)}</span>{journey && <span><strong>Horario:</strong> {journey.hora_inicio} - {journey.hora_final}</span>}</div></article> })}</div>}</div>}
        </Fragment>
      })}
    </div>}
    {open && <Modal title={editing ? 'Editar alumno' : 'Nuevo alumno'} onClose={() => setOpen(false)}><form onSubmit={save} className="grid min-w-0 gap-4 grid-cols-1 md:grid-cols-2"><Field label="TI *" value={form.ti} disabled={Boolean(editing)} required onChange={e => setForm({ ...form, ti: e.target.value })}/><SelectField label="Acudiente *" value={form.numero_documento_acudiente} required onChange={e => setForm({ ...form, numero_documento_acudiente: e.target.value })}><option value="">Selecciona un acudiente</option>{acudientes.map(g => <option key={g.numero_documento} value={g.numero_documento}>{g.nombre_1} {g.apellido_1} · {g.numero_documento}</option>)}</SelectField><Field label="Primer nombre *" value={form.nombre_1} required onChange={e => setForm({ ...form, nombre_1: e.target.value })}/><Field label="Segundo nombre" value={form.nombre_2} onChange={e => setForm({ ...form, nombre_2: e.target.value })}/><Field label="Primer apellido *" value={form.apellido_1} required onChange={e => setForm({ ...form, apellido_1: e.target.value })}/><Field label="Segundo apellido" value={form.apellido_2} onChange={e => setForm({ ...form, apellido_2: e.target.value })}/><Field label="Identificación" value={form.identificacion} onChange={e => setForm({ ...form, identificacion: e.target.value })}/><Field label="Tipo de sangre" value={form.tipo_sangre} placeholder="Ej. O+" onChange={e => setForm({ ...form, tipo_sangre: e.target.value })}/><Field label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })}/><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button><button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">Guardar alumno</button></div></form></Modal>}
  </section>
}
