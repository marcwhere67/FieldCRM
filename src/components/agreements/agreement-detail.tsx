'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, Pencil, Repeat, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate, formatTime, melbourneDateOnly } from '@/lib/format'
import { computeTotals, type MoneyLine } from '@/lib/money'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', fg: '#1C2A35',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.1)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}
const FREQ_LABEL: Record<string, string> = { weekly: 'Weekly', fortnightly: 'Fortnightly', four_weekly: 'Every 4 weeks', monthly: 'Monthly' }
const STATUS_COLOR: Record<string, string> = {
  draft: '#8A9BA6', scheduled: '#2563eb', in_progress: '#5d8c76', completed: '#5d8c76', cancelled: '#dc2626', invoiced: '#7c3aed', paid: '#5d8c76',
}

type One<T> = T | T[] | null
function one<T>(v: One<T>): T | null { return Array.isArray(v) ? (v[0] ?? null) : v }

interface Agreement {
  id: string; title: string; frequency: string; anchor_date: string; start_time: string
  duration_minutes: number; end_date: string | null; active: boolean; line_items: unknown
  instructions: string | null; last_generated_date: string | null; property_id: string | null
  contacts: One<{ id: string; first_name: string; last_name: string }>
  properties: One<{ id: string; label: string | null; address_line1: string | null; suburb: string | null }>
}
interface Job { id: string; job_number: string; title: string; status: string; scheduled_start: string | null }

export function AgreementDetail({ agreement, jobs, isManager }: { agreement: Agreement; jobs: Job[]; isManager: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const contact = one(agreement.contacts)
  const property = one(agreement.properties)
  const total = computeTotals((Array.isArray(agreement.line_items) ? agreement.line_items : []) as MoneyLine[]).total

  const today = melbourneDateOnly()
  const upcoming = jobs.filter(j => j.scheduled_start && melbourneDateOnly(j.scheduled_start) >= today).reverse()
  const past = jobs.filter(j => !j.scheduled_start || melbourneDateOnly(j.scheduled_start) < today)

  async function call(method: 'PATCH' | 'DELETE', body?: unknown) {
    const res = await fetch(`/api/agreements/${agreement.id}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Something went wrong')
  }

  async function toggleActive() {
    setBusy(true)
    try { await call('PATCH', { active: !agreement.active }); toast.success(agreement.active ? 'Paused' : 'Resumed'); router.refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  async function generateNow() {
    setBusy(true)
    try {
      const res = await fetch('/api/agreements/generate', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      toast.success(d.created > 0 ? `${d.created} visit${d.created === 1 ? '' : 's'} scheduled` : 'Already up to date')
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  async function cancel() {
    if (!confirm('Cancel this recurring service? Upcoming un-started visits will be removed. Completed/invoiced ones are kept.')) return
    setBusy(true)
    try { await call('DELETE'); toast.success('Recurring service cancelled'); router.push('/agreements'); router.refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); setBusy(false) }
  }

  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 14px', border: `1px solid ${C.border}`, backgroundColor: '#fff', color: C.fg, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }

  return (
    <div style={{ maxWidth: 820 }} className="space-y-6">
      <Link href="/agreements" style={{ color: C.muted, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> Recurring services
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between pb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontFamily: C.serif, color: C.navy }} className="text-3xl font-light">{agreement.title}</h1>
            {!agreement.active && <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, padding: '2px 8px', textTransform: 'uppercase' }}>Paused</span>}
          </div>
          <p style={{ color: C.muted }} className="text-sm mt-1">
            {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'} · {FREQ_LABEL[agreement.frequency] ?? agreement.frequency} at {formatTime(`${agreement.anchor_date}T${agreement.start_time}`)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24 }}>{formatCurrency(total)}</p>
          <p style={{ color: C.muted, fontSize: 11 }}>per visit</p>
        </div>
      </div>

      {/* Manage actions */}
      {isManager && (
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleActive} disabled={busy} style={btn}>
            {agreement.active ? <><Pause style={{ width: 13, height: 13 }} />Pause</> : <><Play style={{ width: 13, height: 13 }} />Resume</>}
          </button>
          <button onClick={generateNow} disabled={busy} style={btn}><RefreshCw style={{ width: 13, height: 13 }} />Generate visits now</button>
          <Link href={`/agreements/${agreement.id}/edit`} style={btn}><Pencil style={{ width: 13, height: 13 }} />Edit</Link>
          <button onClick={cancel} disabled={busy} style={{ ...btn, color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' }}><Trash2 style={{ width: 13, height: 13 }} />Cancel service</button>
        </div>
      )}

      {/* Details */}
      <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: 16 }} className="grid grid-cols-2 gap-y-3 gap-x-6">
        {[
          ['Property', property ? (property.label || property.address_line1) + (property.suburb ? `, ${property.suburb}` : '') : 'Not set'],
          ['Duration', `${agreement.duration_minutes} min`],
          ['Starts', formatDate(agreement.anchor_date)],
          ['Ends', agreement.end_date ? formatDate(agreement.end_date) : 'No end (ongoing)'],
        ].map(([k, v]) => (
          <div key={k}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{k}</p>
            <p style={{ color: C.fg, fontSize: 13, marginTop: 2 }}>{v}</p>
          </div>
        ))}
        {agreement.instructions && (
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Instructions</p>
            <p style={{ color: C.fg, fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap' }}>{agreement.instructions}</p>
          </div>
        )}
      </div>

      {/* Upcoming visits */}
      <div>
        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Upcoming visits ({upcoming.length})</p>
        {upcoming.length === 0 ? (
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '20px', textAlign: 'center' }}>
            <Repeat style={{ width: 20, height: 20, color: 'rgba(44,62,80,0.15)', margin: '0 auto 8px' }} />
            <p style={{ color: C.muted, fontSize: 12 }}>{agreement.active ? 'None generated yet — “Generate visits now” to schedule ahead.' : 'Paused — no upcoming visits.'}</p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
            {upcoming.map((j, i) => <JobRow key={j.id} job={j} first={i === 0} />)}
          </div>
        )}
      </div>

      {/* Past visits */}
      {past.length > 0 && (
        <div>
          <p style={{ color: C.navy, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Past visits ({past.length})</p>
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
            {past.map((j, i) => <JobRow key={j.id} job={j} first={i === 0} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function JobRow({ job, first }: { job: Job; first: boolean }) {
  return (
    <Link href={`/jobs/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: first ? 'none' : `1px solid ${C.border}`, textDecoration: 'none' }} className="hover:bg-[#FAFAF8] transition-colors">
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, flexShrink: 0 }}>{job.job_number}</span>
      <span style={{ flex: 1, color: C.fg, fontSize: 13 }}>{job.scheduled_start ? formatDate(job.scheduled_start) : 'Unscheduled'}</span>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: STATUS_COLOR[job.status] ?? C.muted }}>{job.status.replace('_', ' ')}</span>
      <ChevronRight style={{ width: 13, height: 13, color: C.muted }} />
    </Link>
  )
}
