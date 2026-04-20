// src/context/WSContext.jsx — v5
import { createContext, useContext, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const Ctx = createContext(null)

export function WSProvider({ children }) {
  const qc  = useQueryClient()
  const wsRef   = useRef(null)
  const retryRef= useRef(null)

  function connect() {
    const token = localStorage.getItem('wg_access_token')
    if (!token) return
    const ws = new WebSocket(`/ws/live?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => console.log('[WS] connected')

    ws.onmessage = (evt) => {
      try {
        const { type, payload } = JSON.parse(evt.data)
        if (type === 'ping') return

        if (type === 'gps_fix') {
          const eid = payload.individual_id
          // Update herd
          qc.setQueryData(['gps','herd'], old => {
            if (!old) return [payload]
            const exists = old.find(f=>f.individual_id===eid)
            if (exists) return old.map(f=>f.individual_id===eid?{...f,...payload}:f)
            return [...old, payload]
          })
          qc.setQueryData(['gps','latest',eid], payload)
          qc.setQueryData(['gps','track',eid], old => {
            if (!old) return [payload]
            return [...old.slice(-99), payload]
          })
        }

        if (type === 'herd_update' && Array.isArray(payload)) {
          qc.setQueryData(['gps','herd'], payload)
        }

        if (type === 'risk_update') {
          qc.setQueryData(['prediction','current',payload.individual_id], old => old ? {...old,...payload} : payload)
        }

        if (type === 'stress_update') {
          const eid = payload.individual_id
          qc.setQueryData(['stress','all'], old => old ? {...old,[eid]:{...old[eid],...payload}} : {[eid]:payload})
          qc.setQueryData(['stress','id',eid], old => old ? {...old,...payload} : payload)
        }

        if (type === 'alert') {
          qc.setQueryData(['alerts',{}], old => old ? [payload,...old] : [payload])
          const icon = payload.level==='critical' ? '🚨' : '⚠️'
          toast(icon+' '+payload.message.slice(0,80), {
            style:{ background:payload.level==='critical'?'#1a0505':'#1a1205',
                    color:payload.level==='critical'?'#fca5a5':'#fbbf24',
                    border:`1px solid ${payload.level==='critical'?'#dc2626':'#d97706'}`, fontSize:12 },
            duration:6000,
          })
        }

        if (type === 'alert_update') {
          qc.setQueryData(['alerts',{}], old =>
            old ? old.map(a=>a.id===payload.id?payload:a) : [payload])
        }

        if (type === 'sensor') {
          qc.setQueryData(['sensors'], old =>
            old ? old.map(s=>s.node_id===payload.node_id?payload:s) : [payload])
        }

      } catch(e) { console.warn('[WS] parse error',e) }
    }

    ws.onclose = () => {
      console.log('[WS] closed — retry in 5s')
      retryRef.current = setTimeout(connect, 5000)
    }
    ws.onerror = () => ws.close()
  }

  useEffect(() => {
    connect()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  return <Ctx.Provider value={wsRef}>{children}</Ctx.Provider>
}

export const useWS = () => useContext(Ctx)
