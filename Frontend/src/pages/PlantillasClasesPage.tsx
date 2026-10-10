import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, CopyPlus, Pencil, Plus, RefreshCw, Trash2, UserPlus, Users, X } from 'lucide-react'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Field, RequiredFieldsNotice, SelectField, showRequiredFieldMessage } from '../components/Field'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints, getApiErrorMessage } from '../services/api'
import { confirmAction, showSuccess } from '../services/alerts'
import type { Alumno, AlumnoSummary, Jornada, PlantillaClase } from '../types'

type TemplateForm = {
  nombre: string
  descripcion: string
  id_jornada: string
  fecha_inicio: string
  fecha_fin: string
  es_recurrente: boolean
  frecuencia: 'semanal' | 'quincenal'
  activo: boolean
}

type ExceptionForm = { fecha: string; ti: string; accion: 'agregar' | 'quitar'; observacion: string }

const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const emptyForm = (): TemplateForm => ({
  nombre: '',
  descripcion: '',
  id_jornada: '',
  fecha_inicio: dateKey(new Date()),
  fecha_fin: '',
  es_recurrente: true,
  frecuencia: 'semanal',
  activo: true,
})

const studentName = (student: AlumnoSummary | Alumno) => `${student.nombre_1} ${student.apellido_1}`.trim()

function TemplateFormModal({
  editing,
  form,
  jornadas,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  editing: boolean
  form: TemplateForm
  jornadas: Jornada[]
  onChange: (next: TemplateForm) => void
  onClose: () => void
  onSave: (event: React.FormEvent) => void
  saving: boolean
}) {
  const selectedDate = form.fecha_inicio ? new Date(`${form.fecha_inicio}T00:00:00`) : null
  const dayName = selectedDate ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1] : ''
  const availableJornadas = jornadas.filter((item) => !dayName || item.dia_semana === dayName)

  return <Modal title={editing ? 'Editar plantilla' : 'Nueva plantilla'} onClose={onClose}>
    <form onSubmit={onSave} onInvalid={showRequiredFieldMessage} className="grid min-w-0 gap-4">
      <RequiredFieldsNotice />
      <Field label="Nombre de la plantilla *" value={form.nombre} required placeholder="Ej. Iniciación Musical - lunes" onChange={(event) => onChange({ ...form, nombre: event.target.value })} />
      <Field label="Descripción" value={form.descripcion} placeholder="Información adicional del grupo" onChange={(event) => onChange({ ...form, descripcion: event.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primera fecha *" type="date" value={form.fecha_inicio} required onChange={(event) => onChange({ ...form, fecha_inicio: event.target.value, id_jornada: '' })} />
        <Field label="Fecha final" type="date" value={form.fecha_fin} min={form.fecha_inicio} onChange={(event) => onChange({ ...form, fecha_fin: event.target.value })} />
      </div>
      <SelectField label="Jornada *" value={form.id_jornada} required disabled={!form.fecha_inicio} onChange={(event) => onChange({ ...form, id_jornada: event.target.value })}>
        <option value="">{dayName ? `Jornada del ${dayName}` : 'Selecciona primero una fecha'}</option>
        {availableJornadas.map((item) => <option key={item.id_jornada} value={item.id_jornada}>{item.tipo_jornada} · {item.hora_inicio.slice(0, 5)} - {item.hora_final.slice(0, 5)}</option>)}
      </SelectField>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-primary-light/70 px-3 py-3 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={form.es_recurrente} onChange={(event) => onChange({ ...form, es_recurrente: event.target.checked })} /> Clase recurrente
      </label>
      {form.es_recurrente && <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-primary-light/70 bg-background/40 px-3 py-3 text-sm font-semibold text-slate-700">
          <input type="radio" name="frecuencia" checked={form.frecuencia === 'semanal'} onChange={() => onChange({ ...form, frecuencia: 'semanal' })} /> Semanal
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-primary-light/70 bg-background/40 px-3 py-3 text-sm font-semibold text-slate-700">
          <input type="radio" name="frecuencia" checked={form.frecuencia === 'quincenal'} onChange={() => onChange({ ...form, frecuencia: 'quincenal' })} /> Quincenal
        </label>
      </div>}
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-primary-light/70 px-3 py-3 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={form.activo} onChange={(event) => onChange({ ...form, activo: event.target.checked })} /> Plantilla activa
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-primary-light px-4 py-3 text-sm font-bold text-slate-600">Cancelar</button>
        <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-primary-dark px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}</button>
      </div>
    </form>
  </Modal>
}

function ManageTemplateModal({
  template,
  students,
  onClose,
  onReload,
}: {
  template: PlantillaClase
  students: Alumno[]
  onClose: () => void
  onReload: () => Promise<void>
}) {
  const [baseStudents, setBaseStudents] = useState<AlumnoSummary[]>(template.alumnos || [])
  const [studentToAdd, setStudentToAdd] = useState('')
  const [exception, setException] = useState<ExceptionForm>({ fecha: template.fecha_inicio, ti: '', accion: 'agregar', observacion: '' })
  const [generation, setGeneration] = useState({ fecha_inicio: template.fecha_inicio, fecha_fin: template.fecha_fin || template.fecha_inicio })
  const [saving, setSaving] = useState(false)
  const baseIds = new Set(baseStudents.map((student) => student.ti))
  const availableStudents = students.filter((student) => !baseIds.has(student.ti))

  const addStudent = async () => {
    if (!studentToAdd) return
    setSaving(true)
    try {
      await api.post(`${endpoints.plantillasClases}${template.id_plantilla}/alumnos/`, { ti: studentToAdd })
      setStudentToAdd('')
      await onReload()
      setBaseStudents((current) => [...current, students.find((student) => student.ti === studentToAdd) as AlumnoSummary])
      await showSuccess('Alumno añadido', 'Quedará incluido en las próximas clases generadas.')
    } catch { /* The parent view displays the next load error when needed. */ } finally { setSaving(false) }
  }

  const removeStudent = async (ti: string) => {
    if (!await confirmAction('¿Quitar alumno de la plantilla?', 'Las clases ya generadas conservarán su historial.')) return
    try {
      await api.delete(`${endpoints.plantillasClases}${template.id_plantilla}/alumnos/${encodeURIComponent(ti)}/`)
      setBaseStudents((current) => current.filter((student) => student.ti !== ti))
    } catch { /* Keep the current list when the request fails. */ }
  }

  const saveException = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!exception.fecha || !exception.ti) return
    setSaving(true)
    try {
      await api.post(`${endpoints.plantillasClases}${template.id_plantilla}/excepciones/`, exception)
      setException({ ...exception, ti: '', observacion: '' })
      await showSuccess('Excepción guardada', 'Solo afectará la clase de esa fecha.')
    } catch { /* Keep the form available for correction. */ } finally { setSaving(false) }
  }

  const generate = async () => {
    if (!generation.fecha_inicio || !generation.fecha_fin) return
    setSaving(true)
    try {
      const response = await api.post<{ cantidad: number }>(`${endpoints.plantillasClases}${template.id_plantilla}/generar/`, generation)
      await onReload()
      await showSuccess('Clases generadas', `Se crearon ${response.data.cantidad} clases nuevas.`)
    } catch { /* The API response is shown by the shared error state on reload. */ } finally { setSaving(false) }
  }

  return <Modal title={template.nombre || `Plantilla ${template.id_plantilla}`} onClose={onClose}>
    <div className="grid gap-5">
      <div className="rounded-2xl border border-primary-light/70 bg-background/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Horario base</p><p className="mt-1 font-bold text-primary-dark">{template.jornada_detalle?.tipo_jornada}</p><p className="mt-1 text-sm text-slate-600">{template.jornada_detalle?.dia_semana} · {template.jornada_detalle?.hora_inicio.slice(0, 5)} - {template.jornada_detalle?.hora_final.slice(0, 5)}</p></div>
          <CalendarPlus className="text-primary" size={22} />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold text-primary-dark"><Users size={18} /> Alumnos base ({baseStudents.length})</h3></div>
        <div className="flex gap-2">
          <select value={studentToAdd} onChange={(event) => setStudentToAdd(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm"><option value="">Seleccionar alumno</option>{availableStudents.map((student) => <option key={student.ti} value={student.ti}>{studentName(student)}</option>)}</select>
          <button type="button" disabled={!studentToAdd || saving} onClick={() => void addStudent()} aria-label="Añadir alumno" className="min-h-12 min-w-12 rounded-xl bg-primary px-3 text-white disabled:opacity-50"><UserPlus size={18} className="mx-auto" /></button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{baseStudents.length === 0 ? <p className="rounded-xl border border-dashed border-primary-light p-4 text-sm text-slate-500 sm:col-span-2">Aún no hay alumnos base.</p> : baseStudents.map((student) => <div key={student.ti} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2"><span className="min-w-0 truncate text-sm font-semibold text-slate-700">{studentName(student)}</span><button type="button" onClick={() => void removeStudent(student.ti)} aria-label={`Quitar a ${studentName(student)}`} className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"><X size={16} /></button></div>)}</div>
      </section>

      <form onSubmit={saveException} className="grid gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
        <div><h3 className="font-bold text-sky-800">Excepción puntual</h3><p className="mt-1 text-xs text-sky-700">Añade o quita un alumno solo para una fecha.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha" type="date" value={exception.fecha} required onChange={(event) => setException({ ...exception, fecha: event.target.value })} /><SelectField label="Acción" value={exception.accion} onChange={(event) => setException({ ...exception, accion: event.target.value as ExceptionForm['accion'] })}><option value="agregar">Agregar alumno</option><option value="quitar">Quitar alumno</option></SelectField></div>
        <SelectField label="Alumno" value={exception.ti} required onChange={(event) => setException({ ...exception, ti: event.target.value })}><option value="">Seleccionar alumno</option>{students.map((student) => <option key={student.ti} value={student.ti}>{studentName(student)}</option>)}</SelectField>
        <input value={exception.observacion} maxLength={255} placeholder="Observación opcional" onChange={(event) => setException({ ...exception, observacion: event.target.value })} className="min-h-12 rounded-xl border border-sky-200 bg-white px-3 text-sm outline-none focus:border-sky-500" />
        <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">Guardar excepción</button>
      </form>

      <section className="rounded-2xl border border-primary-light/70 bg-white p-4">
        <div className="flex items-start gap-3"><CopyPlus className="mt-0.5 shrink-0 text-primary" size={20} /><div><h3 className="font-bold text-primary-dark">Generar clases futuras</h3><p className="mt-1 text-xs text-slate-500">Las clases ya existentes no se duplican ni se modifican.</p></div></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Desde" type="date" value={generation.fecha_inicio} required onChange={(event) => setGeneration({ ...generation, fecha_inicio: event.target.value })} /><Field label="Hasta" type="date" value={generation.fecha_fin} min={generation.fecha_inicio} required onChange={(event) => setGeneration({ ...generation, fecha_fin: event.target.value })} /></div>
        <button type="button" disabled={saving} onClick={() => void generate()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-dark px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={17} /> Generar clases</button>
      </section>
    </div>
  </Modal>
}

export function PlantillasClasesPage() {
  const [templates, setTemplates] = useState<PlantillaClase[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [students, setStudents] = useState<Alumno[]>([])
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [editing, setEditing] = useState<number | null>(null)
  const [managing, setManaging] = useState<PlantillaClase | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [templateResponse, journeyResponse, studentResponse] = await Promise.all([
        api.get<PlantillaClase[]>(endpoints.plantillasClases),
        api.get<Jornada[]>(endpoints.jornadas),
        api.get<Alumno[]>(endpoints.alumnos),
      ])
      setTemplates(templateResponse.data)
      setJornadas(journeyResponse.data)
      setStudents(studentResponse.data)
      setManaging((current) => current ? templateResponse.data.find((item) => item.id_plantilla === current.id_plantilla) || null : null)
    } catch (reason) { setError(getApiErrorMessage(reason, 'No se pudieron cargar las plantillas.')) } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true) }
  const openEdit = (item: PlantillaClase) => { setEditing(item.id_plantilla); setForm({ nombre: item.nombre, descripcion: item.descripcion || '', id_jornada: String(item.jornada_detalle?.id_jornada || ''), fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin || '', es_recurrente: item.es_recurrente, frecuencia: item.frecuencia, activo: item.activo }); setOpen(true) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = editing ? await api.patch<PlantillaClase>(`${endpoints.plantillasClases}${editing}/`, form) : await api.post<PlantillaClase>(endpoints.plantillasClases, form)
      setOpen(false)
      await load()
      if (!editing) setManaging(response.data)
      await showSuccess(editing ? 'Plantilla actualizada' : 'Plantilla creada', 'Ahora puedes añadir alumnos y generar las clases.')
    } catch { setError('No se pudo guardar la plantilla. Revisa la fecha y la jornada seleccionada.') } finally { setSaving(false) }
  }
  const remove = async (id: number) => { if (!await confirmAction('¿Eliminar plantilla?', 'Las clases ya generadas conservarán su información.')) return; try { await api.delete(`${endpoints.plantillasClases}${id}/`); await load(); await showSuccess('Plantilla eliminada', 'Las clases históricas no fueron modificadas.') } catch { setError('No se pudo eliminar la plantilla.') } }

  const activeCount = useMemo(() => templates.filter((item) => item.activo).length, [templates])

  return <section className="page-enter">
    <PageHeader eyebrow="Programación recurrente" title="Plantillas de clases" description="Reutiliza horarios y alumnos sin alterar el historial." actionLabel="Nueva plantilla" action={openNew} />
    {error && <div className="mb-4"><ErrorState message={error} /></div>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-primary-light/70 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Plantillas</p><p className="mt-1 text-2xl font-bold text-primary-dark">{templates.length}</p></div><div className="rounded-2xl border border-primary-light/70 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Activas</p><p className="mt-1 text-2xl font-bold text-primary-dark">{activeCount}</p></div><div className="rounded-2xl border border-primary-light/70 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Uso</p><p className="mt-1 text-sm font-semibold text-slate-600">Genera por rangos</p></div></div>
    {loading ? <LoadingState /> : templates.length === 0 ? <div className="rounded-2xl border border-dashed border-primary-light bg-white/70 p-8 text-center"><CalendarPlus className="mx-auto text-primary" size={30} /><p className="mt-3 font-bold text-primary-dark">Aún no tienes plantillas</p><p className="mt-1 text-sm text-slate-500">Crea una para reutilizar un horario con los mismos alumnos.</p><button type="button" onClick={openNew} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary-dark px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Crear plantilla</button></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((item) => <article key={item.id_plantilla} className="rounded-2xl border border-primary-light/70 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.activo ? 'Activa' : 'Inactiva'}</span><h2 className="mt-3 truncate font-bold text-primary-dark">{item.nombre || `Plantilla ${item.id_plantilla}`}</h2><p className="mt-1 text-sm text-slate-600">{item.jornada_detalle?.dia_semana} · {item.jornada_detalle?.hora_inicio.slice(0, 5)} - {item.jornada_detalle?.hora_final.slice(0, 5)}</p></div><div className="flex shrink-0 gap-1"><button type="button" aria-label="Editar plantilla" onClick={() => openEdit(item)} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={17} /></button><button type="button" aria-label="Eliminar plantilla" onClick={() => void remove(item.id_plantilla)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={17} /></button></div></div><div className="mt-4 grid grid-cols-2 gap-2 border-y border-border py-3 text-sm"><div><p className="text-xs text-slate-400">Periodo</p><p className="mt-1 font-semibold text-slate-700">{item.fecha_inicio} {item.fecha_fin ? `a ${item.fecha_fin}` : 'en adelante'}</p></div><div><p className="text-xs text-slate-400">Alumnos base</p><p className="mt-1 font-semibold text-slate-700">{item.alumnos?.length || 0}</p></div></div><button type="button" onClick={() => setManaging(item)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"><Users size={17} /> Gestionar alumnos y fechas</button></article>)}</div>}
    {open && <TemplateFormModal editing={Boolean(editing)} form={form} jornadas={jornadas} onChange={setForm} onClose={() => setOpen(false)} onSave={save} saving={saving} />}
    {managing && <ManageTemplateModal template={managing} students={students} onClose={() => setManaging(null)} onReload={load} />}
  </section>
}
