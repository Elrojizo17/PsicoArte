import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState() { return <div className="flex items-center gap-2 rounded-xl border border-border bg-white p-6 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-primary"/>Cargando información...</div> }
export function ErrorState({ message }: { message: string }) { return <div className="flex items-center gap-2 rounded-xl border border-secondary/25 bg-secondary/5 p-4 text-sm text-secondary"><AlertCircle size={18}/>{message}</div> }
