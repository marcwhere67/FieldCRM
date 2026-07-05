'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface PipelineStage { id: string; name: string }

interface Campaign {
  id: string; name: string; type: string; status: string; subject: string | null
  content: string | null; audience_filters: Record<string, unknown>; scheduled_at: string | null
  sent_at: string | null; recipient_count: number; open_count: number; click_count: number
  reply_count: number; created_at: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (campaign: Campaign) => void
  pipelineStages: PipelineStage[]
  initial?: Campaign | null
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

export function CampaignForm({ open, onClose, onSaved, pipelineStages, initial }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'email',
    subject: initial?.subject ?? '',
    content: initial?.content ?? '',
    pipeline_stage_id: ((initial?.audience_filters ?? {}) as Record<string, string>).pipeline_stage_id ?? '',
    scheduled_at: initial?.scheduled_at ? initial.scheduled_at.slice(0, 16) : '',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.content.trim()) { toast.error('Content is required'); return }
    if (form.type === 'email' && !form.subject.trim()) { toast.error('Subject is required for email campaigns'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name, type: form.type,
        subject: form.type === 'email' ? form.subject : null,
        content: form.content,
        audience_filters: form.pipeline_stage_id ? { pipeline_stage_id: form.pipeline_stage_id } : {},
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }
      const url = initial ? `/api/campaigns/${initial.id}` : '/api/campaigns'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(initial ? 'Campaign updated' : 'Campaign created')
      onSaved(data)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, boxShadow: '0 8px 40px rgba(44,62,80,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>{initial ? 'Edit Campaign' : 'New Campaign'}</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20 }} className="space-y-4">
          <div>
            <span style={labelSt}>Campaign Name</span>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Summer Re-engagement" style={inp} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span style={labelSt}>Type</span>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <span style={labelSt}>Audience — Pipeline Stage</span>
              <select value={form.pipeline_stage_id} onChange={e => set('pipeline_stage_id', e.target.value)} style={inp}>
                <option value="">All contacts</option>
                {pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {form.type === 'email' && (
            <div>
              <span style={labelSt}>Subject Line</span>
              <input value={form.subject} onChange={e => set('subject', e.target.value)}
                placeholder="We miss you — here's 10% off your next service" style={inp} />
            </div>
          )}

          <div>
            <span style={labelSt}>{form.type === 'sms' ? 'Message' : 'Email Body'}</span>
            <textarea value={form.content} onChange={e => set('content', e.target.value)}
              placeholder={form.type === 'sms'
                ? "Hi {first_name}, it's been a while! Book your next service at..."
                : 'Hi {first_name},\n\nWe wanted to reach out...'}
              rows={6} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
            <p style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Use {'{first_name}'} and {'{last_name}'} as personalisation tokens</p>
          </div>

          <div>
            <span style={labelSt}>Schedule <span style={{ fontWeight: 400 }}>(optional — leave blank to save as draft)</span></span>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} style={inp} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer' }}
              className="uppercase hover:opacity-70 transition-opacity">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              className="uppercase">
              {loading ? 'Saving…' : initial ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
