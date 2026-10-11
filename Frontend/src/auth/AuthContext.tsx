import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import axios from 'axios'
import { api, getApiErrorMessage } from '../services/api'
import { clearStoredSession } from '../services/sessionStorage'

export type UserProfile = {
  tipo: 'empresa' | 'acudiente'
  grupo: 'Psicologia' | 'Musical' | null
  nombre: string
}

type AuthContextValue = {
  profile: UserProfile | null
  loading: boolean
  error: string
  setProfile: (profile: UserProfile | null) => void
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')))
  const [error, setError] = useState('')

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setProfile(null)
      return null
    }
    const { data } = await api.get<UserProfile>('/me/')
    if (localStorage.getItem('token') !== token) return null
    if ((data.tipo !== 'empresa' && data.tipo !== 'acudiente')
      || (data.grupo !== null && data.grupo !== 'Psicologia' && data.grupo !== 'Musical')
      || typeof data.nombre !== 'string'
      || (data.tipo === 'empresa' && data.grupo === null)
      || (data.tipo === 'acudiente' && data.grupo !== null)) {
      throw new Error('El servidor devolvió un perfil no válido.')
    }
    localStorage.setItem('tipo', data.tipo)
    if (data.grupo) localStorage.setItem('grupo', data.grupo)
    else localStorage.removeItem('grupo')
    localStorage.setItem('nombre', data.nombre)
    setProfile(data)
    setError('')
    return data
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void refreshProfile().catch((reason: unknown) => {
      if (!active) return
      if (axios.isAxiosError(reason) && reason.response?.status === 401) {
        const loginNotice = sessionStorage.getItem('loginNotice') || getApiErrorMessage(reason)
        clearStoredSession()
        sessionStorage.setItem('loginNotice', loginNotice)
        setProfile(null)
      } else {
        setError('No se pudo validar la sesión. Revisa tu conexión e inténtalo de nuevo.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refreshProfile])

  return <AuthContext.Provider value={{ profile, loading, error, setProfile, refreshProfile }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
