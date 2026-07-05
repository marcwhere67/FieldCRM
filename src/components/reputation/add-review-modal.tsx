'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Star } from 'lucide-react'

const PLATFORMS = ['Google', 'Facebook', 'Yelp', 'Trustpilot', 'Hipages', 'Other']

interface Review {
  id: string
  platform: string
  rating: number | null
  content: string | null
  author_name: string | null
  response: string | null
  responded_at: string | null
  ai_response_draft: string | null
  received_at: string
  contact_id: string | null
  job_id: string | null
  contacts: { first_name: string; last_name: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (review: Review) => void
}

const C = {
  navy: '#2C3E50', sage: '#76A58F', fg: '#1C2A35', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

export function AddReviewModal({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(5)
  const [hovered, setHovered] = useState(0)
  const [form, setForm] = useState({ platform: 'Google', author_name: '', content: '' })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.author_name.trim()) { toast.error('Author name is required'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rating }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Review added')
      onSaved(data)
      onClose()
      setForm({ platform: 'Google', author_name: '', content: '' })
      setRating(5)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>Log a Review</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span style={labelSt}>Platform</span>
              <select value={form.platform} onChange={e => set('platform', e.target.value)} style={inp}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <span style={labelSt}>Rating</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36 }}>
                {[1,2,3,4,5].map(n => (
                  <Star key={n}
                    style={{ width: 22, height: 22, cursor: 'pointer', color: '#f59e0b', fill: n <= (hovered || rating) ? '#f59e0b' : 'none' }}
                    onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(n)} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <span style={labelSt}>Reviewer Name</span>
            <input value={form.author_name} onChange={e => set('author_name', e.target.value)}
              placeholder="Jane Smith" style={inp} />
          </div>
          <div>
            <span style={labelSt}>Review Content <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></span>
            <textarea value={form.content} onChange={e => set('content', e.target.value)}
              placeholder="Great service, highly recommend…" rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
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
              {loading ? 'Saving…' : 'Add Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
