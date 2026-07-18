'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/format'
import { TrendingUp, TrendingDown, Briefcase } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', fg: '#1C2A35',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.1)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
  green: '#5d8c76', red: '#dc2626',
}

export interface CostRow {
  id: string; job_number: string; title: string; status: string; scheduled_start: string | null
  customer: string; revenue: number; labour: number; materials: number; margin: number; marginPct: number | null
}

function marginColor(pct: number | null) {
  if (pct == null) return C.muted
  if (pct >= 40) return C.green
  if (pct >= 15) return '#b45309'
  return C.red
}

export function JobCostingView({ rows }: { rows: CostRow[] }) {
  const [view, setView] = useState<'job' | 'customer'>('job')

  const totals = useMemo(() => {
    const t = rows.reduce((a, r) => ({
      revenue: a.revenue + r.revenue, labour: a.labour + r.labour, materials: a.materials + r.materials, margin: a.margin + r.margin,
    }), { revenue: 0, labour: 0, materials: 0, margin: 0 })
    return { ...t, marginPct: t.revenue > 0 ? Math.round((t.margin / t.revenue) * 100) : null }
  }, [rows])

  const byCustomer = useMemo(() => {
    const map = new Map<string, { customer: string; jobs: number; revenue: number; labour: number; materials: number; margin: number }>()
    for (const r of rows) {
      const c = map.get(r.customer) ?? { customer: r.customer, jobs: 0, revenue: 0, labour: 0, materials: 0, margin: 0 }
      c.jobs++; c.revenue += r.revenue; c.labour += r.labour; c.materials += r.materials; c.margin += r.margin
      map.set(r.customer, c)
    }
    return [...map.values()].sort((a, b) => b.margin - a.margin)
  }, [rows])

  return (
    <div style={{ maxWidth: 1000 }} className="space-y-6">
      <div className="pb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <p style={{ color: C.sage, letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Finance</p>
        <h1 style={{ fontFamily: C.serif, color: C.navy }} className="text-3xl font-light">Job Costing</h1>
        <p style={{ color: C.muted }} className="text-xs mt-1">Revenue vs. labour &amp; materials on completed work — where you actually make money</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: formatCurrency(totals.revenue), accent: C.navy },
          { label: 'Labour', value: formatCurrency(totals.labour), accent: '#8A9BA6' },
          { label: 'Materials', value: formatCurrency(totals.materials), accent: '#8A9BA6' },
          { label: `Gross margin${totals.marginPct != null ? ` · ${totals.marginPct}%` : ''}`, value: formatCurrency(totals.margin), accent: totals.margin >= 0 ? C.green : C.red },
        ].map(s => (
          <div key={s.label} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: 16 }}>
            <div style={{ borderTop: `2px solid ${s.accent}`, paddingTop: 12 }}>
              <p style={{ color: C.muted, letterSpacing: '0.12em' }} className="text-[9px] uppercase mb-2">{s.label}</p>
              <p style={{ fontFamily: C.serif, color: C.navy, lineHeight: 1 }} className="text-2xl font-light">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', display: 'inline-flex', padding: 2 }}>
        {(['job', 'customer'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '5px 16px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: view === v ? C.navy : 'transparent', color: view === v ? '#fff' : C.muted }}>
            By {v}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }} className="flex flex-col items-center justify-center py-20 gap-3">
          <Briefcase className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
          <p style={{ color: C.muted }} className="text-sm">No completed jobs to cost yet</p>
          <p style={{ color: C.muted, opacity: 0.7 }} className="text-[11px]">Margins appear once jobs are completed or invoiced</p>
        </div>
      ) : view === 'job' ? (
        <Table head={['Job', 'Customer', 'Revenue', 'Labour', 'Materials', 'Margin']}>
          {rows.map(r => (
            <Link key={r.id} href={`/jobs/${r.id}`} style={rowStyle} className="hover:bg-[#FAFAF8]">
              <div style={{ flex: 2, minWidth: 0 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginRight: 6 }}>{r.job_number}</span>
                <span style={{ color: C.fg, fontSize: 13 }}>{r.title}</span>
                <span style={{ color: C.muted, fontSize: 11, display: 'block' }}>{r.scheduled_start ? formatDate(r.scheduled_start) : '—'}</span>
              </div>
              <span style={{ flex: 1.2, color: C.fg, fontSize: 12 }}>{r.customer}</span>
              <span style={numCell}>{formatCurrency(r.revenue)}</span>
              <span style={{ ...numCell, color: C.muted }}>{formatCurrency(r.labour)}</span>
              <span style={{ ...numCell, color: C.muted }}>{formatCurrency(r.materials)}</span>
              <span style={{ ...numCell, color: marginColor(r.marginPct), fontWeight: 500 }}>
                {formatCurrency(r.margin)}{r.marginPct != null && <span style={{ fontSize: 10, marginLeft: 4 }}>{r.marginPct}%</span>}
              </span>
            </Link>
          ))}
        </Table>
      ) : (
        <Table head={['Customer', 'Jobs', 'Revenue', 'Labour', 'Materials', 'Margin']}>
          {byCustomer.map(c => {
            const pct = c.revenue > 0 ? Math.round((c.margin / c.revenue) * 100) : null
            return (
              <div key={c.customer} style={rowStyle}>
                <span style={{ flex: 2, color: C.fg, fontSize: 13 }}>{c.customer}</span>
                <span style={{ flex: 1.2, color: C.muted, fontSize: 12 }}>{c.jobs}</span>
                <span style={numCell}>{formatCurrency(c.revenue)}</span>
                <span style={{ ...numCell, color: C.muted }}>{formatCurrency(c.labour)}</span>
                <span style={{ ...numCell, color: C.muted }}>{formatCurrency(c.materials)}</span>
                <span style={{ ...numCell, color: marginColor(pct), fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  {pct != null && (pct >= 15 ? <TrendingUp style={{ width: 12, height: 12 }} /> : <TrendingDown style={{ width: 12, height: 12 }} />)}
                  {formatCurrency(c.margin)}{pct != null && <span style={{ fontSize: 10 }}>{pct}%</span>}
                </span>
              </div>
            )
          })}
        </Table>
      )}
    </div>
  )
}

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: `1px solid ${C.border}`, textDecoration: 'none' }
const numCell: React.CSSProperties = { flex: 1, textAlign: 'right', fontSize: 12, color: C.fg }

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', gap: 12, padding: '9px 14px', backgroundColor: C.cream }}>
        {head.map((h, i) => (
          <span key={h} style={{ flex: i === 0 ? 2 : i === 1 ? 1.2 : 1, textAlign: i < 2 ? 'left' : 'right', color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      {children}
    </div>
  )
}
