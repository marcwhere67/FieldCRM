'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Star, ChevronDown, ChevronUp, Send, Trash2, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/format'

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

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const PLATFORM_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Google:     { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  Facebook:   { bg: 'rgba(79,70,229,0.07)',   color: '#6366f1', border: 'rgba(79,70,229,0.2)' },
  Yelp:       { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  Trustpilot: { bg: 'rgba(5,150,105,0.07)',   color: '#059669', border: 'rgba(5,150,105,0.2)' },
  Hipages:    { bg: 'rgba(234,88,12,0.07)',   color: '#ea580c', border: 'rgba(234,88,12,0.2)' },
  Other:      { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

function Stars({ rating }: { rating: number | null }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} style={{ width: 13, height: 13, color: '#f59e0b', fill: n <= (rating ?? 0) ? '#f59e0b' : 'none' }} />
      ))}
    </div>
  )
}

interface Props {
  review: Review
  canManage: boolean
  onUpdate: (review: Review) => void
  onDelete: (id: string) => void
}

export function ReviewCard({ review, canManage, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [responseText, setResponseText] = useState(review.response ?? review.ai_response_draft ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pStyle = PLATFORM_STYLE[review.platform] ?? PLATFORM_STYLE.Other
  const av = AVATAR_COLORS[(review.author_name ?? '?').charCodeAt(0) % AVATAR_COLORS.length]

  async function saveResponse() {
    if (!responseText.trim()) { toast.error('Response cannot be empty'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Response saved')
      onUpdate(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm('Delete this review?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Review deleted')
      onDelete(review.id)
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
        className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
        <div style={{ width: 36, height: 36, backgroundColor: av.bg, color: av.color, fontSize: 12, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(review.author_name ?? '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{review.author_name ?? 'Anonymous'}</span>
            <span style={{ fontSize: 10, padding: '2px 7px', backgroundColor: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}` }}>
              {review.platform}
            </span>
            {review.responded_at && (
              <span style={{ fontSize: 11, color: C.sage, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle style={{ width: 11, height: 11 }} />Responded
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars rating={review.rating} />
            <span style={{ color: C.muted, fontSize: 11 }}>{formatDate(review.received_at)}</span>
          </div>
          {review.content && (
            <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 6 }} className="line-clamp-2">{review.content}</p>
          )}
        </div>
        <div style={{ color: C.muted, flexShrink: 0 }}>
          {expanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 16 }} className="space-y-4">
          {review.content && (
            <div>
              <span style={labelSt}>Full Review</span>
              <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6 }}>{review.content}</p>
            </div>
          )}

          {canManage && (
            <div>
              <span style={labelSt}>{review.responded_at ? 'Your Response' : 'Write a Response'}</span>
              <textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                placeholder="Thank you for your kind words! We're thrilled you had a great experience…"
                rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
                  <Trash2 style={{ width: 12, height: 12 }} />Delete
                </button>
                <button onClick={saveResponse} disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
                  className="inline-flex items-center gap-1.5 uppercase">
                  <Send style={{ width: 12, height: 12 }} />
                  {saving ? 'Saving…' : review.responded_at ? 'Update' : 'Save Response'}
                </button>
              </div>
            </div>
          )}

          {!canManage && review.response && (
            <div>
              <span style={labelSt}>Owner Response</span>
              <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>"{review.response}"</p>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{formatDate(review.responded_at!)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
