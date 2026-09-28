import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import type { Alumno, Asistencia, Clase } from '../types'

type CalendarView = 'month' | 'week' | 'day'
const hours = Array.from({ length: 10 }, (_, index) => index + 9)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const monday = (base: Date) => { const day = base.getDay() || 7; const result = new Date(base); result.setDate(base.getDate() - day + 1); return result }
const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CO', options || { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const studentName = (student: Alumno) => [student.nombre_1, student.nombre_2, student.apellido_1, student.apellido_2].filter(Boolean).join(' ')

function MonthCalendar({ month, classes, students }: { month: Date; classes: Clase[]; students: Alumno[] }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, index) => { const number = index - startOffset + 1; return number > 0 && number <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), number) : null })
  const names = new Map(students.map(student => [student.ti, studentName(student)]))
  return <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm"><div className="min-w-[700px]"><div className="grid grid-cols-7 border-b border-primary-light/50">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => { const key = day ? dateKey(day) : `empty-${index}`; const dayClasses = day ? classes.filter(item => item.fecha === key) : []; return <div key={key} className="min-h-28 border-b border-l border-primary-light/30 p-2"><p className="text-xs font-bold text-slate-400">{day?.getDate() || ''}</p><div className="mt-1 grid gap-1">{dayClasses.map(item => <div key={item.id_clase} className="rounded-md bg-primary/15 px-2 py-1 text-[10px] text-primary-dark"><p className="truncate font-bold">{item.jornada_detalle?.hora_inicio.slice(0, 5)} · {item.jornada_detalle?.tipo_jornada}</p><p className="truncate">{(item.alumnos || []).map(student => names.get(student.ti) || student.nombre_1).join(', ')}</p></div>)}</div></div>})}</div></div></div>
}

function TimeGrid({ days, classes, students }: { days: Date[]; classes: Clase[]; students: Alumno[] }) {
  const names = new Map(students.map(student => [student.ti, studentName(student)]))
  const getOffset = (item: Clase) => Math.max(0, (Number(item.jornada_detalle?.hora_inicio.slice(0, 2) || 9) - 9) * 64)
  return <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm"><div className="min-w-[850px]"><div className="grid grid-cols-[64px_repeat(7,minmax(105px,1fr))] border-b border-primary-light/50" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(105px, 1fr))` }}><div className="p-3"/>{days.map(day => <div key={dateKey(day)} className="border-l border-primary-light/40 px-2 py-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(day).replace('.', '')}</p><div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${dateKey(day) === dateKey(new Date()) ? 'bg-primary-dark text-white' : 'text-primary-dark'}`}>{day.getDate()}</div></div>)}</div><div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(105px, 1fr))` }}><div>{hours.map(hour => <div key={hour} className="h-16 border-b border-primary-light/25 pr-2 pt-1 text-right text-[10px] font-semibold text-slate-400">{hour}:00</div>)}</div>{days.map(day => <div key={dateKey(day)} className="relative border-l border-primary-light/40">{hours.map(hour => <div key={hour} className="h-16 border-b border-primary-light/25"/>)}{classes.filter(item => item.fecha === dateKey(day)).map(item => <div key={item.id_clase} style={{ top: getOffset(item) + 4 }} className="absolute left-1 right-1 min-h-14 rounded-lg border-l-4 border-primary-dark bg-primary/15 p-2 text-left shadow-sm"><p className="truncate text-xs font-bold text-primary-dark">{item.jornada_detalle?.tipo_jornada || 'Clase programada'}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 size={11}/>{item.jornada_detalle?.hora_inicio.slice(0, 5)} - {item.jornada_detalle?.hora_final.slice(0, 5)}</p><p className="truncate text-[10px] text-slate-500">{(item.alumnos || []).map(student => names.get(student.ti) || student.nombre_1).join(', ')}</p></div>)}</div>)}</div></div></div>
}

export function ParentCalendarViewPage() {
  const [students, setStudents] = useState<Alumno[]>([])
  const [classes, setClasses] = useState<Clase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusDate, setFocusDate] = useState(monday(new Date()))
  const [view, setView] = useState<CalendarView>('week')

  useEffect(() => {
    Promise.all([api.get<Alumno[]>(endpoints.alumnos), api.get<Clase[]>(endpoints.clases), api.get<Asistencia[]>(endpoints.asistencias)])
      .then(([studentsResponse, classesResponse]) => { setStudents(studentsResponse.data); setClasses(classesResponse.data) })
      .catch(() => setError('No se pudo cargar el calendario familiar.'))
      .finally(() => setLoading(false))
  }, [])

  const days = Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => { const day = new Date(focusDate); day.setDate(focusDate.getDate() + index); return day })
  const visibleClasses = classes.filter(item => item.fecha >= dateKey(days[0]) && item.fecha <= dateKey(days[days.length - 1]))
  const move = (direction: number) => { const next = new Date(focusDate); if (view === 'month') next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * (view === 'day' ? 1 : 7)); setFocusDate(next) }
  const label = view === 'month' ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(focusDate) : view === 'day' ? formatDate(dateKey(days[0])) : `${formatDate(dateKey(days[0]), { day: 'numeric', month: 'short' })} - ${formatDate(dateKey(days[days.length - 1]), { day: 'numeric', month: 'short', year: 'numeric' })}`

  return <section className="page-enter"><PageHeader eyebrow="Portal familiar" title="Calendario" description="Revisa las clases programadas de tus niños." />{error && <ErrorState message={error}/>} {loading ? <LoadingState/> : <><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-light/60 bg-white/70 p-3"><div className="flex items-center gap-2"><button aria-label="Periodo anterior" onClick={() => move(-1)} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronLeft size={19}/></button><p className="text-sm font-bold capitalize text-primary-dark">{label}</p><button aria-label="Periodo siguiente" onClick={() => move(1)} className="rounded-lg p-2 text-primary hover:bg-background"><ChevronRight size={19}/></button></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-full border border-primary-light bg-white p-1">{(['month', 'week', 'day'] as CalendarView[]).map(item => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === item ? 'bg-primary-dark text-white' : 'text-primary-dark hover:bg-background'}`}>{item === 'month' ? 'Mes' : item === 'week' ? 'Semana' : 'Día'}</button>)}</div><button onClick={() => setFocusDate(monday(new Date()))} className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-primary-dark">Hoy</button></div></div>{view === 'month' ? <MonthCalendar month={focusDate} classes={classes} students={students}/> : <TimeGrid days={days} classes={visibleClasses} students={students}/>}</>}</section>
}
