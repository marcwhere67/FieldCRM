'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileSpreadsheet } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

// Local YYYY-MM-DD (the inputs are date-only; the server treats the range as
// Melbourne calendar days, which is what a tradie means by "this month").
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type ExportType = 'xero-invoices' | 'myob-invoices' | 'bas'

const EXPORTS: { type: ExportType; label: string; sub: string }[] = [
  { type: 'xero-invoices', label: 'Xero', sub: 'Sales invoices CSV' },
  { type: 'myob-invoices', label: 'MYOB', sub: 'Sales CSV' },
  { type: 'bas', label: 'BAS summary', sub: 'GST by period' },
]

export function AccountingExport() {
  const now = new Date()
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(ymd(now))
  const [busy, setBusy] = useState<ExportType | null>(null)

  function setThisMonth() {
    setFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
    setTo(ymd(now))
  }
  function setLastMonth() {
    setFrom(ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
    setTo(ymd(new Date(now.getFullYear(), now.getMonth(), 0)))
  }
  function setThisFy() {
    // Australian FY: 1 July – 30 June.
    const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    setFrom(`${y}-07-01`)
    setTo(ymd(now))
  }

  async function download(type: ExportType) {
    if (from > to) {
      toast.error('The "from" date must be on or before the "to" date')
      return
    }
    setBusy(type)
    try {
      const res = await fetch(`/api/export?type=${type}&from=${from}&to=${to}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${from}_${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${type === 'bas' ? 'BAS summary' : type.split('-')[0].toUpperCase()} exported`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${C.border}`, padding: '6px 10px', fontSize: 13, color: C.fg, backgroundColor: '#fff',
  }
  const presetStyle: React.CSSProperties = {
    border: `1px solid ${C.border}`, padding: '4px 10px', fontSize: 11, color: C.navy, backgroundColor: '#fff', cursor: 'pointer',
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }} className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4" style={{ color: C.sage }} />
        <div>
          <h2 style={{ fontFamily: C.serif, color: C.navy, fontSize: 18, fontWeight: 300 }}>Accounting export</h2>
          <p style={{ color: C.muted, fontSize: 12 }}>Xero / MYOB sales and a BAS-ready GST summary for your accountant</p>
        </div>
      </div>

      <div style={{ padding: 20 }} className="space-y-4">
        {/* Period */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>From</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1">
            <span style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>To</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </label>
          <div className="flex items-center gap-1.5">
            <button onClick={setThisMonth} style={presetStyle} className="hover:bg-neutral-50">This month</button>
            <button onClick={setLastMonth} style={presetStyle} className="hover:bg-neutral-50">Last month</button>
            <button onClick={setThisFy} style={presetStyle} className="hover:bg-neutral-50">This FY</button>
          </div>
        </div>

        {/* Downloads */}
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map((e) => (
            <button
              key={e.type}
              onClick={() => download(e.type)}
              disabled={busy !== null}
              style={{ border: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '10px 16px', cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== e.type ? 0.5 : 1 }}
              className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity disabled:cursor-wait"
            >
              <Download className="w-4 h-4" style={{ color: C.navy }} />
              <span className="text-left">
                <span style={{ display: 'block', color: C.navy, fontSize: 13, fontWeight: 500 }}>{busy === e.type ? 'Preparing…' : e.label}</span>
                <span style={{ display: 'block', color: C.muted, fontSize: 11 }}>{e.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
