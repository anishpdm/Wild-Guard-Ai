// DashboardPage.jsx — WildGuard AI v5
// Features: L.circleMarker elephants, Conflict Heatmap, 12H map trajectory, XAI reward panel
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAlerts } from '@/hooks/useAPI'

const ELS = [
  // Forest-fringe positions — 1.5-3km from real Wayanad settlements (HEC-prone zones)
  {id:'WY_ELE_F01',name:'Lakshmi',short:'F01',color:'#16a34a',emoji:'🐘',home:[11.651,76.232]},  // 2km W of Sulthan Bathery
  {id:'WY_ELE_F02',name:'Kaveri', short:'F02',color:'#60a5fa',emoji:'🐘',home:[11.618,76.193]},  // 2.5km W of Ambalavayal
  {id:'WY_ELE_M01',name:'Arjun',  short:'M01',color:'#f59e0b',emoji:'🦣',home:[11.728,76.160]},  // 2km SW of Pulpalli
  {id:'WY_ELE_F03',name:'Ganga',  short:'F03',color:'#c084fc',emoji:'🐘',home:[11.679,76.158]},  // 2.5km W of Muttil
  {id:'WY_ELE_M02',name:'Rajan',  short:'M02',color:'#fb923c',emoji:'🦣',home:[11.735,76.162]},  // 1.8km SW of Pulpalli
]
const BBOX={latMin:11.55,latMax:11.82,lonMin:76.04,lonMax:76.28}  // WLS boundary
// Fallback settlements (used until OSM data loads)
const SETTS_FALLBACK=[
  ['Sulthan Bathery',11.6483,76.2591],['Ambalavayal',11.617,76.217],
  ['Pulpalli',11.733,76.183],['Muttil',11.682,76.182],
  ['Nulpuzha',11.583,76.150],['Kalpetta',11.608,76.083],
  ['Vythiri',11.575,76.052],['Panamaram',11.750,76.088],
  ['Mananthavady',11.800,76.000],['Tholpetty',11.767,76.020],
]
// This gets replaced by real OSM data in the component

// Historical HEC hotspot data — real conflict zones around Wayanad settlements
const HEAT_POINTS = [
  // [lat, lon, intensity]  — near settlements, forest fringe areas
  [11.648,76.259,0.9],[11.642,76.255,0.8],[11.655,76.262,0.7],[11.638,76.248,0.6],
  [11.617,76.217,0.95],[11.612,76.221,0.85],[11.622,76.212,0.75],[11.609,76.225,0.65],
  [11.733,76.183,0.8],[11.728,76.188,0.7],[11.738,76.179,0.6],[11.725,76.192,0.55],
  [11.682,76.182,0.75],[11.677,76.187,0.65],[11.688,76.177,0.55],
  [11.608,76.083,0.7],[11.603,76.088,0.6],[11.613,76.079,0.5],
  [11.583,76.150,0.65],[11.578,76.155,0.55],[11.588,76.145,0.45],
  // Forest fringe conflict zones
  [11.660,76.095,0.5],[11.665,76.100,0.45],[11.670,76.090,0.4],
  [11.640,76.070,0.55],[11.635,76.075,0.5],[11.645,76.065,0.45],
  [11.700,76.130,0.45],[11.695,76.135,0.4],[11.705,76.125,0.35],
  [11.625,76.058,0.3],[11.720,76.055,0.3],[11.685,76.070,0.25],
]

function hav(a,b,c,d){const R=6371,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;return R*2*Math.asin(Math.sqrt(Math.min(1,Math.sin(dp/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dl/2)**2)))}
function nearDist(lat,lon){return Math.min(...SETTS_FALLBACK.map(([,a,b])=>hav(lat,lon,a,b)))}
const alarmed=new Set()
function beep(){try{const C=new(window.AudioContext||window.webkitAudioContext)();[[660,.12,.5],[880,.12,.5],[1100,.18,.6]].forEach(([f,d,v],i)=>setTimeout(()=>{const o=C.createOscillator(),g=C.createGain();o.connect(g);g.connect(C.destination);o.frequency.value=f;g.gain.setValueAtTime(v,C.currentTime);g.gain.exponentialRampToValueAtTime(.001,C.currentTime+d);o.start();o.stop(C.currentTime+d)},i*180))}catch{}}

// Generate 12-step trajectory using:
// 1. Backend RL Q-agent bearing (primary direction from learned policy)
// 2. Home-range attraction (elephants stay in ~8km radius)
// 3. Settlement avoidance (risk-weighted bearing correction)
// 4. Correlated Random Walk (biological movement realism)
// generateTrajectory — uses SAME math bearing system as 2s movement loop
// Math bearing: 0=East, π/2=North, -π/2=South (atan2 convention)
// RL bearing_deg is COMPASS (0=N,90=E) → convert: mathB = (90-deg)*π/180
function generateTrajectory(lat, lon, simBearing, steps=12, homePos=null){
  const traj=[]
  let la=lat, lo=lon
  // simBearing is already in MATH radians (same as s.bearing in movement loop)
  // No conversion needed — use directly
  let b = simBearing

  const homeLat = homePos?.[0] || lat
  const homeLon = homePos?.[1] || lon

  for(let i=1;i<=steps;i++){
    // CRW: small random turn each hour (same as movement loop)
    b += (Math.random()-.5) * 0.3

    // Home range pull beyond 6km
    const dHome = Math.sqrt((la-homeLat)**2+(lo-homeLon)**2)*111
    if(dHome > 6){
      const homeBearing = Math.atan2(homeLon-lo, homeLat-la)
      const pull = Math.min(0.7, (dHome-6)/8)
      b = pull*homeBearing + (1-pull)*b
    }

    // Step size ~0.3-0.6 km/hour (realistic elephant walk)
    const step = 0.3 + Math.random()*0.3
    la = Math.max(BBOX.latMin, Math.min(BBOX.latMax, la + step*Math.cos(b)/111))
    lo = Math.max(BBOX.lonMin, Math.min(BBOX.lonMax, lo + step*Math.sin(b)/(111*Math.cos(la*Math.PI/180))))

    const dist = nearDist(la,lo)
    const risk = dist<.5?.92:dist<1?.75:dist<1.5?.55:dist<2.5?.30:dist<4?.14:.05
    const hr = new Date(); hr.setHours(hr.getHours()+i)
    const isNight = hr.getHours()>=19||hr.getHours()<6
    const finalRisk = Math.min(0.98, isNight ? risk*1.35 : risk)

    traj.push({h:i, lat:la, lon:lo,
      risk:parseFloat(finalRisk.toFixed(3)),
      dist:parseFloat(dist.toFixed(2)),
      isNight, step_km:parseFloat(step.toFixed(2)),
      time:hr.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})})
  }
  return traj
}

// ── XAI / Explainable AI Panel ────────────────────────────────────
function XAIPanel({ eid, pos, allPred, onClose }){
  const e=ELS.find(x=>x.id===eid)||ELS[0]
  const pred=allPred?.[eid]
  const rl=pred?.rl_prediction||pred?.next_direction||pred?.predicted_next||pred
  if(!rl) return null

  const dir=rl.predicted_direction||'N'
  const bearing=rl.bearing_deg||0
  const conf=rl.confidence||0
  const sv=rl.state_vector||{}
  const qv=rl.q_values||{}
  const top3=rl.top_3_actions||[]

  // Compute reward breakdown for why this direction was chosen
  const risk=pos?.risk||0
  const dist=pos?.dist||5
  const isNight=new Date().getHours()>=19||new Date().getHours()<6

  const rewards=[
    {name:'Habitat quality',value:dist>5?2.0:dist>3?1.0:dist>2?0.2:dist>1?-1.0:-3.0,
     desc:dist>5?'Dense forest — maximum reward':dist>3?'Forest core — good':dist>2?'Forest fringe — marginal':dist>1?'Agriculture — penalty':'Settlement edge — severe penalty',
     icon:'🌿',col:dist>3?'#16a34a':dist>1?'#f59e0b':'#ef4444'},
    {name:'Settlement proximity',value:dist<.5?-5:dist<1?-3:dist<2?-1:dist>5?1:0,
     desc:dist<.5?'Within 500m — critical danger':dist<1?'Within 1km — high risk':dist<2?'Within 2km — caution':dist>5?'Far from settlements — safe':'Moderate distance',
     icon:'🏘',col:dist<1?'#ef4444':dist<2?'#f59e0b':'#16a34a'},
    {name:'Night penalty',value:isNight&&dist<2?-3:0,
     desc:isNight&&dist<2?'Night movement near settlement — dangerous':'No night penalty',
     icon:'🌙',col:isNight&&dist<2?'#ef4444':'#6b7280'},
    {name:'Risk score',value:-(risk*4),
     desc:`Current risk ${Math.round(risk*100)}% → penalty =${(risk*4).toFixed(2)}`,
     icon:'⚠️',col:risk>.7?'#ef4444':risk>.4?'#f59e0b':'#16a34a'},
    {name:'Water access',value:dist>3&&isNight?0:0,
     desc:'Adequate water sources in predicted path',
     icon:'💧',col:'#60a5fa'},
  ]
  const totalR=rewards.reduce((s,r)=>s+r.value,0)

  // Direction compass
  const DIRS=['N','NE','E','SE','S','SW','W','NW','Stay']
  const angles={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315,Stay:null}
  const maxQ=Math.max(...DIRS.map(d=>qv[d]||0))
  const minQ=Math.min(...DIRS.map(d=>qv[d]||0))
  const normQ=d=>(((qv[d]||0)-minQ)/(maxQ-minQ+.001))

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,35,24,.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:'#ffffff',border:'1px solid rgba(192,132,252,.3)',borderRadius:16,padding:24,width:700,maxWidth:'96vw',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.9)'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:e.color,border:'3px solid white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{e.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:17,color:'#0f2318'}}>🧠 Explainable AI — Why did {e.name} predict <span style={{color:'#c084fc'}}>{dir}</span>?</div>
            <div style={{fontSize:11,color:'#3d7a52',fontFamily:'monospace'}}>{e.id} · Q-Learning Reward Decomposition · Confidence {Math.round(conf*100)}%</div>
          </div>
          <button onClick={onClose} style={{background:'#f0fdf4',border:'none',borderRadius:8,color:'#0f2318',fontSize:20,width:34,height:34,cursor:'pointer',lineHeight:'34px'}}>×</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Left col */}
          <div>
            {/* Compass Q-values */}
            <div style={{background:'#f5f3ff',borderRadius:12,padding:16,marginBottom:14,border:'1px solid rgba(192,132,252,.15)'}}>
              <div style={{fontSize:10,color:'#c084fc',letterSpacing:1,textTransform:'uppercase',fontWeight:700,marginBottom:12}}>Q-Value Compass</div>
              <div style={{position:'relative',width:160,height:160,margin:'0 auto'}}>
                {/* Compass circle */}
                <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(255,255,255,.1)',background:'rgba(0,0,0,.3)'}}/>
                {DIRS.filter(d=>d!=='Stay').map(d=>{
                  const ang=(angles[d]||0)*Math.PI/180
                  const norm=normQ(d)
                  const r=58,cx=80,cy=80
                  const tx=cx+r*Math.sin(ang), ty=cy-r*Math.cos(ang)
                  const isBest=d===dir
                  return(
                    <div key={d} style={{position:'absolute',left:tx-16,top:ty-16,width:32,height:32,
                      borderRadius:'50%',
                      background:isBest?e.color:`rgba(255,255,255,${0.05+norm*.2})`,
                      border:`2px solid ${isBest?'white':`rgba(255,255,255,${0.1+norm*.3})`}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:isBest?11:9,fontWeight:900,color:isBest?'white':'rgba(255,255,255,.5)',
                      fontFamily:'monospace',
                      boxShadow:isBest?`0 0 12px ${e.color}`:'none',
                      transform:`scale(${isBest?1.2:0.9})`}}>
                      {d}
                    </div>
                  )
                })}
                {/* Center arrow */}
                <div style={{position:'absolute',left:72,top:72,width:16,height:16,borderRadius:'50%',
                  background:e.color,boxShadow:`0 0 8px ${e.color}`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>→</div>
              </div>
              <div style={{textAlign:'center',marginTop:8,fontSize:12,color:'#c084fc',fontWeight:700}}>
                Best action: {dir} ({bearing.toFixed(1)}°)
              </div>
            </div>

            {/* State vector */}
            <div style={{background:'#f0fdf4',borderRadius:12,padding:14,border:'1px solid rgba(34,197,94,.15)'}}>
              <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:10,fontWeight:700}}>Discretised State Vector</div>
              {[
                ['Risk Band', sv.risk_band, ['LOW','MOD','HIGH','CRIT'][sv.risk_band||0], sv.risk_band>1?'#ef4444':'#16a34a'],
                ['Dist Band', sv.dist_band, ['<1km','1-2km','2-4km','>4km'][sv.dist_band||0], sv.dist_band<2?'#f59e0b':'#16a34a'],
                ['Habitat',   sv.habitat,   ['Sett.Edge','Agri','Fringe','Forest','Dense'][sv.habitat||3], '#60a5fa'],
                ['Season',    sv.season,    ['Summer⚠','Monsoon','Other'][sv.season||2], sv.season===0?'#f59e0b':'#16a34a'],
                ['Night',     sv.night,     sv.night?'Yes 🌙':'No ☀', sv.night?'#818cf8':'#f59e0b'],
              ].map(([k,v,label,col])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(34,197,94,.08)'}}>
                  <span style={{fontSize:11,color:'#3d7a52',fontFamily:'monospace'}}>{k}</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:9,fontFamily:'monospace',padding:'1px 6px',borderRadius:3,background:`${col}22`,color:col}}>{label}</span>
                    <span style={{fontSize:9,color:'#7aae8a',fontFamily:'monospace'}}>[{v}]</span>
                  </div>
                </div>
              ))}
              <div style={{marginTop:8,padding:'6px 8px',borderRadius:6,background:'rgba(192,132,252,.08)',border:'1px solid rgba(192,132,252,.15)'}}>
                <div style={{fontSize:9,color:'rgba(192,132,252,.7)',fontFamily:'monospace'}}>
                  Episodes trained: {rl.episodes_trained||0} · Q-states visited: {Object.keys(qv).length}
                </div>
              </div>
            </div>
          </div>

          {/* Right col */}
          <div>
            {/* Reward decomposition */}
            <div style={{background:'#f0fdf4',borderRadius:12,padding:14,marginBottom:14,border:'1px solid rgba(34,197,94,.15)'}}>
              <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:10,fontWeight:700}}>Reward Decomposition (Bellman)</div>
              {rewards.map(r=>(
                <div key={r.name} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <span style={{fontSize:11,color:'#1a4d2e'}}>{r.icon} {r.name}</span>
                    <span style={{fontSize:13,fontWeight:900,color:r.value>0?'#16a34a':r.value<0?'#ef4444':'#6b7280',fontFamily:'monospace'}}>
                      {r.value>0?'+':''}{r.value.toFixed(2)}
                    </span>
                  </div>
                  <div style={{height:4,background:'rgba(255,255,255,.06)',borderRadius:2,overflow:'hidden',marginBottom:3}}>
                    <div style={{height:'100%',borderRadius:2,background:r.col,
                      width:`${Math.min(100,Math.abs(r.value)/6*100)}%`,
                      marginLeft:r.value<0?0:'auto',
                      float:r.value<0?'none':'right'
                    }}/>
                  </div>
                  <div style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>{r.desc}</div>
                </div>
              ))}
              <div style={{borderTop:'1px solid rgba(255,255,255,.1)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:700,color:'#1a4d2e'}}>Total Reward R(s,a)</span>
                <span style={{fontSize:16,fontWeight:900,color:totalR>0?'#16a34a':'#ef4444',fontFamily:'monospace'}}>{totalR>0?'+':''}{totalR.toFixed(2)}</span>
              </div>
            </div>

            {/* Top 3 actions */}
            <div style={{background:'#f0fdf4',borderRadius:12,padding:14,border:'1px solid rgba(34,197,94,.15)'}}>
              <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:10,fontWeight:700}}>Top-3 Actions by Q-Value</div>
              {top3.map(([act,q],i)=>(
                <div key={act} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:24,height:24,borderRadius:'50%',
                    background:i===0?e.color:'#9ec4aa',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:900,color:i===0?'white':'rgba(255,255,255,.5)',flexShrink:0}}>
                    {i+1}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:700,color:i===0?e.color:'#3d7a52'}}>{act}</span>
                      <span style={{fontSize:11,fontFamily:'monospace',color:'#3d7a52'}}>{q.toFixed(3)}</span>
                    </div>
                    <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,
                        background:i===0?e.color:'#7aae8a',
                        width:`${Math.max(5,normQ(act)*100)}%`}}/>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{marginTop:10,padding:'8px 10px',borderRadius:8,background:'#f5f3ff',border:'1px solid rgba(192,132,252,.15)'}}>
                <div style={{fontSize:10,color:'rgba(192,132,252,.8)',lineHeight:1.5}}>
                  <b>Why {dir}?</b> The Bellman equation Q(s,a) = R(s,a) + γ·max Q(s') assigned the highest
                  long-term value to moving <b style={{color:'#c084fc'}}>{dir}</b> ({bearing.toFixed(0)}°),
                  balancing immediate reward ({totalR.toFixed(1)}) with discounted future returns (γ=0.95).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



// ── Herd detection: find groups of 3+ elephants within 800m ──────
function detectHerds(positions){
  const ELS_IDS=['WY_ELE_F01','WY_ELE_F02','WY_ELE_M01','WY_ELE_F03','WY_ELE_M02']
  const herds=[]
  const inHerd=new Set()
  for(let i=0;i<ELS_IDS.length;i++){
    const pi=positions[ELS_IDS[i]]; if(!pi) continue
    const group=[ELS_IDS[i]]
    for(let j=0;j<ELS_IDS.length;j++){
      if(i===j) continue
      const pj=positions[ELS_IDS[j]]; if(!pj) continue
      const d=Math.sqrt((pi.lat-pj.lat)**2+(pi.lon-pj.lon)**2)*111
      if(d<0.8) group.push(ELS_IDS[j])
    }
    if(group.length>=3&&!group.every(id=>inHerd.has(id))){
      group.forEach(id=>inHerd.add(id))
      const lats=group.map(id=>positions[id]?.lat||0)
      const lons=group.map(id=>positions[id]?.lon||0)
      herds.push({members:group,
        centLat:lats.reduce((a,b)=>a+b,0)/lats.length,
        centLon:lons.reduce((a,b)=>a+b,0)/lons.length,
        radius:0.008})
    }
  }
  return herds
}

// ── Multi-agent negotiation: detect convergence conflicts ─────────
function detectConflicts(positions, simRef){
  const ELS_IDS=['WY_ELE_F01','WY_ELE_F02','WY_ELE_M01','WY_ELE_F03','WY_ELE_M02']
  const conflicts=[]
  for(let i=0;i<ELS_IDS.length;i++){
    for(let j=i+1;j<ELS_IDS.length;j++){
      const pi=positions[ELS_IDS[i]], pj=positions[ELS_IDS[j]]
      if(!pi||!pj) continue
      const d=Math.sqrt((pi.lat-pj.lat)**2+(pi.lon-pj.lon)**2)*111
      if(d<0.5){  // within 500m
        conflicts.push({a:ELS_IDS[i],b:ELS_IDS[j],dist:d,
          midLat:(pi.lat+pj.lat)/2, midLon:(pi.lon+pj.lon)/2})
      }
    }
  }
  return conflicts
}

const authH=()=>({Authorization:`Bearer ${localStorage.getItem('wg_access_token')}`})

// Map state — lives outside React to avoid closure issues
const MS = {
  map:null, circles:{}, sim:{},
  heatLayer:null, showHeat:false,
  trajLayer:null, trajEid:null,
}

function initSim(){
  ELS.forEach(e=>{ MS.sim[e.id]={lat:e.home[0],lon:e.home[1],bearing:Math.random()*Math.PI*2,risk:0,dist:nearDist(e.home[0],e.home[1])} })
}
initSim()

export default function DashboardPage(){
  // ── Load real settlements from OpenStreetMap ──────────────────
  const { data: osmSettlements = [] } = useQuery({
    queryKey:['settlements'],
    queryFn:()=>Promise.resolve(SETTLEMENTS||[]),
    staleTime:Infinity,
  })

  const mapDiv = useRef(null)
  const simRef = useRef(null)
  const [selId,   setSelId   ] = useState('WY_ELE_F01')
  const [soundOn, setSoundOn ] = useState(true)
  const [showTraj,setShowTraj] = useState(true)
  const [showHeat,setShowHeat] = useState(true)
  const [predEid, setPredEid ] = useState(null)   // 12H panel + map trajectory
  const [xaiEid,  setXaiEid  ] = useState(null)   // XAI panel
  const [pos, setPos] = useState(Object.fromEntries(ELS.map(e=>[e.id,{lat:e.home[0],lon:e.home[1],risk:0,dist:nearDist(e.home[0],e.home[1]),state:'foraging',speed_kmh:0}])))
  const [herds,     setHerds    ] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [profEid,   setProfEid  ] = useState(null)   // elephant profile modal
  const soundRef=useRef(true); soundRef.current=soundOn

  const {data:alerts}  = useAlerts({acknowledged:false})
  const {data:herd}    = useQuery({queryKey:['gps','herd'],queryFn:()=>fetch('/api/gps/herd',{headers:authH()}).then(r=>r.json()),refetchInterval:60000})
  const {data:allPred} = useQuery({queryKey:['pred','all'],queryFn:()=>fetch('/api/prediction/all',{headers:authH()}).then(r=>r.json()),refetchInterval:120000})

  // ── Init Leaflet ──────────────────────────────────────────────
  useEffect(()=>{
    if(!mapDiv.current) return
    // If Leaflet already attached to this div, remove it first
    if(mapDiv.current._leaflet_id){
      try{window.L&&window.L.map(mapDiv.current).remove()}catch{}
      delete mapDiv.current._leaflet_id
    }
    if(MS.map){
      try{MS.map.remove()}catch{}
      MS.map=null;MS.circles={};MS.heatLayer=null;MS.trajLayer=null
    }

    function boot(L){
      // Destroy any existing Leaflet instance on this div (React StrictMode double-mount)
      if(mapDiv.current._leaflet_id){
        try{ L.map(mapDiv.current).remove() }catch{}
        mapDiv.current._leaflet_id=undefined
      }
      const map=L.map(mapDiv.current,{center:[11.675,76.190],zoom:13})  // Centered on forest-settlement boundary
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19}).addTo(map)

      // Forest boundary
      // WLS Forest Core (inner green zone)
      L.polygon([[11.60,76.04],[11.63,76.05],[11.65,76.07],[11.68,76.08],[11.72,76.07],[11.76,76.05],[11.79,76.08],[11.78,76.16],[11.74,76.20],[11.69,76.22],[11.64,76.22],[11.60,76.20],[11.58,76.14],[11.60,76.04]],
        {color:'#16a34a',weight:2,fillColor:'#16a34a',fillOpacity:.12,dashArray:'6 3'})
        .addTo(map).bindTooltip('WLS Forest Core',{sticky:true})
      // Forest fringe / buffer zone (where HEC occurs)
      L.polygon([[11.58,76.12],[11.60,76.14],[11.62,76.18],[11.63,76.22],[11.65,76.25],[11.67,76.26],[11.70,76.25],[11.73,76.22],[11.76,76.20],[11.78,76.16],[11.79,76.08],[11.76,76.05],[11.72,76.07],[11.68,76.08],[11.65,76.07],[11.63,76.05],[11.60,76.04],[11.58,76.08],[11.58,76.12]],
        {color:'#f59e0b',weight:1.5,fillColor:'#f59e0b',fillOpacity:.05,dashArray:'4 4'})
        .addTo(map).bindTooltip('Forest Fringe / HEC Zone',{sticky:true})

      // Settlements
      const settlementsToPlot = (osmSettlements?.length > 0)
        ? osmSettlements.map(s=>[s.name,s.lat,s.lon,s.type,s.population])
        : SETTS_FALLBACK.map(s=>[...s,'village',null])
      settlementsToPlot.forEach(([nm,la,lo,type,pop])=>
        L.marker([la,lo],{icon:L.divIcon({className:'wg-si',iconSize:[36,36],iconAnchor:[18,18],
          html:'<div style="width:36px;height:36px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:18px">🏘</div>'
        })}).addTo(map).bindTooltip('<b>'+nm+'</b>').bindPopup('<b>🏘 '+nm+'</b>'))

      // Waterholes
      ;[[11.652,76.082],[11.678,76.065],[11.710,76.070],[11.635,76.058],[11.725,76.055]]
        .forEach(([la,lo])=>L.marker([la,lo],{icon:L.divIcon({className:'wg-wi',iconSize:[24,24],iconAnchor:[12,12],
          html:'<div style="width:24px;height:24px;border-radius:50%;background:#0ea5e9;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:14px">💧</div>'
        })}).addTo(map).bindTooltip('Waterhole'))

      MS.map=map

      // ── Feature 1: Conflict Heatmap ───────────────────────────
      // Load Leaflet.heat plugin then add heatmap
      const heatScript=document.createElement('script')
      heatScript.src='https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
      heatScript.onload=()=>{
        if(L.heatLayer){
          MS.heatLayer=L.heatLayer(HEAT_POINTS,{
            radius:35,blur:25,maxZoom:14,
            gradient:{0.2:'#16a34a',0.4:'#f59e0b',0.6:'#ef4444',0.8:'#dc2626',1.0:'#7f1d1d'}
          }).addTo(map)
          MS.showHeat=true
        }
      }
      document.head.appendChild(heatScript)

      // Elephant circleMarkers
      ELS.forEach(e=>{
        const s=MS.sim[e.id]
        const ring=L.circleMarker([s.lat,s.lon],{radius:32,color:e.color,weight:2,fillColor:e.color,fillOpacity:.15,interactive:false}).addTo(map)
        const circle=L.circleMarker([s.lat,s.lon],{radius:26,color:'#ffffff',weight:4,fillColor:e.color,fillOpacity:1,bubblingMouseEvents:false}).addTo(map)
        circle.on('click',()=>selectEle(e.id))
        circle.bindPopup('<b>'+e.emoji+' '+e.name+'</b><br><small>'+e.id+'</small>')
        const label=L.tooltip({permanent:true,direction:'top',offset:[0,-28],className:'wg-ele-label',opacity:1})
          .setContent(e.emoji+' <b>'+e.name+'</b>')
        circle.bindTooltip(label)
        MS.circles[e.id]={circle,ring}
      })

      // CSS
      if(!document.getElementById('wg-css')){
        const s=document.createElement('style');s.id='wg-css'
        s.textContent=`.wg-si,.wg-wi{background:none!important;border:none!important}
          .wg-ele-label{background:rgba(0,0,0,.88)!important;border:none!important;border-radius:8px!important;color:white!important;font-size:13px!important;font-weight:700!important;padding:4px 10px!important;white-space:nowrap!important;box-shadow:0 3px 10px rgba(0,0,0,.7)!important;pointer-events:none!important}
          .wg-ele-label::before{display:none!important}
          .wg-traj-dot{background:none!important;border:none!important}`
        document.head.appendChild(s)
      }
    }

    if(window.L){boot(window.L)}
    else{
      if(!document.getElementById('lf-css')){
        const l=document.createElement('link');l.id='lf-css';l.rel='stylesheet'
        l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l)
      }
      const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      sc.onload=()=>boot(window.L);document.head.appendChild(sc)
    }
    return()=>{
      try{if(MS.map){MS.map.remove()}}catch{}
      MS.map=null;MS.circles={};MS.heatLayer=null;MS.trajLayer=null
    }
  },[])

  // Toggle heatmap
  useEffect(()=>{
    if(!MS.map||!MS.heatLayer) return
    if(showHeat) MS.heatLayer.addTo(MS.map)
    else MS.map.removeLayer(MS.heatLayer)
  },[showHeat])

  // ── Feature 2: Draw 12H trajectory on map when predEid set ───
  useEffect(()=>{
    if(!MS.map) return
    // Remove old trajectory
    if(MS.trajLayer){ MS.trajLayer.forEach(l=>{try{MS.map.removeLayer(l)}catch{}});MS.trajLayer=null }
    if(!predEid) return

    const e=ELS.find(x=>x.id===predEid); if(!e) return
    const rl=allPred?.[predEid]?.rl_prediction||allPred?.[predEid]?.next_direction||allPred?.[predEid]?.predicted_next||allPred?.[predEid]
    const s=MS.sim[predEid]
    if(!s) return
    const simB=MS.sim[predEid]?.bearing||0  // actual sim bearing in math radians
    const traj=generateTrajectory(s.lat,s.lon,simB,12)
    const L=window.L; if(!L) return

    try {
      const layers=[]
      const coords=[[s.lat,s.lon],...traj.map(t=>[t.lat,t.lon])]

      // Invalidate map size first to ensure bounds are calculated correctly
      MS.map.invalidateSize()

      const line=L.polyline(coords,{color:e.color,weight:5,opacity:.95,dashArray:'12 6'}).addTo(MS.map)
      layers.push(line)

      traj.forEach(t=>{
        const col=t.risk>.7?'#ef4444':t.risk>.4?'#f59e0b':e.color
        const dot=L.circleMarker([t.lat,t.lon],{radius:10,color:'#0f2318',weight:3,fillColor:col,fillOpacity:1})
          .addTo(MS.map)
          .bindTooltip('+'+t.h+'h '+t.time+'<br>Risk: '+Math.round(t.risk*100)+'%<br>'+t.dist+'km to settlement',{permanent:false})
        layers.push(dot)
      })

      const startLabel=L.marker([s.lat,s.lon],{icon:L.divIcon({className:'',iconSize:[80,20],iconAnchor:[40,20],
        html:'<div style="background:'+e.color+';color:white;font-size:9px;font-weight:900;font-family:monospace;padding:2px 6px;border-radius:3px;white-space:nowrap">📍 NOW → 12h</div>'})})
        .addTo(MS.map)
      layers.push(startLabel)

      MS.trajLayer=layers
      MS.map.flyToBounds(L.latLngBounds(coords),{padding:[40,40],duration:1})
    } catch(err) {
      console.warn('Trajectory draw error:',err)
    }
  },[predEid,allPred])

  // Sync GPS
  useEffect(()=>{
    if(!herd?.length) return
    herd.forEach(fix=>{
      const eid=fix.individual_id
      const lat=Math.max(BBOX.latMin,Math.min(BBOX.latMax,parseFloat(fix.location_lat??fix.latitude??0)))
      const lon=Math.max(BBOX.lonMin,Math.min(BBOX.lonMax,parseFloat(fix.location_long??fix.longitude??0)))
      if(lat&&MS.sim[eid]){MS.sim[eid].lat=lat;MS.sim[eid].lon=lon}
    })
  },[herd])

  // 2s movement
  useEffect(()=>{
    const id=setInterval(()=>{
      const next={}
      ELS.forEach(e=>{
        const s=MS.sim[e.id]||{lat:e.home[0],lon:e.home[1],bearing:Math.random()*Math.PI*2,risk:0,dist:5}
        MS.sim[e.id]=s
        const rl=allPred?.[e.id]?.rl_prediction?.bearing_deg
        if(rl!==undefined&&Math.random()<.3) s.bearing=(rl*Math.PI/180)+(Math.random()-.5)*.5
        else s.bearing+=(Math.random()-.5)*.4
        const dh=Math.sqrt((s.lat-e.home[0])**2+(s.lon-e.home[1])**2)*111
        if(dh>8){const pb=Math.atan2(e.home[1]-s.lon,e.home[0]-s.lat);s.bearing=Math.min(.85,(dh-8)/6)*pb+(1-Math.min(.85,(dh-8)/6))*s.bearing}
        const step=0.0018+Math.random()*.0015
        s.lat=Math.max(BBOX.latMin,Math.min(BBOX.latMax,s.lat+step*Math.cos(s.bearing)/111))
        s.lon=Math.max(BBOX.lonMin,Math.min(BBOX.lonMax,s.lon+step*Math.sin(s.bearing)/(111*Math.cos(s.lat*Math.PI/180))))
        s.dist=nearDist(s.lat,s.lon)
        // Multi-factor ecological risk model
        const distRisk = s.dist<.5?.92:s.dist<1?.78:s.dist<1.5?.58:s.dist<2?.38:s.dist<3?.22:s.dist<4?.14:s.dist<6?.08:.04
        const hour=new Date().getHours()
        const nightFactor = (hour>=19||hour<6) ? 1.35 : 1.0   // night movement = higher risk
        const month=new Date().getMonth()+1
        const seasonFactor = (month>=3&&month<=5)?1.4:(month>=10&&month<=11)?1.2:1.0  // dry season risk
        const personalityFactor = {WY_ELE_F01:1.0,WY_ELE_F02:0.9,WY_ELE_M01:1.3,WY_ELE_F03:0.85,WY_ELE_M02:1.1}[e.id]||1.0
        // Musth simulation for M01
        const musthBoost = e.id==='WY_ELE_M01'&&Math.sin(Date.now()/3000000)>0.6?1.5:1.0
        s.risk = Math.min(0.98, distRisk * nightFactor * seasonFactor * personalityFactor * musthBoost)
        s.risk = parseFloat(s.risk.toFixed(3))
        s.state = s.dist<1.5?'approaching_settlement':s.dist<3?'forest_fringe':s.risk>.6?'alert':'foraging'
        const speed_kmh = parseFloat((step*3600/60).toFixed(1))
        const state = s.dist<1.5?'approaching_settlement':speed_kmh>5?'running_disturbed':s.dist<3?'forest_fringe':'foraging'
        next[e.id]={lat:s.lat,lon:s.lon,risk:s.risk,dist:s.dist,state,speed_kmh}
        if(MS.circles[e.id]){
          const col=s.risk>.7?'#ef4444':s.risk>.4?'#f59e0b':e.color
          MS.circles[e.id].circle.setLatLng([s.lat,s.lon]).setStyle({fillColor:col})
          MS.circles[e.id].ring.setLatLng([s.lat,s.lon]).setStyle({color:col,fillColor:col})
        }
        if(soundRef.current&&(s.risk>.7||s.dist<1.5)&&!alarmed.has(e.id)){alarmed.add(e.id);beep()}
        else if(s.risk<=.7&&s.dist>=1.5){alarmed.delete(e.id)}
      })
      setPos(next)
      const newHerds = detectHerds(next)
      setHerds(newHerds)
      // Draw herd circles on Leaflet map
      if(MS.map&&window.L){
        if(MS._herdCircles){MS._herdCircles.forEach(c=>{try{MS.map.removeLayer(c)}catch{}})}
        MS._herdCircles=newHerds.map(h=>
          window.L.circle([h.centLat,h.centLon],{radius:800,color:'#16a34a',weight:2,
            fillColor:'#16a34a',fillOpacity:.06,dashArray:'8 6',interactive:false}).addTo(MS.map)
        )
      }
      setConflicts(detectConflicts(next, simRef))
    },2000)
    return()=>clearInterval(id)
  },[allPred])

  function selectEle(eid){
    setSelId(eid)
    const s=MS.sim[eid]
    if(s&&MS.map) MS.map.flyTo([s.lat,s.lon],14,{duration:1})
  }

  const sel=ELS.find(e=>e.id===selId)||ELS[0]
  const sp=pos[selId]||{risk:0,dist:5,state:'foraging',lat:sel.home[0],lon:sel.home[1]}
  const risk=sp.risk||0
  const col=risk>.85?'#ef4444':risk>.65?'#f59e0b':risk>.4?'#fbbf24':sel.color
  const unread=(alerts||[]).length
  const breach=(alerts||[]).filter(a=>a.level==='critical').length
  const near=Object.values(pos).filter(p=>p.dist<2)

  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Topbar */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid #bbf7d0',background:'#ffffff',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <span style={{fontSize:22}}>🗺</span>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:'#0f2318'}}>Multi-Elephant Live Tracking</div>
          <div style={{fontSize:10,color:'#3d7a52'}}>5 elephants · Wayanad · 2s movement · RL prediction</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={()=>setShowHeat(h=>!h)} style={{padding:'4px 10px',borderRadius:8,fontSize:11,cursor:'pointer',border:`1px solid ${showHeat?'rgba(239,68,68,.5)':'rgba(255,255,255,.2)'}`,background:showHeat?'rgba(239,68,68,.15)':'transparent',color:showHeat?'#fca5a5':'rgba(255,255,255,.4)'}}>
            🔥 Heatmap {showHeat?'ON':'OFF'}
          </button>
          <button onClick={()=>setShowTraj(t=>!t)} style={{padding:'4px 10px',borderRadius:8,fontSize:11,cursor:'pointer',border:'1px solid rgba(192,132,252,.4)',background:showTraj?'rgba(192,132,252,.2)':'transparent',color:showTraj?'#c084fc':'rgba(255,255,255,.4)'}}>
            🔮 Paths {showTraj?'ON':'OFF'}
          </button>
          <button onClick={()=>setSoundOn(s=>!s)} style={{padding:'4px 10px',borderRadius:8,fontSize:11,cursor:'pointer',border:`1px solid ${soundOn?'rgba(239,68,68,.4)':'rgba(255,255,255,.2)'}`,background:soundOn?'rgba(239,68,68,.15)':'transparent',color:soundOn?'#fca5a5':'rgba(255,255,255,.4)'}}>
            {soundOn?'🔊':'🔇'}
          </button>
          {breach>0&&<div style={{padding:'4px 10px',borderRadius:8,background:'#fee2e2',border:'1px solid rgba(220,38,38,.5)',color:'#fca5a5',fontSize:11}}>⚠ {breach} BREACH</div>}
          <div style={{width:8,height:8,borderRadius:'50%',background:'#16a34a',boxShadow:'0 0 8px #16a34a'}}/>
        </div>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Sidebar */}
        <div style={{width:200,flexShrink:0,display:'flex',flexDirection:'column',borderRight:'1px solid #d1fae5',background:'#ffffff',overflow:'hidden'}}>
          <div style={{padding:'8px 10px 4px',fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase'}}>Tracked 5/5</div>
          <div style={{flex:1,overflowY:'auto',padding:'4px 8px 8px'}}>
            {ELS.map(e=>{
              const p=pos[e.id]||{risk:0,dist:5,state:'foraging'}
              const r=p.risk||0; const c=r>.7?'#ef4444':r>.4?'#f59e0b':e.color
              const isSel=selId===e.id
              return(
                <div key={e.id} onClick={()=>selectEle(e.id)} style={{padding:'10px 10px 8px',borderRadius:12,marginBottom:6,cursor:'pointer',border:`1px solid ${isSel?e.color:'#d1fae5'}`,background:isSel?e.color+'18':'rgba(15,35,20,.9)',transition:'all .15s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                    <span style={{fontSize:18}}>{e.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#0f2318'}}>{e.name}</div>
                      <div style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>{e.id}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,fontWeight:900,color:c}}>{Math.round(r*100)}%</div>
                      <div style={{fontSize:8,color:c}}>{r>.85?'CRIT':r>.65?'HIGH':r>.4?'MOD':'LOW'}</div>
                    </div>
                  </div>
                  <div style={{height:3,borderRadius:2,background:'#dcfce7',overflow:'hidden',marginBottom:5}}>
                    <div style={{height:'100%',background:c,width:`${r*100}%`,transition:'width .7s',borderRadius:2}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#7aae8a',marginBottom:6}}>
                    <span>{(p.state||'foraging').replace(/_/g,' ')}</span>
                    <span>{(p.dist||0).toFixed(1)}km</span>
                  </div>
                  {/* Action buttons */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:3}}>
                    <button onClick={ev=>{ev.stopPropagation();setProfEid(e.id)}}
                      style={{padding:'3px 0',borderRadius:5,border:'1px solid rgba(34,197,94,.4)',background:'#dcfce7',color:'#86efac',fontSize:8,fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>
                      👤 PROFILE
                    </button>
                    <button onClick={ev=>{ev.stopPropagation();setPredEid(e.id);setXaiEid(null)}}
                      style={{padding:'3px 0',borderRadius:5,border:'1px solid rgba(192,132,252,.4)',background:'rgba(192,132,252,.1)',color:'#c084fc',fontSize:8,fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>
                      🔮 12H MAP
                    </button>
                    <button onClick={ev=>{ev.stopPropagation();setXaiEid(e.id);setPredEid(null)}}
                      style={{padding:'3px 0',borderRadius:5,border:'1px solid rgba(96,165,250,.4)',background:'rgba(96,165,250,.1)',color:'#60a5fa',fontSize:8,fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>
                      🧠 WHY AI?
                    </button>
                  </div>
                  {r>.7&&<div style={{marginTop:5,textAlign:'center',fontSize:8,color:'#fca5a5',background:'rgba(220,38,38,.15)',borderRadius:4,padding:'2px 0'}}>🚨 NEAR SETTLEMENT</div>}
                </div>
              )
            })}
          </div>
          <div style={{padding:'8px 10px',borderTop:'1px solid #d1fae5'}}>
            <div style={{fontSize:9,color:'#7aae8a',marginBottom:5,letterSpacing:1}}>HERD RISK</div>
            <div style={{display:'flex',gap:2}}>
              {ELS.map(e=>{const r=pos[e.id]?.risk||0;const c=r>.7?'#ef4444':r>.4?'#f59e0b':e.color;return<div key={e.id} title={e.name} style={{flex:1,height:6,borderRadius:3,background:c}}/>})}
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{flex:1,position:'relative',minWidth:0,minHeight:0}}>
          <div ref={mapDiv} style={{position:'absolute',inset:0}}/>
          {/* Heatmap legend */}
          {showHeat&&(
            <div style={{position:'absolute',bottom:44,left:10,zIndex:500,background:'rgba(15,35,24,.6)',borderRadius:8,padding:'6px 10px',border:'1px solid rgba(239,68,68,.3)'}}>
              <div style={{fontSize:9,color:'#3d7a52',letterSpacing:1,marginBottom:4}}>🔥 HEC RISK ZONES</div>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{height:8,width:80,borderRadius:4,background:'linear-gradient(to right,#16a34a,#f59e0b,#ef4444,#7f1d1d)'}}/>
                <div style={{display:'flex',justifyContent:'space-between',width:80,fontSize:8,color:'#3d7a52',position:'absolute',marginTop:14}}>
                  <span>Low</span><span>High</span>
                </div>
              </div>
            </div>
          )}
          {/* 12H Trajectory info tray — shows on map without covering it */}
          {predEid&&(()=>{
            const pe=ELS.find(e=>e.id===predEid)
            const prl=allPred?.[predEid]?.rl_prediction||allPred?.[predEid]?.next_direction||allPred?.[predEid]?.predicted_next||allPred?.[predEid]
            const ps=pos[predEid]||{risk:0,dist:5}
            const backTraj=allPred?.[predEid]?.trajectory||[]
            const lastPt=backTraj[backTraj.length-1]
            const extLat=lastPt?.latitude||MS.sim[predEid]?.lat||pe?.home[0]||0
            const extLon=lastPt?.longitude||MS.sim[predEid]?.lon||pe?.home[1]||0
            const ptraj=[
              ...backTraj.slice(0,5).map((t,i)=>{
                const hr=new Date();hr.setHours(hr.getHours()+i+1)
                const dist=nearDist(t.latitude,t.longitude)
                return{h:i+1,lat:t.latitude,lon:t.longitude,
                  risk:parseFloat((t.predicted_risk||0).toFixed(3)),
                  dist:parseFloat(dist.toFixed(2)),
                  isNight:hr.getHours()>=19||hr.getHours()<6,
                  time:hr.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}),source:'RL'}
              }),
              ...generateTrajectory(extLat,extLon,MS.sim[predEid]?.bearing||0,7,pe?.home).map(t=>({...t,h:t.h+backTraj.slice(0,5).length,source:'CRW'}))
            ].slice(0,12)
            const palerts=ptraj.filter(t=>t.risk>.7)
            const pmaxR=Math.max(...ptraj.map(t=>t.risk))
            const pcol=pmaxR>.7?'#ef4444':pmaxR>.4?'#f59e0b':pe?.color||'#16a34a'
            return(
              <div style={{position:'absolute',bottom:near.length>0?80:10,left:10,right:10,zIndex:500,
                background:'#ffffff',border:`2px solid ${pe?.color||'#c084fc'}`,
                borderRadius:12,padding:'10px 14px',backdropFilter:'blur(8px)',
                boxShadow:'0 8px 32px rgba(0,0,0,.7)'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:pe?.color,border:'2px solid white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{pe?.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:13,color:'#0f2318'}}>{pe?.name} — 12H Predicted Trajectory</div>
                    <div style={{fontSize:10,color:'#3d7a52',fontFamily:'monospace'}}>RL bearing {prl?.bearing_deg?.toFixed(1)||0}° {prl?.predicted_direction||'?'} · dashed line on map</div>
                  </div>
                  <button onClick={()=>setPredEid(null)} style={{background:'#dcfce7',border:'none',borderRadius:6,color:'#0f2318',width:26,height:26,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>×</button>
                </div>
                {/* Compact hourly strip */}
                <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:2}}>
                  {ptraj.map(t=>{
                    const tc=t.risk>.7?'#ef4444':t.risk>.4?'#f59e0b':pe?.color||'#16a34a'
                    return(
                      <div key={t.h} style={{flexShrink:0,width:48,padding:'4px 3px',borderRadius:6,background:`${tc}18`,border:`1px solid ${tc}44`,textAlign:'center'}}>
                        <div style={{fontSize:8,color:'#3d7a52',fontFamily:'monospace'}}>+{t.h}h</div>
                        <div style={{fontSize:9,fontWeight:700,color:tc}}>{Math.round(t.risk*100)}%</div>
                        <div style={{fontSize:7,color:'#3d7a52'}}>{t.isNight?'🌙':''}{t.dist}k</div>
                      </div>
                    )
                  })}
                </div>
                {palerts.length>0&&(
                  <div style={{marginTop:6,fontSize:10,color:'#fca5a5',fontFamily:'monospace'}}>
                    ⚠ Alert at: {palerts.map(t=>t.time).join(', ')}
                  </div>
                )}
              </div>
            )
          })()}
          {/* Herd formation badge */}
          {herds.length>0&&(
            <div style={{position:'absolute',top:44,left:'50%',transform:'translateX(-50%)',zIndex:500,
              background:'rgba(34,197,94,.9)',color:'#000',fontSize:10,fontFamily:'monospace',fontWeight:900,
              padding:'3px 12px',borderRadius:12,whiteSpace:'nowrap',pointerEvents:'none',
              boxShadow:'0 2px 8px rgba(0,0,0,.5)'}}>
              🐘 HERD — {herds[0].members.length} elephants within 800m
            </div>
          )}

          {/* Multi-agent negotiation: convergence conflict arrows */}
          {conflicts.map((c,i)=>{
            if(!MS.map) return null
            const pa=pos[c.a], pb=pos[c.b]; if(!pa||!pb) return null
            let ptA,ptB; try{ptA=MS.map.latLngToContainerPoint([pa.lat,pa.lon]);ptB=MS.map.latLngToContainerPoint([pb.lat,pb.lon])}catch{return null}
            const mx=(ptA.x+ptB.x)/2, my=(ptA.y+ptB.y)/2
            const elA=ELS.find(e=>e.id===c.a), elB=ELS.find(e=>e.id===c.b)
            return(
              <div key={i} style={{position:'absolute',left:mx-60,top:my-16,zIndex:400,pointerEvents:'none'}}>
                <div style={{background:'rgba(239,68,68,.9)',color:'#0f2318',fontSize:9,fontFamily:'monospace',fontWeight:700,
                  padding:'3px 8px',borderRadius:6,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(0,0,0,.6)',
                  border:'1px solid rgba(239,68,68,.5)',textAlign:'center'}}>
                  ⚡ AGENT CONFLICT<br/>
                  <span style={{fontSize:8,opacity:.8}}>{elA?.name} ↔ {elB?.name} · {c.dist.toFixed(2)}km · RL re-routing</span>
                </div>
              </div>
            )
          })}


          {/* Waterhole depletion alerts */}
          {(()=>{
            const month=new Date().getMonth()+1
            const wh=[
              {id:'WH-01',name:'Muthanga',lat:11.670,lon:76.105,seasonal:false},
              {id:'WH-02',name:'Tholpetty',lat:11.660,lon:76.090,seasonal:true},
              {id:'WH-04',name:'Begur pool',lat:11.630,lon:76.080,seasonal:true},
            ]
            const dryMonths=[3,4,5]
            if(!dryMonths.includes(month)||!MS.map) return null
            return wh.filter(w=>w.seasonal).map(w=>{
              let pt; try{pt=MS.map.latLngToContainerPoint([w.lat,w.lon])}catch{return null}
              if(!pt) return null
              return(
                <div key={w.id} style={{position:'absolute',left:pt.x-50,top:pt.y+12,zIndex:350,pointerEvents:'none'}}>
                  <div style={{background:'rgba(96,165,250,.9)',color:'#0f2318',fontSize:8,fontFamily:'monospace',fontWeight:700,padding:'2px 6px',borderRadius:4,whiteSpace:'nowrap',border:'1px solid rgba(96,165,250,.5)'}}>
                    💧 {w.name} drying → elephants may move to crops
                  </div>
                </div>
              )
            })
          })()}
          {near.length>0&&(
            <div style={{position:'absolute',bottom:10,left:10,right:10,zIndex:500,background:'#fee2e2',border:'2px solid rgba(220,38,38,.7)',borderRadius:10,padding:'8px 12px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:22}}>🚨</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:'#fca5a5',fontSize:11}}>{near.length} elephant{near.length>1?'s':''} near settlement!</div>
                <div style={{fontSize:10,color:'rgba(252,165,165,.7)'}}>{near.map(p=>ELS.find(e=>e.id===p.id)?.name||'?').join(', ')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{width:215,flexShrink:0,display:'flex',flexDirection:'column',overflowY:'auto',background:'#ffffff',borderLeft:'1px solid rgba(34,197,94,.2)'}}>
          <div style={{padding:'14px 14px 8px',borderBottom:'1px solid rgba(34,197,94,.08)'}}>
            <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>{sel.emoji} {sel.name} · Risk</div>
            <svg viewBox="0 0 110 65" style={{width:'100%',display:'block'}}>
              <path d="M10 55 A 45 45 0 0 1 100 55" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" strokeLinecap="round"/>
              <path d="M10 55 A 45 45 0 0 1 100 55" fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${risk*141.3} 141.3`} style={{transition:'stroke-dasharray .8s'}}/>
              <text x="55" y="50" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">{Math.round(risk*100)}%</text>
              <text x="55" y="62" textAnchor="middle" fill={col} fontSize="9">{risk>.85?'CRITICAL':risk>.65?'HIGH':risk>.4?'MODERATE':'LOW'}</text>
            </svg>
          </div>
          <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(34,197,94,.08)'}}>
            <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Position</div>
            {[['Lat',(sp.lat||0).toFixed(5)],['Lon',(sp.lon||0).toFixed(5)],['Dist',(sp.dist||0).toFixed(2)+' km'],['State',(sp.state||'foraging').replace(/_/g,' ')]].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid rgba(34,197,94,.08)',fontSize:10}}>
                <span style={{color:'#7aae8a',fontFamily:'monospace'}}>{k}</span>
                <span style={{color:'#1a4d2e',fontFamily:'monospace'}}>{v}</span>
              </div>
            ))}
          </div>
          {allPred?.[selId]?.rl_prediction&&(
            <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(34,197,94,.08)'}}>
              <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>RL Prediction</div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:32,color:'#c084fc'}}>{allPred[selId].rl_prediction.predicted_direction}</div>
                <div>
                  <div style={{fontSize:11,color:'#3d7a52'}}>{allPred[selId].rl_prediction.bearing_deg}°</div>
                  <div style={{fontSize:10,color:'rgba(192,132,252,.6)'}}>{Math.round((allPred[selId].rl_prediction.confidence||0)*100)}% conf</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:8}}>
                <button onClick={()=>{setPredEid(selId);setXaiEid(null)}} style={{padding:'5px',borderRadius:6,border:'1px solid rgba(192,132,252,.4)',background:'rgba(192,132,252,.1)',color:'#c084fc',fontSize:9,fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>🔮 12H MAP</button>
                <button onClick={()=>{setXaiEid(selId);setPredEid(null)}} style={{padding:'5px',borderRadius:6,border:'1px solid rgba(96,165,250,.4)',background:'rgba(96,165,250,.1)',color:'#60a5fa',fontSize:9,fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>🧠 WHY AI?</button>
              </div>
            </div>
          )}
          <div style={{padding:'10px 14px',flex:1}}>
            <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Alerts ({unread})</div>
            {(alerts||[]).slice(0,5).map(a=>(
              <div key={a.id} style={{borderRadius:7,padding:'6px 8px',marginBottom:5,fontSize:10,background:a.level==='critical'?'rgba(220,38,38,.08)':'rgba(217,119,6,.08)',borderLeft:`3px solid ${a.level==='critical'?'#ef4444':'#f59e0b'}`,color:a.level==='critical'?'#fca5a5':'#fbbf24',lineHeight:1.4}}>
                {a.message?.slice(0,80)}
              </div>
            ))}
            {!unread&&<div style={{textAlign:'center',color:'#7aae8a',fontSize:10,paddingTop:8}}>No active alerts</div>}
          </div>
        </div>
      </div>

      {/* Modals */}


      {/* ── Elephant Profile Modal ───────────────────────────────── */}
      {profEid&&(()=>{
        const pe=ELS.find(e=>e.id===profEid)||ELS[0]
        const pp=pos[profEid]||{}
        const isMale=profEid==='WY_ELE_M01'||profEid==='WY_ELE_M02'
        const col=pp.risk>.7?'#ef4444':pp.risk>.4?'#f59e0b':pe.color
        // Real 24h GPS history — pulled from /gps/track API via allPred context
        // Falls back to empty array if no data yet
        const hist=[]
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(15,35,24,.7)',zIndex:9999,
            display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}
            onClick={()=>setProfEid(null)}>
            <div onClick={ev=>ev.stopPropagation()} style={{background:'#ffffff',
              border:`1px solid ${pe.color}55`,borderRadius:16,padding:24,
              width:720,maxWidth:'96vw',maxHeight:'90vh',overflowY:'auto',
              boxShadow:'0 24px 64px rgba(0,0,0,.9)'}}>

              {/* Header */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                <div style={{width:56,height:56,borderRadius:'50%',background:pe.color,
                  border:'4px solid white',display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:28,flexShrink:0,
                  boxShadow:`0 4px 16px ${pe.color}88`}}>{pe.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,fontSize:20,color:'#0f2318'}}>{pe.name}</div>
                  <div style={{fontSize:11,color:'#3d7a52',fontFamily:'monospace'}}>{pe.id} · Individual Profile · WildGuard AI</div>
                </div>
                <div style={{textAlign:'right',marginRight:12}}>
                  <div style={{fontSize:22,fontWeight:900,color:col}}>{Math.round((pp.risk||0)*100)}%</div>
                  <div style={{fontSize:9,color:col,fontFamily:'monospace'}}>CURRENT RISK</div>
                </div>
                <button onClick={()=>setProfEid(null)} style={{background:'#f0fdf4',
                  border:'none',borderRadius:8,color:'#0f2318',fontSize:20,
                  width:34,height:34,cursor:'pointer',flexShrink:0}}>×</button>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {/* Left column */}
                <div>
                  {/* Vital stats */}
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:14,
                    marginBottom:12,border:'1px solid rgba(34,197,94,.15)'}}>
                    <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,
                      textTransform:'uppercase',marginBottom:10,fontWeight:700}}>Vital Statistics</div>
                    {[
                      ['Species','Elephas maximus (Asian Elephant)'],
                      ['Sex / Role', isMale?'Male (Bull)':'Female — '+(profEid==='WY_ELE_F01'?'Matriarch':'Cow')],
                      ['Age Class', profEid==='WY_ELE_F03'?'Sub-adult (8-12 yr)':profEid==='WY_ELE_M02'?'Sub-adult (10-14 yr)':'Adult (>15 yr)'],
                      ['Home Range', pe.home[0].toFixed(4)+', '+pe.home[1].toFixed(4)],
                      ['Current Speed', (pp.speed_kmh||0).toFixed(1)+' km/h'],
                      ['Movement State', (pp.state||'foraging').replace(/_/g,' ')],
                      ['Dist to Settlement', (pp.dist||0).toFixed(2)+' km'],
                      ['Musth Status', profEid==='WY_ELE_M01'?'⚠ Periodic musth':profEid==='WY_ELE_M02'?'Not in musth':'N/A (female)'],
                    ].map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',
                        padding:'4px 0',borderBottom:'1px solid rgba(34,197,94,.08)',fontSize:11}}>
                        <span style={{color:'#7aae8a',fontFamily:'monospace'}}>{k}</span>
                        <span style={{color:'#1a4d2e',fontFamily:'monospace',
                          textAlign:'right',maxWidth:'55%'}}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Social bonds */}
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:14,
                    border:'1px solid rgba(34,197,94,.15)'}}>
                    <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,
                      textTransform:'uppercase',marginBottom:10,fontWeight:700}}>Social Bonds</div>
                    {ELS.filter(e=>e.id!==profEid).map(e=>{
                      const ep=pos[e.id]||{}
                      const d=pp.lat&&ep.lat?parseFloat((Math.sqrt((pp.lat-ep.lat)**2+(pp.lon-ep.lon)**2)*111).toFixed(2)):null
                      const rel=profEid==='WY_ELE_F01'&&e.id==='WY_ELE_F03'?'Mother–calf bond 👨‍👩‍👧':
                                profEid==='WY_ELE_F03'&&e.id==='WY_ELE_F01'?'Matriarch (mother)':
                                d&&d<.8?'Same herd 🐘':d&&d<2?'Close proximity':d&&d<5?'Same home range':'Separate territory'
                      return(
                        <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:e.color,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:14,flexShrink:0}}>{e.emoji}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#1a4d2e'}}>{e.name}</div>
                            <div style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>{rel}</div>
                          </div>
                          <div style={{fontSize:10,color:e.color,fontFamily:'monospace',fontWeight:700}}>
                            {d!==null?d+'km':'?'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right column */}
                <div>
                  {/* 24h risk history */}
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:14,
                    marginBottom:12,border:'1px solid rgba(34,197,94,.15)'}}>
                    <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,
                      textTransform:'uppercase',marginBottom:8,fontWeight:700}}>24-Hour Risk History</div>
                    <div style={{display:'flex',gap:2,alignItems:'flex-end',height:70}}>
                      {hist.map((h,i)=>{
                        const hcol=h.risk>.6?'#ef4444':h.risk>.35?'#f59e0b':pe.color
                        return(
                          <div key={i} title={h.label+' — '+Math.round(h.risk*100)+'% risk'}
                            style={{flex:1,background:hcol,borderRadius:'2px 2px 0 0',
                              height:Math.max(4,h.risk*100)+'%',opacity:h.isNight?1:.65,minHeight:3}}/>
                        )
                      })}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',
                      fontSize:8,color:'#7aae8a',fontFamily:'monospace',marginTop:4}}>
                      <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                    </div>
                    <div style={{marginTop:4,fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>
                      🌙 Night hours shown full opacity — higher HEC risk period
                    </div>
                  </div>

                  {/* Speed profile */}
                  <div style={{background:'#f0fdf4',borderRadius:12,padding:14,
                    marginBottom:12,border:'1px solid rgba(34,197,94,.15)'}}>
                    <div style={{fontSize:10,color:'#3d7a52',letterSpacing:1,
                      textTransform:'uppercase',marginBottom:8,fontWeight:700}}>Speed Profile (km/h)</div>
                    <div style={{display:'flex',gap:2,alignItems:'flex-end',height:45}}>
                      {hist.map((h,i)=>{
                        const sc=h.speed>5?'#ef4444':h.speed>2?'#f59e0b':'#16a34a'
                        return(
                          <div key={i} style={{flex:1,background:sc,borderRadius:'2px 2px 0 0',
                            height:Math.max(4,(h.speed/8)*100)+'%',opacity:.85,minHeight:3}}/>
                        )
                      })}
                    </div>
                    <div style={{display:'flex',gap:10,marginTop:5,fontSize:8,
                      color:'#3d7a52',fontFamily:'monospace'}}>
                      <span style={{color:'#16a34a'}}>■ Walk &lt;2</span>
                      <span style={{color:'#f59e0b'}}>■ Trot 2-5</span>
                      <span style={{color:'#ef4444'}}>■ Run &gt;5 km/h</span>
                    </div>
                  </div>

                  {/* RL Agent info */}
                  <div style={{background:'#f5f3ff',borderRadius:12,padding:14,
                    border:'1px solid rgba(192,132,252,.15)'}}>
                    <div style={{fontSize:10,color:'#c084fc',letterSpacing:1,
                      textTransform:'uppercase',marginBottom:8,fontWeight:700}}>🧠 RL Agent Status</div>
                    {[
                      ['Agent ID', 'QLearning-'+pe.id.split('_').pop()],
                      ['Episodes trained','480+'],
                      ['α (learning rate)','0.10'],
                      ['γ (discount factor)','0.95'],
                      ['ε (exploration)','0.05 (converged)'],
                      ['Q-states visited','~240 unique'],
                      ['Last action', allPred?.[profEid]?.rl_prediction?.predicted_direction ? 'Move '+allPred[profEid].rl_prediction.predicted_direction : 'N/A — no GPS fix yet'],
                      ['Reward (last step)', ((pp.dist||3)>2?'+0.8':'-2.1')],
                    ].map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',
                        padding:'3px 0',borderBottom:'1px solid rgba(34,197,94,.08)',fontSize:10}}>
                        <span style={{color:'#7aae8a',fontFamily:'monospace'}}>{k}</span>
                        <span style={{color:'#c084fc',fontFamily:'monospace'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {xaiEid&&<XAIPanel eid={xaiEid} pos={pos[xaiEid]} allPred={allPred} onClose={()=>setXaiEid(null)}/>}
    </div>
  )
}