import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Pencil, Trash2, Users } from 'lucide-react'
import { Checkbox } from 'primereact/checkbox'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Field, SelectField } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import type { Alumno, Clase, Jornada } from '../types'

const hours = Array.from({ length: 10 }, (_, i) => i + 9)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const monday = (base: Date) => {
  const day = base.getDay() || 7
  const result = new Date(base)
  result.setDate(base.getDate() - day + 1)
  return result
}
const displayDay = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const displayDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

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

type FormData = { id_jornada: string; fecha: string }
type SelectionMap = Record<string, boolean>

export function ClasesPage() {
  const [classes, setClasses] = useState<Clase[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [students, setStudents] = useState<Alumno[]>([])
  const [selectionKeys, setSelectionKeys] = useState<SelectionMap>({})
  const [form, setForm] = useState<FormData>({ id_jornada: '', fecha: dateKey(new Date()) })
  const [editing, setEditing] = useState<number | null>(null)
  const [currentClassId, setCurrentClassId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')
  const [week, setWeek] = useState(monday(new Date()))

  const selectedStudents = useMemo(
    () => Object.entries(selectionKeys)
      .filter(([, isSelected]) => isSelected)
      .map(([ti]) => ti),
    [selectionKeys],
  )
  const selectedCount = selectedStudents.length
  const allSelected = students.length > 0 && students.every((student) => !!selectionKeys[student.ti])

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
    () => Array.from({ length: 7 }, (_, i) => {
      const date = new Date(week)
      date.setDate(week.getDate() + i)
      return date
    }),
    [week],
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
    setCurrentClassId(null)
    setSelectionKeys({})
    setForm({
      id_jornada: jornadas[0]?.id_jornada?.toString() || '',
      fecha: dateKey(new Date()),
    })
    setOpen(true)
  }

  const openEdit = (item: Clase) => {
    setEditing(item.id_clase)
    setCurrentClassId(item.id_clase)
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
    if (students.length === 0) return

    if (allSelected) {
      setSelectionKeys((current) => {
        const next = { ...current }
        students.forEach((student) => {
          delete next[student.ti]
        })
        return next
      })
      return
    }

    setSelectionKeys((current) => {
      const next = { ...current }
      students.forEach((student) => {
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

    if (!form.id_jornada) {
      setError('Selecciona una jornada para programar la clase.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const previous = editing
        ? classes.find((item) => item.id_clase === editing)?.alumnos?.map((student) => student.ti) || []
        : []

      const response = editing
        ? await api.patch<Clase>(`${endpoints.clases}${editing}/`, form)
        : await api.post<Clase>(endpoints.clases, form)

      const classId = response.data.id_clase
      setCurrentClassId(classId)
      await assignSelectedStudents(classId, selectedStudents, previous)

      setOpen(false)
      setEditing(null)
      setSelectionKeys({})
      setCurrentClassId(null)
      await load()
    } catch {
      setError('No se pudo guardar la clase o alguna asignación de alumno.')
    } finally {
      setSaving(false)
    }
  }

  const assignStudentsButton = async () => {
    if (!currentClassId) {
      setError('Primero guarda la clase programada para poder asignar alumnos.')
      return
    }

    try {
      setAssigning(true)
      setError('')
      const existing = classes.find((item) => item.id_clase === currentClassId)?.alumnos?.map((student) => student.ti) || []
      await assignSelectedStudents(currentClassId, selectedStudents, existing)
      await load()
      const refreshedIds = classes.find((item) => item.id_clase === currentClassId)?.alumnos?.map((student) => student.ti) || []
      seedSelection(refreshedIds)
    } catch {
      setError('No se pudieron asignar los alumnos seleccionados. Intenta de nuevo.')
    } finally {
      setAssigning(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar esta clase programada?')) return
    try {
      await api.delete(`${endpoints.clases}${id}/`)
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

  return (
    <section className="page-enter">
      <PageHeader
        eyebrow="Agenda semanal"
        title="Programar clases"
        description="Organiza las clases concretas y visualiza la semana de la escuela."
        action={openNew}
      />

      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-light/60 bg-white/60 p-3">
        <div className="flex items-center gap-2">
          <button
            aria-label="Semana anterior"
            onClick={() => {
              const d = new Date(week)
              d.setDate(d.getDate() - 7)
              setWeek(d)
            }}
            className="rounded-lg p-2 text-primary hover:bg-background"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            aria-label="Semana siguiente"
            onClick={() => {
              const d = new Date(week)
              d.setDate(d.getDate() + 7)
              setWeek(d)
            }}
            className="rounded-lg p-2 text-primary hover:bg-background"
          >
            <ChevronRight size={19} />
          </button>
          <span className="ml-2 text-sm font-bold capitalize text-primary-dark">
            {displayDate.format(days[0])} - {displayDate.format(days[6])}
          </span>
        </div>

        <button
          onClick={() => setWeek(monday(new Date()))}
          className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-primary-dark hover:bg-background"
        >
          Hoy
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">
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

                  {classesFor(dateKey(day)).map((item) => (
                    <div
                      key={item.id_clase}
                      style={{ top: getOffset(item) + 4 }}
                      className="group absolute left-1 right-1 min-h-14 rounded-lg border-l-4 border-primary-dark bg-primary/15 p-2 text-left shadow-sm"
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
                          onClick={() => openEdit(item)}
                          className="rounded bg-white p-1 text-primary"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          aria-label="Eliminar clase"
                          onClick={() => void remove(item.id_clase)}
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

      {open && (
        <Modal title={editing ? 'Editar clase programada' : 'Programar una clase'} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid gap-5">
            <SelectField
              label="Jornada *"
              value={form.id_jornada}
              required
              onChange={(e) => setForm({ ...form, id_jornada: e.target.value })}
            >
              <option value="">Selecciona una jornada</option>
              {jornadas.map((j) => (
                <option key={j.id_jornada} value={j.id_jornada}>
                  {j.tipo_jornada} · {j.dia_semana} · {j.hora_inicio.slice(0, 5)} - {j.hora_final.slice(0, 5)}
                </option>
              ))}
            </SelectField>

            <Field
              label="Fecha *"
              type="date"
              value={form.fecha}
              required
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />

            <div className="rounded-2xl border border-primary-light/70 bg-slate-50/70 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-primary-dark">Alumnos</p>
                  <p className="text-xs text-slate-500">Selecciona los estudiantes para la clase.</p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-primary-dark">
                    Alumnos seleccionados: {selectedCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => void assignStudentsButton()}
                    disabled={selectedCount === 0 || assigning || !currentClassId}
                    className="rounded-full bg-primary-dark px-4 py-2 text-xs font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigning ? 'Asignando...' : 'Asignar alumnos'}
                  </button>
                </div>
              </div>

              {students.length === 0 ? (
                <p className="rounded-xl border border-dashed border-primary-light bg-white p-4 text-sm text-slate-500">
                  No hay alumnos disponibles.
                </p>
              ) : (
                <div className="student-table overflow-hidden rounded-xl border border-primary-light/70 bg-white">
                  <DataTable
                    value={students}
                    dataKey="ti"
                    emptyMessage="No hay alumnos disponibles."
                    scrollable
                    scrollHeight="260px"
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
                      header="Fecha de nacimiento"
                      body={(row: Alumno) => formatDate(row.fecha_nacimiento || undefined)}
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

            <div className="rounded-lg bg-background p-3 text-xs text-primary-dark">
              La clase quedará asociada con los alumnos seleccionados y la base de datos evitará duplicados por la clave compuesta.
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-primary-light px-4 py-2 text-xs font-bold text-slate-600 hover:bg-background"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary-dark px-4 py-2 text-xs font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
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
