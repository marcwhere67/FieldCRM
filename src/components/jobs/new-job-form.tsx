'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Contact { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null }
interface Property { id: string; address_line1: string; suburb: string; state: string; contact_id: string }
interface TeamMember { id: string; full_name: string }

interface Props {
  orgId: string
  contacts: Contact[]
  teamMembers: TeamMember[]
  initialContactId?: string
  initialProperties: Property[]
}

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

export function NewJobForm({ orgId, contacts, teamMembers, initialContactId, initialProperties }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<Property[]>(initialProperties)

  const [form, setForm] = useState({
    contact_id: initialContactId ?? '', property_id: '', title: '', description: '',
    job_type: 'one_off', status: 'draft', scheduled_start: '', scheduled_end: '',
    assigned_to: '', instructions: '',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  useEffect(() => {
    if (!form.contact_id) { setProperties([]); return }
    supabase.from('properties').select('id, address_line1, suburb, state, contact_id')
      .eq('org_id', orgId).eq('contact_id', form.contact_id)
      .then(({ data }) => setProperties(data ?? []))
  }, [form.contact_id, orgId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_id) { toast.error('Contact is required'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setLoading(true)

    const assignedUsers = form.assigned_to ? [form.assigned_to] : []

    const payload = {
      org_id: orgId,
      contact_id: form.contact_id,
      property_id: form.property_id || null,
      
      title: form.title.trim(),
      description: form.description.trim() || null,
      job_type: form.job_type,
      status: form.status,
      scheduled_start: form.scheduled_start ? new Date(form.scheduled_start).toISOString() : null,
      scheduled_end: form.scheduled_end ? new Date(form.scheduled_end).toISOString() : null,
      assigned_users: assignedUsers,
      instructions: form.instructions.trim() || null,
    }

    const { data, error } = await supabase.from('jobs').insert(payload).select('id').single()
    if (error) { toast.error('Failed to create job'); setLoading(false); return }
    toast.success('Job created')
    router.push(`/jobs/${data.id}`)
  }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <Link href="/jobs"
            style={{ color: C.sage, fontSize: 11, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8, textDecoration: 'none' }}
            className="uppercase hover:opacity-70 transition-opacity">
            <ArrowLeft style={{ width: 12, height: 12 }} />Back
          </Link>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Jobs</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>New Job</h1>
          <p style={{ color: C.muted, fontSize: 12 }}>Number assigned on save</p>
        </div>
      </div>

      <div className="px-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <Section title="Job Details">
            <div><span style={labelSt}>Title *</span><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Carpet cleaning" required style={inp} /></div>
            <div>
              <span style={labelSt}>Description</span>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Job details..." rows={3} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span style={labelSt}>Job type</span>
                <select value={form.job_type} onChange={e => set('job_type', e.target.value)} style={inp}>
                  <option value="one_off">One off</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
              <div>
                <span style={labelSt}>Status</span>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Contact & Property">
            <div>
              <span style={labelSt}>Contact *</span>
              <select value={form.contact_id} onChange={e => { set('contact_id', e.target.value); set('property_id', '') }} required style={inp}>
                <option value="">Select a contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''}</option>)}
              </select>
            </div>
            <div>
              <span style={labelSt}>Property</span>
              <select value={form.property_id} onChange={e => set('property_id', e.target.value)} disabled={!form.contact_id} style={inp}>
                <option value="">None</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.address_line1}, {p.suburb} {p.state}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Schedule & Assignment">
            <div className="grid grid-cols-2 gap-4">
              <div><span style={labelSt}>Start</span><input type="datetime-local" value={form.scheduled_start} onChange={e => set('scheduled_start', e.target.value)} style={inp} /></div>
              <div><span style={labelSt}>End</span><input type="datetime-local" value={form.scheduled_end} onChange={e => set('scheduled_end', e.target.value)} style={inp} /></div>
            </div>
            <div>
              <span style={labelSt}>Assigned to</span>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} style={inp}>
                <option value="">Unassigned</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <span style={labelSt}>Instructions</span>
              <textarea value={form.instructions} onChange={e => set('instructions', e.target.value)}
                placeholder="Special instructions for the team..." rows={3} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/jobs"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', textDecoration: 'none' }}
              className="uppercase hover:opacity-70 transition-opacity">
              Cancel
            </Link>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '9px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              className="uppercase">
              {loading ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const C = { navy: '#2C3E50', border: 'rgba(44,62,80,0.09)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)" }
  return (
    <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 16px' }}>
        <h2 style={{ color: C.navy, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{title}</h2>
      </div>
      <div style={{ padding: 16 }} className="space-y-4">{children}</div>
    </div>
  )
}
