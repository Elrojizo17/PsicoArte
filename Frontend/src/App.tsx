import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
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

function ProtectedRoute() {
  const location = useLocation()

  return localStorage.getItem('token')
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location }} />
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<ParentLayout />}>
        <Route path="/perfil-padre" element={<ParentChildrenPage />} />
        <Route path="/perfil-padre/calendario" element={<ParentCalendarViewPage />} />
        <Route path="/perfil-padre/asistencias" element={<ParentAttendancePage />} />
        <Route path="/perfil-padre/pagos" element={<ParentPaymentsPage />} />
        <Route path="/perfil-padre/mensajeria" element={<MensajeriaPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/clases" replace />} />
        <Route path="/acudientes" element={<AcudientesPage />} />
        <Route path="/alumnos" element={<AlumnosPage />} />
        <Route path="/clases" element={<ClasesPage />} />
        <Route path="/plantillas-clases" element={<PlantillasClasesPage />} />
        <Route path="/pagos" element={<PagosPage />} />
        <Route path="/mensajeria" element={<MensajeriaPage />} />
        <Route path="/automatizacion" element={<AutomatizacionPage />} />
        <Route path="/agenda-citas" element={<AgendaCitasPage />} />
        <Route path="/certificados" element={<CertificadosPage />} />
      </Route>
    </Route>
  </Routes></BrowserRouter>
}

export default App
