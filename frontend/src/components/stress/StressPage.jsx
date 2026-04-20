// StressPage.jsx — WildGuard AI v5 — Ecological stress + Fatigue/Aggression prediction
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
         BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

const authH = () => ({Authorization:`Bearer ${localStorage.getItem('wg_access_token')}`})
const ELS = [
  {id:'WY_ELE_F01',name:'Lakshmi',color:'#22c55e',emoji:'🐘'},
  {id:'WY_ELE_F02',name:'Kaveri', color:'#60a5fa',emoji:'🐘'},
  {id:'WY_ELE_M01',name:'Arjun',  color:'#f59e0b',emoji:'🦣'},
  {id:'WY_ELE_F03',name:'Ganga',  color:'#c084fc',emoji:'🐘'},
  {id:'WY_ELE_M02',name:'Rajan',  color:'#fb923c',emoji:'🦣'},
]
const TT = {contentStyle:{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:10,
  fontSize:11,fontFamily:'DM Mono,monospace',color:'#0f2318'}}

function FatigueCard({ f }) {
  if (!f) return null
  const fi = parseFloat(f.fatigue_index) || 0
  const ap = parseFloat(f.aggression_prob) || 0
  const col = fi > 0.7 ? '#ef4444' : fi > 0.5 ? '#f97316' : fi > 0.3 ? '#f59e0b' : '#22c55e'
  const el  = ELS.find(e=>e.id===f.individual_id) || ELS.find(e=>e.name===f.name) || ELS[0]
  // Override f with safe values
  f = {...f, fatigue_index: fi, aggression_prob: ap}
  const aggCol = f.aggression_prob > 0.6 ? '#ef4444'
               : f.aggression_prob > 0.35 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{borderRadius:14,border:`2px solid ${col}33`,background:'#ffffff',
      padding:16,boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
      
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div style={{width:44,height:44,borderRadius:12,background:`${el.color}22`,
          border:`2px solid ${el.color}44`,display:'flex',alignItems:'center',
          justifyContent:'center',fontSize:22}}>{el.emoji}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:14,color:'#0f2318',fontFamily:'Syne,sans-serif'}}>
            {f.name}
          </div>
          <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
            {f.sex==='M'?'♂ Male':'♀ Female'} · {f.age_class}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{padding:'3px 10px',borderRadius:8,background:`${col}18`,
            border:`1px solid ${col}44`,color:col,fontSize:11,
            fontFamily:'DM Mono,monospace',fontWeight:700}}>
            {f.fatigue_state}
          </div>
        </div>
      </div>

      {/* Fatigue gauge */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#3d7a52',fontWeight:700}}>
            🔋 Fatigue Index
          </span>
          <span style={{fontSize:14,fontWeight:900,color:col}}>
            {Math.round(f.fatigue_index*100)}%
          </span>
        </div>
        <div style={{height:10,borderRadius:5,background:'#f0fdf4',overflow:'hidden',border:'1px solid #d1fae5'}}>
          <div style={{height:'100%',background:`linear-gradient(90deg,#22c55e,${col})`,
            width:`${f.fatigue_index*100}%`,borderRadius:5,transition:'width 1s'}}/>
        </div>
      </div>

      {/* Aggression */}
      <div style={{padding:10,borderRadius:10,
        background:f.aggression_prob>0.6?'#fef2f2':f.aggression_prob>0.35?'#fffbeb':'#f0fdf4',
        border:`1px solid ${aggCol}33`,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <span style={{fontSize:11,fontWeight:700,color:'#0f2318'}}>
            ⚡ Aggression Probability
          </span>
          <span style={{fontSize:20,fontWeight:900,color:aggCol,fontFamily:'Syne,sans-serif'}}>
            {Math.round(f.aggression_prob*100)}%
          </span>
        </div>
        <div style={{fontSize:10,color:'#6b7280'}}>{f.next_event_risk}</div>
        <div style={{height:6,borderRadius:3,background:'rgba(0,0,0,.06)',overflow:'hidden',marginTop:6}}>
          <div style={{height:'100%',background:aggCol,width:`${f.aggression_prob*100}%`,borderRadius:3}}/>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {[
          ['📏 Distance (24h)', `${f.breakdown?.total_distance_km||0}km`],
          ['💨 Avg Speed',      `${f.breakdown?.avg_speed_kmh||0}km/h`],
          ['😴 Rest',           `${f.breakdown?.rest_hours||0}h`],
          ['🌙 Night activity', `${f.breakdown?.night_activity_pct||0}%`],
          ['⚡ Sprints',        `${f.breakdown?.sprint_events||0}`],
          ['😓 Rest deficit',   `${f.breakdown?.rest_deficit_hours||0}h`],
        ].map(([k,v])=>(
          <div key={k} style={{padding:'5px 8px',borderRadius:7,background:'#f8fafc',
            border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:8,color:'#9ca3af',fontFamily:'DM Mono,monospace'}}>{k}</div>
            <div style={{fontSize:12,fontWeight:700,color:'#0f2318',fontFamily:'DM Mono,monospace'}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StressPage() {
  const [tab, setTab]       = useState('fatigue')
  const [selEid, setSelEid] = useState('WY_ELE_F01')

  const {data:stressAll}  = useQuery({queryKey:['stress','all'],queryFn:()=>fetch('/api/stress/current',{headers:authH()}).then(r=>r.json()),refetchInterval:15000})
  const {data:fatigueRaw,isLoading:fatLoading} = useQuery({queryKey:['fatigue','all'],queryFn:()=>fetch('/api/fatigue/all',{headers:authH()}).then(r=>r.json()),refetchInterval:30000})
  // /api/fatigue/all returns {eid: {...}} object — convert to array
  const _fatRaw = fatigueRaw ? (Array.isArray(fatigueRaw) ? fatigueRaw : Object.values(fatigueRaw)) : []
  // Always show all 5 elephants — fill missing ones with defaults
  const fatigueAll = ELS.map(e => {
    const found = _fatRaw.find(f => f.individual_id === e.id)
    if (found) return found
    // Default entry for elephants not yet computed
    return {
      individual_id: e.id, name: e.name, sex: e.id.includes('M0') ? 'M' : 'F',
      age_class: 'adult', fatigue_index: 0, aggression_prob: 0.05,
      fatigue_state: 'RESTED', next_event_risk: 'Insufficient GPS data yet',
      breakdown: {total_distance_km:0,avg_speed_kmh:0,rest_hours:0,night_activity_pct:0,sprint_events:0,rest_deficit_hours:0}
    }
  })
  const {data:waterholes=[]} = useQuery({queryKey:['stress','waterholes'],queryFn:()=>fetch('/api/stress/waterholes',{headers:authH()}).then(r=>r.json())})
  const {data:corridors=[]}  = useQuery({queryKey:['stress','corridors'], queryFn:()=>fetch('/api/stress/corridors', {headers:authH()}).then(r=>r.json())})

  const selStress  = stressAll?.[selEid]
  const selFatigue = fatigueAll.find(f=>f.individual_id===selEid)
  const el         = ELS.find(e=>e.id===selEid)||ELS[0]

  const radarData = selStress ? [
    {dim:'Water stress',  val:Math.round((selStress.water_stress||0)*100)},
    {dim:'Forage stress', val:Math.round((selStress.forage_stress||0)*100)},
    {dim:'Crop attract',  val:Math.round((selStress.crop_attraction||0)*100)},
    {dim:'Social stress', val:Math.round((selStress.social_stress||0)*100)},
    {dim:'Human dist',    val:Math.round((selStress.human_disturbance||0)*100)},
    {dim:'Corridor',      val:Math.round((selStress.corridor_pressure||0)*100)},
  ] : []

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#f0fdf4'}}>
      {/* Header */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
        borderBottom:'1px solid #d1fae5',background:'#ffffff',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
        <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#16a34a,#22c55e)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🧬</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:'#0f2318',fontFamily:'Syne,sans-serif'}}>
            Ecological Stress + Fatigue Prediction
          </div>
          <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
            Multi-factor stress analysis · GPS-based fatigue index · Aggression prediction
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{flexShrink:0,display:'flex',gap:4,padding:'6px 12px',
        borderBottom:'1px solid #d1fae5',background:'#f9fefb'}}>
        {[{k:'fatigue',l:'⚡ Fatigue & Aggression'},{k:'stress',l:'🌿 Ecological Stress'},{k:'env',l:'🌊 Environment'}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'5px 14px',borderRadius:8,fontSize:11,cursor:'pointer',
            fontFamily:'DM Mono,monospace',fontWeight:600,
            border:`1px solid ${tab===k?'#22c55e':'#d1fae5'}`,
            background:tab===k?'#dcfce7':'#ffffff',
            color:tab===k?'#15803d':'#3d7a52',
          }}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:12}}>

        {/* ── Fatigue Tab ── */}
        {tab==='fatigue'&&(
          <div>
            {/* Alert banner for high fatigue */}
            {fatigueAll.filter(f=>(parseFloat(f.fatigue_index)||0)>0.6).length>0&&(
              <div style={{borderRadius:10,background:'#fef2f2',border:'1px solid #fca5a5',
                padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>🚨</span>
                <div>
                  <div style={{fontWeight:700,color:'#dc2626',fontSize:13}}>
                    High Fatigue Alert — {fatigueAll.filter(f=>(parseFloat(f.fatigue_index)||0)>0.6).length} elephant(s) showing elevated aggression risk
                  </div>
                  <div style={{fontSize:11,color:'#ef4444'}}>
                    {fatigueAll.filter(f=>(parseFloat(f.fatigue_index)||0)>0.6).map(f=>f.name).join(', ')} — increased HEC probability
                  </div>
                </div>
              </div>
            )}

            {/* All elephants fatigue overview */}
            <div style={{borderRadius:12,border:'1px solid #d1fae5',background:'#ffffff',
              padding:14,marginBottom:12}}>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:10}}>
                ⚡ Fatigue Index Overview — All Elephants
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={fatigueAll.map(f=>({
                  name:ELS.find(e=>e.id===f.individual_id)?.name||f.individual_id,
                  fatigue:Math.round((parseFloat(f.fatigue_index)||0)*100),
                  aggression:Math.round(f.aggression_prob*100),
                  color:ELS.find(e=>e.id===f.individual_id)?.color||'#22c55e',
                }))} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4"/>
                  <XAxis dataKey="name" tick={{fill:'#3d7a52',fontSize:10,fontFamily:'DM Mono'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>v+'%'} tick={{fill:'#3d7a52',fontSize:9}} axisLine={false} tickLine={false} width={36}/>
                  <Tooltip {...TT} formatter={(v,n)=>[v+'%',n==='fatigue'?'Fatigue':'Aggression']}/>
                  <Bar dataKey="fatigue" name="fatigue" radius={[4,4,0,0]}>
                    {fatigueAll.map((f,i)=>{
                      const fi2=parseFloat(f.fatigue_index)||0; const c=fi2>0.7?'#ef4444':fi2>0.5?'#f97316':fi2>0.3?'#f59e0b':'#22c55e'
                      return<Cell key={i} fill={c}/>
                    })}
                  </Bar>
                  <Bar dataKey="aggression" name="aggression" radius={[4,4,0,0]} fill="#c084fc" opacity={0.5}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{fontSize:9,color:'#9ec4aa',fontFamily:'DM Mono,monospace',marginTop:4}}>
                Green bars = Fatigue % · Purple bars = Aggression % · Based on 24h GPS history
              </div>
            </div>

            {/* Individual cards */}
            {fatLoading
              ? <div style={{textAlign:'center',padding:40,color:'#9ec4aa',fontSize:12}}>Computing fatigue from GPS history...</div>
              : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {fatigueAll.map(f=><FatigueCard key={f.individual_id} f={f}/>)}
                </div>
            }

            {/* Scientific basis */}
            <div style={{borderRadius:12,border:'1px solid #d1fae5',background:'#ffffff',
              padding:14,marginTop:12}}>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:10}}>
                📚 Scientific Basis — Fatigue → Aggression Model
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {icon:'📏',t:'Distance Factor (35%)',d:'Daily distance vs species max (25-35km). Elephants exceeding 80% of max range show elevated stress cortisol (Sukumar 1989).'},
                  {icon:'😴',t:'Rest Deficit (30%)',   d:'African/Asian elephants need 5-7h rest. Sleep deprivation correlates with increased aggression in captive studies (Rees 2009).'},
                  {icon:'🌙',t:'Night Activity (20%)', d:'Nocturnal foraging is energy-intensive. High night-time movement near settlements → 2.3× more aggressive encounters (Gubbi 2012).'},
                  {icon:'⚡',t:'Sprint Events (15%)',  d:'High-speed bursts (>8km/h) indicate panic/musth. Male elephants in musth show 4× normal aggression (Poole 1987).'},
                ].map(({icon,t,d})=>(
                  <div key={t} style={{borderRadius:10,border:'1px solid #d1fae5',padding:10,background:'#f9fefb'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <span style={{fontSize:16}}>{icon}</span>
                      <span style={{fontSize:11,fontWeight:700,color:'#0f2318'}}>{t}</span>
                    </div>
                    <div style={{fontSize:10,color:'#374151',lineHeight:1.4}}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stress Tab ── */}
        {tab==='stress'&&(
          <div style={{display:'grid',gap:12}}>
            {/* Elephant selector */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {ELS.map(e=>(
                <button key={e.id} onClick={()=>setSelEid(e.id)} style={{
                  padding:'5px 12px',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:600,
                  border:`1px solid ${selEid===e.id?e.color:'#d1fae5'}`,
                  background:selEid===e.id?`${e.color}22`:'#ffffff',
                  color:selEid===e.id?e.color:'#3d7a52',
                }}>{e.emoji} {e.name}</button>
              ))}
            </div>

            {selStress&&(
              <>
                <div style={{borderRadius:12,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
                  <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                    textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>
                    🌿 {el.name} — Stress Radar
                  </div>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:8}}>
                    Primary driver: <b style={{color:'#ef4444'}}>{selStress.primary_driver||'N/A'}</b> ·
                    Composite: <b style={{color:'#ef4444'}}>{Math.round((selStress.composite_score||0)*100)}%</b>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#d1fae5"/>
                      <PolarAngleAxis dataKey="dim" tick={{fill:'#3d7a52',fontSize:10,fontFamily:'DM Mono'}}/>
                      <Radar dataKey="val" stroke={el.color} fill={el.color} fillOpacity={0.25} strokeWidth={2}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {[
                    ['💧 Water stress', selStress.water_stress,'#3b82f6'],
                    ['🌿 Forage stress',selStress.forage_stress,'#22c55e'],
                    ['🌾 Crop attract', selStress.crop_attraction,'#f59e0b'],
                    ['👥 Social stress',selStress.social_stress,'#c084fc'],
                    ['🏘 Human dist',   selStress.human_disturbance,'#ef4444'],
                    ['🛤 Corridor',      selStress.corridor_pressure,'#fb923c'],
                  ].map(([k,v,c])=>(
                    <div key={k} style={{borderRadius:10,border:`1px solid ${c}22`,
                      padding:10,background:`${c}08`,textAlign:'center'}}>
                      <div style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#3d7a52',marginBottom:4}}>{k}</div>
                      <div style={{fontSize:20,fontWeight:900,color:c}}>{Math.round((v||0)*100)}%</div>
                      <div style={{height:5,borderRadius:3,background:'#f0fdf4',overflow:'hidden',marginTop:4}}>
                        <div style={{height:'100%',background:c,width:`${(v||0)*100}%`,borderRadius:3}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Environment Tab ── */}
        {tab==='env'&&(
          <div style={{display:'grid',gap:12}}>
            <div style={{borderRadius:12,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
                💧 Waterhole Levels
              </div>
              {(Array.isArray(waterholes)?waterholes:[]).map((w,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:12,color:'#0f2318'}}>{w.name}</div>
                    <div style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#6b7280'}}>{w.location}</div>
                  </div>
                  <div style={{width:80}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                      <span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#6b7280'}}>Level</span>
                      <span style={{fontSize:11,fontWeight:700,
                        color:w.level_pct<20?'#ef4444':w.level_pct<50?'#f59e0b':'#16a34a'}}>
                        {Math.round(w.level_pct)}%
                      </span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:'#f0fdf4',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,
                        background:w.level_pct<20?'#ef4444':w.level_pct<50?'#f59e0b':'#3b82f6',
                        width:`${w.level_pct}%`}}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{borderRadius:12,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
                🛤 Wildlife Corridor Health
              </div>
              {(Array.isArray(corridors)?corridors:[]).map((c,i)=>(
                <div key={i} style={{borderRadius:10,border:'1px solid #d1fae5',
                  padding:10,marginBottom:8,background:'#f9fefb'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:12,color:'#0f2318'}}>{c.name}</span>
                    <span style={{fontSize:11,fontWeight:700,
                      color:c.health_score>0.6?'#16a34a':c.health_score>0.3?'#f59e0b':'#ef4444'}}>
                      {Math.round(c.health_score*100)}% healthy
                    </span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:'#f0fdf4',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:3,
                      background:c.health_score>0.6?'#22c55e':c.health_score>0.3?'#f59e0b':'#ef4444',
                      width:`${c.health_score*100}%`}}/>
                  </div>
                  <div style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#6b7280',marginTop:4}}>
                    {c.bottleneck_risk} bottleneck risk · {c.primary_threat||'No major threat'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}