'use client'

import Link from 'next/link'
import { Plus, Repeat, Pause } from 'lucide-react'
import { formatCurrency, formatDate, melbourneDateOnly } from '@/lib/format'
import { computeTotals, type MoneyLine } from '@/lib/money'
import { occurrencesBetween, type Frequency } from '@/lib/recurring'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', fg: '#1C2A35',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.1)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const FREQ_LABEL: Record<string, string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', four_weekly: 'Every 4 weeks', monthly: 'Monthly',
}

interface Agreement {
  id: string; title: string; frequency: string; anchor_date: string; start_time: string
  end_date: string | null; active: boolean; line_items: unknown; last_generated_date: string | null
  contacts: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null
}

function nextDate(a: Agreement): string | null {
  const today = melbourneDateOnly()
  const yesterday = melbourneDateOnly(new Date(Date.now() - 86400000))
  const horizon = melbourneDateOnly(new Date(Date.now() + 90 * 86400000))
  const dates = occurrencesBetween(a.anchor_date, a.frequency as Frequency, yesterday, horizon, a.end_date)
  return dates.find(d => d >= today) ?? null
}

export function AgreementsList({ agreements, isManager }: { agreements: Agreement[]; isManager: boolean }) {
  return (
    <div style={{ maxWidth: 900 }} className="space-y-6">
      <div className="flex items-end justify-between pb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Operations</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy }} className="text-3xl font-light">Recurring services</h1>
          <p style={{ color: C.muted }} className="text-xs mt-1">{agreements.length} active plan{agreements.length === 1 ? '' : 's'}</p>
        </div>
        {isManager && (
          <Link href="/agreements/new">
            <button style={{ backgroundColor: C.navy, color: '#fff', letterSpacing: '0.1em' }} className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase hover:opacity-80 transition-opacity">
              <Plus className="w-3.5 h-3.5" />New recurring service
            </button>
          </Link>
        )}
      </div>

      {agreements.length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }} className="flex flex-col items-center justify-center py-20 gap-3">
          <Repeat className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
          <p style={{ color: C.muted }} className="text-sm">No recurring services yet</p>
          <p style={{ color: C.muted, opacity: 0.7 }} className="text-[11px]">Set one up to auto-schedule regular cleans</p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
          {agreements.map((a, i) => {
            const contact = Array.isArray(a.contacts) ? a.contacts[0] : a.contacts
            const total = computeTotals((Array.isArray(a.line_items) ? a.line_items : []) as MoneyLine[]).total
            const next = a.active ? nextDate(a) : null
            return (
              <Link key={a.id} href={`/agreements/${a.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, opacity: a.active ? 1 : 0.55, textDecoration: 'none' }}
                className="hover:bg-[#FAFAF8] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ color: C.fg, fontSize: 14, fontWeight: 500 }}>{a.title}</p>
                    {!a.active && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, padding: '1px 6px', textTransform: 'uppercase' }}><Pause style={{ width: 9, height: 9 }} />Paused</span>}
                  </div>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                    {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'} · {FREQ_LABEL[a.frequency] ?? a.frequency}
                    {next && <> · next {formatDate(next)}</>}
                  </p>
                </div>
                <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 18 }}>{formatCurrency(total)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
