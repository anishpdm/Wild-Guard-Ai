// src/context/BackendContext.jsx
// Polls /health every 10 seconds.
// If backend is down: shows full-screen offline error — NO mock data ever shown.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { healthAPI } from '@/api/client'

const Ctx = createContext({ online: null, checking: true })

export function BackendProvider({ children }) {
  const [online,   setOnline]   = useState(null)   // null=unknown, true=up, false=down
  const [checking, setChecking] = useState(true)
  const [info,     setInfo]     = useState(null)

  const check = useCallback(async () => {
    try {
      const { data } = await healthAPI.check()
      setOnline(true)
      setInfo(data)
    } catch {
      setOnline(false)
      setInfo(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [check])

  return (
    <Ctx.Provider value={{ online, checking, info, retry: check }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBackend = () => useContext(Ctx)
