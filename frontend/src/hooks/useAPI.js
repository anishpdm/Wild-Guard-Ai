// src/hooks/useAPI.js — WildGuard AI v5
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gpsAPI, predAPI, alertAPI, cameraAPI, sensorAPI, analyticsAPI, agentAPI, settingsAPI } from '@/api/client'
import toast from 'react-hot-toast'

const token = () => localStorage.getItem('wg_access_token')
const apiFetch = (url) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())

// GPS
export const useGPSTrack    = (id, limit) => useQuery({ queryKey:['gps','track',id],  queryFn:() => gpsAPI.track(id,limit).then(r=>r.data), refetchInterval:60000 })
export const useGPSLatest   = (id)        => useQuery({ queryKey:['gps','latest',id], queryFn:() => gpsAPI.latest(id).then(r=>r.data),       refetchInterval:60000 })
export const useHerd        = ()          => useQuery({ queryKey:['gps','herd'],       queryFn:() => apiFetch('/api/gps/herd'),                 refetchInterval:60000 })
export const useIndividuals = ()          => useQuery({ queryKey:['gps','individuals'],queryFn:() => gpsAPI.individuals().then(r=>r.data) })

// Prediction
export const usePrediction = (id) => useQuery({ queryKey:['prediction','current',id], queryFn:() => predAPI.current(id).then(r=>r.data), refetchInterval:60000 })
export const useAllPredictions = () => useQuery({ queryKey:['prediction','all'], queryFn:() => apiFetch('/api/prediction/all'), refetchInterval:120000 })
export const useTrajectory = (id, steps=5) => useQuery({ queryKey:['prediction','traj',id], queryFn:() => apiFetch(`/api/prediction/trajectory?individual_id=${id}&steps=${steps}`), refetchInterval:120000 })

// Alerts
export const useAlerts = (params={}) => useQuery({ queryKey:['alerts',params], queryFn:() => alertAPI.list(params).then(r=>r.data), refetchInterval:15000 })

export const useAcknowledgeAlert = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn:(id)=>alertAPI.acknowledge(id), onSuccess:()=>{ qc.invalidateQueries({queryKey:['alerts']}); toast.success('Alert acknowledged') } })
}
export const useDismissAlert = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn:(id)=>alertAPI.dismiss(id), onSuccess:()=>qc.invalidateQueries({queryKey:['alerts']}) })
}

// Cameras
export const useCameras     = () => useQuery({ queryKey:['cameras'],      queryFn:()=>cameraAPI.list().then(r=>r.data),        refetchInterval:30000 })
export const useVideoStatus = () => useQuery({ queryKey:['video-status'], queryFn:()=>cameraAPI.videoStatus().then(r=>r.data), refetchInterval:30000 })

// Sensors
export const useSensors     = () => useQuery({ queryKey:['sensors'],      queryFn:()=>sensorAPI.list().then(r=>r.data),  refetchInterval:10000 })
export const useSensorStats = () => useQuery({ queryKey:['sensor-stats'], queryFn:()=>sensorAPI.stats().then(r=>r.data), refetchInterval:10000 })

// Analytics
export const useMonthlyRisk      = (y) => useQuery({ queryKey:['analytics','risk',y],      queryFn:()=>analyticsAPI.monthlyRisk(y).then(r=>r.data) })
export const useMonthlyIncidents = (y) => useQuery({ queryKey:['analytics','incidents',y], queryFn:()=>analyticsAPI.monthlyIncidents(y).then(r=>r.data) })
export const useBehaviourDist    = ()  => useQuery({ queryKey:['analytics','behaviour'],    queryFn:()=>analyticsAPI.behaviour().then(r=>r.data) })
export const useHabitatDist      = ()  => useQuery({ queryKey:['analytics','habitat'],      queryFn:()=>analyticsAPI.habitat().then(r=>r.data) })
export const useAnalyticsSummary = ()  => useQuery({ queryKey:['analytics','summary'],      queryFn:()=>analyticsAPI.summary().then(r=>r.data) })

// Ecological stress
export const useAllStress        = ()    => useQuery({ queryKey:['stress','all'],          queryFn:()=>apiFetch('/api/stress/current'),           refetchInterval:60000 })
export const useElephantStress   = (id)  => useQuery({ queryKey:['stress','id',id],        queryFn:()=>apiFetch(`/api/stress/current?individual_id=${id}`), refetchInterval:60000 })
export const useWaterholes       = ()    => useQuery({ queryKey:['stress','waterholes'],    queryFn:()=>apiFetch('/api/stress/waterholes'),         refetchInterval:120000 })
export const useCorridors        = ()    => useQuery({ queryKey:['stress','corridors'],     queryFn:()=>apiFetch('/api/stress/corridors') })
export const useCropCalendar     = ()    => useQuery({ queryKey:['stress','crops'],         queryFn:()=>apiFetch('/api/stress/crop_calendar'),     refetchInterval:3600000 })
export const useSeasonalForecast = ()    => useQuery({ queryKey:['stress','forecast'],      queryFn:()=>apiFetch('/api/stress/seasonal_forecast') })

// Social
export const useSocial = () => useQuery({ queryKey:['social'], queryFn:()=>apiFetch('/api/social/analyse'), refetchInterval:30000 })

// Incidents
export const useIncidents     = (params={}) => useQuery({ queryKey:['incidents',params], queryFn:()=>apiFetch(`/api/incidents?limit=${params.limit||100}`), refetchInterval:30000 })
export const useIncidentStats = ()           => useQuery({ queryKey:['incidents','stats'], queryFn:()=>apiFetch('/api/incidents/stats'), refetchInterval:60000 })

// Agents
export const useAgents   = () => useQuery({ queryKey:['agents'],  queryFn:()=>agentAPI.status().then(r=>r.data) })
export const useAuditLog = () => useQuery({ queryKey:['audit'],   queryFn:()=>agentAPI.auditLog().then(r=>r.data) })

// Settings
export const useSettings = () => useQuery({ queryKey:['settings'], queryFn:()=>settingsAPI.get().then(r=>r.data) })
export const useUpdateSettings = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn:(body)=>settingsAPI.put(body), onSuccess:()=>{ qc.invalidateQueries({queryKey:['settings']}); toast.success('Settings saved') } })
}
