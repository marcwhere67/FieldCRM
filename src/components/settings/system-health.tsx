'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/format'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ShieldCheck } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const LEVEL: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.2)', Icon: AlertTriangle },
  error:    { label: 'Error',    color: '#b45309', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', Icon: AlertCircle },
  warning:  { label: 'Warning',  color: '#8A6D3B', bg: 'rgba(138,109,59,0.07)', border: 'rgba(138,109,59,0.18)', Icon: Info },
}

interface ErrorEvent {
  id: string
  created_at: string
  level: 'critical' | 'error' | 'warning'
  source: string
  message: string
  stack: string | null
  context: Record<string, unknown> | null
}

export function SystemHealth() {
  const [events, setEvents] = useState<ErrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('error_events')
      .select('id, created_at, level, source, message, stack, context')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setLoadError('System health log is not available yet.')
        else setEvents((data as ErrorEvent[]) ?? [])
        setLoading(false)
      })
  }, [])

  const now = Date.now()
  const dayAgo = now - 24 * 3600 * 1000
  const last24h = events.filter(e => new Date(e.created_at).getTime() >= dayAgo)
  const countBy = (level: string, list: ErrorEvent[]) => list.filter(e => e.level === level).length

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: C.navy, fontSize: 22, fontWeight: 300 }}>
        System Health
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 20 }}>
        Errors on the critical paths (payments, invoices, quotes). You’re emailed on anything critical.
      </p>

      {/* Last 24h summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {(['critical', 'error', 'warning'] as const).map(level => {
          const L = LEVEL[level]
          const n = countBy(level, last24h)
          return (
            <div key={level} style={{ border: `1px solid ${n > 0 ? L.border : C.border}`, backgroundColor: n > 0 ? L.bg : '#fff', padding: 14 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>{L.label} · 24h</p>
              <p style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: n > 0 ? L.color : C.navy, fontSize: 26, lineHeight: 1 }}>{n}</p>
            </div>
          )
        })}
      </div>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>
      ) : loadError ? (
        <p style={{ color: C.muted, fontSize: 13 }}>{loadError}</p>
      ) : events.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0', border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
          <ShieldCheck style={{ width: 26, height: 26, color: C.sage }} />
          <p style={{ color: C.navy, fontSize: 14 }}>All clear</p>
          <p style={{ color: C.muted, fontSize: 12 }}>No errors have been logged.</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
          {events.map((e, i) => {
            const L = LEVEL[e.level] ?? LEVEL.error
            const open = expanded === e.id
            const hasDetail = e.stack || (e.context && Object.keys(e.context).length > 0)
            return (
              <div key={e.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <button
                  onClick={() => hasDetail && setExpanded(open ? null : e.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: hasDetail ? 'pointer' : 'default' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: L.color, backgroundColor: L.bg, border: `1px solid ${L.border}`, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', flexShrink: 0 }}>
                    <L.Icon style={{ width: 11, height: 11 }} />{L.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.fg, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</p>
                    <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
                      <span style={{ fontFamily: 'monospace' }}>{e.source}</span> · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                  {hasDetail && <ChevronDown style={{ width: 14, height: 14, color: C.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }} />}
                </button>
                {open && hasDetail && (
                  <div style={{ padding: '0 14px 14px 14px' }}>
                    {e.context && Object.keys(e.context).length > 0 && (
                      <pre style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, padding: 10, fontSize: 11, color: C.fg, overflowX: 'auto', margin: 0, marginBottom: e.stack ? 8 : 0 }}>
                        {JSON.stringify(e.context, null, 2)}
                      </pre>
                    )}
                    {e.stack && (
                      <pre style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, padding: 10, fontSize: 10, color: C.muted, overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {e.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
