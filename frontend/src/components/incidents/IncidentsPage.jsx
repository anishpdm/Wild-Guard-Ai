// src/components/incidents/IncidentsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const token = () => localStorage.getItem('wg_access_token')
const apiFetch = (url) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
const apiPost  = (url, body) => fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, body:JSON.stringify(body) }).then(r=>r.json())

const SEVERITY_STYLE = {
  critical: { bg:'rgba(220,38,38,0.08)', border:'rgba(220,38,38,0.25)', color:'#fca5a5' },
  high:     { bg:'rgba(220,38,38,0.06)', border:'rgba(220,38,38,0.2)',  color:'#fca5a5' },
  medium:   { bg:'rgba(217,119,6,0.07)', border:'rgba(217,119,6,0.2)',  color:'#fbbf24' },
  low:      { bg:'rgba(34,197,94,0.06)', border:'rgba(34,197,94,0.15)', color:'#16a34a' },
}

const TYPE_ICON = {
  crop_raid:'🌾', property_damage:'🏠', human_injury:'🚑',
  elephant_injury:'🏥', retaliatory_attack:'⚡', crop_raid_risk:'⚠️',
}

const DRIVER_COLORS = {
  water_stress:'#60a5fa', forage_stress:'#4ade80', crop_attraction:'#fbbf24',
  social_stress:'#c084fc', human_disturbance:'#fb923c', corridor_pressure:'#f87171', health_anomaly:'#34d399',
}

function StatBox({ label, value, sub, col='#4ade80' }) {
  return (
    <div className="rounded-xl border border-green-200 p-4 text-center" style={{ background:'#ffffff' }}>
      <div className="text-2xl font-bold mb-1" style={{ color:col, fontFamily:'Syne,sans-serif' }}>{value}</div>
      <div className="text-xs font-mono text-green-700/70">{label}</div>
      {sub && <div className="text-[10px] font-mono text-green-600/60 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function IncidentsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ incident_type:'crop_raid', severity:'medium', village:'', individual_id:'', crop_loss_inr:0, description:'', reported_by:'forest_officer', primary_driver:'crop_attraction' })

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => apiFetch('/api/incidents?limit=100'),
    refetchInterval: 30000,
  })
  const { data: stats } = useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: () => apiFetch('/api/incidents/stats'),
    refetchInterval: 60000,
  })

  const { mutate: addIncident } = useMutation({
    mutationFn: (body) => apiPost('/api/incidents', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['incidents'] }); setShowForm(false) },
  })
  const { mutate: verify } = useMutation({
    mutationFn: (id) => fetch(`/api/incidents/${id}/verify`, { method:'POST', headers:{ Authorization:`Bearer ${token()}` } }).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey:['incidents'] }),
  })

  const totals = stats?.totals || {}
  const drivers = (stats?.primary_drivers || []).map(d => ({
    name: d.primary_driver, value: d.cnt,
    color: DRIVER_COLORS[d.primary_driver] || '#888',
  }))

  const TOOLTIP_STYLE = {
    contentStyle:{ background:'#ffffff', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, fontSize:11, fontFamily:'DM Mono' },
    itemStyle:{ color:'#16a34a' },
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-green-200"
        style={{ background:'rgba(10,26,15,0.9)' }}>
        <span className="text-xl">📋</span>
        <div>
          <div className="font-bold text-sm text-white" style={{ fontFamily:'Syne,sans-serif' }}>HEC Incident Log</div>
          <div className="text-[10px] font-mono text-white">Human-Elephant Conflict — root cause analysis</div>
        </div>
        <div className="ml-auto">
          <button onClick={() => setShowForm(s => !s)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-green-950 border border-green-500/30 hover:bg-green-50 transition-colors">
            {showForm ? '✕ Cancel' : '+ Report Incident'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          <StatBox label="Total Incidents" value={totals.total || 0}/>
          <StatBox label="Crop Loss" value={`₹${Math.round((totals.total_crop_loss||0)/1000)}K`} col="#f59e0b"/>
          <StatBox label="Property Loss" value={`₹${Math.round((totals.total_prop_loss||0)/1000)}K`} col="#f59e0b"/>
          <StatBox label="Human Injuries" value={totals.injuries || 0} col="#ef4444"/>
          <StatBox label="Fatalities" value={totals.fatalities || 0} col="#ef4444" sub="human"/>
        </div>

        {/* Root cause pie */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-green-200 p-4 col-span-1" style={{ background:'#ffffff' }}>
            <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest mb-3">Root Cause Breakdown</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={drivers} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" nameKey="name" paddingAngle={2}>
                  {drivers.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v,n) => [v, n.replace(/_/g,' ')]}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {drivers.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:d.color }}/>
                  <span className="text-green-700/70 flex-1 capitalize">{d.name?.replace(/_/g,' ')}</span>
                  <span className="text-green-800/80">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Incident form */}
          {showForm && (
            <div className="col-span-2 rounded-xl border border-green-500/20 p-4" style={{ background:'#ffffff' }}>
              <div className="text-xs font-mono text-green-700/70 uppercase tracking-widest mb-3">Report New Incident</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['incident_type', 'Type', 'select', ['crop_raid','property_damage','human_injury','elephant_injury','retaliatory_attack']],
                  ['severity', 'Severity', 'select', ['low','medium','high','critical']],
                  ['village', 'Village', 'text'],
                  ['individual_id', 'Elephant ID', 'select', ['','WY_ELE_F01','WY_ELE_F02','WY_ELE_M01','WY_ELE_F03','WY_ELE_M02']],
                  ['crop_loss_inr', 'Crop Loss (₹)', 'number'],
                  ['primary_driver', 'Root Cause', 'select', ['crop_attraction','water_stress','forage_stress','social_stress','human_disturbance','corridor_pressure','health_anomaly']],
                ].map(([field, label, type, opts]) => (
                  <div key={field}>
                    <label className="block text-[10px] font-mono text-green-700/60 mb-1">{label}</label>
                    {type === 'select' ? (
                      <select value={form[field]} onChange={e => setForm(f => ({...f,[field]:e.target.value}))}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-green-950 bg-green-50 border border-white/10 focus:border-green-500/40 focus:outline-none font-mono">
                        {opts.map(o => <option key={o} value={o}>{o || '-- select --'}</option>)}
                      </select>
                    ) : (
                      <input type={type} value={form[field]} onChange={e => setForm(f => ({...f,[field]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-green-950 bg-green-50 border border-white/10 focus:border-green-500/40 focus:outline-none font-mono"/>
                    )}
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-green-700/60 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))}
                    rows={2} className="w-full px-2 py-1.5 rounded-lg text-xs text-green-950 bg-green-50 border border-white/10 focus:border-green-500/40 focus:outline-none font-mono resize-none"/>
                </div>
              </div>
              <button onClick={() => addIncident(form)}
                className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-green-950"
                style={{ background:'linear-gradient(135deg,#16a34a,#16a34a)', fontFamily:'Syne,sans-serif' }}>
                Submit Incident Report
              </button>
            </div>
          )}

          {!showForm && (
            <div className="col-span-2 rounded-xl border border-green-200 p-4" style={{ background:'#ffffff' }}>
              <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest mb-3">Incident Types Distribution</div>
              <div className="space-y-2">
                {(stats?.incident_types || []).map(t => {
                  const total = (stats?.incident_types||[]).reduce((a,b)=>a+b.cnt,0) || 1
                  const pct = Math.round(t.cnt/total*100)
                  return (
                    <div key={t.incident_type}>
                      <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-green-700/70">{TYPE_ICON[t.incident_type] || '📍'} {t.incident_type?.replace(/_/g,' ')}</span>
                        <span className="text-green-800/80">{t.cnt} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-green-50 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:'#f59e0b' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Incident list */}
        <div>
          <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest mb-3">All Incidents</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <div className="space-y-2">
              {(incidents || []).map(inc => {
                const sty = SEVERITY_STYLE[inc.severity] || SEVERITY_STYLE.medium
                return (
                  <div key={inc.id} className="rounded-xl border p-4 flex gap-4"
                    style={{ background:sty.bg, borderColor:sty.border }}>
                    <div className="text-2xl flex-shrink-0">{TYPE_ICON[inc.incident_type] || '📍'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-bold" style={{ color:sty.color }}>
                          {inc.incident_type?.replace(/_/g,' ').toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                          style={{ color:sty.color, borderColor:sty.border, background:`${sty.border}44` }}>
                          {inc.severity?.toUpperCase()}
                        </span>
                        {inc.individual_id && (
                          <span className="text-[10px] font-mono text-green-700/70">{inc.individual_id}</span>
                        )}
                        {inc.verified && <span className="text-[9px] text-green-700 font-mono">✓ verified</span>}
                        <span className="text-[10px] font-mono text-green-600/50 ml-auto">
                          {new Date(inc.occurred_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xs text-green-800/80 mb-1">{inc.description}</div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-green-700/60 flex-wrap">
                        {inc.village && <span>📍 {inc.village}</span>}
                        {inc.primary_driver && <span style={{ color:DRIVER_COLORS[inc.primary_driver]||'#888' }}>🔍 {inc.primary_driver?.replace(/_/g,' ')}</span>}
                        {inc.crop_loss_inr > 0 && <span className="text-amber-300/60">₹{inc.crop_loss_inr.toLocaleString()} crop loss</span>}
                        {inc.property_loss_inr > 0 && <span className="text-amber-300/60">₹{inc.property_loss_inr.toLocaleString()} property</span>}
                        {!inc.verified && (
                          <button onClick={() => verify(inc.id)}
                            className="ml-auto text-[10px] text-green-700 font-mono px-2 py-0.5 rounded border border-green-500/20 hover:bg-green-50">
                            ✓ Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}