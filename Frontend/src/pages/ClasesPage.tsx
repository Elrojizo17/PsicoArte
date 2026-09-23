import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Field, SelectField } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import type { Alumno, Clase, Jornada } from '../types'

const hours = Array.from({ length: 10 }, (_, i) => i + 9)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const monday = (base: Date) => { const day = base.getDay() || 7; const result = new Date(base); result.setDate(base.getDate() - day + 1); return result }
const displayDay = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const displayDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

type FormData = { id_jornada: string; fecha: string }

export function ClasesPage() {
  const [classes, setClasses] = useState<Clase[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [students, setStudents] = useState<Alumno[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [form, setForm] = useState<FormData>({ id_jornada: '', fecha: dateKey(new Date()) })
  const [editing, setEditing] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [week, setWeek] = useState(monday(new Date()))

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [classResponse, journeyResponse, studentResponse] = await Promise.all([
        api.get<Clase[]>(endpoints.clases),
        api.get<Jornada[]>(endpoints.jornadas),
        api.get<Alumno[]>(endpoints.alumnos),
      ])
      setClasses(classResponse.data)
      setJornadas(journeyResponse.data)
      setStudents(studentResponse.data)
    } catch {
      setError('No se pudo cargar el calendario. Verifica que el backend esté activo.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(week)
    date.setDate(week.getDate() + i)
    return date
  }), [week])

  const openNew = () => {
    setEditing(null)
    setSelectedStudents([])
    setForm({ id_jornada: jornadas[0]?.id_jornada?.toString() || '', fecha: dateKey(new Date()) })
    setOpen(true)
  }

  const openEdit = (item: Clase) => {
    setEditing(item.id_clase)
    setSelectedStudents(item.alumnos?.map(student => student.ti) || [])
    setForm({ id_jornada: item.jornada_detalle?.id_jornada.toString() || '', fecha: item.fecha })
    setOpen(true)
  }

  const toggleStudent = (ti: string) => {
    setSelectedStudents(current => current.includes(ti) ? current.filter(id => id !== ti) : [...current, ti])
  }

  const syncStudents = async (classId: number, previousIds: string[]) => {
    const added = selectedStudents.filter(ti => !previousIds.includes(ti))
    const removed = previousIds.filter(ti => !selectedStudents.includes(ti))
    await Promise.all([
      ...added.map(ti => api.post(`${endpoints.clases}${classId}/alumnos/`, { ti })),
      ...removed.map(ti => api.delete(`${endpoints.clases}${classId}/alumnos/${ti}/`)),
    ])
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.id_jornada) { setError('Selecciona una jornada para programar la clase.'); return }
    try {
      setSaving(true)
      const previous = editing ? classes.find(item => item.id_clase === editing)?.alumnos?.map(student => student.ti) || [] : []
      const response = editing
        ? await api.patch<Clase>(`${endpoints.clases}${editing}/`, form)
        : await api.post<Clase>(endpoints.clases, form)
      await syncStudents(response.data.id_clase, previous)
      setOpen(false)
      setEditing(null)
      setSelectedStudents([])
      await load()
    } catch {
      setError('No se pudo guardar la clase o alguna inscripción de alumno.')
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar esta clase programada?')) return
    try { await api.delete(`${endpoints.clases}${id}/`); await load() } catch { setError('No se pudo eliminar la clase.') }
  }

  const classesFor = (date: string) => classes.filter(item => item.fecha === date)
  const getOffset = (item: Clase) => {
    const start = item.jornada_detalle?.hora_inicio?.slice(0, 2)
    return Math.max(0, (Number(start || 9) - 9) * 64)
  }

  return <section className="page-enter">
    <PageHeader eyebrow="Agenda semanal" title="Programar clases" description="Organiza las clases concretas y visualiza la semana de la escuela." action={openNew}/>
    {error && <div className="mb-4"><ErrorState message={error}/></div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-light/60 bg-white/60 p-3">
      <div className="flex items-center gap-2"><button aria-label="Semana anterior" onClick={() => { const d = new Date(week); d.setDate(d.getDate() - 7); setWeek(d) }} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronLeft size={19}/></button><button aria-label="Semana siguiente" onClick={() => { const d = new Date(week); d.setDate(d.getDate() + 7); setWeek(d) }} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronRight size={19}/></button><span className="ml-2 text-sm font-bold capitalize text-primary-dark">{displayDate.format(days[0])} - {displayDate.format(days[6])}</span></div>
      <button onClick={() => setWeek(monday(new Date()))} className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-primary-dark hover:bg-background">Hoy</button>
    </div>
    {loading ? <LoadingState/> : <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm"><div className="min-w-[850px]">
      <div className="grid grid-cols-[64px_repeat(7,minmax(105px,1fr))] border-b border-primary-light/50"><div className="p-3"/>{days.map(day => <div key={dateKey(day)} className="border-l border-primary-light/40 px-2 py-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{displayDay.format(day).replace('.', '')}</p><div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${dateKey(day) === dateKey(new Date()) ? 'bg-primary-dark text-white' : 'text-primary-dark'}`}>{day.getDate()}</div></div>)}</div>
      <div className="grid grid-cols-[64px_repeat(7,minmax(105px,1fr))]"><div>{hours.map(hour => <div key={hour} className="h-16 border-b border-primary-light/25 pr-2 pt-1 text-right text-[10px] font-semibold text-slate-400">{hour}:00</div>)}</div>{days.map(day => <div key={dateKey(day)} className="relative border-l border-primary-light/40">{hours.map(hour => <div key={hour} className="h-16 border-b border-primary-light/25"/>)}{classesFor(dateKey(day)).map(item => <div key={item.id_clase} style={{ top: getOffset(item) + 4 }} className="group absolute left-1 right-1 min-h-14 rounded-lg border-l-4 border-primary-dark bg-primary/15 p-2 text-left shadow-sm"><p className="truncate text-xs font-bold text-primary-dark">{item.jornada_detalle?.tipo_jornada || 'Clase programada'}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 size={11}/>{item.jornada_detalle?.hora_inicio?.slice(0, 5)} - {item.jornada_detalle?.hora_final?.slice(0, 5)}</p><p className="flex items-center gap-1 text-[10px] text-slate-500"><Users size={11}/>{item.alumnos?.length ?? 0} alumnos</p><div className="absolute right-1 top-1 hidden gap-1 group-hover:flex"><button aria-label="Editar clase" onClick={() => openEdit(item)} className="rounded bg-white p-1 text-primary"><Pencil size={11}/></button><button aria-label="Eliminar clase" onClick={() => void remove(item.id_clase)} className="rounded bg-white p-1 text-red-500"><Trash2 size={11}/></button></div></div>)}</div>)}</div>
    </div></div>}
    {open && <Modal title={editing ? 'Editar clase programada' : 'Programar una clase'} onClose={() => setOpen(false)}><form onSubmit={save} className="grid gap-5"><SelectField label="Jornada *" value={form.id_jornada} required onChange={e => setForm({ ...form, id_jornada: e.target.value })}><option value="">Selecciona una jornada</option>{jornadas.map(j => <option key={j.id_jornada} value={j.id_jornada}>{j.tipo_jornada} · {j.dia_semana} · {j.hora_inicio.slice(0, 5)} - {j.hora_final.slice(0, 5)}</option>)}</SelectField><Field label="Fecha *" type="date" value={form.fecha} required onChange={e => setForm({ ...form, fecha: e.target.value })}/><div><div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-bold text-primary-dark">Estudiantes de la clase</p><p className="text-xs text-slate-500">Selecciona los alumnos que participarán.</p></div><span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-primary-dark">{selectedStudents.length} seleccionados</span></div><div className="max-h-52 overflow-y-auto rounded-xl border border-primary-light/70 bg-slate-50/70">{students.length === 0 ? <p className="p-4 text-sm text-slate-500">No hay alumnos registrados todavía.</p> : students.map(student => <label key={student.ti} className="flex cursor-pointer items-center gap-3 border-b border-primary-light/30 px-4 py-3 last:border-0 hover:bg-background"><input type="checkbox" checked={selectedStudents.includes(student.ti)} onChange={() => toggleStudent(student.ti)} className="h-4 w-4 accent-primary"/><span><span className="block text-sm font-semibold text-primary-dark">{student.nombre_1} {student.apellido_1}</span><span className="block text-xs text-slate-500">TI {student.ti}</span></span></label>)}</div></div><div className="rounded-lg bg-background p-3 text-xs text-primary-dark">Los alumnos seleccionados quedarán asociados a esta clase. Puedes cambiar la selección al editarla.</div><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button><button disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"><Plus size={16} className="mr-1 inline"/>{saving ? 'Guardando...' : 'Guardar clase'}</button></div></form></Modal>}
  </section>
}
