import { useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Pencil, UserRound, XCircle } from 'lucide-react'
import axios from 'axios'
import { Field } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import { showSuccess } from '../services/alerts'
import type { Alumno, Asistencia, Clase } from '../types'

const formatDate = (value?: string | null, options?: Intl.DateTimeFormatOptions | number) => {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  const dateOptions: Intl.DateTimeFormatOptions = typeof options === 'number' || !options ? { day: '2-digit', month: 'short', year: 'numeric' } : options
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', dateOptions).format(date)
}
const fullName = (student: Alumno) => [student.nombre_1, student.nombre_2, student.apellido_1, student.apellido_2].filter(Boolean).join(' ')
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const monday = (base: Date) => { const day = base.getDay() || 7; const result = new Date(base); result.setDate(base.getDate() - day + 1); return result }

function useParentData() {
  const [students, setStudents] = useState<Alumno[]>([])
  const [classes, setClasses] = useState<Clase[]>([])
  const [attendances, setAttendances] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true); setError('')
      const [studentsResponse, classesResponse, attendancesResponse] = await Promise.all([
        api.get<Alumno[]>(endpoints.alumnos), api.get<Clase[]>(endpoints.clases), api.get<Asistencia[]>(endpoints.asistencias),
      ])
      setStudents(studentsResponse.data); setClasses(classesResponse.data); setAttendances(attendancesResponse.data)
    } catch { setError('No se pudo cargar la información de tu familia.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  return { students, classes, attendances, loading, error, reload: load }
}

export function ParentChildrenPage() {
  const { students, loading, error, reload } = useParentData()
  const [selected, setSelected] = useState<Alumno | null>(null)
  const [form, setForm] = useState({ nombre_1: '', nombre_2: '', apellido_1: '', apellido_2: '', identificacion: '', tipo_sangre: '', eps: '', fecha_nacimiento: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const openEdit = (student: Alumno) => { setSelected(student); setFormError(''); setForm({ nombre_1: student.nombre_1, nombre_2: student.nombre_2 || '', apellido_1: student.apellido_1, apellido_2: student.apellido_2 || '', identificacion: student.identificacion || '', tipo_sangre: student.tipo_sangre || '', eps: student.eps || '', fecha_nacimiento: student.fecha_nacimiento || '' }) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return
    try { setSaving(true); await api.patch(`${endpoints.alumnos}${selected.ti}/`, { ...form, identificacion: form.identificacion || null, fecha_nacimiento: form.fecha_nacimiento || null }); setSelected(null); await showSuccess('Datos actualizados', 'La información del niño fue guardada.'); void reload() }
    catch (reason) { const data = axios.isAxiosError(reason) ? reason.response?.data : null; setFormError(data ? 'Revisa los datos ingresados.' : 'No se pudo actualizar la información.') }
    finally { setSaving(false) }
  }

  return <section className="page-enter"><PageHeader eyebrow="Portal familiar" title="Mis niños" description="Consulta y actualiza la información de los niños asociados a tu cuenta." />{error && <ErrorState message={error}/>} {loading ? <LoadingState/> : <div className="grid gap-4 lg:grid-cols-2">{students.length === 0 ? <p className="rounded-2xl border border-dashed border-primary-light bg-white p-6 text-sm text-slate-500">No hay niños asociados a esta cuenta.</p> : students.map(student => <article key={student.ti} className="rounded-2xl border border-primary-light/70 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><UserRound size={20} className="text-primary"/><h2 className="text-lg font-bold text-primary-dark">{fullName(student)}</h2></div><p className="mt-1 text-sm text-slate-500">TI: {student.ti}</p></div><button aria-label={`Actualizar datos de ${fullName(student)}`} onClick={() => openEdit(student)} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={18}/></button></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tipo de sangre</p><p className="mt-1 font-semibold text-slate-700">{student.tipo_sangre || 'No registrado'}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">EPS</p><p className="mt-1 font-semibold text-slate-700">{student.eps || 'No registrada'}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Clases programadas</p><p className="mt-1 font-semibold text-slate-700">{student.clases?.length || 0}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estado de pago</p><p className="mt-1 font-semibold text-slate-700">{student.resumen_pagos?.estado_pago === 'vigente' ? `${student.resumen_pagos.clases_disponibles} clases disponibles` : student.resumen_pagos?.estado_pago === 'vencido' ? 'Pago vencido' : 'Sin pago registrado'}</p></div></div></article>)}</div>}
    {selected && <Modal title={`Actualizar datos de ${fullName(selected)}`} onClose={() => setSelected(null)}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">{formError && <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</p>}<Field label="Primer nombre *" value={form.nombre_1} required onChange={event => setForm({ ...form, nombre_1: event.target.value })}/><Field label="Segundo nombre" value={form.nombre_2} onChange={event => setForm({ ...form, nombre_2: event.target.value })}/><Field label="Primer apellido *" value={form.apellido_1} required onChange={event => setForm({ ...form, apellido_1: event.target.value })}/><Field label="Segundo apellido" value={form.apellido_2} onChange={event => setForm({ ...form, apellido_2: event.target.value })}/><Field label="Identificación" value={form.identificacion} onChange={event => setForm({ ...form, identificacion: event.target.value })}/><Field label="Tipo de sangre" value={form.tipo_sangre} onChange={event => setForm({ ...form, tipo_sangre: event.target.value })}/><Field label="EPS" value={form.eps} onChange={event => setForm({ ...form, eps: event.target.value })}/><Field label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={event => setForm({ ...form, fecha_nacimiento: event.target.value })}/><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">{saving ? 'Guardando...' : 'Guardar cambios'}</button></div></form></Modal>}
  </section>
}

export function ParentCalendarPage() {
  const { students, classes, loading, error } = useParentData()
  const [week, setWeek] = useState(monday(new Date()))
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(week); day.setDate(week.getDate() + index); return day })
  const studentMap = new Map(students.map(student => [student.ti, fullName(student)]))
  const visibleClasses = classes.filter(item => item.fecha >= dateKey(days[0]) && item.fecha <= dateKey(days[6]))
  return <section className="page-enter"><PageHeader eyebrow="Portal familiar" title="Calendario" description="Revisa las clases programadas de tus niños." />{error && <ErrorState message={error}/>} {loading ? <LoadingState/> : <><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-light/60 bg-white/70 p-3"><div className="flex items-center gap-2"><button aria-label="Semana anterior" onClick={() => { const next = new Date(week); next.setDate(week.getDate() - 7); setWeek(next) }} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronLeft size={19}/></button><p className="text-sm font-bold capitalize text-primary-dark">{formatDate(dateKey(days[0]), { day: 'numeric', month: 'short' })} - {formatDate(dateKey(days[6]), { day: 'numeric', month: 'short', year: 'numeric' })}</p><button aria-label="Semana siguiente" onClick={() => { const next = new Date(week); next.setDate(week.getDate() + 7); setWeek(next) }} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronRight size={19}/></button></div><button onClick={() => setWeek(monday(new Date()))} className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-primary-dark">Hoy</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleClasses.length === 0 ? <p className="rounded-2xl border border-dashed border-primary-light bg-white p-6 text-sm text-slate-500">No hay clases programadas para esta semana.</p> : visibleClasses.map(item => <article key={item.id_clase} className="rounded-2xl border border-primary-light/70 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-primary-dark">{item.jornada_detalle?.tipo_jornada || 'Clase programada'}</p><p className="mt-1 text-sm font-semibold text-slate-600">{formatDate(item.fecha)} · {item.jornada_detalle?.hora_inicio.slice(0, 5)} - {item.jornada_detalle?.hora_final.slice(0, 5)}</p></div><CalendarDays className="text-primary" size={20}/></div><div className="mt-3 border-t border-border pt-3 text-xs text-slate-500">{(item.alumnos || []).map(student => <p key={student.ti}>{studentMap.get(student.ti) || `${student.nombre_1} ${student.apellido_1}`}</p>)}</div></article>)}</div></>}</section>
}

export function ParentAttendancePage() {
  const { students, classes, attendances, loading, error } = useParentData()
  const attendanceMap = new Map(attendances.map(item => [`${item.alumno}-${item.clase}`, item]))
  const rows = students.flatMap(student => (student.clases || []).map(enrollment => ({ student, classItem: classes.find(item => item.id_clase === enrollment.id_clase), attendance: attendanceMap.get(`${student.ti}-${enrollment.id_clase}`) }))).filter(row => row.classItem)
  return <section className="page-enter"><PageHeader eyebrow="Portal familiar" title="Asistencias" description="Consulta el historial de clases de tus niños y su estado de asistencia." />{error && <ErrorState message={error}/>} {loading ? <LoadingState/> : <div className="overflow-hidden rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">{rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Todavía no hay clases para consultar.</p> : <div className="divide-y divide-primary-light/30">{rows.map(({ student, classItem, attendance }) => { const state = attendance?.estado || 'programada'; return <div key={`${student.ti}-${classItem?.id_clase}`} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto] md:items-center"><div><p className="font-bold text-primary-dark">{fullName(student)}</p><p className="text-xs text-slate-500">{classItem?.jornada_detalle?.tipo_jornada}</p></div><div className="text-sm text-slate-600">{formatDate(classItem?.fecha)} · {classItem?.jornada_detalle?.hora_inicio.slice(0, 5)} - {classItem?.jornada_detalle?.hora_final.slice(0, 5)}</div><span className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${state === 'presente' ? 'bg-emerald-50 text-emerald-700' : state === 'ausente' ? 'bg-red-50 text-red-700' : state === 'pospuesta' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{state === 'presente' ? <CheckCircle2 size={14}/> : state === 'ausente' ? <XCircle size={14}/> : <AlertCircle size={14}/>} {state === 'presente' ? 'Presente' : state === 'ausente' ? 'Ausente' : state === 'pospuesta' ? 'Pospuesta' : 'Programada'}</span><p className="text-xs text-slate-500">{attendance?.observacion || 'Sin observación'}</p></div> })}</div>}</div>}</section>
}

export function ParentPaymentsPage() {
  const { students, loading, error } = useParentData()
  return <section className="page-enter"><PageHeader eyebrow="Portal familiar" title="Mis pagos" description="Consulta tus pagos, las clases que cubrieron y el saldo disponible de cada niño." />{error && <ErrorState message={error}/>} {loading ? <LoadingState/> : <div className="grid gap-5">{students.map(student => { const summary = student.resumen_pagos; return <article key={student.ti} className="rounded-2xl border border-primary-light/70 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-primary-dark">{fullName(student)}</h2><p className="text-sm text-slate-500">{summary?.clases_disponibles || 0} clases disponibles · cubierto hasta {formatDate(summary?.fecha_cubre_hasta)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${summary?.estado_pago === 'vigente' ? 'bg-emerald-50 text-emerald-700' : summary?.estado_pago === 'vencido' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{summary?.estado_pago === 'vigente' ? 'Pago vigente' : summary?.estado_pago === 'vencido' ? 'Pago vencido' : 'Sin pagos'}</span></div>{student.pagos && student.pagos.length > 0 ? <div className="mt-4 grid gap-3">{student.pagos.map(payment => <div key={payment.id_pago} className="rounded-xl border border-border bg-background/50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-primary-dark">Pago del {formatDate(payment.fecha_pago)} · {payment.clases_pagadas} clases</p><p className="font-semibold text-slate-600">${Number(payment.valor_pagado).toLocaleString('es-CO')}</p></div><p className="mt-2 text-sm text-slate-600">Clases consumidas: {payment.clases_consumidas.length ? payment.clases_consumidas.map(formatDate).join(', ') : 'Aún ninguna'}</p><p className="mt-1 text-sm text-slate-600">Este pago cubre hasta: <strong>{formatDate(payment.fecha_cubre_hasta)}</strong> · {payment.clases_disponibles} sin asignar</p></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-primary-light p-4 text-sm text-slate-500">No hay pagos registrados para este niño.</p>}</article>})}</div>}</section>
}
