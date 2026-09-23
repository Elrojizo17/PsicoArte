import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageHeader({ title, description, action, actionLabel = 'Nuevo registro' }: { eyebrow?: string; title: string; description: ReactNode; action?: () => void; actionLabel?: string }) {
  return <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-primary-dark sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p></div>{action && <button onClick={action} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark"><Plus size={18}/>{actionLabel}</button>}</header>
}
