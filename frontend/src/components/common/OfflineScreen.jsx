// src/components/common/OfflineScreen.jsx
export default function OfflineScreen({ retry, checking }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background:'rgba(5,10,7,0.98)' }}>
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-6">🔌</div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily:'Syne,sans-serif' }}>
          Backend Offline
        </h1>
        <p className="text-white/40 text-sm font-mono mb-6 leading-relaxed">
          Cannot connect to WildGuard API at{' '}
          <code className="text-green-400">localhost:8000</code>
        </p>

        <div className="bg-black/40 rounded-xl p-4 text-left mb-6 border border-white/10">
          <div className="text-xs font-bold text-white/60 mb-3 font-mono">START BACKEND:</div>
          <div className="space-y-1">
            {[
              'cd wildguard-backend',
              'source venv/bin/activate',
              'pip install bcrypt==4.0.1 -q',
              'uvicorn main:app --reload --port 8000',
            ].map((cmd,i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-green-500 text-xs font-mono">$</span>
                <code className="text-green-300 text-xs font-mono">{cmd}</code>
              </div>
            ))}
          </div>
        </div>

        <button onClick={retry} disabled={checking}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)', opacity: checking?.6:1 }}>
          {checking ? '⏳ Checking...' : '↺ Retry Connection'}
        </button>

        <p className="text-white/20 text-xs font-mono mt-4">
          Auto-retrying every 10 seconds
        </p>
      </div>
    </div>
  )
}
