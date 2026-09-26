import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/AppLayout'
import { AcudientesPage } from './pages/AcudientesPage'
import { AlumnosPage } from './pages/AlumnosPage'
import { ClasesPage } from './pages/ClasesPage'
import { JornadaPage } from './pages/JornadaPage'
import { PerfilPadre } from './pages/PerfilPadre'
import { AgendaCitasPage } from './pages/AgendaCitasPage'
import { CertificadosPage } from './pages/CertificadosPage'

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
      <Route path="/perfil-padre" element={<PerfilPadre />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/clases" replace />} />
        <Route path="/acudientes" element={<AcudientesPage />} />
        <Route path="/alumnos" element={<AlumnosPage />} />
        <Route path="/jornada" element={<JornadaPage />} />
        <Route path="/clases" element={<ClasesPage />} />
        <Route path="/agenda-citas" element={<AgendaCitasPage />} />
        <Route path="/certificados" element={<CertificadosPage />} />
      </Route>
    </Route>
  </Routes></BrowserRouter>
}

export default App
