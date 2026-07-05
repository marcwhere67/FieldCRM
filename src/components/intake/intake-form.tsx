'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface Org { name: string; phone: string | null; email: string | null; logo_url: string | null }
interface Props { org: Org; orgSlug: string }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '10px 12px', outline: 'none',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

const SERVICE_TYPES = ['Standard Clean', 'Deep Clean', 'End of Lease', 'Other']

export function IntakeForm({ org, orgSlug }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', address: '',
    serviceType: 'Standard Clean', message: '',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.phone.trim()) { setError('First name and phone are required'); return }
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/intake/${orgSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)
    if (!res.ok) { setError('Something went wrong — please try again'); return }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.cream, padding: '48px 16px', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <CheckCircle style={{ width: 40, height: 40, color: C.sage, margin: '0 auto 16px' }} />
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300, marginBottom: 12 }}>Thanks, {form.firstName}!</h1>
          <p style={{ color: '#4A5A65', fontSize: 14, lineHeight: 1.6 }}>
            We've received your request and someone from {org.name} will be in touch shortly.
          </p>
          {org.phone && <p style={{ color: C.muted, fontSize: 13, marginTop: 16 }}>Or call us on {org.phone}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream, padding: '48px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }} className="space-y-6">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{org.name}</p>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Request a quote — tell us a bit about your place and we'll be in touch.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 24 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><span style={labelSt}>First name *</span><input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" required style={inp} /></div>
            <div><span style={labelSt}>Last name</span><input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Smith" style={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><span style={labelSt}>Phone *</span><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+61 4xx xxx xxx" required style={inp} /></div>
            <div><span style={labelSt}>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" style={inp} /></div>
          </div>
          <div><span style={labelSt}>Address</span><input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, Richmond VIC" style={inp} /></div>
          <div>
            <span style={labelSt}>Service type</span>
            <select value={form.serviceType} onChange={e => set('serviceType', e.target.value)} style={inp}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <span style={labelSt}>Message</span>
            <textarea value={form.message} onChange={e => set('message', e.target.value)}
              placeholder="Tell us about your space, any special requirements..." rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
            className="uppercase">
            {loading ? 'Sending…' : 'Request a quote'}
          </button>
        </form>
      </div>
    </div>
  )
}
