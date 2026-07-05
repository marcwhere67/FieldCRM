'use client'

import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react'

interface Insight { type: 'positive' | 'warning' | 'info'; title: string; body: string }

const C = { navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

const ACCENT: Record<string, { color: string; border: string }> = {
  positive: { color: '#5d8c76', border: 'rgba(118,165,143,0.4)' },
  warning:  { color: '#b45309', border: 'rgba(245,158,11,0.3)' },
  info:     { color: '#2563eb', border: 'rgba(37,99,235,0.25)' },
}

export function AiInsightsCard() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/ai/insights')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInsights(data.insights)
    } catch { setError('Could not load AI insights') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 14, height: 14, color: '#7c3aed' }} />
          <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>AI Insights</p>
          <span style={{ color: C.muted, fontSize: 11 }}>Last 30 days</span>
        </div>
        <button onClick={load} disabled={loading} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          className="hover:opacity-70 transition-opacity">
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, padding: '8px 0' }}>
          <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Analysing your data…</span>
        </div>
      )}

      {error && !loading && <p style={{ color: C.muted, fontSize: 13 }}>{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {insights.map((insight, i) => {
            const acc = ACCENT[insight.type] ?? ACCENT.info
            const Icon = insight.type === 'positive' ? TrendingUp : insight.type === 'warning' ? AlertTriangle : Info
            return (
              <div key={i} style={{ display: 'flex', gap: 10, paddingLeft: 10, borderLeft: `2px solid ${acc.border}` }}>
                <Icon style={{ width: 13, height: 13, color: acc.color, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>{insight.title}</p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{insight.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
