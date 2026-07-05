'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface Stage { id: string; name: string; color: string }

interface Contact {
  id: string; first_name: string; last_name: string; company_name: string | null
  phone: string | null; email: string | null; pipeline_stage_id: string | null; created_at: string
}

interface Props {
  orgId: string
  defaultStageId: string | null
  stages: Stage[]
  onClose: () => void
  onCreated: (contact: Contact) => void
}

const C = {
  navy: '#2C3E50', fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

export function QuickAddModal({ orgId, defaultStageId, stages, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!firstName.trim()) { toast.error('First name is required'); return }
    setSaving(true)
    const res = await fetch('/api/pipeline/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName.trim(), lastName: lastName.trim(),
        company: company.trim() || null, phone: phone.trim() || null,
        email: email.trim() || null, stageId: stageId || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to create lead')
    else { onCreated(data.contact); toast.success('Lead added') }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>Add Lead</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span style={labelSt}>First name *</span>
              <input autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} />
            </div>
            <div>
              <span style={labelSt}>Last name</span>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <span style={labelSt}>Company</span>
            <input value={company} onChange={e => setCompany(e.target.value)} style={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span style={labelSt}>Phone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inp} />
            </div>
            <div>
              <span style={labelSt}>Email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inp} />
            </div>
          </div>
          <div>
            <span style={labelSt}>Pipeline stage</span>
            <select value={stageId} onChange={e => setStageId(e.target.value)} style={inp}>
              <option value="">No stage</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '8px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer' }}
              className="uppercase hover:opacity-70 transition-opacity">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: '8px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              className="uppercase">
              {saving ? 'Adding…' : 'Add Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
