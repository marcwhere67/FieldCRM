'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)', inputBorder: 'rgba(44,62,80,0.15)',
}

const TIMEZONES = ['Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth','Australia/Adelaide','Australia/Darwin','Australia/Hobart','Pacific/Auckland']

interface Org { id: string; name: string; abn: string | null; phone: string | null; email: string | null; address: string | null; default_payment_terms_days: number; timezone: string; subscription_plan: string }

export function BusinessSettings({ org }: { org: Org }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: org.name, abn: org.abn ?? '', phone: org.phone ?? '',
    email: org.email ?? '', address: org.address ?? '',
    default_payment_terms_days: String(org.default_payment_terms_days), timezone: org.timezone,
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, default_payment_terms_days: Number(form.default_payment_terms_days) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Business settings saved')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  const inputStyle = { backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' }
  const labelStyle = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  return (
    <div style={{ maxWidth: 560 }} className="space-y-6">
      <div>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 500 }}>Business Information</h2>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>Details shown on quotes, invoices and client-facing documents</p>
      </div>

      <div style={{ backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.09)`, padding: 20 }} className="space-y-4">
        <div>
          <label style={labelStyle}>Business Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} className="focus:border-[#76A58F] focus:ring-2 focus:ring-[#76A58F]/20" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>ABN</label>
            <input value={form.abn} onChange={e => set('abn', e.target.value)} placeholder="12 345 678 901" style={inputStyle} className="focus:border-[#76A58F]" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(07) 3000 0000" style={inputStyle} className="focus:border-[#76A58F]" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Business Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="hello@yourbusiness.com.au" style={inputStyle} className="focus:border-[#76A58F]" />
        </div>
        <div>
          <label style={labelStyle}>Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, Brisbane QLD 4000" style={inputStyle} className="focus:border-[#76A58F]" />
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.09)`, padding: 20 }}>
        <h3 style={{ color: C.navy, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Preferences</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Payment Terms (days)</label>
            <input type="number" min="0" value={form.default_payment_terms_days} onChange={e => set('default_payment_terms_days', e.target.value)} style={inputStyle} className="focus:border-[#76A58F]" />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <Select value={form.timezone} onValueChange={v => set('timezone', v ?? org.timezone)}>
              <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, color: C.fg, fontSize: 13 }} className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.12)` }} className="rounded-none">
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz} style={{ color: C.fg, fontSize: 12 }}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.09)`, padding: 20 }}>
        <h3 style={{ color: C.navy, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Integrations</h3>
        <div className="space-y-2">
          {[
            { label: 'Stripe', desc: 'Payment processing' },
            { label: 'Twilio', desc: 'SMS messaging' },
            { label: 'Resend', desc: 'Email delivery' },
          ].map(i => (
            <div key={i.label} style={{ border: `1px solid rgba(44,62,80,0.09)`, padding: '12px 14px' }} className="flex items-center justify-between">
              <div>
                <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{i.label}</p>
                <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{i.desc}</p>
              </div>
              <span style={{ color: C.muted, fontSize: 10, letterSpacing: '0.08em', backgroundColor: 'rgba(44,62,80,0.06)', padding: '3px 10px', textTransform: 'uppercase' }}>Not connected</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          style={{ backgroundColor: C.navy, color: '#fff', padding: '8px 18px', fontSize: 11, letterSpacing: '0.1em' }}
          className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
          <Save className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
