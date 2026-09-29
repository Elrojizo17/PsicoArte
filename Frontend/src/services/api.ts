import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
})

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
    window.location.assign('/login')
  }
  return Promise.reject(error)
})

export const endpoints = {
  acudientes: '/acudientes/',
  alumnos: '/alumnos/',
  jornadas: '/jornadas/',
  clases: '/clases/',
  pagos: '/pagos/',
  asistencias: '/asistencias/',
  conversaciones: '/mensajeria/conversaciones/',
  mensajes: '/mensajeria/mensajes/',
  plantillas: '/automatizacion/plantillas/',
  avisoPagos: '/automatizacion/aviso-pagos/',
}
