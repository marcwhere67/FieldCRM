'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { conversationId: string; onDraft: (text: string) => void }

const C = { navy: '#2C3E50', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

export function DraftReplyButton({ conversationId, onDraft }: Props) {
  const [loading, setLoading] = useState(false)

  async function draft() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDraft(data.draft)
    } catch { toast.error('Failed to draft reply') }
    finally { setLoading(false) }
  }

  return (
    <button type="button" onClick={draft} disabled={loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, letterSpacing: '0.06em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
      className="uppercase hover:opacity-70 transition-opacity">
      {loading
        ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
        : <Sparkles style={{ width: 12, height: 12, color: '#7c3aed' }} />}
      {loading ? 'Drafting…' : 'AI Draft'}
    </button>
  )
}
