'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { TrendingUp, DollarSign, Users, AlertCircle, CheckCircle, Download } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS_DOT: Record<string, string> = {
  completed: '#76A58F', in_progress: '#2563eb', scheduled: '#3b82f6',
  pending: '#f59e0b', cancelled: '#dc2626',
}

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface Props {
  revenueByMonth: { label: string; revenue: number; expenses: number; profit: number }[]
  jobsByStatus: Record<string, number>
  jobsByMonth: { label: string; count: number }[]
  topClients: { name: string; total: number; invoiceCount: number }[]
  techPerformance: { name: string; role: string; jobsCompleted: number; jobsTotal: number; hoursLogged: number }[]
  totalRevenue: number; totalExpenses: number; outstandingAmount: number; completionRate: number
  newContactsThisMonth: number; totalJobs: number; totalContacts: number
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

export function ReportsView({ revenueByMonth, jobsByStatus, jobsByMonth, topClients, techPerformance, totalRevenue, totalExpenses, outstandingAmount, completionRate, newContactsThisMonth, totalJobs, totalContacts }: Props) {
  const profit = totalRevenue - totalExpenses
  const totalStatusJobs = Object.values(jobsByStatus).reduce((a, b) => a + b, 0)

  function exportCSV() {
    const rows = [['Month', 'Revenue', 'Expenses', 'Profit'], ...revenueByMonth.map(r => [r.label, r.revenue, r.expenses, r.profit])]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'fieldcrm-report.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Analytics</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Reports</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Business performance overview</p>
        </div>
        <button onClick={exportCSV}
          style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
          className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
          <Download className="w-3.5 h-3.5" />Export CSV
        </button>
      </div>

      <div className="px-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue',   value: fmt(totalRevenue),   icon: DollarSign,  accent: C.sage,    sub: `${fmt(profit)} profit` },
            { label: 'Outstanding',     value: fmt(outstandingAmount), icon: AlertCircle, accent: '#b45309', sub: 'unpaid invoices' },
            { label: 'Job Completion',  value: `${completionRate}%`, icon: CheckCircle, accent: C.navy,    sub: `${totalJobs} total jobs` },
            { label: 'Total Clients',   value: totalContacts.toString(), icon: Users,    accent: '#2563eb', sub: `+${newContactsThisMonth} this month` },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.accent}`, padding: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon style={{ width: 14, height: 14, color: card.accent }} />
                <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{card.label}</span>
              </div>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24 }}>{card.value}</p>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
          <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 16 }}>Revenue vs Expenses (12 months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByMonth} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,62,80,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, fontSize: 12 }} labelStyle={{ color: C.navy }} formatter={(v) => [fmt(Number(v)), '']} />
              <Bar dataKey="revenue" name="Revenue" fill={C.sage} radius={[2,2,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="rgba(44,62,80,0.15)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Jobs by month */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 16 }}>Jobs Created (6 months)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={jobsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,62,80,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, fontSize: 12 }} labelStyle={{ color: C.navy }} />
                <Line type="monotone" dataKey="count" name="Jobs" stroke={C.sage} strokeWidth={2} dot={{ fill: C.sage, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Job status breakdown */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 16 }}>Job Status Breakdown</p>
            <div className="space-y-3">
              {Object.entries(jobsByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ color: '#4A5A65', fontSize: 12 }} className="flex items-center gap-1.5 capitalize">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_DOT[status] ?? C.muted, display: 'inline-block', flexShrink: 0 }} />
                      {status.replace('_', ' ')}
                    </span>
                    <span style={{ color: C.muted, fontSize: 11 }}>{count} <span style={{ color: 'rgba(44,62,80,0.3)' }}>({Math.round((count / totalStatusJobs) * 100)}%)</span></span>
                  </div>
                  <div style={{ height: 3, backgroundColor: 'rgba(44,62,80,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / totalStatusJobs) * 100}%`, backgroundColor: STATUS_DOT[status] ?? C.muted }} />
                  </div>
                </div>
              ))}
              {Object.keys(jobsByStatus).length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No job data yet</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top clients */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }}>
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Top Clients by Revenue</p>
            </div>
            {topClients.length === 0
              ? <div style={{ padding: '40px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}>No payment data yet</div>
              : <div className="divide-y divide-[rgba(44,62,80,0.07)]">
                {topClients.map((client, i) => (
                  <div key={client.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <span style={{ color: C.muted, fontSize: 11, width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{client.name}</p>
                      <p style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{client.invoiceCount} invoice{client.invoiceCount !== 1 ? 's' : ''}</p>
                    </div>
                    <span style={{ fontFamily: C.serif, color: C.sage, fontSize: 15 }}>{fmt(client.total)}</span>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* Technician performance */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }}>
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Technician Performance</p>
            </div>
            {techPerformance.length === 0
              ? <div style={{ padding: '40px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}>No technician data yet</div>
              : <div className="divide-y divide-[rgba(44,62,80,0.07)]">
                {techPerformance.map((tech, i) => {
                  const av = AVATAR_COLORS[tech.name.charCodeAt(0) % AVATAR_COLORS.length]
                  return (
                    <div key={tech.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                      <div style={{ width: 32, height: 32, backgroundColor: av.bg, color: av.color, fontSize: 11, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                        {tech.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{tech.name}</p>
                        <p style={{ color: C.muted, fontSize: 10, marginTop: 1, textTransform: 'capitalize' }}>{tech.role}</p>
                      </div>
                      <div className="text-right">
                        <p style={{ color: C.fg, fontSize: 12 }}>{tech.jobsCompleted}<span style={{ color: C.muted }}>/{tech.jobsTotal} jobs</span></p>
                        <p style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{tech.hoursLogged}h logged</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
