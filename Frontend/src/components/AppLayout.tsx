import { CalendarDays, HeartHandshake, LayoutGrid, UsersRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
  { to: '/acudientes', label: 'Gestionar Acudientes', icon: HeartHandshake },
  { to: '/alumnos', label: 'Gestionar Alumnos', icon: UsersRound },
  { to: '/jornada', label: 'Gestionar Jornada', icon: LayoutGrid },
  { to: '/clases', label: 'Programar Clases', icon: CalendarDays },
]

export function AppLayout() {
  return <div className="min-h-screen bg-background text-ink lg:flex">
    <aside className="w-full border-b border-border bg-white px-5 py-5 lg:min-h-screen lg:w-[275px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-6">
      <div className="flex flex-col items-center lg:block">
        <div className="flex h-32 items-center lg:h-56">
          <img src="/logo.png" alt="PsicoArte" className="h-32 w-32 object-contain object-left lg:h-52 lg:w-52" />
        </div>
      </div>
      <nav className="mt-6 grid grid-cols-2 gap-3 lg:mt-12 lg:grid-cols-1 lg:gap-4">
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `group flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark lg:justify-start lg:px-4 ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}><Icon size={18} strokeWidth={2.4} /><span>{label}</span></NavLink>)}
      </nav>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
  </div>
}
