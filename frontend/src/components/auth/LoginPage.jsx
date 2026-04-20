// src/components/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [form, setForm] = useState({ username:'admin', password:'wayanad2024' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed — check credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background:'#f0fdf4' }}>
      {/* Background forest effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_,i) => (
          <div key={i} className="absolute bottom-0 opacity-10"
            style={{ left:`${i*18}%`, width:80, height:`${120+i*30}px`,
              background:'#16a34a', clipPath:'polygon(50% 0%,0% 100%,100% 100%)' }}/>
        ))}
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐘</div>
          <h1 className="text-2xl font-bold text-green-950" style={{ fontFamily:'Syne,sans-serif' }}>
            WildGuard AI
          </h1>
          <p className="text-sm text-green-700/70 font-mono mt-1">
            Wayanad HEC Prevention System
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border border-green-900/40" style={{ background:'#ffffff' }}>
          <h2 className="text-base font-semibold text-green-900 mb-5">Sign in to continue</h2>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-green-700/70 mb-1.5">Username</label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-green-950 bg-green-50 border border-white/10 focus:border-green-500/50 focus:outline-none transition-colors font-mono"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-green-700/70 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-green-950 bg-green-50 border border-white/10 focus:border-green-500/50 focus:outline-none transition-colors font-mono"
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-green-950 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background:'linear-gradient(135deg,#16a34a,#16a34a)', fontFamily:'Syne,sans-serif' }}>
              {loading ? '⏳ Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <p className="text-xs text-green-600/50 font-mono">admin / wayanad2024</p>
          </div>
        </div>
      </div>
    </div>
  )
}