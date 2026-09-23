import { CalendarDays, HeartHandshake, LayoutGrid, Music2, UsersRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
  { to: '/acudientes', label: 'Gestionar Acudientes', icon: HeartHandshake },
  { to: '/alumnos', label: 'Gestionar Alumnos', icon: UsersRound },
  { to: '/jornada', label: 'Gestionar Jornada', icon: LayoutGrid },
  { to: '/clases', label: 'Programar Clases', icon: CalendarDays },
]

export function AppLayout() {
  return <div className="min-h-screen bg-[#d9edfc] text-slate-800 lg:flex">
    <aside className="w-full border-b-2 border-primary-dark bg-background px-5 py-6 lg:min-h-screen lg:w-[275px] lg:shrink-0 lg:border-b-0 lg:border-r-2 lg:px-6">
      <div className="flex items-center gap-3 lg:block">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#7ddb55] shadow-[inset_0_0_0_8px_rgba(125,219,85,.28)] lg:mx-auto lg:h-44 lg:w-44 lg:rounded-full">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-black lg:h-36 lg:w-36"><span className="text-center text-lg font-bold tracking-tight text-black lg:text-3xl">PsicoArte</span></div>
        </div>
        <div className="lg:mt-10"><p className="text-xs font-bold uppercase tracking-[.22em] text-primary-dark">Escuela cognitiva</p><p className="mt-1 text-sm text-slate-500">Agenda y comunidad</p></div>
      </div>
      <nav className="mt-6 grid grid-cols-2 gap-3 lg:mt-12 lg:grid-cols-1 lg:gap-4">
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `group flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark lg:justify-start lg:px-4 ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}><Icon size={18} strokeWidth={2.4} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="mt-8 hidden rounded-2xl border border-primary-light/70 bg-white/55 p-4 lg:block"><Music2 className="text-primary-dark" size={20}/><p className="mt-3 text-sm font-semibold text-primary-dark">Un espacio para aprender, crear y acompañar.</p></div>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
  </div>
}
