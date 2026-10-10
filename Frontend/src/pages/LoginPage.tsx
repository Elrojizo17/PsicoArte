import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, getApiErrorMessage } from '../services/api'
import './LoginPage.css'

type LoginResponse = {
  token: string
  tipo: 'empresa' | 'acudiente'
  nombre: string
  grupo?: 'Psicologia' | 'Musical'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice] = useState(() => {
    const loginNotice = sessionStorage.getItem('loginNotice')
    sessionStorage.removeItem('loginNotice')
    return loginNotice || (
      window.matchMedia('(display-mode: standalone)').matches
        ? 'Inicia sesión para usar la app instalada'
        : ''
    )
  })

  if (localStorage.getItem('token')) {
    return <Navigate to={localStorage.getItem('tipo') === 'acudiente' ? '/perfil-padre' : '/clases'} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/login/', { username, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('tipo', data.tipo)
      if (data.grupo) localStorage.setItem('grupo', data.grupo)
      else localStorage.removeItem('grupo')
      navigate(data.tipo === 'acudiente' ? '/perfil-padre' : '/clases', { replace: true })
    } catch (reason) {
      setError(axios.isAxiosError(reason) && reason.response?.status === 401
        ? 'Usuario o contraseña incorrectos.'
        : getApiErrorMessage(reason, 'No se pudo iniciar sesión. Inténtalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-split-page">
      {/* Panel lateral de color (Oculto en móviles) */}
      <section className="login-banner">
        <div className="banner-content">
          {/* Logo para versión de escritorio */}
          <img className="login-logo-desktop" src="/logo.png" alt="Psicoarte" />
          
          <h1 className="banner-title">¡Hola,<br/>Bienvenido a Psicoarte!</h1>
          <p className="banner-text">
          </p>
        </div>
        <div className="banner-footer">
          © 2026 Psicoarte. Todos los derechos reservados.
        </div>
      </section>

      {/* Panel del formulario */}
      <section className="login-content" aria-labelledby="login-title">
        <div className="login-form-wrapper">
          {/* Logo para versión móvil (Oculto en escritorio) */}
          <img className="login-logo-mobile" src="/logo.png" alt="Psicoarte" />
          
          <div className="login-header">
            <h2 id="login-title">¡Bienvenido!</h2>
            <p className="login-intro">Ingresa tus datos para acceder a tu cuenta.</p>
            {notice && <p className="login-intro" role="status">{notice}</p>}
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">USUARIO</label>
              <input 
                id="username" 
                name="username" 
                autoComplete="username" 
                value={username}
                onChange={(event) => setUsername(event.target.value)} 
                placeholder="ejemplo@correo.com"
                required 
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">CONTRASEÑA</label>
              <div className="password-wrapper">
                <input 
                  id="password" 
                  name="password" 
                  type={showPassword ? "text" : "password"} 
                  autoComplete="current-password"
                  value={password} 
                  onChange={(event) => setPassword(event.target.value)} 
                  placeholder="Tu contraseña"
                  required 
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>{error}</span>
              </div>
            )}

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? <span className="loader"></span> : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
