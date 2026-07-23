'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', fg: '#1C2A35', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

export interface EmailDraft { to?: string; subject: string; message: string }

// Reusable "Review & send" modal. Prefilled with the default draft; the caller
// sends whatever subject/message the user lands on. The branded shell (logo,
// quote summary / approve buttons, sign-off) is added automatically server-side
// and is intentionally not editable here.
export function SendEmailModal({
  draft, sending, onSend, onClose,
}: {
  draft: EmailDraft
  sending: boolean
  onSend: (subject: string, message: string) => void
  onClose: () => void
}) {
  const [subject, setSubject] = useState(draft.subject)
  const [message, setMessage] = useState(draft.message)

  const inp = {
    backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0,
    color: C.fg, fontSize: 13, width: '100%', padding: '8px 10px', outline: 'none' as const,
  }
  const label = { color: C.muted, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4, display: 'block' }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 560, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Mail style={{ width: 16, height: 16, color: C.sage }} />
          <h2 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 400 }}>Review &amp; send</h2>
        </div>

        {draft.to && (
          <div style={{ marginBottom: 12 }}>
            <span style={label}>To</span>
            <div style={{ ...inp, backgroundColor: '#F5F0EB', color: C.muted }}>{draft.to}</div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <span style={label}>Subject</span>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <span style={label}>Message</span>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={10}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }} />
        </div>

        <p style={{ color: C.muted, fontSize: 11, marginBottom: 20 }}>
          Your logo, the quote summary with approve buttons, and your sign-off are added automatically. The PDF{draft.to ? '' : 's'} will be attached.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={sending}
            style={{ border: `1px solid ${C.border}`, color: C.muted, backgroundColor: '#fff', padding: '9px 18px', fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer' }}
            className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
          <button onClick={() => onSend(subject, message)} disabled={sending || !subject.trim() || !message.trim()}
            style={{ backgroundColor: C.navy, color: '#fff', border: 'none', padding: '9px 20px', fontSize: 11, letterSpacing: '0.08em', cursor: sending ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: sending ? 0.7 : 1 }}
            className="uppercase hover:opacity-90 transition-opacity">
            {sending && <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />}
            Send email
          </button>
        </div>
      </div>
    </div>
  )
}
