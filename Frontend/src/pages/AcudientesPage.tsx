import { Fragment, useEffect, useState } from 'react'
import axios from 'axios'
import { ChevronDown, ChevronUp, Pencil, Phone, Trash2, Users } from 'lucide-react'
import { Field, RequiredFieldsNotice, SelectField, requiredFieldMessage, showRequiredFieldMessage } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import { confirmAction, showSuccess } from '../services/alerts'
import type { Acudiente, Alumno } from '../types'

type FormData = Omit<Acudiente, 'alumnos' | 'usuario_username'>
const documentTypes = ['CC', 'CE', 'PPT', 'PA', 'PEP'] as const
const displayDocument = (type: string, document: string) => (
  document.startsWith('ACU-') ? 'No disponible' : [type, document].filter(Boolean).join(' · ') || 'No disponible'
)
const empty: FormData = {
  numero_documento: '', nombre_1: '', nombre_2: '', apellido_1: '', apellido_2: '',
  tipo_documento: 'CC', correo: '', telefono_1: '', telefono_2: '', telefono_3: '',
}

export function AcudientesPage() {
  const [items, setItems] = useState<Acudiente[]>([])
  const [students, setStudents] = useState<Alumno[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

  const linkedUsername = editing
    ? items.find(item => item.numero_documento === editing)?.usuario_username ?? ''
    : ''
  const hasAccount = Boolean(linkedUsername)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [{ data: guardians }, { data: studentData }] = await Promise.all([
        api.get<Acudiente[]>(endpoints.acudientes),
        api.get<Alumno[]>(endpoints.alumnos),
      ])
      setItems(guardians)
      setStudents(studentData)
    } catch {
      setError('No se pudieron cargar acudientes y estudiantes. Verifica que Django esté activo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const startCreate = () => {
    setEditing(null)
    setForm(empty)
    setUsername('')
    setPassword('')
    setFormError('')
    setOpen(true)
  }

  const startEdit = (item: Acudiente) => {
    setEditing(item.numero_documento)
    setForm(item)
    setUsername(item.usuario_username ?? '')
    setPassword('')
    setFormError('')
    setOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    const wasEditing = Boolean(editing)
    const credentials = {
      ...(!hasAccount && username.trim() ? { username: username.trim() } : {}),
      ...(password ? { password } : {}),
    }

    try {
      if (editing) {
        await api.patch(`${endpoints.acudientes}${editing}/`, { ...form, ...credentials })
      } else {
        await api.post(endpoints.acudientes, { ...form, ...credentials })
      }
      setOpen(false)
      setEditing(null)
      setForm(empty)
      setUsername('')
      setPassword('')
      await showSuccess(
        wasEditing ? 'Acudiente actualizado' : 'Acudiente creado',
        'La información se guardó correctamente.',
      )
      void load()
    } catch (reason) {
      const data = axios.isAxiosError(reason) ? reason.response?.data : null
      const messages = data && typeof data === 'object'
        ? Object.entries(data as Record<string, unknown>).flatMap(([field, value]) => {
          const values = Array.isArray(value) ? value : [value]
          return values.map(message => `${field}: ${String(message)}`)
        })
        : []
      setFormError(messages.join(' ') || 'No se pudo guardar el registro. Revisa los campos y las credenciales.')
    }
  }

  const remove = async (id: string) => {
    if (!await confirmAction('¿Eliminar acudiente?', 'Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`${endpoints.acudientes}${id}/`)
      await showSuccess('Acudiente eliminado', 'El registro se eliminó correctamente.')
      void load()
    } catch {
      setError('No se puede eliminar un acudiente con alumnos relacionados.')
    }
  }

  return <section className="page-enter">
    <PageHeader
      title="Acudientes"
      description={<span>Personas responsables y red de acompañamiento de cada alumno. <span className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary-dark"><Users size={15} className="text-primary" aria-hidden="true" />Haz clic en este ícono para ver los alumnos a cargo de cada acudiente.</span></span>}
      actionLabel="Nuevo Acudiente"
      action={startCreate}
    />
    {error && <div className="mb-4"><ErrorState message={error} /></div>}
    {loading ? <LoadingState /> : <div className="overflow-hidden rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 border-b border-primary-light/50 bg-background/60 px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-dark md:grid">
        <span>Nombre</span><span>Documento</span><span>Teléfono</span><span>Alumnos</span><span />
      </div>
      {items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aún no hay acudientes registrados.</p>}
      {items.map(item => {
        const assignedStudents = students.filter(student => item.alumnos?.some(summary => summary.ti === student.ti))
        const isExpanded = expanded === item.numero_documento
        return <Fragment key={item.numero_documento}>
          <div className="grid gap-3 border-b border-primary-light/30 px-5 py-4 last:border-0 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
            <div><p className="font-bold text-primary-dark">{item.nombre_1} {item.nombre_2} {item.apellido_1} {item.apellido_2}</p><p className="text-xs text-slate-400">Responsable registrado</p></div>
            <span className="text-sm text-slate-600">{displayDocument(item.tipo_documento, item.numero_documento)}</span>
            <span className="flex items-center gap-2 text-sm text-slate-600"><Phone size={15} className="text-primary" />{item.telefono_1}</span>
            <button type="button" onClick={() => setExpanded(isExpanded ? null : item.numero_documento)} className="flex items-center gap-2 text-left text-sm font-semibold text-primary-dark hover:text-primary" aria-expanded={isExpanded} aria-label={`Ver ${assignedStudents.length} alumnos`}><Users size={15} className="text-primary" />{assignedStudents.length}{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            <div className="flex gap-2"><button aria-label="Editar acudiente" onClick={() => startEdit(item)} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={17} /></button><button aria-label="Eliminar acudiente" onClick={() => void remove(item.numero_documento)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={17} /></button></div>
          </div>
          {isExpanded && <div className="border-b border-primary-light/30 bg-background/60 px-5 py-4 md:col-span-5">
            <p className="mb-3 text-sm font-bold text-primary-dark">Alumnos a cargo</p>
            {assignedStudents.length === 0 ? <p className="text-sm text-slate-500">No hay alumnos asociados a este acudiente.</p> : <div className="grid gap-3 md:grid-cols-2">
              {assignedStudents.map(student => <article key={student.ti} className="rounded-xl border border-border bg-white p-3">
                <p className="font-bold text-primary-dark">{student.nombre_1} {student.nombre_2 || ''} {student.apellido_1} {student.apellido_2 || ''}</p>
                <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2"><span><strong>TI:</strong> {student.ti}</span><span><strong>Identificación:</strong> {student.identificacion || '—'}</span><span><strong>Tipo de sangre:</strong> {student.tipo_sangre || '—'}</span><span><strong>Fecha de nacimiento:</strong> {student.fecha_nacimiento || '—'}</span><span className="sm:col-span-2"><strong>Clases programadas:</strong> {student.clases?.length ?? 0}</span></div>
              </article>)}
            </div>}
          </div>}
        </Fragment>
      })}
    </div>}
    {open && <Modal title={editing ? 'Editar acudiente' : 'Nuevo acudiente'} onClose={() => setOpen(false)}>
      <form onSubmit={save} onInvalid={event => {
        showRequiredFieldMessage(event)
        const field = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[required], select[required]')).find(candidate => candidate.validity.valueMissing)
        if (field) setFormError(requiredFieldMessage(field))
      }} className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><RequiredFieldsNotice /></div>
        {formError && <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{formError}</div>}
        <SelectField label="Tipo de documento" value={form.tipo_documento} onChange={event => setForm({ ...form, tipo_documento: event.target.value })}><option value="">Sin tipo de documento</option>{documentTypes.map(documentType => <option key={documentType} value={documentType}>{documentType}</option>)}</SelectField>
        <Field label="Número de documento" value={form.numero_documento} disabled={Boolean(editing)} onChange={event => setForm({ ...form, numero_documento: event.target.value })} />
        <Field label="Primer nombre *" value={form.nombre_1} required onChange={event => setForm({ ...form, nombre_1: event.target.value })} />
        <Field label="Segundo nombre" value={form.nombre_2} onChange={event => setForm({ ...form, nombre_2: event.target.value })} />
        <Field label="Primer apellido *" value={form.apellido_1} required onChange={event => setForm({ ...form, apellido_1: event.target.value })} />
        <Field label="Segundo apellido" value={form.apellido_2} onChange={event => setForm({ ...form, apellido_2: event.target.value })} />
        <Field label="Correo electrónico" type="email" value={form.correo} onChange={event => setForm({ ...form, correo: event.target.value })} />
        <Field label="Teléfono principal *" value={form.telefono_1} required onChange={event => setForm({ ...form, telefono_1: event.target.value })} />
        <Field label="Teléfono secundario" value={form.telefono_2} onChange={event => setForm({ ...form, telefono_2: event.target.value })} />
        <Field label="Teléfono adicional" value={form.telefono_3} onChange={event => setForm({ ...form, telefono_3: event.target.value })} />
        <Field label="Usuario" value={hasAccount ? linkedUsername : username} disabled={hasAccount} autoComplete="off" onChange={event => setUsername(event.target.value)} />
        <Field label="Contraseña" type="password" value={password} placeholder={hasAccount ? 'Dejar en blanco para no cambiarla' : 'Contraseña inicial'} autoComplete="new-password" onChange={event => setPassword(event.target.value)} />
        <div className="flex justify-end gap-2 md:col-span-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">Guardar acudiente</button>
        </div>
      </form>
    </Modal>}
  </section>
}
