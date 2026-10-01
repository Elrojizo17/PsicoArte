import { CalendarDays, ClipboardCheck, CreditCard, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MessageNotifications } from './MessageNotifications'

const navigation = [
  { to: '/perfil-padre', label: 'Mis niños', icon: UserRound, end: true },
  { to: '/perfil-padre/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/perfil-padre/asistencias', label: 'Asistencias', icon: ClipboardCheck },
  { to: '/perfil-padre/pagos', label: 'Mis pagos', icon: CreditCard },
]

export function ParentLayout() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const name = localStorage.getItem('nombre') || 'Familia PsicoArte'

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('tipo')
    localStorage.removeItem('grupo')
    localStorage.removeItem('nombre')
    navigate('/login', { replace: true })
  }

  return <div className="min-h-screen bg-background text-ink lg:flex">
    <aside className="w-full border-b border-border bg-white px-5 py-5 lg:min-h-screen lg:w-[275px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-6">
      <div className="flex items-center justify-between lg:block">
        <div className="flex h-28 items-center lg:h-48"><img src="/logo.png" alt="PsicoArte" className="h-28 w-28 object-contain object-left lg:h-44 lg:w-44" /></div>
        <div className="flex gap-2 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(current => !current)} aria-expanded={menuOpen} aria-controls="parent-navigation" className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-dark">
            {menuOpen ? <X size={17}/> : <Menu size={17}/>}<span>Módulos</span>
          </button>
          <button type="button" onClick={logout} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d8dfd5] bg-white px-4 py-3 text-sm font-bold text-[#526454] shadow-sm hover:bg-[#f3f6f0]"><LogOut size={17}/><span>Cerrar sesión</span></button>
        </div>
      </div>
      <div className="mb-5 hidden lg:block"><p className="text-xs font-bold uppercase tracking-widest text-primary">Portal familiar</p><p className="mt-1 truncate font-bold text-primary-dark">{name}</p></div>
      <nav id="parent-navigation" className={`${menuOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 lg:mt-8 lg:grid lg:grid-cols-1 lg:gap-3`}>{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:bg-primary-dark lg:justify-start lg:px-4 ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}><Icon size={18}/><span>{label}</span></NavLink>)}<MessageNotifications to="/perfil-padre/mensajeria" label="Mensajes" compact onNavigate={() => setMenuOpen(false)} />
      </nav>
      <button type="button" onClick={logout} className="mt-8 hidden min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#d8dfd5] bg-white px-4 py-3 text-sm font-bold text-[#526454] shadow-sm hover:bg-[#f3f6f0] lg:flex"><LogOut size={17}/><span>Cerrar sesión</span></button>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
  </div>
}
