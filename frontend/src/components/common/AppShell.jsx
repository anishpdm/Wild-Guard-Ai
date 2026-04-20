// AppShell.jsx — Light Pastel Green Theme
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth }    from '@/context/AuthContext'
import { useBackend } from '@/context/BackendContext'
import { useQuery }   from '@tanstack/react-query'

const NAV = [
  { path:'/dashboard', icon:'🗺',  label:'Dashboard'  },
  { path:'/cameras',   icon:'🎥',  label:'Cameras'    },
  { path:'/alerts',    icon:'🚨',  label:'Alerts'     },
  { path:'/stress',    icon:'🌿',  label:'Eco Stress' },
  { path:'/social',    icon:'🐘',  label:'Social'     },
  { path:'/incidents', icon:'📋',  label:'Incidents'  },
  { path:'/analytics', icon:'📊',  label:'Analytics'  },
  { path:'/sensors',   icon:'📡',  label:'Sensors'    },
  { path:'/settings',  icon:'⚙️',  label:'Settings'   },
]

const token = () => localStorage.getItem('wg_access_token')

export default function AppShell() {
  const { user, logout } = useAuth()
  const { info }         = useBackend()

  const { data: alerts } = useQuery({
    queryKey: ['alerts',{acknowledged:false}],
    queryFn: ()=>fetch('/api/alerts?acknowledged=false&limit=100',
      {headers:{Authorization:`Bearer ${token()}`}}).then(r=>r.json()),
    refetchInterval: 15000,
  })
  const unread    = (alerts||[]).length
  const breachCnt = (alerts||[]).filter(a=>a.level==='critical').length

  const S = {
    sidebar:{
      width:210, flexShrink:0, display:'flex', flexDirection:'column',
      background:'#ffffff',
      borderRight:'1px solid rgba(34,197,94,.2)',
      boxShadow:'2px 0 12px rgba(0,0,0,.04)',
    },
    logo:{
      padding:'16px 16px 14px',
      borderBottom:'1px solid rgba(34,197,94,.15)',
      background:'linear-gradient(135deg,#f0faf3,#ffffff)',
    },
    logoBox:{
      width:40,height:40,borderRadius:12,flexShrink:0,
      background:'linear-gradient(135deg,#16a34a,#22c55e)',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:21,boxShadow:'0 3px 10px rgba(22,163,74,.3)',
    },
    nav:{flex:1,padding:'10px 8px',overflowY:'auto'},
    statusBar:{
      padding:'7px 14px',
      borderTop:'1px solid rgba(34,197,94,.15)',
      background:'#f0faf3',
    },
    userBar:{
      padding:'10px 14px',
      borderTop:'1px solid rgba(34,197,94,.15)',
      display:'flex',alignItems:'center',gap:8,
      background:'#f9fefb',
    },
    avatar:{
      width:32,height:32,borderRadius:8,flexShrink:0,
      background:'linear-gradient(135deg,#bbf7d0,#86efac)',
      border:'2px solid #4ade80',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:13,fontWeight:800,fontFamily:'DM Mono,monospace',color:'#14532d',
    },
  }

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden',background:'var(--f)'}}>
      <aside style={S.sidebar}>

        {/* Logo */}
        <div style={S.logo}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={S.logoBox}>🐘</div>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:'#14532d',fontFamily:'Syne,sans-serif',letterSpacing:-.3}}>WildGuard AI</div>
              <div style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#4ade80',marginTop:1,fontWeight:500}}>Wayanad Wildlife Sanctuary</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          {NAV.map(({path,icon,label})=>(
            <NavLink key={path} to={path} style={({isActive})=>({
              display:'flex',alignItems:'center',gap:10,
              padding:'9px 12px',borderRadius:10,marginBottom:2,
              fontSize:13,fontWeight:isActive?600:500,
              textDecoration:'none',transition:'all .15s',
              background:isActive?'linear-gradient(90deg,#dcfce7,#f0fdf4)':'transparent',
              border:isActive?'1px solid rgba(34,197,94,.3)':'1px solid transparent',
              color:isActive?'#15803d':'#3d7a52',
              boxShadow:isActive?'0 1px 4px rgba(34,197,94,.12)':'none',
            })}>
              <span style={{fontSize:16,width:22,textAlign:'center'}}>{icon}</span>
              <span style={{flex:1}}>{label}</span>
              {label==='Alerts'&&unread>0&&(
                <span style={{
                  padding:'1px 7px',borderRadius:10,fontSize:9,
                  fontFamily:'DM Mono,monospace',fontWeight:700,
                  background:'#fee2e2',border:'1px solid #fca5a5',color:'#dc2626',
                }}>{unread}</span>
              )}
              {label==='Alerts'&&breachCnt>0&&(
                <span style={{width:7,height:7,borderRadius:'50%',background:'#ef4444',
                  boxShadow:'0 0 6px #ef4444',animation:'pulse-dot 2s infinite'}}/>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div style={S.statusBar}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',
              boxShadow:'0 0 6px rgba(34,197,94,.7)',flexShrink:0,
              animation:'pulse-dot 2s infinite'}}/>
            <span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#3d7a52'}}>
              {info?.ws_clients??0} WS · {info?.tracked_elephants??5}🐘 · GPS {info?.gps_interval??'60s'}
            </span>
          </div>
        </div>

        {/* User */}
        <div style={S.userBar}>
          <div style={S.avatar}>{user?.username?.[0]?.toUpperCase()??'A'}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:'#1a4d2e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.full_name}</div>
            <div style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'#7aae8a'}}>{user?.role}</div>
          </div>
          <button onClick={logout} style={{
            fontSize:9,fontFamily:'DM Mono,monospace',color:'#7aae8a',
            background:'none',border:'1px solid rgba(34,197,94,.2)',
            cursor:'pointer',padding:'3px 8px',borderRadius:6,
            transition:'all .15s',
          }}
          onMouseEnter={e=>{e.target.style.color='#dc2626';e.target.style.borderColor='rgba(220,38,38,.3)'}}
          onMouseLeave={e=>{e.target.style.color='#7aae8a';e.target.style.borderColor='rgba(34,197,94,.2)'}}>
            sign out
          </button>
        </div>
      </aside>

      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:'var(--f)'}}>
        <Outlet/>
      </main>
    </div>
  )
}