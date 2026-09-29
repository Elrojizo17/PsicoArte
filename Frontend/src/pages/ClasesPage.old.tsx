import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Pencil, Search, Trash2, Users } from 'lucide-react'
import { Checkbox } from 'primereact/checkbox'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Field, RequiredFieldsNotice, SelectField, showRequiredFieldMessage } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import { confirmAction, showSuccess } from '../services/alerts'
import type { Alumno, Clase, Jornada } from '../types'

const hours = Array.from({ length: 10 }, (_, i) => i + 9)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const isSameLocalDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
const monday = (base: Date) => {
  const day = base.getDay() || 7
  const result = new Date(base)
  result.setDate(base.getDate() - day + 1)
  return result
}
const displayDay = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const displayDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const displayStudentId = (ti: string) => ti.startsWith('ALU-') ? 'No disponible' : ti || 'No disponible'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const formatAge = (value?: string | null) => {
  if (!value) return '—'
  const birthDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) return '—'

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayHasPassed = (
    today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  )
  if (!birthdayHasPassed) age -= 1

  return age >= 0 ? `${age} ${age === 1 ? 'año' : 'años'}` : '—'
}

type FormData = { id_jornada: string; fecha: string }
type SelectionMap = Record<string, boolean>
type CalendarView = 'month' | 'week' | 'day'

function MonthCalendar({ month, classes, onOpen }: { month: Date; classes: Clase[]; onOpen: (item: Clase) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1
    return dayNumber > 0 && dayNumber <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), dayNumber) : null
  })
  return <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm"><div className="min-w-[700px]"><div className="grid grid-cols-7 border-b border-primary-light/50">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => { const key = day ? dateKey(day) : `empty-${index}`; const dayClasses = day ? classes.filter(item => item.fecha === key) : []; return <div key={key} className="min-h-28 border-b border-l border-primary-light/30 p-2"><p className={`text-xs font-bold ${day && dateKey(day) === dateKey(new Date()) ? 'text-primary-dark' : 'text-slate-400'}`}>{day?.getDate() || ''}</p><div className="mt-1 grid gap-1">{dayClasses.map(item => <button key={item.id_clase} type="button" onClick={() => onOpen(item)} className="truncate rounded-md bg-primary/15 px-2 py-1 text-left text-[10px] font-semibold text-primary-dark hover:bg-primary/25">{item.jornada_detalle?.hora_inicio.slice(0, 5)} · {item.jornada_detalle?.tipo_jornada}</button>)}</div></div>})}</div></div></div>
}

function DayClasses({ day, classes, onOpen, onEdit, onRemove }: { day: Date; classes: Clase[]; onOpen: (item: Clase) => void; onEdit: (item: Clase) => void; onRemove: (id: number) => void }) {
  const dayClasses = classes.filter(item => item.fecha === dateKey(day))
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dayClasses.length === 0 ? <p className="rounded-2xl border border-dashed border-primary-light bg-white p-6 text-sm text-slate-500">No hay clases programadas para este día.</p> : dayClasses.map(item => <article key={item.id_clase} className="group rounded-2xl border border-primary-light/70 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><button type="button" onClick={() => onOpen(item)} className="block w-full text-left"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-primary-dark">{item.jornada_detalle?.tipo_jornada || 'Clase programada'}</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-600"><Clock3 size={15}/>{item.jornada_detalle?.hora_inicio.slice(0, 5)} - {item.jornada_detalle?.hora_final.slice(0, 5)}</p></div><Users size={19} className="text-primary"/></div><p className="mt-3 border-t border-border pt-3 text-xs text-slate-500">{item.alumnos?.length || 0} alumnos inscritos</p></button><div className="mt-3 flex justify-end gap-1 border-t border-border pt-2"><button type="button" aria-label="Editar clase" onClick={() => onEdit(item)} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={16}/></button><button type="button" aria-label="Eliminar clase" onClick={() => onRemove(item.id_clase)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div></article>)}</div>
}

export function ClasesPage() {
  const [classes, setClasses] = useState<Clase[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [students, setStudents] = useState<Alumno[]>([])
  const [selectionKeys, setSelectionKeys] = useState<SelectionMap>({})
  const [studentSearch, setStudentSearch] = useState('')
  const [form, setForm] = useState<FormData>({ id_jornada: '', fecha: dateKey(new Date()) })
  const [editing, setEditing] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<Clase | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [week, setWeek] = useState(monday(new Date()))
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const availableJornadas = useMemo(
    () => form.fecha
      ? jornadas.filter((jornada) => jornada.dia_semana === dayNames[new Date(`${form.fecha}T00:00:00`).getDay()])
      : [],
    [form.fecha, jornadas],
  )

  const selectedStudents = useMemo(
    () => Object.entries(selectionKeys)
      .filter(([, isSelected]) => isSelected)
      .map(([ti]) => ti),
    [selectionKeys],
  )
  const selectedCount = selectedStudents.length
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase()
    if (!query) return students

    const normalize = (value?: string | null) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase() || ''
    return students.filter((student) => [
      student.ti,
      student.identificacion,
      student.nombre_1,
      student.nombre_2,
      student.apellido_1,
      student.apellido_2,
    ].some((value) => normalize(value).includes(normalize(query))))
  }, [studentSearch, students])
  const allSelected = filteredStudents.length > 0 && filteredStudents.every((student) => !!selectionKeys[student.ti])

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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const days = useMemo(
    () => Array.from({ length: calendarView === 'day' ? 1 : 7 }, (_, i) => {
      const date = new Date(week)
      date.setDate(week.getDate() + i)
      return date
    }),
    [calendarView, week],
  )

  const seedSelection = (ids: string[]) => {
    const next: SelectionMap = {}
    ids.forEach((ti) => {
      next[ti] = true
    })
    setSelectionKeys(next)
  }

  const openNew = () => {
    setEditing(null)
    setSelectionKeys({})
    setStudentSearch('')
    setForm({
      id_jornada: '',
      fecha: dateKey(new Date()),
    })
    setOpen(true)
  }

  const openEdit = (item: Clase) => {
    setEditing(item.id_clase)
    setStudentSearch('')
    seedSelection(item.alumnos?.map((student) => student.ti) || [])
    setForm({
      id_jornada: item.jornada_detalle?.id_jornada.toString() || '',
      fecha: item.fecha,
    })
    setOpen(true)
  }

  const toggleStudent = (ti: string) => {
    setSelectionKeys((current) => ({ ...current, [ti]: !current[ti] }))
  }

  const toggleAllStudents = () => {
    if (filteredStudents.length === 0) return

    if (allSelected) {
      setSelectionKeys((current) => {
        const next = { ...current }
        filteredStudents.forEach((student) => {
          delete next[student.ti]
        })
        return next
      })
      return
    }

    setSelectionKeys((current) => {
      const next = { ...current }
      filteredStudents.forEach((student) => {
        next[student.ti] = true
      })
      return next
    })
  }

  const assignSelectedStudents = async (
    classId: number,
    targetIds: string[],
    existingIds: string[] = [],
  ) => {
    const idsToAssign = [...new Set(targetIds.filter((ti) => !existingIds.includes(ti)))]
    if (!idsToAssign.length) return

    await Promise.all(
      idsToAssign.map((ti) => api.post(`${endpoints.clases}${classId}/alumnos/`, { ti })),
    )
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.fecha) {
      setError('Selecciona primero la fecha de realización.')
      return
    }

    if (!form.id_jornada) {
      setError('Selecciona una jornada para programar la clase.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const wasEditing = Boolean(editing)

      const previous = editing
        ? classes.find((item) => item.id_clase === editing)?.alumnos?.map((student) => student.ti) || []
        : []

      const response = editing
        ? await api.patch<Clase>(`${endpoints.clases}${editing}/`, form)
        : await api.post<Clase>(endpoints.clases, form)

      const classId = response.data.id_clase
      await assignSelectedStudents(classId, selectedStudents, previous)

      setOpen(false)
      setEditing(null)
      setSelectionKeys({})
      await load()
      await showSuccess(wasEditing ? 'Clase actualizada' : 'Clase programada', 'La clase y sus alumnos se guardaron correctamente.')
    } catch {
      setError('No se pudo guardar la clase o alguna asignación de alumno.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!await confirmAction('¿Eliminar clase programada?', 'Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`${endpoints.clases}${id}/`)
      await showSuccess('Clase eliminada', 'La clase se eliminó correctamente.')
      await load()
    } catch {
      setError('No se pudo eliminar la clase.')
    }
  }

  const classesFor = (date: string) => classes.filter((item) => item.fecha === date)

  const getOffset = (item: Clase) => {
    const start = item.jornada_detalle?.hora_inicio?.slice(0, 2)
    return Math.max(0, (Number(start || 9) - 9) * 64)
  }

  const currentTimeOffset = (currentTime.getHours() - 9 + currentTime.getMinutes() / 60) * 64
  const currentTimeLabel = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(currentTime)

  const openDetails = (item: Clase) => {
    setSelectedClass(item)
  }

  const selectedClassStudents = selectedClass?.alumnos?.map((summary) => ({
    summary,
    detail: students.find((student) => student.ti === summary.ti),
  })) || []

  const moveCalendar = (direction: number) => {
    const next = new Date(week)
    if (calendarView === 'month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction * (calendarView === 'day' ? 1 : 7))
    setWeek(next)
  }

  const calendarLabel = calendarView === 'month'
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(week)
    : calendarView === 'day'
      ? displayDate.format(days[0])
      : `${displayDate.format(days[0])} - ${displayDate.format(days[days.length - 1])}`

  return (
    <section className="page-enter lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <div className="shrink-0">
      <PageHeader
        eyebrow="Agenda semanal"
        title="Programar Clases"
        description="Organiza las clases concretas y visualiza la semana de la escuela."
        actionLabel="Nueva Clase"
        action={openNew}
      />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-light/60 bg-white/60 p-3">
        <div className="flex items-center gap-2">
          <button
            aria-label="Semana anterior"
            onClick={() => moveCalendar(-1)}
            className="rounded-lg p-2 text-primary hover:bg-background"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            aria-label="Semana siguiente"
            onClick={() => moveCalendar(1)}
            className="rounded-lg p-2 text-primary hover:bg-background"
          >
            <ChevronRight size={19} />
          </button>
          <span className="ml-2 text-sm font-bold capitalize text-primary-dark">
            {calendarLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-full border border-primary-light bg-white p-1">{(['month', 'week', 'day'] as CalendarView[]).map(view => <button key={view} type="button" onClick={() => setCalendarView(view)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${calendarView === view ? 'bg-primary-dark text-white' : 'text-primary-dark hover:bg-background'}`}>{view === 'month' ? 'Mes' : view === 'week' ? 'Semana' : 'Día'}</button>)}</div><button onClick={() => setWeek(monday(new Date()))} className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-primary-dark hover:bg-background">Hoy</button></div>
      </div>

      <div className="min-h-0 lg:flex-1 lg:overflow-auto lg:overscroll-contain">
      {loading ? (
        <LoadingState />
      ) : (
        calendarView === 'month' ? <MonthCalendar month={week} classes={classes} onOpen={openDetails} /> : calendarView === 'day' ? <DayClasses day={week} classes={classes} onOpen={openDetails} onEdit={openEdit} onRemove={(id) => void remove(id)} /> : <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[64px_repeat(7,minmax(105px,1fr))] border-b border-primary-light/50">
              <div className="p-3" />
              {days.map((day) => (
                <div key={dateKey(day)} className="border-l border-primary-light/40 px-2 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {displayDay.format(day).replace('.', '')}
                  </p>
                  <div
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      dateKey(day) === dateKey(new Date()) ? 'bg-primary-dark text-white' : 'text-primary-dark'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[64px_repeat(7,minmax(105px,1fr))]">
              <div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-16 border-b border-primary-light/25 pr-2 pt-1 text-right text-[10px] font-semibold text-slate-400"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              {days.map((day) => (
                <div key={dateKey(day)} className="relative border-l border-primary-light/40">
                  {hours.map((hour) => (
                    <div key={hour} className="h-16 border-b border-primary-light/25" />
                  ))}

                  {isSameLocalDay(day, currentTime)
                    && currentTimeOffset >= 0
                    && currentTimeOffset <= hours.length * 64
                    && <div className="pointer-events-none absolute left-0 right-0 z-0 flex items-center" style={{ top: currentTimeOffset }}>
                      <span className="absolute -left-[64px] w-[58px] pr-1 text-right text-[11px] font-bold tabular-nums text-[#075b2b]">{currentTimeLabel}</span>
                      <span aria-hidden="true" className="relative z-10 h-0 w-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-[#075b2b]" />
                      <span aria-hidden="true" className="h-[2px] flex-1 bg-[#075b2b]" />
                    </div>}

                  {classesFor(dateKey(day)).map((item) => (
                    <div
                      key={item.id_clase}
                      style={{ top: getOffset(item) + 4 }}
                      className="class-calendar-event group absolute left-1 right-1 z-30 min-h-14 cursor-pointer rounded-lg border-l-4 border-primary-dark p-2 text-left shadow-sm transition"
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver información de la clase del ${formatDate(item.fecha)}`}
                      onClick={() => openDetails(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openDetails(item)
                        }
                      }}
                    >
                      <p className="truncate text-xs font-bold text-primary-dark">
                        {item.jornada_detalle?.tipo_jornada || 'Clase programada'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                        <Clock3 size={11} />
                        {item.jornada_detalle?.hora_inicio?.slice(0, 5)} - {item.jornada_detalle?.hora_final?.slice(0, 5)}
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Users size={11} />
                        {item.alumnos?.length ?? 0} alumnos
                      </p>

                      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                        <button
                          aria-label="Editar clase"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEdit(item)
                          }}
                          className="rounded bg-white p-1 text-primary"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          aria-label="Eliminar clase"
                          onClick={(event) => {
                            event.stopPropagation()
                            void remove(item.id_clase)
                          }}
                          className="rounded bg-white p-1 text-red-500"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

      {selectedClass && (
        <Modal
          title="Información de la clase"
          onClose={() => setSelectedClass(null)}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-xl border border-primary-light/60 bg-background/50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Jornada</p>
                <p className="mt-1 font-bold text-primary-dark">
                  {selectedClass.jornada_detalle?.tipo_jornada || 'Clase programada'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Día</p>
                <p className="mt-1 font-semibold text-slate-700">
                  {selectedClass.jornada_detalle?.dia_semana || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fecha de realización</p>
                <p className="mt-1 font-semibold text-slate-700">{formatDate(selectedClass.fecha)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Horario</p>
                <p className="mt-1 font-semibold text-slate-700">
                  {selectedClass.jornada_detalle
                    ? `${selectedClass.jornada_detalle.hora_inicio.slice(0, 5)} - ${selectedClass.jornada_detalle.hora_final.slice(0, 5)}`
                    : '—'}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h3 className="font-bold text-primary-dark">
                  Alumnos inscritos ({selectedClassStudents.length})
                </h3>
              </div>
              {selectedClassStudents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-primary-light bg-white p-4 text-sm text-slate-500">
                  No hay alumnos inscritos en esta clase.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedClassStudents.map(({ summary, detail }) => (
                    <div key={summary.ti} className="rounded-xl border border-border bg-white p-3">
                      <p className="font-bold text-primary-dark">
                        {detail?.nombre_1 || summary.nombre_1} {detail?.apellido_1 || summary.apellido_1}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">TI: {displayStudentId(summary.ti)}</p>
                      {detail?.acudiente_detalle && (
                        <p className="mt-1 text-xs text-slate-500">
                          Acudiente: {detail.acudiente_detalle.nombre_1} {detail.acudiente_detalle.apellido_1}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {open && (
        <Modal title={editing ? 'Editar clase programada' : 'Programar una clase'} onClose={() => setOpen(false)}>
          <form onSubmit={save} onInvalid={showRequiredFieldMessage} className="grid min-w-0 gap-5">
            <RequiredFieldsNotice />
            <Field
              label="Fecha de realización *"
              type="date"
              value={form.fecha}
              required
              onChange={(e) => setForm({ ...form, fecha: e.target.value, id_jornada: '' })}
            />

            <SelectField
              label="Jornada *"
              value={form.id_jornada}
              required
              disabled={!form.fecha}
              onChange={(e) => setForm({ ...form, id_jornada: e.target.value })}
            >
              <option value="">
                {form.fecha ? 'Selecciona una jornada' : 'Selecciona primero la fecha'}
              </option>
              {availableJornadas.map((j) => (
                <option key={j.id_jornada} value={j.id_jornada}>
                  {j.dia_semana} · {j.tipo_jornada} · {j.hora_inicio.slice(0, 5)} - {j.hora_final.slice(0, 5)}
                </option>
              ))}
            </SelectField>

            <div className="min-w-0 rounded-2xl border border-primary-light/70 bg-slate-50/70 p-3">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-primary-dark">Alumnos</p>
                  <p className="text-xs text-slate-500">Selecciona los estudiantes para la clase.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-primary-dark">
                    Alumnos seleccionados: {selectedCount}
                  </span>
                </div>
              </div>
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-primary-light/70 bg-white px-3 py-2.5 text-sm text-slate-500 focus-within:border-primary-dark focus-within:ring-2 focus-within:ring-primary/15">
                <Search size={17} className="shrink-0 text-primary" aria-hidden="true" />
                <span className="sr-only">Buscar alumno</span>
                <input
                  type="search"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Buscar por TI, identificación o nombre"
                  aria-label="Buscar alumnos por número de identificación o nombre"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                />
              </label>

              {students.length === 0 ? (
                <p className="rounded-xl border border-dashed border-primary-light bg-white p-4 text-sm text-slate-500">
                  No hay alumnos disponibles.
                </p>
              ) : (
                <div className="student-table min-w-0 overflow-x-auto overflow-y-hidden rounded-xl border border-primary-light/70 bg-white">
                  <DataTable
                    value={filteredStudents}
                    dataKey="ti"
                    emptyMessage="No hay alumnos disponibles."
                    scrollable
                    scrollHeight="260px"
                    tableStyle={{ minWidth: '860px' }}
                  >
                    <Column
                      header={() => (
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={allSelected}
                            onChange={toggleAllStudents}
                            aria-label="Seleccionar todos los alumnos"
                          />
                        </div>
                      )}
                      body={(row: Alumno) => (
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={!!selectionKeys[row.ti]}
                            onChange={() => toggleStudent(row.ti)}
                            aria-label={`Seleccionar ${row.nombre_1} ${row.apellido_1}`}
                          />
                        </div>
                      )}
                      style={{ width: '4rem' }}
                    />
                    <Column field="ti" header="TI" style={{ width: '8rem' }} />
                    <Column
                      header="Nombre completo"
                      body={(row: Alumno) => `${row.nombre_1} ${row.apellido_1}`.trim()}
                    />
                    <Column header="Identificación" body={(row: Alumno) => row.identificacion || '—'} />
                    <Column field="tipo_sangre" header="Tipo de sangre" body={(row: Alumno) => row.tipo_sangre || '—'} />
                    <Column
                      header="Edad"
                      body={(row: Alumno) => formatAge(row.fecha_nacimiento)}
                    />
                    <Column
                      header="Acudiente"
                      body={(row: Alumno) => {
                        const acudiente = row.acudiente_detalle
                        return acudiente ? `${acudiente.nombre_1} ${acudiente.apellido_1}`.trim() : 'Sin acudiente'
                      }}
                    />
                  </DataTable>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-slate-600 hover:bg-background sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-primary-dark px-4 py-2 text-xs font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar clase'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
