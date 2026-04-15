import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDbHealth } from '../api/disputeApi.js'

function Indicator({ ok }) {
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
    </span>
  )
}

function StatCard({ label, value, sub, color = 'brand' }) {
  return (
    <div className="glass p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold text-${color}-400`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

export default function DbHealth() {
  const [lastChecked, setLastChecked] = useState(null)

  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey:        ['health'],
    queryFn:         fetchDbHealth,
    refetchInterval: 10_000,  // poll every 10 s as specified
    retry:           1,
  })

  useEffect(() => {
    if (dataUpdatedAt) setLastChecked(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const isUp = !isError && !!data

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="gradient-text mb-2">Database Health</h1>
        <p className="text-gray-500 text-sm">Auto-refreshes every 10 seconds. Polls Oracle DUAL + pool stats.</p>
      </div>

      {/* Status hero */}
      <div className={`card mb-6 border-2 ${isUp ? 'border-emerald-800/50' : 'border-red-800/50'}`}>
        <div className="card-body flex items-center gap-5 py-6">
          {isLoading
            ? <span className="spinner w-6 h-6 border-brand-500" />
            : <Indicator ok={isUp} />
          }
          <div>
            <p className={`text-2xl font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isLoading ? 'Checking…' : isUp ? 'Oracle Database Online' : 'Database Unreachable'}
            </p>
            {isError && (
              <p className="text-red-500 text-sm mt-1">{error?.message}</p>
            )}
            {lastChecked && (
              <p className="text-gray-600 text-xs mt-1">
                Last checked: {lastChecked.toLocaleTimeString('en-IN')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="DB Status"
              value={data.status}
              color="emerald"
            />
            <StatCard
              label="Server Time"
              value={data.dbTime?.split(' ')[1] || '—'}
              sub={data.dbTime?.split(' ')[0]}
              color="brand"
            />
            <StatCard
              label="Pool Open"
              value={data.poolStats?.connectionsOpen ?? '—'}
              sub={`max ${data.poolStats?.poolMax}`}
              color="purple"
            />
            <StatCard
              label="In Use"
              value={data.poolStats?.connectionsInUse ?? '—'}
              sub={`min ${data.poolStats?.poolMin}`}
              color="amber"
            />
          </div>

          {/* Pool utilisation bar */}
          <div className="card">
            <div className="card-header"><h2>Pool Utilisation</h2></div>
            <div className="card-body space-y-3">
              {[
                { label: 'Open Connections',   val: data.poolStats?.connectionsOpen,  max: data.poolStats?.poolMax,  color: '#818cf8' },
                { label: 'Active Connections',  val: data.poolStats?.connectionsInUse, max: data.poolStats?.poolMax,  color: '#10b981' },
              ].map(({ label, val, max, color }) => {
                const pct = max > 0 ? Math.round((val / max) * 100) : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{label}</span>
                      <span>{val} / {max} ({pct}%)</span>
                    </div>
                    <div className="risk-bar-track">
                      <div className="risk-bar-fill transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Live countdown */}
      <LiveCountdown />
    </div>
  )
}

function LiveCountdown() {
  const [secs, setSecs] = useState(10)

  useEffect(() => {
    setSecs(10)
    const iv = setInterval(() => setSecs((s) => (s <= 1 ? 10 : s - 1)), 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <p className="text-center text-gray-700 text-xs mt-6">
      Next refresh in <span className="text-gray-500 font-mono">{secs}s</span>
    </p>
  )
}
