'use client'

const C = {
  navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

interface MonthBar {
  label: string
  revenue: number
  expenses: number
}

interface Props {
  data: MonthBar[]
}

export function RevenueChart({ data }: Props) {
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses]), 1)

  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Revenue vs Expenses</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, backgroundColor: C.sage, display: 'inline-block' }} />Revenue
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, backgroundColor: 'rgba(44,62,80,0.18)', display: 'inline-block' }} />Expenses
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 148 }}>
        {data.map((d, i) => {
          const revH = Math.round((d.revenue / maxVal) * 140)
          const expH = Math.round((d.expenses / maxVal) * 140)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: '100%', justifyContent: 'center', height: 140 }}>
                <div title={`Revenue: $${d.revenue.toFixed(0)}`}
                  style={{ flex: 1, backgroundColor: C.sage, maxWidth: 18, height: revH || 2, alignSelf: 'flex-end', transition: 'height 300ms' }} />
                <div title={`Expenses: $${d.expenses.toFixed(0)}`}
                  style={{ flex: 1, backgroundColor: 'rgba(44,62,80,0.18)', maxWidth: 18, height: expH || 2, alignSelf: 'flex-end', transition: 'height 300ms' }} />
              </div>
              <span style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
