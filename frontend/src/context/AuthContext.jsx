// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '@/api/client'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)   // checking existing token on mount

  // On mount: verify existing token
  useEffect(() => {
    const token = localStorage.getItem('wg_access_token')
    if (!token) { setLoading(false); return }
    authAPI.me()
      .then(r => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('wg_access_token')
        localStorage.removeItem('wg_refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await authAPI.login(username, password)
    localStorage.setItem('wg_access_token',  data.access_token)
    localStorage.setItem('wg_refresh_token', data.refresh_token)
    const me = await authAPI.me()
    setUser(me.data)
    return me.data
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('wg_access_token')
    localStorage.removeItem('wg_refresh_token')
    setUser(null)
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
