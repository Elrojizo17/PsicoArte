import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCheck, MessageCircle, Paperclip, Search, Send, X } from 'lucide-react'
import { api, endpoints } from '../services/api'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader } from '../components/PageHeader'
import type { Conversacion, Mensaje } from '../types'

const apiOrigin = new URL(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').origin
const socketOrigin = apiOrigin.replace(/^http/, 'ws')
const formatTime = (value: string) => new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const formatDay = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(new Date(value))

export function MensajeriaPage() {
  const [conversations, setConversations] = useState<Conversacion[]>([])
  const [selected, setSelected] = useState<Conversacion | null>(null)
  const [messages, setMessages] = useState<Mensaje[]>([])
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const isParent = localStorage.getItem('tipo') === 'acudiente'

  const loadConversations = async () => {
    try {
      setLoading(true); setError('')
      const response = await api.get<Conversacion[]>(endpoints.conversaciones)
      setConversations(response.data)
      setSelected(current => current ? response.data.find(item => item.id === current.id) || response.data[0] || null : response.data[0] || null)
    } catch { setError('No se pudieron cargar las conversaciones.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadConversations() }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    setMessagesLoading(true)
    api.get<Mensaje[]>(`${endpoints.mensajes}?conversacion=${selected.id}`).then(response => { if (active) setMessages(response.data) }).catch(() => setError('No se pudieron cargar los mensajes.')).finally(() => { if (active) setMessagesLoading(false) })
    void api.post(`${endpoints.conversaciones}${selected.id}/marcar-leidos/`)
    const token = localStorage.getItem('token')
    const socket = new WebSocket(`${socketOrigin}/ws/mensajeria/${selected.id}/?token=${encodeURIComponent(token || '')}`)
    socket.onmessage = event => {
      const message = JSON.parse(event.data) as Mensaje
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setConversations(current => current.map(item => item.id === selected.id ? { ...item, no_leidos: 0, ultimo_mensaje: message } : item))
    }
    socketRef.current = socket
    return () => { active = false; socket.close(); socketRef.current = null }
  }, [selected?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const visibleConversations = useMemo(() => conversations.filter(item => item.acudiente_nombre.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [conversations, query])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || (!body.trim() && !file)) return
    const formData = new FormData()
    formData.append('conversacion', String(selected.id))
    if (body.trim()) formData.append('cuerpo', body.trim())
    if (file) formData.append('archivo', file)
    try {
      await api.post(endpoints.mensajes, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setBody(''); setFile(null)
    } catch { setError('No se pudo enviar el mensaje.') }
  }

  return <section className="page-enter"><PageHeader eyebrow="Comunicación" title="Mensajería" description={isParent ? 'Comunícate directamente con PsicoArte.' : 'Gestiona las conversaciones con las familias.'} />{error && <div className="mb-4"><ErrorState message={error}/></div>}{loading ? <LoadingState/> : <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-primary-light/70 bg-white shadow-sm lg:grid-cols-[290px_1fr]"> <aside className="border-b border-primary-light/50 bg-background/45 p-4 lg:border-b-0 lg:border-r"><div className="mb-4 flex items-center gap-2"><MessageCircle size={20} className="text-primary"/><h2 className="font-bold text-primary-dark">Conversaciones</h2></div>{!isParent && <label className="relative mb-3 block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar familia" className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-2 text-sm outline-none focus:border-primary"/></label>}<div className="grid gap-2">{visibleConversations.length === 0 ? <p className="p-3 text-sm text-slate-500">No hay conversaciones.</p> : visibleConversations.map(item => <button type="button" key={item.id} onClick={() => setSelected(item)} className={`rounded-xl p-3 text-left transition ${selected?.id === item.id ? 'bg-primary-dark text-white' : 'bg-white hover:bg-primary/10'}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{isParent ? 'PsicoArte' : item.acudiente_nombre}</p>{item.no_leidos > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected?.id === item.id ? 'bg-white text-primary-dark' : 'bg-primary text-white'}`}>{item.no_leidos}</span>}</div><p className={`mt-1 truncate text-xs ${selected?.id === item.id ? 'text-white/75' : 'text-slate-500'}`}>{item.ultimo_mensaje?.cuerpo || (item.ultimo_mensaje ? 'Archivo adjunto' : 'Sin mensajes todavía')}</p></button>)}</div></aside><div className="flex min-w-0 flex-col">{selected ? <><header className="border-b border-border px-5 py-4"><p className="text-xs font-bold uppercase tracking-widest text-primary">Conversación familiar</p><h2 className="mt-1 text-lg font-bold text-primary-dark">{isParent ? 'PsicoArte' : selected.acudiente_nombre}</h2></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8faf7] p-4">{messagesLoading ? <LoadingState/> : messages.length === 0 ? <div className="flex h-full min-h-72 items-center justify-center text-center text-sm text-slate-500">Aún no hay mensajes.<br/>Inicia la conversación.</div> : messages.map(message => <div key={message.id} className={`flex ${message.es_propio ? 'justify-end' : 'justify-start'}`}><article className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${message.es_propio ? 'rounded-br-sm bg-primary-dark text-white' : 'rounded-bl-sm border border-border bg-white text-ink'}`}><p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${message.es_propio ? 'text-white/70' : 'text-primary'}`}>{message.es_propio ? 'Tú' : message.remitente_nombre} · {formatDay(message.creado_en)} {formatTime(message.creado_en)}</p>{message.cuerpo && <p className="whitespace-pre-wrap text-sm">{message.cuerpo}</p>}{message.archivo_url && <a href={message.archivo_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-bold underline">{message.archivo || 'Ver archivo adjunto'}</a>}<p className="mt-2 flex justify-end"><CheckCheck size={14} className={message.es_propio ? 'text-white/70' : 'text-primary'}/></p></article></div>)}<div ref={bottomRef}/></div><form onSubmit={send} className="border-t border-border bg-white p-4"><div className="flex items-end gap-2"><label className="cursor-pointer rounded-lg p-2 text-primary hover:bg-background" aria-label="Adjuntar archivo"><Paperclip size={19}/><input type="file" className="hidden" onChange={event => setFile(event.target.files?.[0] || null)}/></label><textarea value={body} onChange={event => setBody(event.target.value)} rows={2} placeholder="Escribe un mensaje..." className="min-w-0 flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"/><button type="submit" aria-label="Enviar mensaje" className="rounded-xl bg-primary p-3 text-white hover:bg-primary-dark"><Send size={18}/></button></div>{file && <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">{file.name}<button type="button" onClick={() => setFile(null)} aria-label="Quitar archivo"><X size={14}/></button></p>}</form></> : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Selecciona una conversación para comenzar.</div>}</div></div>}</section>
}
