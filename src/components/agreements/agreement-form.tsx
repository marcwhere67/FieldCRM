'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X, ArrowLeft, Repeat } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, melbourneDateOnly } from '@/lib/format'
import { computeTotals, lineSubtotal } from '@/lib/money'
import { occurrencesBetween, type Frequency } from '@/lib/recurring'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', fg: '#1C2A35',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.12)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}
const inp: React.CSSProperties = { backgroundColor: '#fff', border: `1px solid ${C.border}`, color: C.fg, fontSize: 13, height: 38, width: '100%', padding: '0 10px', outline: 'none' }
const label: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'four_weekly', label: 'Every 4 weeks' },
  { value: 'monthly', label: 'Monthly' },
]

interface Contact { id: string; first_name: string; last_name: string; company_name: string | null }
interface Property { id: string; label: string | null; address_line1: string | null; suburb: string | null; contact_id: string }
interface Team { id: string; full_name: string }
interface Line { description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }
export interface ExistingAgreement {
  id: string; contact_id: string; property_id: string | null; title: string; frequency: Frequency
  anchor_date: string; start_time: string; duration_minutes: number; end_date: string | null
  first_visit_date?: string | null
  instructions: string | null; assigned_users: string[] | null; line_items: Line[] | null
}

export function AgreementForm({ contacts, properties, team, initialContactId, existing }: {
  contacts: Contact[]; properties: Property[]; team: Team[]; initialContactId: string | null; existing?: ExistingAgreement | null
}) {
  const router = useRouter()
  const editing = !!existing
  const [saving, setSaving] = useState(false)
  const [contactId, setContactId] = useState(existing?.contact_id ?? initialContactId ?? '')
  const [propertyId, setPropertyId] = useState(existing?.property_id ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'fortnightly')
  const [anchorDate, setAnchorDate] = useState(existing?.anchor_date ?? melbourneDateOnly())
  const [firstVisitDate, setFirstVisitDate] = useState(existing?.first_visit_date ?? '')
  const [startTime, setStartTime] = useState((existing?.start_time ?? '09:00').slice(0, 5))
  const [duration, setDuration] = useState(existing?.duration_minutes ?? 120)
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [instructions, setInstructions] = useState(existing?.instructions ?? '')
  const [assignees, setAssignees] = useState<string[]>(existing?.assigned_users ?? [])
  const [lines, setLines] = useState<Line[]>(existing?.line_items?.length ? existing.line_items : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 }])

  const contactProps = properties.filter(p => p.contact_id === contactId)
  const { subtotal, tax, total } = computeTotals(lines)

  // Live preview of the next few occurrences.
  const preview = useMemo(() => {
    if (!anchorDate) return []
    const dayBefore = melbourneDateOnly(new Date(new Date(anchorDate + 'T00:00:00Z').getTime() - 86400000))
    const horizon = melbourneDateOnly(new Date(new Date(anchorDate + 'T00:00:00Z').getTime() + 120 * 86400000))
    const cadence = occurrencesBetween(anchorDate, frequency, dayBefore, horizon, endDate || null)
    // Prepend the optional one-off first visit so the preview matches generation.
    const withFirst = firstVisitDate && !cadence.includes(firstVisitDate)
      ? [firstVisitDate, ...cadence].sort()
      : cadence
    return withFirst.slice(0, 5)
  }, [anchorDate, frequency, endDate, firstVisitDate])

  function updateLine(i: number, field: 'description' | 'quantity' | 'unit_price', value: string) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const u = { ...l, [field]: field === 'description' ? value : Number(value) || 0 }
      u.subtotal = lineSubtotal(Number(u.quantity), Number(u.unit_price))
      return u
    }))
  }

  async function submit() {
    if (!title.trim()) { toast.error('Give it a title'); return }
    if (!contactId) { toast.error('Choose a customer'); return }
    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/agreements/${existing!.id}` : '/api/agreements', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, contact_id: contactId, property_id: propertyId || null, frequency,
          anchor_date: anchorDate, first_visit_date: firstVisitDate || null, start_time: startTime, duration_minutes: duration,
          end_date: endDate || null, instructions: instructions || null,
          assigned_users: assignees,
          line_items: lines.filter(l => l.description.trim() || l.unit_price > 0),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success(editing ? 'Changes saved' : 'Recurring service set up')
      router.push(editing ? `/agreements/${existing!.id}` : '/agreements')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }} className="space-y-6">
      <div>
        <Link href={editing ? `/agreements/${existing!.id}` : '/agreements'} style={{ color: C.muted, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> {editing ? 'Back to service' : 'Recurring services'}
        </Link>
        <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300, marginTop: 8 }}>{editing ? 'Edit recurring service' : 'New recurring service'}</h1>
      </div>

      {/* Customer + property */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span style={label}>Customer *</span>
          <select value={contactId} onChange={e => { setContactId(e.target.value); setPropertyId('') }} style={inp}>
            <option value="">Choose a customer…</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.company_name ? ` · ${c.company_name}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={label}>Property</span>
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={inp} disabled={!contactId}>
            <option value="">{contactId ? 'Default / not set' : 'Pick a customer first'}</option>
            {contactProps.map(p => (
              <option key={p.id} value={p.id}>{p.label || p.address_line1}{p.suburb ? `, ${p.suburb}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span style={label}>Title *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fortnightly house clean" style={inp} />
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span style={label}>Repeats *</span>
          <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} style={inp}>
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Regular schedule starts *</span>
          <input type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)} style={inp} />
          <span style={{ color: C.muted, fontSize: 10, marginTop: 3, display: 'block' }}>The day the recurring visits follow (e.g. every Thursday).</span>
        </div>
        <div>
          <span style={label}>First visit — if different (optional)</span>
          <input type="date" value={firstVisitDate} onChange={e => setFirstVisitDate(e.target.value)} style={inp} />
          <span style={{ color: C.muted, fontSize: 10, marginTop: 3, display: 'block' }}>Only if the very first clean is on a different day (e.g. a Tuesday) than the regular schedule.</span>
        </div>
        <div>
          <span style={label}>Start time</span>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inp} />
        </div>
        <div>
          <span style={label}>Duration (minutes)</span>
          <input type="number" min={15} step={15} value={duration} onChange={e => setDuration(Number(e.target.value) || 120)} style={inp} />
        </div>
        <div>
          <span style={label}>End date (optional)</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inp} />
        </div>
      </div>

      {/* Occurrence preview */}
      {preview.length > 0 && (
        <div style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Repeat style={{ width: 13, height: 13, color: C.sage }} />
          <span style={{ color: C.muted, fontSize: 11 }}>Next visits:</span>
          {preview.map(d => (
            <span key={d} style={{ color: C.navy, fontSize: 11, backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '2px 7px' }}>{formatDate(d)}</span>
          ))}
          <span style={{ color: C.muted, fontSize: 11 }}>…</span>
        </div>
      )}

      {/* Price / line items */}
      <div>
        <span style={label}>Price per visit</span>
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderBottom: i < lines.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" style={{ ...inp, flex: 1, height: 32, border: 'none' }} />
              <input type="number" min={0} value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} style={{ ...inp, width: 64, height: 32, textAlign: 'right' }} />
              <input type="number" min={0} step={0.01} value={l.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} placeholder="0.00" style={{ ...inp, width: 90, height: 32, textAlign: 'right' }} />
              <span style={{ width: 80, textAlign: 'right', color: C.navy, fontSize: 13 }}>{formatCurrency(l.subtotal)}</span>
              {lines.length > 1 && <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 14, height: 14 }} /></button>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => setLines(prev => [...prev, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 }])}
            style={{ color: C.sage, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus style={{ width: 13, height: 13 }} /> Add line
          </button>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: C.muted, fontSize: 11, marginRight: 10 }}>incl. {formatCurrency(tax)} GST</span>
            <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 20 }}>{formatCurrency(total)}</span>
            <span style={{ color: C.muted, fontSize: 11 }}> / visit</span>
          </div>
        </div>
      </div>

      {/* Assignees */}
      {team.length > 0 && (
        <div>
          <span style={label}>Assign to</span>
          <div className="flex flex-wrap gap-2">
            {team.map(t => {
              const on = assignees.includes(t.id)
              return (
                <button key={t.id} onClick={() => setAssignees(prev => on ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ fontSize: 12, padding: '5px 12px', border: `1px solid ${on ? C.sage : C.border}`, backgroundColor: on ? 'rgba(118,165,143,0.12)' : '#fff', color: on ? C.navy : C.muted, cursor: 'pointer' }}>
                  {t.full_name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <span style={label}>Instructions (optional)</span>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }} placeholder="Access notes, gate code, priorities…" />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={submit} disabled={saving}
          style={{ backgroundColor: C.navy, color: '#fff', padding: '11px 24px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Set up recurring service'}
        </button>
        <Link href={editing ? `/agreements/${existing!.id}` : '/agreements'} style={{ color: C.muted, fontSize: 12 }}>Cancel</Link>
      </div>
    </div>
  )
}
