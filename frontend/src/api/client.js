// src/api/client.js — WildGuard AI v5 — ZERO mock data
import axios from 'axios'

const api = axios.create({ baseURL:'/api', timeout:10000, headers:{'Content-Type':'application/json'} })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('wg_access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

let _refreshing = false, _queue = []
api.interceptors.response.use(r=>r, async err => {
  const orig = err.config
  if (err.response?.status === 401 && !orig._retry) {
    if (_refreshing) return new Promise((res,rej) => _queue.push({res,rej})).then(()=>api(orig))
    orig._retry = true; _refreshing = true
    try {
      const rt = localStorage.getItem('wg_refresh_token')
      if (!rt) throw new Error('no refresh token')
      const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt })
      localStorage.setItem('wg_access_token', data.access_token)
      _queue.forEach(p=>p.res()); _queue = []
      return api(orig)
    } catch {
      _queue.forEach(p=>p.rej()); _queue = []
      localStorage.removeItem('wg_access_token'); localStorage.removeItem('wg_refresh_token')
      window.location.href = '/login'
    } finally { _refreshing = false }
  }
  return Promise.reject(err)
})

export default api

export const authAPI = {
  login: (u,p) => { const f=new URLSearchParams(); f.append('username',u); f.append('password',p); return axios.post('/api/auth/login',f,{headers:{'Content-Type':'application/x-www-form-urlencoded'}}) },
  me:     () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}
export const gpsAPI = {
  track:       (id='WY_ELE_F01',limit=48) => api.get('/gps/track',{params:{individual_id:id,limit}}),
  latest:      (id='WY_ELE_F01')          => api.get('/gps/latest',{params:{individual_id:id}}),
  history:     (id,start,end)             => api.get('/gps/history',{params:{individual_id:id,start,end}}),
  individuals: ()                         => api.get('/gps/individuals'),
  herd:        ()                         => api.get('/gps/herd'),
}
export const predAPI = {
  current:    (id='WY_ELE_F01') => api.get('/prediction/current',{params:{individual_id:id}}),
  trajectory: (id,steps=5)      => api.get('/prediction/trajectory',{params:{individual_id:id,steps}}),
  all:        ()                 => api.get('/prediction/all'),
}
export const alertAPI = {
  list:        (params={})  => api.get('/alerts',{params}),
  acknowledge: (id)         => api.post(`/alerts/${id}/acknowledge`),
  dismiss:     (id)         => api.delete(`/alerts/${id}`),
  create:      (body)       => api.post('/alerts',body),
}
export const cameraAPI = {
  list:        () => api.get('/cameras'),
  videoStatus: () => api.get('/cameras/video-status'),
}
export const sensorAPI = {
  list:    ()              => api.get('/sensors'),
  stats:   ()              => api.get('/sensors/stats'),
  history: (id,hours=24)  => api.get(`/sensors/${id}/history`,{params:{hours}}),
}
export const analyticsAPI = {
  monthlyRisk:      (year=2022) => api.get('/analytics/monthly_risk',{params:{year}}),
  monthlyIncidents: (year=2022) => api.get('/analytics/monthly_incidents',{params:{year}}),
  behaviour:        ()          => api.get('/analytics/behaviour_distribution'),
  habitat:          ()          => api.get('/analytics/habitat_distribution'),
  summary:          ()          => api.get('/analytics/summary'),
}
export const agentAPI = {
  status:   ()           => api.get('/agents/status'),
  override: (id,body)    => api.post(`/agents/${id}/override`,body),
  auditLog: (limit=50)   => api.get('/agents/audit_log',{params:{limit}}),
}
export const settingsAPI = {
  get: ()     => api.get('/settings'),
  put: (body) => api.put('/settings',body),
}
export const healthAPI = {
  check: () => axios.get('/api/health',{timeout:3000}),
}
