'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  orgId: string
  teamMembers: { id: string; full_name: string }[]
  pipelineStages: { id: string; name: string }[]
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

export function NewContactForm({ orgId, teamMembers, pipelineStages }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company_name: '',
    address_line1: '', suburb: '', state: '', postcode: '',
    status: 'active', source: '', assigned_to: '', pipeline_stage_id: '', notes: '',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { toast.error('First name is required'); return }
    setLoading(true)

    const payload: Record<string, string | null> = {
      org_id: orgId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company_name: form.company_name.trim() || null,
      address_line1: form.address_line1.trim() || null,
      suburb: form.suburb.trim() || null,
      state: form.state.trim() || null,
      postcode: form.postcode.trim() || null,
      status: form.status,
      source: form.source || null,
      assigned_to: form.assigned_to || null,
      pipeline_stage_id: form.pipeline_stage_id || null,
      notes: form.notes.trim() || null,
    }

    const { data, error } = await supabase.from('contacts').insert(payload).select('id').single()
    if (error) { toast.error('Failed to create contact'); setLoading(false); return }
    toast.success('Contact created')
    router.push(`/contacts/${data.id}`)
  }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <Link href="/contacts"
            style={{ color: C.sage, fontSize: 11, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8, textDecoration: 'none' }}
            className="uppercase hover:opacity-70 transition-opacity">
            <ArrowLeft style={{ width: 12, height: 12 }} />Back
          </Link>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Contacts</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>New Contact</h1>
        </div>
      </div>

      <div className="px-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {/* Basic info */}
          <Section title="Basic Information">
            <div className="grid grid-cols-2 gap-4">
              <div><span style={labelSt}>First name *</span><input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" required style={inp} /></div>
              <div><span style={labelSt}>Last name</span><input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" style={inp} /></div>
            </div>
            <div><span style={labelSt}>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" style={inp} /></div>
            <div><span style={labelSt}>Phone</span><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+61 4xx xxx xxx" style={inp} /></div>
            <div><span style={labelSt}>Company</span><input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme Pty Ltd" style={inp} /></div>
          </Section>

          {/* Address */}
          <Section title="Address">
            <div><span style={labelSt}>Street address</span><input value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="123 Main St" style={inp} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><span style={labelSt}>Suburb</span><input value={form.suburb} onChange={e => set('suburb', e.target.value)} placeholder="Richmond" style={inp} /></div>
              <div>
                <span style={labelSt}>State</span>
                <select value={form.state} onChange={e => set('state', e.target.value)} style={inp}>
                  <option value="">—</option>
                  {['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><span style={labelSt}>Postcode</span><input value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="3000" style={inp} /></div>
            </div>
          </Section>

          {/* CRM */}
          <Section title="CRM">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span style={labelSt}>Status</span>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>
              <div>
                <span style={labelSt}>Source</span>
                <select value={form.source} onChange={e => set('source', e.target.value)} style={inp}>
                  <option value="">—</option>
                  {['Google','Facebook','Instagram','Referral','Manual','Website','Other'].map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span style={labelSt}>Assigned to</span>
                <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} style={inp}>
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <span style={labelSt}>Pipeline stage</span>
                <select value={form.pipeline_stage_id} onChange={e => set('pipeline_stage_id', e.target.value)} style={inp}>
                  <option value="">None</option>
                  {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <span style={labelSt}>Notes</span>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any notes about this contact..." rows={3} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/contacts"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', textDecoration: 'none' }}
              className="uppercase hover:opacity-70 transition-opacity">
              Cancel
            </Link>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '9px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              className="uppercase">
              {loading ? 'Creating…' : 'Create Contact'}
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
