import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState() { return <div className="flex items-center gap-2 rounded-xl border border-primary-light/50 bg-white/60 p-6 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-primary"/>Cargando información...</div> }
export function ErrorState({ message }: { message: string }) { return <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18}/>{message}</div> }
