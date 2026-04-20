// src/components/settings/SettingsPage.jsx
import { useSettings, useUpdateSettings } from '@/hooks/useAPI'

function Toggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5">
      <div className="flex-1 mr-4">
        <div className="text-sm font-medium text-green-900">{label}</div>
        {desc && <div className="text-xs font-mono text-green-700/60 mt-0.5">{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? 'var(--l)' : 'rgba(255,255,255,0.12)' }}>
        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}/>
      </button>
    </div>
  )
}

function SliderRow({ label, desc, value, min, max, step=0.05, format, onChange }) {
  return (
    <div className="py-3 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-green-900">{label}</div>
          {desc && <div className="text-xs font-mono text-green-700/60 mt-0.5">{desc}</div>}
        </div>
        <span className="text-sm font-mono text-green-700">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-green-500"/>
    </div>
  )
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const { mutate: save }              = useUpdateSettings()

  const set = (key, value) => save({ [key]: value })

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const s = settings || {}

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-green-200"
        style={{ background:'rgba(10,26,15,0.9)' }}>
        <span className="text-xl">⚙️</span>
        <div>
          <div className="font-bold text-sm text-green-950" style={{ fontFamily:'Syne,sans-serif' }}>System Settings</div>
          <div className="text-[10px] font-mono text-green-700/60">Saved automatically to MySQL</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-xl space-y-4">
          {/* Alerts */}
          <div className="rounded-xl border border-green-200 px-4 pt-2 pb-1" style={{ background:'#ffffff' }}>
            <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest py-2">Alert Settings</div>
            <Toggle label="SMS Alerts" desc="Send SMS to registered community contacts"
              value={!!s.sms_alerts} onChange={v=>set('sms_alerts',v)}/>
            <Toggle label="Smart Fence Trigger" desc="Activate electric fence on CRITICAL risk"
              value={!!s.fence_trigger} onChange={v=>set('fence_trigger',v)}/>
            <Toggle label="Email Reports" desc="Daily summary email to Forest Department"
              value={!!s.email_reports} onChange={v=>set('email_reports',v)}/>
          </div>

          {/* AI */}
          <div className="rounded-xl border border-green-200 px-4 pt-2 pb-1" style={{ background:'#ffffff' }}>
            <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest py-2">AI Agent Settings</div>
            <Toggle label="Autonomous Mode" desc="Agents act without human approval"
              value={!!s.autonomous_mode} onChange={v=>set('autonomous_mode',v)}/>
            <Toggle label="XAI Logging" desc="Log SHAP explanations for every prediction"
              value={!!s.xai_logging} onChange={v=>set('xai_logging',v)}/>
            <Toggle label="Night Mode Boost" desc="Increase sensitivity 1.3× between 19:00–06:00"
              value={!!s.night_mode_boost} onChange={v=>set('night_mode_boost',v)}/>
            <SliderRow label="Risk Threshold" desc="Alert fires above this score"
              value={s.risk_threshold ?? 0.70} min={0.3} max={0.95} step={0.05}
              format={v=>`${Math.round(v*100)}%`}
              onChange={v=>set('risk_threshold',v)}/>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-green-200 p-4" style={{ background:'#ffffff' }}>
            <div className="text-xs font-mono text-green-700/60 uppercase tracking-widest mb-3">System Info</div>
            {[
              ['Individual ID', 'WY_ELE_F01 (Female-01)'],
              ['Collar ID',     'COL-2022-001'],
              ['GPS interval',  `${s.gps_interval_minutes ?? 1} min`],
              ['Database',      'MySQL (wildguard)'],
              ['Model',         'Random Forest v1 (rule-based fallback)'],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-white/5 text-xs">
                <span className="font-mono text-green-700/60">{k}</span>
                <span className="font-mono text-green-800/80">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}