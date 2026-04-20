// SensorsPage.jsx — WildGuard AI v5
// ESP8266 DHT11 live feed + AI predictions from sensor data
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, ReferenceLine } from 'recharts'
import { useSensors, useSensorStats } from '@/hooks/useAPI'

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('wg_access_token')}` })

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Compute predictions from sensor data ─────────────────────────
function computePredictions(esp) {
  if (!esp) return null
  const t = esp.temperature, h = esp.humidity
  const hour = new Date().getHours()
  const month = new Date().getMonth() + 1
  const isNight = hour >= 19 || hour < 6

  // 1. Waterhole depletion risk
  const waterholeRisk = Math.min(1, Math.max(0,
    (t > 30 ? (t - 30) * 0.04 : 0) + (h < 60 ? (60 - h) * 0.01 : 0)
  ))

  // 2. Elephant heat stress
  const heatStress = t > 38 ? 'CRITICAL' : t > 35 ? 'HIGH' : t > 32 ? 'MODERATE' : 'LOW'
  const heatStressScore = t > 38 ? 0.95 : t > 35 ? 0.75 : t > 32 ? 0.45 : 0.15

  // 3. Crop raid probability (temp + humidity + crop season)
  const cropSeason = [3,4,5,6].includes(month) // banana ripening
  const raidProb = Math.min(0.98, Math.max(0.05,
    (t > 33 ? 0.3 : 0.1) + (h < 40 ? 0.25 : 0.1) + (cropSeason ? 0.3 : 0.05) + (isNight ? 0.15 : 0)
  ))

  // 4. Active movement window prediction
  // Elephants move when temp drops — peak activity 2-3h after sunset
  const movementRisk = isNight ? Math.min(0.95, 0.4 + (40-t)*0.02 + (100-h)*0.005) : 0.15

  // 5. HEC risk composite
  const hecRisk = Math.min(0.98, (waterholeRisk*0.3 + raidProb*0.4 + movementRisk*0.3))

  // 6. Waterhole days remaining
  const daysLeft = Math.max(0, Math.round(20 - (t - 25) * 1.2 - (60 - h) * 0.3))

  // 7. 24h temperature forecast (sinusoidal model)
  const tempForecast = Array.from({length:24}, (_,i) => {
    const futureHour = (hour + i) % 24
    const dayTemp = t + 4 * Math.sin((futureHour - 14) * Math.PI / 12) // peak at 2pm
    return {
      hour: futureHour.toString().padStart(2,'0') + ':00',
      temp: parseFloat(dayTemp.toFixed(1)),
      risk: parseFloat(Math.min(0.95, Math.max(0.05,
        (dayTemp > 33 ? 0.3 : 0.1) + (futureHour >= 19 || futureHour < 6 ? 0.4 : 0)
      )).toFixed(2))
    }
  })

  return { waterholeRisk, heatStress, heatStressScore, raidProb, movementRisk, hecRisk, daysLeft, tempForecast, cropSeason }
}

// ── Circular gauge ────────────────────────────────────────────────
function Gauge({ value, label, color, size=80 }) {
  const r = size*0.4, cx = size/2, cy = size/2
  const circ = 2*Math.PI*r, dash = circ*value
  return (
    <div style={{textAlign:'center'}}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0fdf4" strokeWidth={size*0.08}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size*0.08}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{transition:'stroke-dasharray .8s'}}/>
        <text x={cx} y={cy+2} textAnchor="middle" fill={color} fontSize={size*0.18} fontWeight="900">{Math.round(value*100)}%</text>
      </svg>
      <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',marginTop:2}}>{label}</div>
    </div>
  )
}

// ── Risk card ─────────────────────────────────────────────────────
function RiskCard({ icon, title, value, label, color, bg, desc, extra }) {
  return (
    <div style={{borderRadius:12,border:`1px solid ${color}33`,background:bg,padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:20}}>{icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:700,color:'#0f2318'}}>{title}</div>
          <div style={{fontSize:9,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>{desc}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:20,fontWeight:900,color,fontFamily:'Syne,sans-serif'}}>{value}</div>
          <div style={{fontSize:9,color,fontFamily:'DM Mono,monospace',fontWeight:700}}>{label}</div>
        </div>
      </div>
      <div style={{height:6,borderRadius:3,background:'rgba(0,0,0,.06)',overflow:'hidden'}}>
        <div style={{height:'100%',background:color,width:`${typeof value==='string'?60:value}%`,borderRadius:3,transition:'width .8s'}}/>
      </div>
      {extra&&<div style={{marginTop:6,fontSize:10,color:'#374151'}}>{extra}</div>}
    </div>
  )
}

// ── ESP Live Widget ───────────────────────────────────────────────
function ESPLiveWidget({ data }) {
  const connected = data && (Date.now() - new Date(data.timestamp).getTime()) < 30000
  const t = data?.temperature ?? null
  const h = data?.humidity    ?? null
  const hi= data?.heat_index  ?? null
  const tempCol = t>35?'#ef4444':t>32?'#f59e0b':'#16a34a'
  const humCol  = h<30?'#ef4444':h<50?'#f59e0b':'#3b82f6'

  return(
    <div style={{borderRadius:16,border:`2px solid ${connected?'#22c55e':'#e5e7eb'}`,
      background:'#ffffff',padding:20,
      boxShadow:connected?'0 0 0 4px rgba(34,197,94,.08),0 4px 16px rgba(0,0,0,.06)':'0 2px 8px rgba(0,0,0,.04)'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <div style={{width:48,height:48,borderRadius:13,
          background:'linear-gradient(135deg,#dcfce7,#bbf7d0)',
          border:'2px solid #86efac',display:'flex',alignItems:'center',
          justifyContent:'center',fontSize:24}}>🔌</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:15,color:'#0f2318',fontFamily:'Syne,sans-serif'}}>
            ESP8266 + DHT11 — Live Reading
          </div>
          <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
            {data?.device_id??'ESP-DHT11-WY-01'} · {data?.location??'Wayanad Forest Station'}
          </div>
          {data?.timestamp&&<div style={{fontSize:9,color:'#9ec4aa',fontFamily:'DM Mono,monospace',marginTop:1}}>
            Updated: {new Date(data.timestamp).toLocaleTimeString('en-IN',{hour12:false})}
          </div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,
          background:connected?'#dcfce7':'#f3f4f6',
          border:`1px solid ${connected?'#86efac':'#e5e7eb'}`}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:connected?'#22c55e':'#9ca3af',
            display:'inline-block',animation:connected?'pulse-dot 2s infinite':'none',
            boxShadow:connected?'0 0 6px rgba(34,197,94,.8)':'none'}}/>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',fontWeight:700,
            color:connected?'#15803d':'#6b7280'}}>{connected?'LIVE':'OFFLINE'}</span>
        </div>
      </div>

      {/* Big reading cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
        {[
          {icon:'🌡',val:t!==null?`${t}°C`:'--',label:'Temperature',
           bg:t>35?'#fef2f2':t>32?'#fffbeb':'#f0fdf4',col:tempCol,
           status:t>35?'🚨 Heat stress':t>32?'⚠ Warm':'✅ Normal'},
          {icon:'💧',val:h!==null?`${h}%`:'--',label:'Humidity',
           bg:h<30?'#fef2f2':h<50?'#fffbeb':'#eff6ff',col:humCol,
           status:h<30?'🚨 Critically low':h<50?'⚠ Low':'✅ Normal'},
          {icon:'🔥',val:hi!==null?`${hi}°C`:'--',label:'Heat Index',
           bg:'#fffbeb',col:'#d97706',
           status:'Feels-like temp'},
        ].map(({icon,val,label,bg,col,status})=>(
          <div key={label} style={{borderRadius:12,border:`1px solid ${col}33`,background:bg,padding:12,textAlign:'center'}}>
            <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
            <div style={{fontSize:28,fontWeight:900,color:col,lineHeight:1,fontFamily:'Syne,sans-serif'}}>{val}</div>
            <div style={{fontSize:11,fontWeight:700,color:col,marginTop:3}}>{label}</div>
            <div style={{fontSize:9,color:'#6b7280',marginTop:4,fontFamily:'DM Mono,monospace'}}>{status}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {data?.alert&&(
        <div style={{padding:'10px 14px',borderRadius:10,background:'#fef2f2',
          border:'1px solid #fca5a5',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>🚨</span>
          <div>
            <div style={{fontWeight:700,color:'#dc2626',fontSize:12}}>Ecological Alert Active</div>
            <div style={{fontSize:11,color:'#ef4444'}}>{data.alert_reason}</div>
          </div>
        </div>
      )}

      {/* Connection info */}
      {data&&(
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
          {[['📡 WiFi',`${data.wifi_rssi} dBm`,'#3b82f6'],
            ['⏱ Uptime',`${Math.floor((data.uptime_s||0)/60)}m ${(data.uptime_s||0)%60}s`,'#16a34a'],
            ['🔑 Device',data.device_id,'#7c3aed']].map(([k,v,c])=>(
            <div key={k} style={{flex:1,minWidth:90,padding:'5px 8px',borderRadius:7,
              background:'#f8fafc',border:'1px solid #e2e8f0'}}>
              <div style={{fontSize:8,color:'#94a3b8',fontFamily:'DM Mono,monospace'}}>{k}</div>
              <div style={{fontSize:11,fontWeight:700,color:c,fontFamily:'DM Mono,monospace'}}>{v}</div>
            </div>
          ))}
        </div>
      )}


    </div>
  )
}

// ── AI Predictions Panel ──────────────────────────────────────────
function PredictionsPanel({ esp, preds, mlPred, modelInfo }) {
  if (!preds) return (
    <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:20,textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:8}}>🧠</div>
      <div style={{fontSize:13,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
        Connect ESP8266 to enable AI predictions
      </div>
    </div>
  )

  const raidCol = preds.raidProb>0.7?'#ef4444':preds.raidProb>0.4?'#f59e0b':'#16a34a'
  const hecCol  = preds.hecRisk>0.7?'#ef4444':preds.hecRisk>0.4?'#f59e0b':'#16a34a'
  const whCol   = preds.waterholeRisk>0.6?'#ef4444':preds.waterholeRisk>0.3?'#f59e0b':'#3b82f6'
  const hsCol   = preds.heatStress==='CRITICAL'?'#ef4444':preds.heatStress==='HIGH'?'#f97316':preds.heatStress==='MODERATE'?'#f59e0b':'#16a34a'

  return(
    <div style={{display:'grid',gap:12}}>

      {/* Summary gauges */}
      <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:18}}>
        <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
          textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:16}}>
          🧠 AI Predictions from Sensor Data
        </div>
        <div style={{display:'flex',justifyContent:'space-around',flexWrap:'wrap',gap:12}}>
          <Gauge value={preds.hecRisk}     label="HEC Risk"         color={hecCol}/>
          <Gauge value={preds.raidProb}    label="Crop Raid Prob"   color={raidCol}/>
          <Gauge value={preds.waterholeRisk} label="Waterhole Risk" color={whCol}/>
          <Gauge value={preds.heatStressScore} label="Heat Stress"  color={hsCol}/>
        </div>
      </div>

      {/* ML Model info panel */}
      {mlPred&&(
        <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#f0fdf4',padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:800,color:'#0f2318'}}>
                🤖 Logistic Regression Model — Live Result
              </div>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
                {mlPred.method} · {modelInfo?.data_source==='mysql_real' ? '✅ Trained on REAL MySQL data' : '⚠ Using synthetic fallback (DB empty)'} · {mlPred.training_samples} samples · CV Accuracy: {Math.round((mlPred.model_accuracy||0)*100)}%
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:28,fontWeight:900,fontFamily:'Syne,sans-serif',
                color:mlPred.hec_probability>0.7?'#ef4444':mlPred.hec_probability>0.4?'#f59e0b':'#16a34a'}}>
                {Math.round((mlPred.hec_probability||0)*100)}%
              </div>
              <div style={{fontSize:10,fontWeight:700,fontFamily:'DM Mono,monospace',
                color:mlPred.hec_probability>0.7?'#ef4444':mlPred.hec_probability>0.4?'#f59e0b':'#16a34a'}}>
                {mlPred.risk_level} RISK
              </div>
            </div>
          </div>

          {/* Model equation */}
          {modelInfo&&(
            <div style={{padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,.7)',
              border:'1px solid #bbf7d0',marginBottom:10}}>
              <div style={{fontSize:9,color:'#3d7a52',fontFamily:'DM Mono,monospace',fontWeight:700,marginBottom:3}}>
                MODEL EQUATION
              </div>
              <div style={{fontSize:10,color:'#0f2318',fontFamily:'DM Mono,monospace'}}>
                {modelInfo.equation}
              </div>
            </div>
          )}

          {/* Top drivers */}
          {mlPred.top_drivers?.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',fontWeight:700,marginBottom:6}}>
                TOP RISK DRIVERS (SHAP)
              </div>
              {mlPred.top_drivers.map(([name,val])=>(
                <div key={name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <span style={{fontSize:10,color:'#1a4d2e',fontFamily:'DM Mono,monospace',width:180,flexShrink:0}}>{name}</span>
                  <div style={{flex:1,height:6,borderRadius:3,background:'#d1fae5',overflow:'hidden'}}>
                    <div style={{height:'100%',background:'#16a34a',width:`${Math.min(100,val*200)}%`,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#3d7a52',width:40,textAlign:'right'}}>{val.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Feature values */}
          {mlPred.features&&(
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {Object.entries(mlPred.features).slice(0,6).map(([k,v])=>(
                <div key={k} style={{fontSize:9,padding:'2px 8px',borderRadius:5,
                  background:'#ffffff',border:'1px solid #bbf7d0',
                  color:'#1a4d2e',fontFamily:'DM Mono,monospace'}}>
                  {k.replace(/_/g,' ')}: <b>{v}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <RiskCard
          icon="🌊" title="Waterhole Depletion Risk"
          value={Math.round(preds.waterholeRisk*100)}
          label={preds.waterholeRisk>0.6?'CRITICAL':preds.waterholeRisk>0.3?'MODERATE':'LOW'}
          color={whCol} bg={preds.waterholeRisk>0.6?'#fef2f2':preds.waterholeRisk>0.3?'#fffbeb':'#eff6ff'}
          desc="Based on temperature + humidity trend"
          extra={`Est. ${preds.daysLeft} days until depletion — elephants may move toward farms`}/>

        <RiskCard
          icon="🌾" title="Crop Raiding Probability"
          value={Math.round(preds.raidProb*100)}
          label={preds.raidProb>0.7?'HIGH RISK':preds.raidProb>0.4?'MODERATE':'LOW'}
          color={raidCol} bg={preds.raidProb>0.7?'#fef2f2':preds.raidProb>0.4?'#fffbeb':'#f0fdf4'}
          desc="Temp × Humidity × Crop season × Time"
          extra={preds.cropSeason?'🍌 Banana ripening season — peak raiding period':'Crop season: moderate risk'}/>

        <RiskCard
          icon="🌡" title="Elephant Heat Stress"
          value={preds.heatStress}
          label={`${esp?.temperature}°C ambient`}
          color={hsCol} bg={preds.heatStress==='CRITICAL'||preds.heatStress==='HIGH'?'#fef2f2':'#f0fdf4'}
          desc="Elephants stressed above 35°C"
          extra={preds.heatStress!=='LOW'?'Elephants seek water — settlement intrusion risk rises':'Normal thermal comfort range'}/>

        <RiskCard
          icon="🌙" title="Nocturnal Activity Risk"
          value={Math.round(preds.movementRisk*100)}
          label={preds.movementRisk>0.5?'ACTIVE WINDOW':'LOW'}
          color={preds.movementRisk>0.5?'#7c3aed':'#16a34a'}
          bg={preds.movementRisk>0.5?'#f5f3ff':'#f0fdf4'}
          desc="Movement probability based on cooling"
          extra={`Elephants most active when temp < 30°C — peak 9PM–2AM`}/>
      </div>

      {/* 24h forecast chart */}
      <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
        <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
          textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          📈 24-Hour Temperature & HEC Risk Forecast
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={preds.tempForecast} margin={{left:-15,right:10,top:5,bottom:0}}>
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4"/>
            <XAxis dataKey="hour" tick={{fill:'#3d7a52',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} interval={3}/>
            <YAxis yAxisId="temp" tick={{fill:'#3d7a52',fontSize:9}} axisLine={false} tickLine={false} width={32}/>
            <YAxis yAxisId="risk" orientation="right" tickFormatter={v=>Math.round(v*100)+'%'} tick={{fill:'#3d7a52',fontSize:9}} axisLine={false} tickLine={false} width={36}/>
            <Tooltip contentStyle={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:10,fontSize:11,color:'#0f2318',boxShadow:'0 4px 12px rgba(0,0,0,.1)'}} labelStyle={{color:'#1a4d2e'}}/>
            <Legend wrapperStyle={{fontSize:10,fontFamily:'DM Mono',color:'#3d7a52'}}/>
            <ReferenceLine yAxisId="temp" y={35} stroke="#ef4444" strokeDasharray="4 4" label={{value:'Heat stress',position:'right',fill:'#ef4444',fontSize:9}}/>
            <Area yAxisId="temp" dataKey="temp" name="Temp °C" stroke="#ef4444" fill="url(#tempGrad)" strokeWidth={2.5} dot={false}/>
            <Area yAxisId="risk" dataKey="risk" name="HEC Risk" stroke="#f59e0b" fill="url(#riskGrad)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
        <div style={{fontSize:9,color:'#9ec4aa',fontFamily:'DM Mono,monospace',marginTop:4}}>
          Red dashed line = 35°C elephant heat stress threshold · Risk peaks during night cooling period
        </div>
      </div>

      {/* Logistic Regression Coefficients */}
      {modelInfo&&(
        <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
          <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
            textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
            📐 Logistic Regression Coefficients (β values)
          </div>
          <div style={{padding:'8px 12px',borderRadius:8,background:'#f0fdf4',border:'1px solid #bbf7d0',marginBottom:10}}>
            <div style={{fontSize:10,color:'#1a4d2e',fontFamily:'DM Mono,monospace'}}>{modelInfo.equation}</div>
          </div>
          <div style={{display:'grid',gap:6}}>
            {Object.entries(modelInfo.coefficients||{}).map(([feat,coef])=>{
              const pos=coef>0,col=pos?'#ef4444':'#3b82f6'
              return(
                <div key={feat} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#1a4d2e',width:200,flexShrink:0}}>{feat}</span>
                  <div style={{flex:1,height:6,borderRadius:3,background:'#f0fdf4',overflow:'hidden',position:'relative'}}>
                    <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#d1fae5'}}/>
                    <div style={{position:'absolute',
                      left:pos?'50%':'auto',right:pos?'auto':'50%',
                      top:0,bottom:0,
                      width:`${Math.min(50,Math.abs(coef)*25)}%`,
                      background:col,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:col,
                    width:55,textAlign:'right',fontWeight:700}}>
                    {coef>0?'+':''}{coef.toFixed(4)}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{marginTop:10,fontSize:9,color:'#9ec4aa',fontFamily:'DM Mono,monospace'}}>
            Positive β = increases HEC risk · Negative β = reduces risk · 
            Source: {modelInfo.data_source==='mysql_real'?'Real MySQL DB':'Synthetic fallback'} · Samples: {modelInfo.training_samples} ({modelInfo.n_real_incidents} real) · CV Accuracy: {Math.round((modelInfo.cv_accuracy||0)*100)}%
          </div>
        </div>
      )}

      {/* Actionable recommendations */}
      <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
        <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
          textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          ✅ Recommended Actions — Based on Current Conditions
        </div>
        {[
          preds.waterholeRisk>0.5 && {
            icon:'💧',col:'#3b82f6',
            action:'Deploy water trucks to drying waterholes',
            reason:`Waterhole risk ${Math.round(preds.waterholeRisk*100)}% — est. ${preds.daysLeft} days until depletion`,
            priority:'HIGH'
          },
          preds.raidProb>0.6 && {
            icon:'🌾',col:'#f59e0b',
            action:'Alert farmers near Sulthan Bathery & Ambalavayal',
            reason:`Crop raid probability ${Math.round(preds.raidProb*100)}%${preds.cropSeason?' — banana season active':''}`,
            priority:'HIGH'
          },
          preds.heatStressScore>0.6 && {
            icon:'🌡',col:'#ef4444',
            action:'Increase patrol frequency near waterholes',
            reason:`Elephant heat stress ${preds.heatStress} — animals seeking water urgently`,
            priority:'URGENT'
          },
          preds.movementRisk>0.5 && {
            icon:'🌙',col:'#7c3aed',
            action:'Activate smart fence between 8PM–4AM',
            reason:`Nocturnal activity risk ${Math.round(preds.movementRisk*100)}% — peak movement window`,
            priority:'MODERATE'
          },
          {
            icon:'📊',col:'#16a34a',
            action:'Log reading to HEC research database',
            reason:`T=${esp?.temperature}°C H=${esp?.humidity}% recorded at ${new Date().toLocaleTimeString('en-IN',{hour12:false})}`,
            priority:'INFO'
          },
        ].filter(Boolean).map((rec,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #f0fdf4',alignItems:'flex-start'}}>
            <span style={{fontSize:18,flexShrink:0}}>{rec.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'#0f2318',fontSize:12}}>{rec.action}</div>
              <div style={{fontSize:10,color:'#3d7a52',marginTop:2}}>{rec.reason}</div>
            </div>
            <div style={{padding:'2px 8px',borderRadius:6,fontSize:9,fontFamily:'DM Mono,monospace',
              fontWeight:700,flexShrink:0,
              background:rec.priority==='URGENT'?'#fef2f2':rec.priority==='HIGH'?'#fffbeb':rec.priority==='MODERATE'?'#f5f3ff':'#f0fdf4',
              color:rec.priority==='URGENT'?'#dc2626':rec.priority==='HIGH'?'#d97706':rec.priority==='MODERATE'?'#7c3aed':'#16a34a',
              border:`1px solid ${rec.col}33`}}>
              {rec.priority}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 24h History Chart ─────────────────────────────────────────────
function HistoryChart({ history }) {
  if (!history.length) return null
  return(
    <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
      <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
        textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
        📉 Historical Temperature & Humidity (24h)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={history} margin={{left:-15,right:10,top:5,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4"/>
          <XAxis dataKey="time" tick={{fill:'#3d7a52',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} interval={Math.floor(history.length/6)}/>
          <YAxis tick={{fill:'#3d7a52',fontSize:9}} axisLine={false} tickLine={false} width={32}/>
          <Tooltip contentStyle={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:10,fontSize:11,color:'#0f2318'}} labelStyle={{color:'#1a4d2e'}}/>
          <Legend wrapperStyle={{fontSize:10,fontFamily:'DM Mono',color:'#3d7a52'}}/>
          <Line dataKey="temperature" name="Temp °C" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{r:4}}/>
          <Line dataKey="humidity" name="Humidity %" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{r:4}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Simulated IoT Node Card ───────────────────────────────────────
function NodeCard({ node }) {
  const col = node.pir_triggered ? '#ef4444' : '#16a34a'
  return(
    <div style={{borderRadius:14,border:`1px solid ${node.pir_triggered?'#fca5a5':'#d1fae5'}`,
      background:'#ffffff',padding:16,boxShadow:'0 1px 6px rgba(0,0,0,.04)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{width:10,height:10,borderRadius:'50%',background:col,
          boxShadow:`0 0 6px ${col}`,flexShrink:0}}/>
        <span style={{fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:700,color:'#0f2318'}}>{node.node_id}</span>
        {node.pir_triggered&&(
          <span style={{marginLeft:'auto',fontSize:9,fontFamily:'DM Mono,monospace',
            padding:'1px 7px',borderRadius:6,background:'#fef2f2',
            border:'1px solid #fca5a5',color:'#dc2626',fontWeight:700}}>
            PIR TRIGGERED
          </span>
        )}
      </div>
      <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace',marginBottom:12}}>{node.location}</div>
      {[['🌡','Temp',`${node.temperature_c}°C`,node.temperature_c,45,node.temperature_c>33?'#ef4444':node.temperature_c>30?'#f59e0b':'#16a34a'],
        ['💧','Humidity',`${node.humidity_pct}%`,node.humidity_pct,100,'#3b82f6'],
        ['🌱','Soil',`${node.soil_moisture}%`,node.soil_moisture,100,'#f59e0b'],
        ['🌿','NDVI',`${node.ndvi}`,node.ndvi,1,'#16a34a'],
        ['🔋','Battery',`${node.battery_pct}%`,node.battery_pct,100,node.battery_pct<20?'#ef4444':node.battery_pct<50?'#f59e0b':'#16a34a'],
      ].map(([ic,lb,val,v,mx,c])=>(
        <div key={lb} style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
            <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#3d7a52'}}>{ic} {lb}</span>
            <span style={{fontSize:11,fontWeight:700,color:c,fontFamily:'DM Mono,monospace'}}>{val}</span>
          </div>
          <div style={{height:5,borderRadius:3,background:'#f0fdf4',overflow:'hidden'}}>
            <div style={{height:'100%',background:c,width:`${Math.min(100,(v/mx)*100)}%`,borderRadius:3,transition:'width .7s'}}/>
          </div>
        </div>
      ))}
      <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #f0fdf4',fontSize:9,fontFamily:'DM Mono,monospace',color:'#9ec4aa'}}>
        {node.timestamp?new Date(node.timestamp).toLocaleTimeString('en-IN',{hour12:false}):'—'}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SensorsPage() {
  const { data:sensors, isLoading } = useSensors()
  const { data:stats }              = useSensorStats()
  const [espData,    setEspData   ] = useState(null)
  const [espHistory, setEspHistory] = useState([])
  const [tab,        setTab       ] = useState('esp')
  const wsRef = useRef(null)

  const { data:espRest } = useQuery({
    queryKey:['esp','latest'],
    queryFn: ()=>fetch('/api/esp/latest',{headers:authH()}).then(r=>r.json()),
    refetchInterval:8000,
  })
  const { data:espHistDB } = useQuery({
    queryKey:['esp','history'],
    queryFn: ()=>fetch('/api/esp/history?hours=24',{headers:authH()}).then(r=>r.json()),
    refetchInterval:60000,
  })
  // Real ML prediction from Logistic Regression model
  const { data:mlPred, refetch:refetchML } = useQuery({
    queryKey:['esp','predict', espData?.temperature, espData?.humidity],
    queryFn: ()=> espData
      ? fetch(`/api/esp/predict?temperature=${espData.temperature}&humidity=${espData.humidity}&heat_index=${espData.heat_index}`,{headers:authH()}).then(r=>r.json())
      : null,
    enabled: !!espData,
    refetchInterval:15000,
  })
  const { data:modelInfo } = useQuery({
    queryKey:['esp','model_info'],
    queryFn: ()=>fetch('/api/esp/model_info',{headers:authH()}).then(r=>r.json()),
    staleTime:Infinity,
  })

  useEffect(()=>{ if(espRest?.length>0) setEspData(espRest[0]) },[espRest])

  useEffect(()=>{
    if(!espHistDB?.length) return
    setEspHistory(espHistDB.map(r=>({
      time:new Date(r.recorded_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}),
      temperature:r.temperature, humidity:r.humidity, heat_index:r.heat_index,
    })))
  },[espHistDB])

  // WebSocket push
  useEffect(()=>{
    const token=localStorage.getItem('wg_access_token')
    const ws=new WebSocket(`ws://localhost:8000/ws/live?token=${token}`)
    wsRef.current=ws
    ws.onmessage=(e)=>{
      try{
        const msg=JSON.parse(e.data)
        if(msg.type==='esp_sensor'){
          const d=msg.payload
          setEspData(d)
          setEspHistory(prev=>{
            const pt={
              time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}),
              temperature:d.temperature,humidity:d.humidity,heat_index:d.heat_index,
            }
            return [...prev.slice(-47),pt]
          })
        }
      }catch{}
    }
    return()=>{try{ws.close()}catch{}}
  },[])

  const preds = computePredictions(espData)
  const tempAlert = espData?.temperature>35
  const humAlert  = espData?.humidity<30
  const connected = espData&&(Date.now()-new Date(espData.timestamp).getTime())<30000

  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#f0fdf4'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Topbar */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:12,padding:'10px 20px',
        borderBottom:'1px solid #d1fae5',background:'#ffffff',boxShadow:'0 1px 6px rgba(0,0,0,.05)'}}>
        <div style={{width:38,height:38,borderRadius:10,
          background:'linear-gradient(135deg,#16a34a,#22c55e)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
          boxShadow:'0 2px 8px rgba(22,163,74,.3)'}}>📡</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:'#0f2318',fontFamily:'Syne,sans-serif'}}>
            IoT Sensor Network + AI Predictions
          </div>
          <div style={{fontSize:10,color:'#3d7a52',fontFamily:'DM Mono,monospace'}}>
            ESP8266 + DHT11 real data · {stats?.active_nodes??0} nodes · Weather-based HEC intelligence
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {espData&&(
            <>
              <div style={{padding:'3px 10px',borderRadius:8,fontFamily:'DM Mono,monospace',fontWeight:700,
                fontSize:11,background:tempAlert?'#fef2f2':'#f0fdf4',
                border:`1px solid ${tempAlert?'#fca5a5':'#bbf7d0'}`,color:tempAlert?'#dc2626':'#15803d'}}>
                🌡 {espData.temperature}°C
              </div>
              <div style={{padding:'3px 10px',borderRadius:8,fontFamily:'DM Mono,monospace',fontWeight:700,
                fontSize:11,background:humAlert?'#fef2f2':'#eff6ff',
                border:`1px solid ${humAlert?'#fca5a5':'#93c5fd'}`,color:humAlert?'#dc2626':'#2563eb'}}>
                💧 {espData.humidity}%
              </div>
            </>
          )}
          {preds&&<div style={{padding:'3px 10px',borderRadius:8,fontFamily:'DM Mono,monospace',
            fontSize:10,fontWeight:700,
            background:preds.hecRisk>0.7?'#fef2f2':preds.hecRisk>0.4?'#fffbeb':'#f0fdf4',
            border:`1px solid ${preds.hecRisk>0.7?'#fca5a5':preds.hecRisk>0.4?'#fde68a':'#bbf7d0'}`,
            color:preds.hecRisk>0.7?'#dc2626':preds.hecRisk>0.4?'#d97706':'#15803d'}}>
            ⚠ HEC {Math.round((preds?.hecRisk??0)*100)}%
          </div>}
          {stats&&<span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'#3d7a52'}}>
            Avg {stats.avg_temperature_c}°C · {stats.avg_humidity_pct}% RH
          </span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{flexShrink:0,display:'flex',gap:4,padding:'8px 16px',
        borderBottom:'1px solid #d1fae5',background:'#f9fefb'}}>
        {[{k:'esp',l:'🔌 ESP8266 Live'},{k:'predict',l:'🧠 AI Predictions'},{k:'iot',l:'📡 IoT Nodes'}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'5px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace',fontWeight:600,
            border:`1px solid ${tab===k?'#22c55e':'#d1fae5'}`,
            background:tab===k?'#dcfce7':'#ffffff',
            color:tab===k?'#15803d':'#3d7a52',
          }}>{l}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',padding:16}}>

        {tab==='esp'&&(
          <div style={{display:'grid',gap:12}}>
            <ESPLiveWidget data={espData}/>
            <HistoryChart history={espHistory}/>
            {/* Ecology context */}
            <div style={{borderRadius:14,border:'1px solid #d1fae5',background:'#ffffff',padding:16}}>
              <div style={{fontSize:11,color:'#3d7a52',fontFamily:'DM Mono,monospace',
                textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
                🌿 Why Temperature & Humidity Matter for HEC
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {icon:'🌡',t:'Temp > 35°C',d:'Elephants face heat stress and urgently seek water — often near farms. Historical data shows 3× more HEC incidents on days above 35°C in Wayanad.',col:'#ef4444',bg:'#fef2f2'},
                  {icon:'💧',t:'Humidity < 30%',d:'Indicates severe drought. Natural waterholes dry up within 2 weeks. Elephants travel up to 15km for water, crossing agricultural zones.',col:'#f59e0b',bg:'#fffbeb'},
                  {icon:'🔥',t:'Heat Index > 40°C',d:'Combined thermal stress triggers erratic elephant behavior. Correlates strongly with crop raiding incidents in Sulthan Bathery and Ambalavayal.',col:'#dc2626',bg:'#fef2f2'},
                  {icon:'📊',t:'Live Risk Update',d:'DHT11 readings automatically update the RL agent risk multiplier. High temp + low humidity = seasonal risk boost applied to all 5 elephants in real-time.',col:'#16a34a',bg:'#f0fdf4'},
                ].map(({icon,t,d,col,bg})=>(
                  <div key={t} style={{borderRadius:10,border:`1px solid ${col}22`,background:bg,padding:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <span style={{fontSize:18}}>{icon}</span>
                      <span style={{fontSize:12,fontWeight:700,color:col}}>{t}</span>
                    </div>
                    <div style={{fontSize:10,color:'#374151',lineHeight:1.5}}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==='predict'&&<PredictionsPanel esp={espData} preds={preds} mlPred={mlPred} modelInfo={modelInfo}/>}

        {tab==='iot'&&(
          isLoading?(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}>
              <div style={{width:32,height:32,border:'3px solid #22c55e',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
              {(sensors||[]).map(n=><NodeCard key={n.node_id} node={n}/>)}
            </div>
          )
        )}
      </div>
    </div>
  )
}