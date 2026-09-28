import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, Pencil, Search, Trash2, WalletCards } from 'lucide-react'
import axios from 'axios'
import { Field, SelectField } from '../components/Field'
import { ErrorState, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { api, endpoints } from '../services/api'
import { confirmAction, showSuccess } from '../services/alerts'
import type { Alumno, Pago } from '../types'

type PaymentForm = { alumno: string; fecha_pago: string; clases_pagadas: string; valor_pagado: string }
const emptyPayment: PaymentForm = { alumno: '', fecha_pago: new Date().toISOString().slice(0, 10), clases_pagadas: '', valor_pagado: '' }

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
const formatMoney = (value: string | number) => Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const studentName = (student: Alumno) => [student.nombre_1, student.nombre_2, student.apellido_1, student.apellido_2].filter(Boolean).join(' ')

export function PagosPage() {
  const [students, setStudents] = useState<Alumno[]>([])
  const [payments, setPayments] = useState<Pago[]>([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<PaymentForm>(emptyPayment)
  const [formError, setFormError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [studentsResponse, paymentsResponse] = await Promise.all([
        api.get<Alumno[]>(endpoints.alumnos),
        api.get<Pago[]>(endpoints.pagos),
      ])
      setStudents(studentsResponse.data)
      setPayments(paymentsResponse.data)
    } catch {
      setError('No se pudo cargar la información de pagos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visibleStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return students
    return students.filter(student => studentName(student).toLocaleLowerCase().includes(normalizedQuery) || student.ti.toLocaleLowerCase().includes(normalizedQuery))
  }, [query, students])

  const activeCount = students.filter(student => student.resumen_pagos?.estado_pago === 'vigente').length
  const dueCount = students.filter(student => student.resumen_pagos?.estado_pago === 'vencido').length
  const availableClasses = students.reduce((total, student) => total + (student.resumen_pagos?.clases_disponibles || 0), 0)
  const paidValue = payments.reduce((total, payment) => total + Number(payment.valor_pagado), 0)

  const openCreate = (studentId = '') => {
    setEditing(null)
    setFormError('')
    setForm({ ...emptyPayment, alumno: studentId })
    setPaymentOpen(true)
  }

  const openEdit = (payment: Pago) => {
    setEditing(payment.id_pago)
    setFormError('')
    setForm({ alumno: payment.alumno, fecha_pago: payment.fecha_pago, clases_pagadas: String(payment.clases_pagadas), valor_pagado: payment.valor_pagado })
    setPaymentOpen(true)
  }

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setFormError('')
      const payload = { alumno: form.alumno, fecha_pago: form.fecha_pago, clases_pagadas: Number(form.clases_pagadas), valor_pagado: form.valor_pagado }
      if (editing) await api.patch(`${endpoints.pagos}${editing}/`, payload)
      else await api.post(endpoints.pagos, payload)
      setPaymentOpen(false)
      setForm(emptyPayment)
      await showSuccess(editing ? 'Pago actualizado' : 'Pago registrado', 'El estado del alumno fue actualizado.')
      void load()
    } catch (reason) {
      const data = axios.isAxiosError(reason) ? reason.response?.data : null
      const messages = data && typeof data === 'object' ? Object.entries(data as Record<string, unknown>).flatMap(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`) : []
      setFormError(messages.join(' ') || 'No se pudo guardar el pago.')
    }
  }

  const removePayment = async (payment: Pago) => {
    if (!await confirmAction('¿Eliminar este pago?', 'El saldo de clases del alumno será recalculado.')) return
    try {
      await api.delete(`${endpoints.pagos}${payment.id_pago}/`)
      await showSuccess('Pago eliminado', 'El historial fue actualizado.')
      void load()
    } catch { setError('No se pudo eliminar el pago.') }
  }

  return <section className="page-enter">
    <PageHeader eyebrow="Control financiero" title="Pagos" description="Controla los paquetes de clases, el saldo disponible y la fecha estimada del siguiente pago." actionLabel="Registrar pago" action={() => openCreate()} />
    {error && <div className="mb-4"><ErrorState message={error}/></div>}
    {loading ? <LoadingState/> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-primary-light/60 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Alumnos con saldo</p><CheckCircle2 className="text-emerald-500" size={20}/></div><p className="mt-3 text-3xl font-bold text-primary-dark">{activeCount}</p><p className="mt-1 text-xs text-slate-500">con clases disponibles</p></article>
        <article className="rounded-2xl border border-primary-light/60 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Pagos vencidos</p><AlertTriangle className="text-red-500" size={20}/></div><p className="mt-3 text-3xl font-bold text-red-600">{dueCount}</p><p className="mt-1 text-xs text-slate-500">requieren seguimiento</p></article>
        <article className="rounded-2xl border border-primary-light/60 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Clases disponibles</p><WalletCards className="text-primary" size={20}/></div><p className="mt-3 text-3xl font-bold text-primary-dark">{availableClasses}</p><p className="mt-1 text-xs text-slate-500">saldo acumulado</p></article>
        <article className="rounded-2xl border border-primary-light/60 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Valor registrado</p><CreditCard className="text-primary" size={20}/></div><p className="mt-3 text-2xl font-bold text-primary-dark">{formatMoney(paidValue)}</p><p className="mt-1 text-xs text-slate-500">historial completo</p></article>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="relative block min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar alumno o TI" className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-primary-dark focus:ring-2 focus:ring-primary/15" /></label><p className="text-sm text-slate-500">{visibleStudents.length} alumnos visibles</p></div>
      <div className="overflow-hidden rounded-2xl border border-primary-light/70 bg-white/80 shadow-sm">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-primary-light/50 bg-background/60 px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-dark md:grid"><span>Alumno</span><span>Estado</span><span>Saldo</span><span>Próximo pago</span><span/></div>
        {visibleStudents.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No hay alumnos que coincidan con la búsqueda.</p>}
        {visibleStudents.map(student => {
          const summary = student.resumen_pagos
          const history = payments.filter(payment => payment.alumno === student.ti)
          const isExpanded = expanded === student.ti
          const status = summary?.estado_pago || 'sin_pago'
          return <div key={student.ti} className="border-b border-primary-light/40 last:border-0">
            <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"><div><p className="font-bold text-primary-dark">{studentName(student)}</p><p className="text-xs text-slate-400">{student.ti}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${status === 'vigente' ? 'bg-emerald-50 text-emerald-700' : status === 'vencido' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{status === 'vigente' ? 'Vigente' : status === 'vencido' ? 'Vencido' : 'Sin pago'}</span><div><p className="font-bold text-primary-dark">{summary?.clases_disponibles || 0} clases</p><p className="text-xs text-slate-500">de {summary?.clases_pagadas || 0} pagadas</p></div><div className="flex items-center gap-2 text-sm text-slate-600"><CalendarClock size={16} className="text-primary"/>{formatDate(summary?.fecha_proximo_pago)}</div><div className="flex gap-1"><button aria-label="Ver historial" onClick={() => setExpanded(isExpanded ? null : student.ti)} className="rounded-lg p-2 text-primary hover:bg-background"><WalletCards size={17}/></button><button aria-label="Registrar pago" onClick={() => openCreate(student.ti)} className="rounded-lg p-2 text-primary hover:bg-background"><CreditCard size={17}/></button></div></div>
            {isExpanded && <div className="bg-background/60 px-5 pb-5 pt-1"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-primary-dark">Historial de pagos</p><p className="text-xs text-slate-500">Último pago: {formatDate(summary?.fecha_ultimo_pago)} · Cubre hasta: {formatDate(summary?.fecha_cubre_hasta)}</p></div>{history.length === 0 ? <p className="rounded-xl border border-dashed border-primary-light bg-white p-4 text-sm text-slate-500">Este alumno aún no tiene pagos registrados.</p> : <div className="grid gap-2">{history.map(payment => <div key={payment.id_pago} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm"><div className="min-w-0"><p className="font-semibold text-primary-dark">Pago del {formatDate(payment.fecha_pago)} · {payment.clases_pagadas} clases</p><p className="text-xs text-slate-500">{formatMoney(payment.valor_pagado)} · {payment.clases_disponibles} sin asignar</p><p className="mt-2 text-xs text-slate-600"><strong>Clases consumidas:</strong> {payment.clases_consumidas.length ? payment.clases_consumidas.map(formatDate).join(', ') : 'Ninguna todavía'}</p><p className="text-xs text-slate-600"><strong>Cubre hasta:</strong> {formatDate(payment.fecha_cubre_hasta)}</p></div><div className="flex gap-1"><button aria-label="Editar pago" onClick={() => openEdit(payment)} className="rounded-lg p-2 text-primary hover:bg-background"><Pencil size={16}/></button><button aria-label="Eliminar pago" onClick={() => void removePayment(payment)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div></div>)}</div>}</div>}
          </div>
        })}
      </div>
    </>}
    {paymentOpen && <Modal title={editing ? 'Editar pago' : 'Registrar pago'} onClose={() => setPaymentOpen(false)}><form onSubmit={savePayment} className="grid min-w-0 gap-4"><p className="text-sm text-slate-600">Cada pago agrega un paquete de clases. Las clases inscritas se descuentan al llegar su fecha, aunque el alumno no asista.</p>{formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{formError}</div>}<SelectField label="Alumno *" value={form.alumno} required onChange={event => setForm({ ...form, alumno: event.target.value })}><option value="">Selecciona un alumno</option>{students.map(student => <option key={student.ti} value={student.ti}>{studentName(student)} · {student.ti}</option>)}</SelectField><Field label="Fecha del pago *" type="date" value={form.fecha_pago} required onChange={event => setForm({ ...form, fecha_pago: event.target.value })}/><Field label="Cantidad de clases *" type="number" min="1" step="1" value={form.clases_pagadas} required onChange={event => setForm({ ...form, clases_pagadas: event.target.value })}/><Field label="Valor pagado *" type="number" min="0" step="0.01" value={form.valor_pagado} required onChange={event => setForm({ ...form, valor_pagado: event.target.value })}/><div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">{editing ? 'Actualizar pago' : 'Guardar pago'}</button></div></form></Modal>}
  </section>
}
