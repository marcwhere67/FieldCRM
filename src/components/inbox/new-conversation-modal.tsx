'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X, Search, Phone } from 'lucide-react'

interface Contact {
  id: string; first_name: string; last_name: string; phone: string | null
}

interface Props {
  orgId: string
  onClose: () => void
  onCreated: (conv: any) => void
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

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

export function NewConversationModal({ orgId, onClose, onCreated }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch('/api/inbox/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.contacts ?? []))
  }, [])

  const filtered = contacts.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase()) || (c.phone ?? '').includes(search)
  })

  async function handleSend() {
    if (!selected || !message.trim()) return
    setSending(true)
    const res = await fetch('/api/inbox/new', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selected.id, message: message.trim(), channel: 'sms' }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to start conversation')
    else onCreated(data.conversation)
    setSending(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>New Conversation</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          {!selected ? (
            <>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.muted }} />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search contacts…" style={{ ...inp, paddingLeft: 32 }} />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }} className="space-y-1">
                {filtered.map(c => {
                  const av = AVATAR_COLORS[c.first_name.charCodeAt(0) % AVATAR_COLORS.length]
                  return (
                    <button key={c.id} onClick={() => setSelected(c)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: `1px solid transparent`, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                      className="hover:bg-[rgba(44,62,80,0.04)] transition-colors">
                      <div style={{ width: 32, height: 32, backgroundColor: av.bg, color: av.color, fontSize: 11, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div>
                        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{c.first_name} {c.last_name}</p>
                        {c.phone && <p style={{ color: C.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ width: 11, height: 11 }} />{c.phone}</p>}
                      </div>
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No contacts found</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(44,62,80,0.04)', border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{selected.first_name} {selected.last_name}</p>
                  {selected.phone && <p style={{ color: C.muted, fontSize: 11 }}>{selected.phone}</p>}
                </div>
                <button onClick={() => setSelected(null)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {!selected.phone && (
                <p style={{ color: '#b45309', fontSize: 12, backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px' }}>
                  This contact has no phone number — SMS cannot be sent.
                </p>
              )}

              <textarea autoFocus value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Type your message…" rows={4}
                style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelected(null)}
                  style={{ flex: 1, padding: '8px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer' }}
                  className="uppercase hover:opacity-70 transition-opacity">
                  Back
                </button>
                <button onClick={handleSend} disabled={!message.trim() || !selected.phone || sending}
                  style={{ flex: 1, padding: '8px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: !message.trim() || !selected.phone || sending ? 'default' : 'pointer', opacity: !message.trim() || !selected.phone || sending ? 0.4 : 1 }}
                  className="uppercase">
                  {sending ? 'Sending…' : 'Send SMS'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
