import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock3, Download, FileText, MessageCircle, Paperclip, RotateCw, Search, Send, X } from 'lucide-react'
import { api, endpoints } from '../services/api'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader } from '../components/PageHeader'
import type { Conversacion, Jornada, Mensaje } from '../types'

const apiOrigin = new URL(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').origin
const socketOrigin = apiOrigin.replace(/^http/, 'ws')
const formatTime = (value: string) => new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const formatDay = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(new Date(value))
type PendingMessage = { localId: number; conversationId: number; cuerpo: string; archivo: File | null; status: 'sending' | 'failed' }

function BroadcastComposer({ conversations, jornadas }: { conversations: Conversacion[]; jornadas: Jornada[] }) {
  const [audience, setAudience] = useState<'general' | 'jornada' | 'acudientes'>('general')
  const [jornada, setJornada] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [statusText, setStatusText] = useState('')
  const [sending, setSending] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setStatusText('')
    try {
      const { data } = await api.post<{ enviados: number }>('/mensajeria/mensajes-masivos/', { audiencia: audience, cuerpo: body.trim(), ...(audience === 'jornada' ? { jornada } : {}), ...(audience === 'acudientes' ? { acudientes: selected } : {}) })
      setStatusText(`Enviado a ${data.enviados} acudiente${data.enviados === 1 ? '' : 's'}.`); setBody('')
    } catch { setStatusText('No se pudo enviar. Revisa la audiencia y vuelve a intentar.') }
    finally { setSending(false) }
  }
  return <form onSubmit={submit} className="mb-3 grid gap-2 rounded-xl border border-primary-light/70 bg-white p-3 shadow-sm sm:grid-cols-[180px_1fr_auto]"><div className="grid content-start gap-2"><label className="text-xs font-bold text-primary-dark">Enviar a<select className="mt-1 w-full rounded-lg border border-border p-2 text-sm" value={audience} onChange={e => setAudience(e.target.value as typeof audience)}><option value="general">Todos los acudientes</option><option value="jornada">Padres de una jornada</option><option value="acudientes">Acudientes seleccionados</option></select></label>{audience === 'jornada' && <select required className="rounded-lg border border-border p-2 text-sm" value={jornada} onChange={e => setJornada(e.target.value)}><option value="">Selecciona jornada</option>{jornadas.map(item => <option key={item.id_jornada} value={item.id_jornada}>{item.dia_semana} · {item.hora_inicio} · {item.tipo_jornada}</option>)}</select>}</div><div><textarea required maxLength={5000} rows={2} className="w-full rounded-lg border border-border p-2 text-sm" placeholder="Mensaje para varios acudientes..." value={body} onChange={e => setBody(e.target.value)}/>{audience === 'acudientes' && <div className="mt-1 flex max-h-20 flex-wrap gap-x-3 gap-y-1 overflow-y-auto">{conversations.map(item => <label key={item.acudiente} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selected.includes(item.acudiente)} onChange={e => setSelected(v => e.target.checked ? [...v, item.acudiente] : v.filter(id => id !== item.acudiente))}/>{item.acudiente_nombre}</label>)}</div>}{statusText && <p role="status" className="mt-1 text-xs text-primary-dark">{statusText}</p>}</div><button type="submit" disabled={sending || !body.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{sending ? 'Enviando…' : 'Enviar'}</button></form>
}

function AttachmentPreview({ url, name, own }: { url: string; name: string; own: boolean }) {
  const [protectedUrl, setProtectedUrl] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const filename = name.split(/[\\/]/).pop() || name
  const extension = filename.split('.').pop()?.toLocaleLowerCase() || ''
  const image = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension)
  const pdf = extension === 'pdf'

  useEffect(() => {
    let active = true
    let objectUrl = ''
    setProtectedUrl('')
    setLoadFailed(false)
    api.get<Blob>(url, { responseType: 'blob' }).then(({ data }) => {
      const createdUrl = URL.createObjectURL(data)
      if (!active) {
        URL.revokeObjectURL(createdUrl)
        return
      }
      objectUrl = createdUrl
      setProtectedUrl(createdUrl)
    }).catch(() => { if (active) setLoadFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (loadFailed) return <p className="mt-2 text-xs text-red-600">No se pudo cargar el archivo adjunto.</p>
  if (!protectedUrl) return <p className="mt-2 text-xs opacity-70">Cargando archivo adjunto…</p>

  if (image) return <a href={protectedUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg" aria-label={`Abrir imagen ${filename}`}>
    <img src={protectedUrl} alt={filename} loading="lazy" className="max-h-72 w-full rounded-lg object-contain" />
    <span className={`mt-1 block truncate text-xs ${own ? 'text-white/75' : 'text-slate-500'}`}>{filename}</span>
  </a>

  if (pdf) return <div className="mt-2 w-full overflow-hidden rounded-lg border border-border/60 bg-white">
    <iframe src={protectedUrl} title={`Vista previa: ${filename}`} className="h-72 w-full" />
    <a href={protectedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-primary-dark hover:underline"><FileText size={15}/><span className="min-w-0 flex-1 truncate">{filename}</span><Download size={15}/><span>Abrir</span></a>
  </div>

  return <a href={protectedUrl} download={filename} className={`mt-2 flex items-center gap-3 rounded-lg border px-3 py-3 ${own ? 'border-white/20 bg-white/10 text-white' : 'border-border bg-background text-ink'}`}>
    <FileText size={22} className="shrink-0 text-primary"/>
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{filename}</span><span className="text-[10px] opacity-70">{extension ? `${extension.toUpperCase()} · Archivo adjunto` : 'Archivo adjunto'}</span></span>
    <Download size={16}/>
  </a>
}

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
  const [sending, setSending] = useState(false)
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list')
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const isParent = localStorage.getItem('tipo') === 'acudiente'

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setError('') }
      const response = await api.get<Conversacion[]>(endpoints.conversaciones)
      setConversations(response.data)
      setSelected(current => current ? response.data.find(item => item.id === current.id) || response.data[0] || null : response.data[0] || null)
    } catch { if (!silent) setError('No se pudieron cargar las conversaciones.') }
    finally { if (!silent) setLoading(false) }
  }

  useEffect(() => { void loadConversations() }, [])
  useEffect(() => { if (!isParent) void api.get<Jornada[]>(endpoints.jornadas).then(({ data }) => setJornadas(data)).catch(() => {}) }, [isParent])

  useEffect(() => {
    if (!selected) return
    let active = true
    setMessagesLoading(true)
    api.get<Mensaje[]>(`${endpoints.mensajes}?conversacion=${selected.id}`).then(response => { if (active) setMessages(response.data) }).catch(() => setError('No se pudieron cargar los mensajes.')).finally(() => { if (active) setMessagesLoading(false) })
    void api.post(`${endpoints.conversaciones}${selected.id}/marcar-leidos/`)
    const token = localStorage.getItem('token')
    const socketUrl = `${socketOrigin}/ws/mensajeria/${selected.id}/?token=${encodeURIComponent(token || '')}`
    console.log('[PsicoArte messaging] opening WebSocket', { socketUrl: socketUrl.replace(/([?&]token=)[^&]*/, '$1[redacted]'), pageOrigin: window.location.origin })
    const socket = new WebSocket(socketUrl)
    socket.onopen = () => console.log('[PsicoArte messaging] WebSocket connected', { conversationId: selected.id })
    socket.onerror = event => console.error('[PsicoArte messaging] WebSocket error', event)
    socket.onclose = event => console.log('[PsicoArte messaging] WebSocket closed', { conversationId: selected.id, code: event.code, reason: event.reason, wasClean: event.wasClean })
    socket.onmessage = event => {
      const payload = JSON.parse(event.data) as Mensaje | { type: 'read_receipt' }
      if ('type' in payload && payload.type === 'read_receipt') {
        void api.get<Mensaje[]>(`${endpoints.mensajes}?conversacion=${selected.id}`).then(response => {
          if (active) setMessages(response.data)
        }).catch(() => { /* The periodic refresh will load the updated read state. */ })
        return
      }
      const message = payload as Mensaje
      console.log('[PsicoArte messaging] WebSocket message received', { conversationId: selected.id, messageId: message.id, own: message.es_propio })
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setConversations(current => current.map(item => item.id === selected.id ? { ...item, no_leidos: 0, ultimo_mensaje: message } : item))
    }
    socketRef.current = socket
    const refresh = window.setInterval(async () => {
      try {
        const response = await api.get<Mensaje[]>(`${endpoints.mensajes}?conversacion=${selected.id}`)
        if (active) setMessages(current => {
          const currentById = new Map(current.map(message => [message.id, message]))
          const merged = response.data.map(incoming => {
            const existing = currentById.get(incoming.id)
            return existing && existing.leido_por_acudiente === incoming.leido_por_acudiente && existing.leido_por_personal === incoming.leido_por_personal
              ? existing
              : incoming
          })
          const responseIds = new Set(merged.map(message => message.id))
          current.forEach(message => { if (!responseIds.has(message.id)) merged.push(message) })
          merged.sort((a, b) => a.id - b.id)
          return merged.some((message, index) => message !== current[index]) || merged.length !== current.length ? merged : current
        })
      } catch { /* Preserve the conversation during temporary network loss. */ }
    }, 5000)
    return () => { active = false; window.clearInterval(refresh); socket.close(); socketRef.current = null }
  }, [selected?.id])

  useEffect(() => {
    const refresh = window.setInterval(() => { void loadConversations(true) }, 5000)
    return () => window.clearInterval(refresh)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const visibleConversations = useMemo(() => conversations.filter(item => item.acudiente_nombre.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [conversations, query])

  const transmit = async (pending: PendingMessage) => {
    setSending(true)
    setPendingMessages(current => current.map(item => item.localId === pending.localId ? { ...item, status: 'sending' } : item))
    const formData = new FormData()
    formData.append('conversacion', String(pending.conversationId))
    if (pending.cuerpo) formData.append('cuerpo', pending.cuerpo)
    if (pending.archivo) formData.append('archivo_upload', pending.archivo)
    try {
      await api.post(endpoints.mensajes, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPendingMessages(current => current.filter(item => item.localId !== pending.localId))
      try {
        const response = await api.get<Mensaje[]>(`${endpoints.mensajes}?conversacion=${pending.conversationId}`)
        setMessages(current => [...new Map([...current, ...response.data].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id))
      } catch { /* The periodic refresh will load a successfully sent message. */ }
      void loadConversations(true)
    } catch {
      setPendingMessages(current => current.map(item => item.localId === pending.localId ? { ...item, status: 'failed' } : item))
    } finally { setSending(false) }
  }

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || (!body.trim() && !file) || sending) return
    const pending: PendingMessage = { localId: Date.now(), conversationId: selected.id, cuerpo: body.trim(), archivo: file, status: 'sending' }
    setPendingMessages(current => [...current, pending])
    setBody(''); setFile(null); setError('')
    void transmit(pending)
  }

  return <section className="page-enter flex min-h-[calc(100dvh-2rem)] flex-col overflow-hidden lg:h-[calc(100dvh-4rem)] lg:min-h-0"><PageHeader title={'Mensajer\u00eda'} description={isParent ? 'Comunícate directamente con PsicoArte.' : 'Gestiona las conversaciones con los acudientes.'} />{!isParent && <BroadcastComposer conversations={conversations} jornadas={jornadas}/ >}{error && <div className="mb-4"><ErrorState message={error}/></div>}{loading ? <LoadingState/> : <div className="grid h-[calc(100dvh-11rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-primary-light/70 bg-white shadow-sm lg:min-h-0 lg:flex-1 lg:grid-cols-[290px_1fr]"> <aside className={`${mobileView === 'conversation' ? 'hidden' : 'block'} min-h-0 overflow-y-auto border-primary-light/50 bg-background/45 p-3 lg:block lg:border-r lg:p-4`}><div className="mb-3 flex items-center gap-2 px-1"><MessageCircle size={20} className="text-primary"/><h2 className="font-bold text-primary-dark">Conversaciones</h2></div>{!isParent && <label className="relative mb-3 block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar Acudiente" className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-2 text-sm outline-none focus:border-primary"/></label>}<div className="grid gap-2">{visibleConversations.length === 0 ? <p className="p-3 text-sm text-slate-500">No hay conversaciones.</p> : visibleConversations.map(item => <button type="button" key={item.id} onClick={() => { setSelected(item); setMobileView('conversation') }} className={`rounded-xl p-3 text-left transition ${selected?.id === item.id ? 'bg-primary-dark text-white' : 'bg-white hover:bg-primary/10'}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{isParent ? 'PsicoArte' : item.acudiente_nombre}</p>{item.no_leidos > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected?.id === item.id ? 'bg-white text-primary-dark' : 'bg-primary text-white'}`}>{item.no_leidos}</span>}</div><p className={`mt-1 truncate text-xs ${selected?.id === item.id ? 'text-white/75' : 'text-slate-500'}`}>{item.ultimo_mensaje?.cuerpo || (item.ultimo_mensaje ? 'Archivo adjunto' : 'Sin mensajes todavía')}</p></button>)}</div></aside><div className={`${mobileView === 'list' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col lg:flex`}>{selected ? <><header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-5 sm:py-4"><button type="button" onClick={() => setMobileView('list')} className="rounded-full p-2 text-primary hover:bg-background lg:hidden" aria-label="Volver a conversaciones"><ArrowLeft size={20}/></button><div className="min-w-0"><h2 className="truncate text-base font-bold text-primary-dark sm:text-lg">{isParent ? 'PsicoArte' : selected.acudiente_nombre}</h2></div></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f8faf7] p-3 sm:p-4">{messagesLoading ? <LoadingState/> : messages.length === 0 ? <div className="flex h-full min-h-72 items-center justify-center text-center text-sm text-slate-500">Aún no hay mensajes.<br/>Inicia la conversación.</div> : messages.map(message => <div key={message.id} className={`flex ${message.es_propio ? 'justify-end' : 'justify-start'}`}><article className={`max-w-[88%] rounded-2xl px-3 py-2.5 shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 ${message.es_propio ? 'rounded-br-sm bg-primary-dark text-white' : 'rounded-bl-sm border border-border bg-white text-ink'}`}><p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${message.es_propio ? 'text-white/70' : 'text-primary'}`}>{message.es_propio ? 'Tú' : message.remitente_nombre} · {formatDay(message.creado_en)} {formatTime(message.creado_en)}</p>{message.cuerpo && <p className="whitespace-pre-wrap break-words text-sm">{message.cuerpo}</p>}{message.archivo_url && <AttachmentPreview url={message.archivo_url} name={message.archivo || 'Archivo adjunto'} own={message.es_propio}/>}<p className="mt-2 flex min-h-4 justify-end">{message.es_propio && ((isParent ? message.leido_por_personal : message.leido_por_acudiente) ? <CheckCheck size={14} className="text-sky-300" aria-label="Leído"/> : <Check size={14} className="text-white/70" aria-label="Enviado"/>)}</p></article></div>)}{pendingMessages.filter(item => item.conversationId === selected.id).map(item => <div key={item.localId} className="flex justify-end"><article className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary-dark/80 px-3 py-2.5 text-white shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3"><p className="whitespace-pre-wrap break-words text-sm">{item.cuerpo || item.archivo?.name || 'Adjunto'}</p><p className="mt-2 flex items-center justify-end gap-1 text-white/75">{item.status === 'sending' ? <><Clock3 size={13}/><span className="text-[10px]">Enviando</span></> : <><AlertCircle size={14} className="text-red-200"/><span className="text-[10px]">No enviado</span><button type="button" onClick={() => void transmit(item)} aria-label="Reintentar envío" title="Reintentar" className="ml-1 rounded p-1 hover:bg-white/15"><RotateCw size={14}/></button></>}</p></article></div>)}<div ref={bottomRef}/></div><form onSubmit={send} className="border-t border-border bg-white p-2.5 sm:p-4"><div className="flex items-end gap-1.5 sm:gap-2"><label className="cursor-pointer rounded-lg p-2 text-primary hover:bg-background" aria-label="Adjuntar archivo"><Paperclip size={19}/><input type="file" className="hidden" onChange={event => setFile(event.target.files?.[0] || null)}/></label><textarea value={body} onChange={event => setBody(event.target.value)} rows={2} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} onCopy={event => event.stopPropagation()} onCut={event => event.stopPropagation()} onPaste={event => event.stopPropagation()} placeholder="Escribe un mensaje..." className="min-w-0 flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"/><button type="submit" aria-label="Enviar mensaje" disabled={sending} className="rounded-xl bg-primary p-3 text-white hover:bg-primary-dark disabled:opacity-60"><Send size={18}/></button></div>{file && <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-500"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label="Quitar archivo"><X size={14}/></button></p>}</form></> : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Selecciona una conversación para comenzar.</div>}</div></div>}</section>
}
