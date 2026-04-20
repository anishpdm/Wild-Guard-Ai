// src/App.jsx — WildGuard AI v5
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth }       from '@/context/AuthContext'
import { BackendProvider, useBackend } from '@/context/BackendContext'
import { WSProvider }                  from '@/context/WSContext'
import OfflineScreen                   from '@/components/common/OfflineScreen'
import AppShell                        from '@/components/common/AppShell'
import LoginPage                       from '@/components/auth/LoginPage'
import DashboardPage                   from '@/components/dashboard/DashboardPage'
import CamerasPage                     from '@/components/cameras/CamerasPage'
import AlertsPage                      from '@/components/alerts/AlertsPage'
import AnalyticsPage                   from '@/components/analytics/AnalyticsPage'
import SensorsPage                     from '@/components/sensors/SensorsPage'
import SettingsPage                    from '@/components/settings/SettingsPage'
import StressPage                      from '@/components/stress/StressPage'
import IncidentsPage                   from '@/components/incidents/IncidentsPage'
import SocialPage                      from '@/components/social/SocialPage'

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="fixed inset-0 flex items-center justify-center" style={{ background:'#0a1a0f' }}><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace/>
  return children
}

function BackendGuard({ children }) {
  const { online, checking, retry } = useBackend()
  if (checking && online === null) return <div className="fixed inset-0 flex items-center justify-center" style={{ background:'#0a1a0f' }}><div className="text-center"><div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-white/40 text-sm font-mono">Connecting to WildGuard API...</p></div></div>
  if (online === false) return <OfflineScreen retry={retry} checking={checking}/>
  return children
}

function InnerApp() {
  const { isAuthenticated } = useAuth()
  return (
    <WSProvider>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace/> : <LoginPage/>}/>
        <Route path="/" element={<RequireAuth><AppShell/></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace/>}/>
          <Route path="dashboard"  element={<DashboardPage/>}/>
          <Route path="cameras"    element={<CamerasPage/>}/>
          <Route path="alerts"     element={<AlertsPage/>}/>
          <Route path="analytics"  element={<AnalyticsPage/>}/>
          <Route path="sensors"    element={<SensorsPage/>}/>
          <Route path="stress"     element={<StressPage/>}/>
          <Route path="incidents"  element={<IncidentsPage/>}/>
          <Route path="social"     element={<SocialPage/>}/>
          <Route path="settings"   element={<SettingsPage/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </WSProvider>
  )
}

export default function App() {
  return (
    <BackendProvider>
      <BackendGuard>
        <AuthProvider>
          <InnerApp/>
        </AuthProvider>
      </BackendGuard>
    </BackendProvider>
  )
}
