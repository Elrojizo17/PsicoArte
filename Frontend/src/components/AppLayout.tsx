import { CalendarClock, CalendarDays, ClipboardList, CreditCard, FileBadge, HeartHandshake, LogOut, Menu, Smartphone, UsersRound, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MessageNotifications } from './MessageNotifications'
import { logoutCurrentSession } from '../services/push'

const baseNavigation = [
  { to: '/acudientes', label: 'Gestionar Acudientes', icon: HeartHandshake },
  { to: '/alumnos', label: 'Gestionar Alumnos', icon: UsersRound },
  { to: '/clases', label: 'Programar Clases', icon: CalendarDays },
  { to: '/plantillas-clases', label: 'Plantillas de clases', icon: ClipboardList },
  { to: '/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/automatizacion', label: 'Automatización de mensajes', icon: Settings2 },
  { to: '/dispositivos', label: 'Mis dispositivos', icon: Smartphone },
]

export function AppLayout() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigation = localStorage.getItem('grupo') === 'Psicologia'
    ? [...baseNavigation,
      { to: '/agenda-citas', label: 'Agenda de citas', icon: CalendarClock },
      { to: '/certificados', label: 'Certificados', icon: FileBadge },
    ]
    : baseNavigation

  async function handleLogout() {
    await logoutCurrentSession()
    localStorage.removeItem('token')
    localStorage.removeItem('session_id')
    localStorage.removeItem('tipo')
    localStorage.removeItem('grupo')
    navigate('/login', { replace: true })
  }

  return <div className="min-h-screen bg-background text-ink lg:flex lg:h-screen lg:overflow-hidden">
    <aside className="w-full border-b border-border bg-white px-5 py-5 lg:h-screen lg:w-[275px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-6">
      <div className="flex items-center justify-between lg:block">
        <div className="flex h-32 items-center lg:h-56">
          <img src="/logo.png" alt="PsicoArte" className="h-32 w-32 object-contain object-left lg:h-52 lg:w-52" />
        </div>
        <div className="flex gap-2 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(current => !current)} aria-expanded={menuOpen} aria-controls="personal-navigation" className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark">
            {menuOpen ? <X size={18} strokeWidth={2.4} /> : <Menu size={18} strokeWidth={2.4} />}
            <span>Módulos</span>
          </button>
          <button type="button" onClick={handleLogout} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-[#d8dfd5] bg-white px-4 py-3 text-sm font-bold text-[#526454] shadow-sm transition hover:bg-[#f3f6f0]">
            <LogOut size={18} strokeWidth={2.4} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
      <nav id="personal-navigation" className={`${menuOpen ? 'grid' : 'hidden'} mt-6 grid-cols-2 gap-3 lg:mt-12 lg:grid lg:grid-cols-1 lg:gap-4`}>
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `group flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark lg:justify-start lg:px-4 ${isActive ? 'bg-primary-dark text-white' : 'bg-primary text-white'}`}><Icon size={18} strokeWidth={2.4} /><span>{label}</span></NavLink>)}
      <MessageNotifications to="/mensajeria" label={'Mensajer\u00eda'} onNavigate={() => setMenuOpen(false)} />
      </nav>
      <button type="button" onClick={handleLogout} className="mt-4 hidden min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d8dfd5] bg-white px-4 py-3 text-sm font-bold text-[#526454] shadow-sm transition hover:bg-[#f3f6f0] lg:mt-8 lg:flex">
        <LogOut size={18} strokeWidth={2.4} />
        <span>Cerrar sesión</span>
      </button>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:p-8"><Outlet /></main>
  </div>
}
