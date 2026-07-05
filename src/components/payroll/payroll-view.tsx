'use client'

import { useState } from 'react'
import { Download, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

interface TimesheetEntry {
  id: string; clocked_in_at: string; clocked_out_at: string | null
  total_minutes: number | null; job_id: string | null; approved: boolean
  jobs: { title: string } | null
}
interface EmployeeSummary {
  id: string; full_name: string; email: string; role: string
  hourly_rate: number | null; timesheets: TimesheetEntry[]
}
interface Props { employees: EmployeeSummary[]; periodStart: string; periodEnd: string }

function minutesToHours(minutes: number) { return Math.round((minutes / 60) * 100) / 100 }
function fmtHours(h: number) { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h` }
function fmtMoney(n: number) { return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export function PayrollView({ employees, periodStart: initStart, periodEnd: initEnd }: Props) {
  const [start, setStart] = useState(initStart)
  const [end, setEnd] = useState(initEnd)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<EmployeeSummary[]>(employees)

  async function fetchPeriod(s: string, e: string) {
    if (!s || !e || s > e) return
    setLoading(true)
    const res = await fetch(`/api/payroll?start=${s}&end=${e}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  function handleStartChange(val: string) { setStart(val); fetchPeriod(val, end) }
  function handleEndChange(val: string) { setEnd(val); fetchPeriod(start, val) }

  const summaries = data.map(emp => {
    const sheets = emp.timesheets.filter(t => {
      const d = t.clocked_in_at.split('T')[0]
      return d >= start && d <= end && t.clocked_out_at && t.total_minutes
    })
    const totalMins = sheets.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
    const totalHours = minutesToHours(totalMins)
    const rate = emp.hourly_rate ?? 0
    const gross = Math.round(totalHours * rate * 100) / 100
    const unapproved = sheets.filter(t => !t.approved).length
    return { ...emp, sheets, totalHours, gross, unapproved }
  }).filter(e => e.sheets.length > 0 || data.length <= 3)

  const grandHours = summaries.reduce((s, e) => s + e.totalHours, 0)
  const grandGross = summaries.reduce((s, e) => s + e.gross, 0)
  const totalUnapproved = summaries.reduce((s, e) => s + e.unapproved, 0)

  function exportCSV() {
    const rows = [['Employee','Email','Role','Hours','Hourly Rate','Gross Pay','Unapproved Entries']]
    summaries.forEach(e => rows.push([e.full_name, e.email, e.role, e.totalHours.toFixed(2), e.hourly_rate != null ? e.hourly_rate.toFixed(2) : '', e.gross.toFixed(2), String(e.unapproved)]))
    rows.push(['','','',grandHours.toFixed(2),'',grandGross.toFixed(2),''])
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `payroll-${start}-to-${end}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function exportDetailedCSV() {
    const rows = [['Employee','Date','Clock In','Clock Out','Hours','Job','Approved','Hourly Rate','Pay']]
    summaries.forEach(e => e.sheets.forEach(t => {
      const hours = minutesToHours(t.total_minutes ?? 0)
      const pay = Math.round(hours * (e.hourly_rate ?? 0) * 100) / 100
      rows.push([e.full_name, t.clocked_in_at.split('T')[0], new Date(t.clocked_in_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }), t.clocked_out_at ? new Date(t.clocked_out_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '', hours.toFixed(2), t.jobs?.title ?? '', t.approved ? 'Yes' : 'No', e.hourly_rate != null ? e.hourly_rate.toFixed(2) : '', pay.toFixed(2)])
    }))
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `payroll-detailed-${start}-to-${end}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const periodBtns = [
    { label: 'This week', fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return [mon, sun] } },
    { label: 'Last week', fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() - 6); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return [mon, sun] } },
    { label: 'This month', fn: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)] } },
    { label: 'Last month', fn: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)] } },
  ]

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>HR</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Payroll Export</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Timesheet summary for pay period</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportDetailedCSV}
            style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Download style={{ width: 13, height: 13 }} />Detailed CSV
          </button>
          <button onClick={exportCSV}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Download style={{ width: 13, height: 13 }} />Summary CSV
          </button>
        </div>
      </div>

      <div className="px-6 space-y-5">
        {/* Period picker */}
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '16px 18px' }} className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input type="date" value={start} onChange={e => handleStartChange(e.target.value)}
              style={{ border: `1px solid rgba(44,62,80,0.15)`, padding: '6px 10px', fontSize: 13, color: C.fg, outline: 'none', borderRadius: 0 }} className="focus:border-[#76A58F]" />
            <span style={{ color: C.muted }}>—</span>
            <input type="date" value={end} min={start} onChange={e => handleEndChange(e.target.value)}
              style={{ border: `1px solid rgba(44,62,80,0.15)`, padding: '6px 10px', fontSize: 13, color: C.fg, outline: 'none', borderRadius: 0 }} className="focus:border-[#76A58F]" />
          </div>
          <div style={{ width: 1, height: 20, backgroundColor: C.border }} />
          <div className="flex gap-1.5 flex-wrap">
            {periodBtns.map(({ label, fn }) => (
              <button key={label} onClick={() => {
                const [s, e] = fn()
                const fmtD = (d: Date) => d.toISOString().split('T')[0]
                setStart(fmtD(s)); setEnd(fmtD(e)); fetchPeriod(fmtD(s), fmtD(e))
              }} style={{ padding: '5px 10px', border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, cursor: 'pointer' }}
              className="hover:text-[#2C3E50] hover:border-[rgba(44,62,80,0.2)] transition-colors">{label}</button>
            ))}
          </div>
          {loading && <span style={{ color: C.muted, fontSize: 12 }}>Loading…</span>}
        </div>

        {/* Alert */}
        {totalUnapproved > 0 && (
          <div style={{ border: '1px solid rgba(180,83,9,0.2)', backgroundColor: 'rgba(180,83,9,0.05)', padding: '10px 14px' }} className="flex items-center gap-3">
            <AlertTriangle style={{ width: 14, height: 14, color: '#b45309', flexShrink: 0 }} />
            <p style={{ color: '#b45309', fontSize: 12 }}>
              <strong>{totalUnapproved} timesheet {totalUnapproved === 1 ? 'entry' : 'entries'}</strong> in this period {totalUnapproved === 1 ? 'has' : 'have'} not been approved yet
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Employees', value: String(summaries.filter(e => e.totalHours > 0).length), accent: C.sage },
            { label: 'Total Hours', value: fmtHours(grandHours), accent: C.navy },
            { label: 'Gross Pay', value: fmtMoney(grandGross), accent: C.sage, serif: true },
            { label: 'Unapproved', value: String(totalUnapproved), accent: totalUnapproved > 0 ? '#b45309' : C.navy },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.accent}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{card.label}</p>
              <p style={{ fontFamily: card.serif ? C.serif : 'inherit', color: card.accent, fontSize: card.serif ? 24 : 20, fontWeight: card.serif ? 300 : 600 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Per-employee */}
        {summaries.length === 0 ? (
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '64px 24px', textAlign: 'center' }}>
            <p style={{ color: C.muted, fontSize: 13 }}>No timesheets found for this period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map(emp => {
              const av = AVATAR_COLORS[emp.full_name.charCodeAt(0) % AVATAR_COLORS.length]
              return (
                <div key={emp.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', overflow: 'hidden' }}>
                  <div className="flex items-center gap-4" style={{ padding: '14px 16px' }}>
                    <div style={{ width: 36, height: 36, backgroundColor: av.bg, color: av.color, fontSize: 12, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                      {emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }}>{emp.full_name}</p>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{emp.email}</p>
                    </div>
                    <div className="hidden md:grid grid-cols-4 gap-6 text-right shrink-0">
                      <div>
                        <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hours</p>
                        <p style={{ color: C.fg, fontSize: 13, fontWeight: 500 }}>{fmtHours(emp.totalHours)}</p>
                      </div>
                      <div>
                        <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rate</p>
                        <p style={{ color: C.fg, fontSize: 13 }}>{emp.hourly_rate != null ? `${fmtMoney(emp.hourly_rate)}/hr` : '—'}</p>
                      </div>
                      <div>
                        <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Gross</p>
                        <p style={{ fontFamily: C.serif, color: emp.gross > 0 ? C.navy : C.muted, fontSize: 15 }}>{emp.hourly_rate != null ? fmtMoney(emp.gross) : '—'}</p>
                      </div>
                      <div>
                        <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Entries</p>
                        <p style={{ color: C.fg, fontSize: 13 }}>
                          {emp.sheets.length}
                          {emp.unapproved > 0 && <span style={{ color: '#b45309', fontSize: 10, marginLeft: 4 }}>({emp.unapproved} pending)</span>}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}
                      style={{ color: C.muted, width: 28, height: 28, marginLeft: 8 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                      {expanded === emp.id ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                    </button>
                  </div>

                  {expanded === emp.id && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 2fr 2fr 1fr 1fr', gap: 8, padding: '8px 16px', color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream }}>
                        <div>Date</div><div>Clock In</div><div>Clock Out</div><div>Hours</div><div>Job</div><div>Pay</div><div style={{ textAlign: 'right' }}>Status</div>
                      </div>
                      {emp.sheets.map(t => {
                        const hours = minutesToHours(t.total_minutes ?? 0)
                        const pay = Math.round(hours * (emp.hourly_rate ?? 0) * 100) / 100
                        return (
                          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 2fr 2fr 1fr 1fr', gap: 8, padding: '9px 16px', fontSize: 11, borderBottom: `1px solid rgba(44,62,80,0.05)` }}
                            className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                            <div style={{ color: C.muted }}>{formatDate(t.clocked_in_at.split('T')[0])}</div>
                            <div style={{ color: '#4A5A65', fontFamily: 'monospace' }}>{new Date(t.clocked_in_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                            <div style={{ color: '#4A5A65', fontFamily: 'monospace' }}>{t.clocked_out_at ? new Date(t.clocked_out_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : <span style={{ color: C.sage }}>Active</span>}</div>
                            <div style={{ color: '#4A5A65' }}>{fmtHours(hours)}</div>
                            <div style={{ color: C.muted }} className="truncate">{t.jobs?.title ?? '—'}</div>
                            <div style={{ color: C.fg }}>{emp.hourly_rate != null ? fmtMoney(pay) : '—'}</div>
                            <div style={{ textAlign: 'right' }}>{t.approved ? <span style={{ color: C.sage }}>✓</span> : <span style={{ color: '#b45309' }}>Pending</span>}</div>
                          </div>
                        )
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 2fr 2fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 11, backgroundColor: C.cream, fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <div style={{ color: C.muted, gridColumn: '1 / 4' }}>Total</div>
                        <div style={{ color: C.navy }}>{fmtHours(emp.totalHours)}</div>
                        <div /><div style={{ color: C.navy, fontFamily: C.serif, fontSize: 13 }}>{emp.hourly_rate != null ? fmtMoney(emp.gross) : '—'}</div><div />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Grand total */}
            <div style={{ border: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '16px 18px' }} className="flex items-center justify-between">
              <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }}>Total Payroll</p>
              <div className="flex items-center gap-10 text-right">
                <div>
                  <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hours</p>
                  <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>{fmtHours(grandHours)}</p>
                </div>
                <div>
                  <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Gross Pay</p>
                  <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{fmtMoney(grandGross)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
