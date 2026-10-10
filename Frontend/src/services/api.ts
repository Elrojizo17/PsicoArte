import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
})

export function getApiErrorMessage(
  error: unknown,
  fallback = 'No se pudo completar la solicitud. Inténtalo de nuevo.',
) {
  if (!axios.isAxiosError(error)) return fallback
  if (!error.response) return 'No se pudo conectar con el servidor. Revisa tu internet'

  if (error.response.status === 401) return 'Tu sesión se cerró, inicia sesión de nuevo'
  if (error.response.status === 403) return 'No tienes permiso para esta acción'
  if (error.response.status >= 500) return 'El servidor tuvo un problema, intenta de nuevo'
  return fallback
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Token ${token}`
  return config
})

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && localStorage.getItem('token')) {
    localStorage.removeItem('token')
    localStorage.removeItem('tipo')
    localStorage.removeItem('grupo')
    sessionStorage.setItem('loginNotice', getApiErrorMessage(error))
    window.location.assign('/login')
  }
  return Promise.reject(error)
})

export const endpoints = {
  acudientes: '/acudientes/',
  alumnos: '/alumnos/',
  jornadas: '/jornadas/',
  clases: '/clases/',
  plantillasClases: '/plantillas-clase/',
  pagos: '/pagos/',
  asistencias: '/asistencias/',
  conversaciones: '/mensajeria/conversaciones/',
  mensajes: '/mensajeria/mensajes/',
  plantillas: '/automatizacion/plantillas/',
  avisoPagos: '/automatizacion/aviso-pagos/',
}
