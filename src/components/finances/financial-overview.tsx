'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'

const C = { navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

export function FinancialOverview() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finances/metrics?period=${period}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <p style={{ color: C.muted }}>Loading...</p>

  const m = data?.metrics || {}

  return (
    <div className="space-y-6">
      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${C.border}` }}>
        {['day', 'week', 'month', 'year'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '10px 16px',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: period === p ? C.navy : C.muted,
              borderBottom: `2px solid ${period === p ? C.sage : 'transparent'}`,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            className="transition-colors hover:text-[#2C3E50]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Revenue */}
        <div style={{ border: `1px solid ${C.border}`, padding: 20, backgroundColor: '#fff' }}>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Revenue</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: C.navy }}>{formatCurrency(m.totalRevenue || 0)}</p>
        </div>

        {/* Outstanding */}
        <div style={{ border: `1px solid ${C.border}`, padding: 20, backgroundColor: '#fff' }}>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Outstanding</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: '#dc2626' }}>{formatCurrency(m.outstandingRevenue || 0)}</p>
        </div>

        {/* Quote Conversion */}
        <div style={{ border: `1px solid ${C.border}`, padding: 20, backgroundColor: '#fff' }}>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Conversion Rate</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: C.sage }}>{m.conversionRate || 0}%</p>
        </div>

        {/* Pending Quotes */}
        <div style={{ border: `1px solid ${C.border}`, padding: 20, backgroundColor: '#fff' }}>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Pending Quotes</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: C.navy }}>{m.pendingQuoteValue || 0}</p>
        </div>
      </div>

      {/* Chart placeholder */}
      <div style={{ border: `1px solid ${C.border}`, padding: 40, backgroundColor: '#fff', textAlign: 'center' }}>
        <p style={{ color: C.muted }}>Revenue trend chart — Chart.js integration coming next</p>
      </div>
    </div>
  )
}
