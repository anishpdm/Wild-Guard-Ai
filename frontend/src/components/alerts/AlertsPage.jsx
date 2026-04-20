// AlertsPage.jsx — WildGuard AI v5 — Real alerts + SMS Dispatch Panel
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('wg_access_token')}` })

function toIST(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone:'Asia/Kolkata', day:'2-digit', month:'short',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }) + ' IST'
  } catch { return ts }
}

const LEVEL_STYLE = {
  critical: { bg:'#fef2f2', border:'#fca5a5', dot:'#ef4444', text:'#dc2626', badge:'#fee2e2' },
  warning:  { bg:'#fffbeb', border:'#fde68a', dot:'#f59e0b', text:'#d97706', badge:'#fef9c3' },
  info:     { bg:'#f0fdf4', border:'#bbf7d0', dot:'#22c55e', text:'#15803d', badge:'#dcfce7' },
}

// ── SMS Dispatch Panel ─────────────────────────────────────────────
function SMSDispatchPanel() {
  const { data: _dispatchRaw, isLoading } = useQuery({
    queryKey: ['dispatch','alerts'],
    queryFn:  () => fetch('/api/dispatch/alerts', {headers:authH()}).then(r=>r.json()),
    refetchInterval: 15000,
  })
  const dispatches = Array.isArray(_dispatchRaw) ? _dispatchRaw : (_dispatchRaw ? Object.values(_dispatchRaw) : [])
  const [sent, setSent] = useState({})
  const [preview, setPreview] = useState(null)

  const levelCol = {CRITICAL:'#ef4444', WARNING:'#f59e0b', INFO:'#16a34a'}

  if (isLoading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
      <div style={{width:28,height:28,border:'3px solid #22c55e',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{padding:'10px 16px',borderRadius:10,background:'linear-gradient(135deg,#1a4d2e,#166534)',
        marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:28}}>📱</span>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:'#ffffff',fontFamily:'Syne,sans-serif'}}>
            SMS / WhatsApp Farmer Dispatch
          </div>
          <div style={{fontSize:10,color:'#86efac',fontFamily:'DM Mono,monospace'}}>
            {dispatches.length} farmers within 5km of elephant locations · Auto-generated alerts
          </div>
        </div>
        <div style={{marginLeft:'auto',padding:'3px 10px',borderRadius:8,
          background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',
          fontSize:11,color:'#dcfce7',fontFamily:'DM Mono,monospace',fontWeight:700}}>
          {dispatches.filter(d=>d.level==='CRITICAL').length} CRITICAL
        </div>
      </div>

      {dispatches.length === 0 && (
        <div style={{textAlign:'center',padding:40,color:'#9ec4aa',fontSize:12,fontFamily:'DM Mono,monospace'}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          No farmers within alert range currently — all elephants are far from settlements
        </div>
      )}

      {dispatches.map((d,i) => {
        const col = levelCol[d.level] || '#16a34a'
        const isSent = sent[`${d.farmer.id}_${d.elephant_id}`]
        return (
          <div key={i} style={{borderRadius:12,border:`1px solid ${col}33`,
            background:d.level==='CRITICAL'?'#fef2f2':d.level==='WARNING'?'#fffbeb':'#f0fdf4',
            padding:14,marginBottom:10}}>
            
            {/* Farmer info row */}
            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${col}22`,
                border:`1px solid ${col}44`,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:20,flexShrink:0}}>👨‍🌾</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:'#0f2318'}}>{d.farmer.name}</div>
                <div style={{fontSize:10,color:'#6b7280',fontFamily:'DM Mono,monospace'}}>
                  📞 {d.farmer.phone} · 📍 {d.farmer.village}
                </div>
                <div style={{fontSize:10,color:'#6b7280',fontFamily:'DM Mono,monospace'}}>
                  🌾 {d.farmer.crops.join(', ')} · {d.farmer.area_ha} ha farm
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{padding:'2px 10px',borderRadius:6,background:`${col}22`,
                  border:`1px solid ${col}44`,color:col,fontSize:10,
                  fontFamily:'DM Mono,monospace',fontWeight:700,marginBottom:4}}>
                  {d.level}
                </div>
                <div style={{fontSize:10,color:col,fontFamily:'DM Mono,monospace',fontWeight:700}}>
                  {d.distance_km}km away
                </div>
              </div>
            </div>

            {/* Elephant + ETA info */}
            <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
              {[
                ['🐘 Elephant', d.elephant_name],
                ['⏱ ETA', `~${d.eta_minutes} min`],
                ['⚠ Risk', `${Math.round(d.risk_score*100)}%`],
              ].map(([k,v]) => (
                <div key={k} style={{padding:'4px 10px',borderRadius:7,
                  background:'rgba(255,255,255,.7)',border:'1px solid #e2e8f0',fontSize:11}}>
                  <span style={{color:'#6b7280',fontFamily:'DM Mono,monospace'}}>{k}: </span>
                  <span style={{fontWeight:700,color:'#0f2318'}}>{v}</span>
                </div>
              ))}
            </div>

            {/* Message preview */}
            <div style={{padding:'8px 12px',borderRadius:8,
              background:'rgba(255,255,255,.8)',border:'1px solid #d1fae5',
              marginBottom:10,fontSize:11,color:'#0f2318',lineHeight:1.5,
              fontFamily:'system-ui,sans-serif'}}>
              {d.sms_message}
            </div>

            {/* Action buttons */}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPreview(d)}
                style={{flex:1,padding:'7px 12px',borderRadius:8,fontSize:11,cursor:'pointer',
                  border:'1px solid #d1fae5',background:'#f0fdf4',color:'#15803d',fontWeight:600}}>
                👁 Preview
              </button>
              <button onClick={()=>{
                window.open(d.whatsapp_url,'_blank')
                setSent(s=>({...s,[`${d.farmer.id}_${d.elephant_id}`]:true}))
              }} style={{flex:1,padding:'7px 12px',borderRadius:8,fontSize:11,cursor:'pointer',
                border:`1px solid ${isSent?'#86efac':'#25d366'}`,
                background:isSent?'#dcfce7':'#25d366',
                color:isSent?'#15803d':'#ffffff',fontWeight:700}}>
                {isSent?'✅ Sent':'💬 WhatsApp'}
              </button>
              <button onClick={()=>{
                navigator.clipboard?.writeText(d.sms_message)
                setSent(s=>({...s,[`${d.farmer.id}_${d.elephant_id}`]:true}))
              }} style={{flex:1,padding:'7px 12px',borderRadius:8,fontSize:11,cursor:'pointer',
                border:'1px solid #93c5fd',background:'#eff6ff',
                color:'#2563eb',fontWeight:600}}>
                📋 Copy SMS
              </button>
            </div>
          </div>
        )
      })}

      {/* Preview modal */}
      {preview && (
        <div onClick={()=>setPreview(null)} style={{position:'fixed',inset:0,
          background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:9999,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#ffffff',borderRadius:16,
            padding:24,maxWidth:400,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4,color:'#0f2318'}}>📱 Message Preview</div>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:16,fontFamily:'DM Mono,monospace'}}>
              To: {preview.farmer.name} · {preview.farmer.phone}
            </div>
            <div style={{padding:14,borderRadius:10,background:'#dcfce7',border:'1px solid #86efac',
              fontSize:13,lineHeight:1.6,color:'#0f2318',marginBottom:16}}>
              {preview.sms_message}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button onClick={()=>{window.open(preview.whatsapp_url,'_blank');setPreview(null)}}
                style={{padding:10,borderRadius:8,background:'#25d366',color:'#fff',
                  border:'none',fontWeight:700,cursor:'pointer',fontSize:12}}>
                💬 Send WhatsApp
              </button>
              <button onClick={()=>setPreview(null)}
                style={{padding:10,borderRadius:8,background:'#f3f4f6',color:'#374151',
                  border:'none',cursor:'pointer',fontSize:12}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alert Row ──────────────────────────────────────────────────────
function AlertRow({ alert, onAck, onDel }) {
  const s = LEVEL_STYLE[alert.level] || LEVEL_STYLE.info
  return (
    <div style={{borderRadius:12,border:`1px solid ${s.border}`,background:s.bg,
      padding:'12px 14px',marginBottom:8,display:'flex',alignItems:'flex-start',gap:10}}>
      <span style={{width:10,height:10,borderRadius:'50%',background:s.dot,flexShrink:0,
        marginTop:4,boxShadow:`0 0 6px ${s.dot}66`}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
          <span style={{padding:'1px 8px',borderRadius:5,fontSize:9,fontWeight:700,
            fontFamily:'DM Mono,monospace',background:s.badge,color:s.text,border:`1px solid ${s.border}`}}>
            {(alert.level||'info').toUpperCase()}
          </span>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#6b7280'}}>
            {alert.camera_id}
          </span>
          <span style={{marginLeft:'auto',fontSize:9,fontFamily:'DM Mono,monospace',color:'#9ca3af'}}>
            {toIST(alert.timestamp||alert.created_at)}
          </span>
        </div>
        <div style={{fontSize:12,color:'#0f2318',marginBottom:4,lineHeight:1.4}}>{alert.message}</div>
        {alert.location && (
          <div style={{fontSize:10,color:'#9ca3af',fontFamily:'DM Mono,monospace'}}>
            📍 {alert.location}
          </div>
        )}
      </div>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        {!alert.acknowledged && (
          <button onClick={()=>onAck(alert.id)}
            style={{padding:'3px 10px',borderRadius:6,fontSize:10,cursor:'pointer',
              border:'1px solid #bbf7d0',background:'#f0fdf4',color:'#15803d',fontWeight:600}}>
            ✓ Ack
          </button>
        )}
        <button onClick={()=>onDel(alert.id)}
          style={{padding:'3px 8px',borderRadius:6,fontSize:10,cursor:'pointer',
            border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280'}}>
          ×
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AlertsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [tab, setTab]       = useState('alerts')

  const { data:alerts=[] } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => {
      const params = new URLSearchParams({limit:'100'})
      if (filter==='unread')    params.set('acknowledged','false')
      if (filter==='critical')  params.set('level','critical')
      return fetch(`/api/alerts?${params}`,{headers:authH()}).then(r=>r.json())
    },
    refetchInterval: 8000,
  })

  const ackMut = useMutation({
    mutationFn: id => fetch(`/api/alerts/${id}/acknowledge`,{method:'POST',headers:authH()}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:['alerts']}),
  })
  const delMut = useMutation({
    mutationFn: id => fetch(`/api/alerts/${id}`,{method:'DELETE',headers:authH()}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:['alerts']}),
  })

  const unread   = alerts.filter(a=>!a.acknowledged).length
  const critical = alerts.filter(a=>a.level==='critical').length

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#f0fdf4'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
        borderBottom:'1px solid #d1fae5',background:'#ffffff',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
        <div style={{width:36,height:36,borderRadius:10,
          background:'linear-gradient(135deg,#16a34a,#22c55e)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
          boxShadow:'0 2px 8px rgba(22,163,74,.3)'}}>🔔</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:'#0f2318',fontFamily:'Syne,sans-serif'}}>
            Alert Centre + SMS Dispatch
          </div>
          <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
            Real-time HEC incident log · Farmer notification panel
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          {[['all','All'],['unread',`Unread (${unread})`],['critical',`Critical (${critical})`]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{
              padding:'3px 10px',borderRadius:8,fontSize:10,cursor:'pointer',
              fontFamily:'DM Mono,monospace',fontWeight:600,
              border:`1px solid ${filter===k?'#22c55e':'#d1fae5'}`,
              background:filter===k?'#dcfce7':'#ffffff',
              color:filter===k?'#15803d':'#3d7a52',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{flexShrink:0,display:'flex',gap:4,padding:'6px 12px',
        borderBottom:'1px solid #d1fae5',background:'#f9fefb'}}>
        {[{k:'alerts',l:'🔔 Live Alerts'},{k:'sms',l:'📱 SMS Dispatch'}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'5px 14px',borderRadius:8,fontSize:12,cursor:'pointer',
            fontFamily:'DM Mono,monospace',fontWeight:600,
            border:`1px solid ${tab===k?'#22c55e':'#d1fae5'}`,
            background:tab===k?'#dcfce7':'#ffffff',
            color:tab===k?'#15803d':'#3d7a52',
          }}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:12}}>
        {tab==='alerts'&&(
          alerts.length===0
            ? <div style={{textAlign:'center',padding:48,color:'#9ec4aa',fontSize:12,fontFamily:'DM Mono,monospace'}}>
                <div style={{fontSize:40,marginBottom:10}}>✅</div>
                No alerts — all elephants safely in forest core
              </div>
            : alerts.map(a=>(
                <AlertRow key={a.id} alert={a}
                  onAck={id=>ackMut.mutate(id)}
                  onDel={id=>delMut.mutate(id)}/>
              ))
        )}
        {tab==='sms'&&<SMSDispatchPanel/>}
      </div>
    </div>
  )
}