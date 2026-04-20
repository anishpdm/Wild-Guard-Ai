// SocialPage.jsx — WildGuard AI v5 — Corridor Health Map + Social Dynamics
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
const authH=()=>({Authorization:`Bearer ${localStorage.getItem('wg_access_token')}`})

const CORRIDORS=[
  {id:'COR-01',name:'Wayanad–Nagarhole',health:0.65,lat1:11.75,lon1:76.08,lat2:11.90,lon2:76.15,threat:'Encroachment',length:'28 km'},
  {id:'COR-02',name:'Wayanad–Mudumalai',health:0.42,lat1:11.57,lon1:76.35,lat2:11.45,lon2:76.50,threat:'Road fragmentation',length:'35 km'},
  {id:'COR-03',name:'Tholpetty–Brahmagiri',health:0.80,lat1:11.77,lon1:76.02,lat2:11.85,lon2:75.95,threat:'Low threat',length:'18 km'},
  {id:'COR-04',name:'Muthanga–Bandipur',health:0.30,lat1:11.67,lon1:76.37,lat2:11.70,lon2:76.55,threat:'Highway NH-212',length:'42 km'},
]
const ELS=[
  {id:'WY_ELE_F01',name:'Lakshmi',color:'#16a34a',emoji:'🐘',home:[11.658,76.228]},
  {id:'WY_ELE_F02',name:'Kaveri', color:'#60a5fa',emoji:'🐘',home:[11.628,76.192]},
  {id:'WY_ELE_M01',name:'Arjun',  color:'#f59e0b',emoji:'🦣',home:[11.702,76.158]},
  {id:'WY_ELE_F03',name:'Ganga',  color:'#c084fc',emoji:'🐘',home:[11.668,76.163]},
  {id:'WY_ELE_M02',name:'Rajan',  color:'#fb923c',emoji:'🦣',home:[11.738,76.162]},
]

function corColor(h){return h>.7?'#16a34a':h>.5?'#f59e0b':h>.35?'#ef4444':'#7f1d1d'}

export default function SocialPage(){
  const mapRef=useRef(null)
  const mapDivRef=useRef(null)
  const [tick,setTick]=useState(0)
  const {data:social}=useQuery({queryKey:['social'],queryFn:()=>fetch('/api/social/analyse',{headers:authH()}).then(r=>r.json()),refetchInterval:15000})

  useEffect(()=>{
    if(!mapDivRef.current) return
    if(mapRef.current){ try{mapRef.current.remove()}catch{} mapRef.current=null }
    function boot(L){
      const map=L.map(mapDivRef.current,{center:[11.680,76.190],zoom:11})
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map)

      // Draw corridors as colored polylines
      CORRIDORS.forEach(cor=>{
        const col=corColor(cor.health)
        const line=L.polyline([[cor.lat1,cor.lon1],[cor.lat2,cor.lon2]],{
          color:col,weight:8,opacity:.75,
          dashArray:cor.health<.5?'12 6':null,
        }).addTo(map)
        line.bindTooltip(`<b>${cor.name}</b><br>Health: ${Math.round(cor.health*100)}%<br>Length: ${cor.length}<br>Threat: ${cor.threat}`,{sticky:true})

        // Health indicator at midpoint
        const midLat=(cor.lat1+cor.lat2)/2, midLon=(cor.lon1+cor.lon2)/2
        L.marker([midLat,midLon],{icon:L.divIcon({className:'',iconSize:[50,20],iconAnchor:[25,10],
          html:`<div style="background:${col};color:#000;font-size:8px;font-weight:900;font-family:monospace;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,.5)">${Math.round(cor.health*100)}% ${cor.id}</div>`
        })}).addTo(map)

        // Corridor blockage warning
        if(cor.health<.5){
          L.marker([(cor.lat1+cor.lat2)/2+.02,(cor.lon1+cor.lon2)/2],{
            icon:L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],
              html:'<div style="font-size:18px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))">⛔</div>'})
          }).addTo(map).bindPopup(`<b>⛔ ${cor.name}</b><br>BLOCKED — ${cor.threat}`)
        }
      })

      // WLS boundary
      L.polygon([[11.60,76.04],[11.65,76.07],[11.68,76.08],[11.72,76.07],[11.76,76.05],[11.79,76.08],[11.78,76.16],[11.74,76.20],[11.69,76.22],[11.64,76.22],[11.60,76.20],[11.58,76.14],[11.60,76.04]],
        {color:'#16a34a',weight:1.5,fillColor:'#16a34a',fillOpacity:.05,dashArray:'6 3'})
        .addTo(map).bindTooltip('WLS Forest Core')

      // Elephant markers
      ELS.forEach(e=>{
        L.circleMarker(e.home,{radius:10,color:'#fff',weight:3,fillColor:e.color,fillOpacity:1})
          .addTo(map)
          .bindTooltip(e.emoji+' '+e.name,{permanent:true,direction:'top',offset:[0,-12],
            className:'',opacity:1})
      })

      mapRef.current=map
      map.on('move zoom',()=>setTick(t=>t+1))
    }
    if(window.L){boot(window.L);return}
    if(!document.getElementById('lf-css2')){
      const l=document.createElement('link');l.id='lf-css2';l.rel='stylesheet'
      l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l)
    }
    const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    sc.onload=()=>boot(window.L);document.head.appendChild(sc)
    return()=>{
      try{if(mapRef.current){mapRef.current.remove();mapRef.current=null}}catch(e){}
      if(mapDivRef.current){mapDivRef.current.innerHTML=''}
    }
  },[])

  const musth=social?.musth_status||{}
  const pairs=social?.pair_distances||[]
  const herdEvents=social?.herd_events||[]

  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#f0fdf4'}}>
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid #d1fae5',background:'#f0fdf4'}}>
        <span style={{fontSize:22}}>🌿</span>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:'#0f2318'}}>Social Dynamics & Corridor Health</div>
          <div style={{fontSize:10,color:'#3d7a52'}}>Wildlife corridors · Herd formation · Musth tracking · Inter-elephant distances</div>
        </div>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Left: corridor list */}
        <div style={{width:260,flexShrink:0,overflowY:'auto',padding:12,borderRight:'1px solid #d1fae5',background:'#ffffff'}}>
          <div style={{fontSize:9,color:'#7aae8a',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Wildlife Corridors</div>
          {CORRIDORS.map(cor=>{
            const col=corColor(cor.health)
            return(
              <div key={cor.id} onClick={()=>mapRef.current?.flyTo([(cor.lat1+cor.lat2)/2,(cor.lon1+cor.lon2)/2],12,{duration:.8})}
                style={{borderRadius:10,border:`1px solid ${col}44`,padding:10,marginBottom:8,background:`${col}08`,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:'#1a4d2e'}}>{cor.name}</span>
                  <span style={{fontSize:12,fontWeight:900,color:col}}>{Math.round(cor.health*100)}%</span>
                </div>
                <div style={{height:5,borderRadius:3,background:'#f0fdf4',overflow:'hidden',marginBottom:5}}>
                  <div style={{height:'100%',background:col,width:`${cor.health*100}%`,borderRadius:3}}/>
                </div>
                <div style={{fontSize:9,color:'#7aae8a',fontFamily:'monospace'}}>{cor.length} · {cor.threat}</div>
                {cor.health<.5&&<div style={{marginTop:4,fontSize:8,color:'#fca5a5',background:'rgba(239,68,68,.15)',borderRadius:3,padding:'1px 5px',textAlign:'center'}}>⛔ DEGRADED</div>}
              </div>
            )
          })}

          {/* Corridor health legend */}
          <div style={{fontSize:9,color:'#7aae8a',letterSpacing:1,textTransform:'uppercase',marginBottom:6,marginTop:8}}>Health Legend</div>
          {[['#16a34a','>70% Healthy'],['#f59e0b','50-70% Degraded'],['#ef4444','35-50% Critical'],['#7f1d1d','<35% Blocked']].map(([c,l])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <div style={{width:20,height:4,borderRadius:2,background:c}}/>
              <span style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>{l}</span>
            </div>
          ))}

          {/* Musth status */}
          <div style={{fontSize:9,color:'#7aae8a',letterSpacing:1,textTransform:'uppercase',marginBottom:6,marginTop:12}}>Musth Status</div>
          {['WY_ELE_M01','WY_ELE_M02'].map(eid=>{
            const el=ELS.find(e=>e.id===eid)
            const ms=musth[eid]||{}
            return(
              <div key={eid} style={{borderRadius:8,border:`1px solid ${ms.in_musth?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,padding:8,marginBottom:6,background:ms.in_musth?'rgba(239,68,68,.08)':'rgba(15,35,20,.9)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:16}}>{el?.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#1a4d2e'}}>{el?.name}</div>
                    <div style={{fontSize:9,fontFamily:'monospace',color:ms.in_musth?'#fca5a5':'rgba(255,255,255,.3)'}}>
                      {ms.in_musth?`🔴 IN MUSTH (${Math.round((ms.intensity||0)*100)}% intensity)`:'✅ Normal'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Herd events */}
          {herdEvents.length>0&&(
            <>
              <div style={{fontSize:9,color:'#7aae8a',letterSpacing:1,textTransform:'uppercase',marginBottom:6,marginTop:8}}>Herd Events</div>
              {herdEvents.slice(0,3).map((ev,i)=>(
                <div key={i} style={{borderRadius:7,border:'1px solid rgba(34,197,94,.2)',padding:7,marginBottom:5,background:'rgba(34,197,94,.05)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#86efac',marginBottom:2}}>🐘 {ev.event_type||'Herd Formation'}</div>
                  <div style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace'}}>{ev.description||'Group movement detected'}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Map */}
        <div style={{flex:1,position:'relative',minWidth:0,minHeight:0}}>
          <div ref={mapDivRef} style={{position:'absolute',inset:0}}/>
          {/* Corridor health summary overlay */}
          <div style={{position:'absolute',top:8,right:8,zIndex:500,background:'rgba(15,35,24,.65)',borderRadius:10,padding:'8px 12px',border:'1px solid #bbf7d0'}}>
            <div style={{fontSize:9,color:'#3d7a52',letterSpacing:1,marginBottom:6}}>CORRIDOR HEALTH</div>
            {CORRIDORS.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <div style={{width:24,height:3,borderRadius:2,background:corColor(c.health)}}/>
                <span style={{fontSize:9,color:'#3d7a52',fontFamily:'monospace',flex:1}}>{c.id}</span>
                <span style={{fontSize:9,fontWeight:700,color:corColor(c.health)}}>{Math.round(c.health*100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: pair distances */}
        <div style={{width:220,flexShrink:0,overflowY:'auto',padding:12,borderLeft:'1px solid #d1fae5',background:'#ffffff'}}>
          <div style={{fontSize:9,color:'#7aae8a',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Inter-Elephant Distances</div>
          {pairs.length>0?pairs.slice(0,8).map((p,i)=>{
            const col=p.distance_km<0.5?'#ef4444':p.distance_km<1?'#f59e0b':p.distance_km<3?'#fbbf24':'#16a34a'
            return(
              <div key={i} style={{borderRadius:8,border:`1px solid ${col}33`,padding:8,marginBottom:6,background:`${col}08`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:10,color:'#3d7a52',fontFamily:'monospace'}}>{p.elephant_a?.split('_').pop()} ↔ {p.elephant_b?.split('_').pop()}</span>
                  <span style={{fontSize:11,fontWeight:700,color:col}}>{p.distance_km?.toFixed(2)}km</span>
                </div>
                <div style={{height:3,borderRadius:2,background:'#f0fdf4',overflow:'hidden'}}>
                  <div style={{height:'100%',background:col,width:`${Math.min(100,100-p.distance_km*12)}%`}}/>
                </div>
                <div style={{fontSize:8,color:'#7aae8a',fontFamily:'monospace',marginTop:2}}>
                  {p.distance_km<0.5?'⚡ Conflict risk':p.distance_km<1?'🐘 Herd proximity':p.distance_km<3?'Close range':'Separate territory'}
                </div>
              </div>
            )
          }):(
            // Simulated pairs if API not available
            ELS.flatMap((a,i)=>ELS.slice(i+1).map(b=>{
              const d=parseFloat((0.5+Math.random()*6).toFixed(2))
              const col=d<0.5?'#ef4444':d<1?'#f59e0b':d<3?'#fbbf24':'#16a34a'
              return(
                <div key={a.id+b.id} style={{borderRadius:8,border:`1px solid ${col}33`,padding:8,marginBottom:6,background:`${col}08`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:10,color:'#3d7a52'}}>{a.emoji}{a.name.slice(0,4)} ↔ {b.emoji}{b.name.slice(0,4)}</span>
                    <span style={{fontSize:11,fontWeight:700,color:col}}>{d}km</span>
                  </div>
                  <div style={{height:3,borderRadius:2,background:'#f0fdf4',overflow:'hidden'}}>
                    <div style={{height:'100%',background:col,width:`${Math.min(100,100-d*12)}%`}}/>
                  </div>
                </div>
              )
            }))
          )}
        </div>
      </div>
    </div>
  )
}