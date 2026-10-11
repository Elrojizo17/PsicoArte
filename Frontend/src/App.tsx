import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/AppLayout'
import { AcudientesPage } from './pages/AcudientesPage'
import { AlumnosPage } from './pages/AlumnosPage'
import { ClasesPage } from './pages/ClasesPage'
import { ParentAttendancePage, ParentChildrenPage, ParentPaymentsPage } from './pages/ParentPortalPages'
import { ParentCalendarViewPage } from './pages/ParentCalendarViewPage'
import { ParentLayout } from './components/ParentLayout'
import { AgendaCitasPage } from './pages/AgendaCitasPage'
import { CertificadosPage } from './pages/CertificadosPage'
import { PagosPage } from './pages/PagosPage'
import { MensajeriaPage } from './pages/MensajeriaPage'
import { AutomatizacionPage } from './pages/AutomatizacionPage'
import { PlantillasClasesPage } from './pages/PlantillasClasesPage'
import { DeviceSessionsPage } from './pages/DeviceSessionsPage'

function LoadingScreen({ message = 'Cargando tu sesión…' }: { message?: string }) {
  return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-primary-dark"><p role="status" className="font-semibold">{message}</p></main>
}

function SessionState({ children }: { children: ReactNode }) {
  const { loading, error, refreshProfile } = useAuth()
  if (loading) return <LoadingScreen />
  if (error) return <main className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><p role="alert" className="text-primary-dark">{error}</p><button className="mt-4 rounded-xl bg-primary-dark px-4 py-3 font-semibold text-white" onClick={() => { void refreshProfile().catch(() => undefined) }}>Reintentar</button></div></main>
  return <>{children}</>
}

function ProtectedRoute() {
  return localStorage.getItem('token') ? <Outlet /> : <Navigate to="/login" replace />
}

function RoleRoute({ role }: { role: 'parent' | 'staff' }) {
  const { profile } = useAuth()
  if (!localStorage.getItem('token') || !profile) return <Navigate to="/login" replace />
  const isParent = profile.tipo === 'acudiente'
  if (role === 'parent' && !isParent) return <Navigate to="/clases" replace />
  if (role === 'staff' && isParent) return <Navigate to="/perfil-padre" replace />
  return <Outlet />
}

function HomeRoute() {
  const { profile } = useAuth()
  return <Navigate to={profile?.tipo === 'acudiente' ? '/perfil-padre' : '/clases'} replace />
}

function App() {
  return <AuthProvider><BrowserRouter><SessionState><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<HomeRoute />} />
      <Route element={<RoleRoute role="parent" />}>
        <Route element={<ParentLayout />}>
          <Route path="/perfil-padre" element={<ParentChildrenPage />} />
          <Route path="/perfil-padre/dispositivos" element={<DeviceSessionsPage />} />
          <Route path="/perfil-padre/calendario" element={<ParentCalendarViewPage />} />
          <Route path="/perfil-padre/asistencias" element={<ParentAttendancePage />} />
          <Route path="/perfil-padre/pagos" element={<ParentPaymentsPage />} />
          <Route path="/perfil-padre/mensajeria" element={<MensajeriaPage />} />
        </Route>
      </Route>
      <Route element={<RoleRoute role="staff" />}><Route element={<AppLayout />}>
        <Route path="/dispositivos" element={<DeviceSessionsPage />} />
        <Route path="/acudientes" element={<AcudientesPage />} />
        <Route path="/alumnos" element={<AlumnosPage />} />
        <Route path="/clases" element={<ClasesPage />} />
        <Route path="/plantillas-clases" element={<PlantillasClasesPage />} />
        <Route path="/pagos" element={<PagosPage />} />
        <Route path="/mensajeria" element={<MensajeriaPage />} />
        <Route path="/automatizacion" element={<AutomatizacionPage />} />
        <Route path="/agenda-citas" element={<AgendaCitasPage />} />
        <Route path="/certificados" element={<CertificadosPage />} />
      </Route></Route>
    </Route>
  </Routes></SessionState></BrowserRouter></AuthProvider>
}

export default App
