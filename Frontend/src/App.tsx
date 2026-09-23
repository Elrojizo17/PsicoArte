import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AcudientesPage } from './pages/AcudientesPage'
import { AlumnosPage } from './pages/AlumnosPage'
import { ClasesPage } from './pages/ClasesPage'
import { JornadaPage } from './pages/JornadaPage'

function App() {
  return <BrowserRouter><Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Navigate to="/clases" replace />} />
      <Route path="/acudientes" element={<AcudientesPage />} />
      <Route path="/alumnos" element={<AlumnosPage />} />
      <Route path="/jornada" element={<JornadaPage />} />
      <Route path="/clases" element={<ClasesPage />} />
    </Route>
  </Routes></BrowserRouter>
}

export default App
