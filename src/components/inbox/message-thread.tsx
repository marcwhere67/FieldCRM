'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Send, Phone, CheckCheck, Clock, X } from 'lucide-react'
import { DraftReplyButton } from '@/components/ai/draft-reply-button'

interface Contact {
  id: string; first_name: string; last_name: string; phone: string | null; email: string | null
}

interface Conversation {
  id: string; channel: string; status: string
  contacts: Contact | Contact[] | null
}

interface Message {
  id: string; direction: 'inbound' | 'outbound'; content: string; sent_at: string
  sent_by: string | null; is_automated: boolean; external_message_id: string | null
}

interface Props {
  conversation: Conversation
  currentUserId: string
  currentUserName: string
  onClose: () => void
}

const C = {
  navy: '#2C3E50', sage: '#76A58F', fg: '#1C2A35', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)', cream: '#F5F0EB',
}

function formatMsgTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const isToday = d.toDateString() === new Date().toDateString()
  const time = `${h < 12 ? h || 12 : h - 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`
  return isToday ? time : `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${time}`
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
]

export function MessageThread({ conversation, currentUserId, currentUserName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts
  const isClosed = conversation.status === 'closed'
  const av = contact ? AVATAR_COLORS[contact.first_name.charCodeAt(0) % AVATAR_COLORS.length] : AVATAR_COLORS[0]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/inbox/messages?conversationId=${conversation.id}`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [conversation.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendReply() {
    if (!reply.trim() || sending) return
    setSending(true)
    const content = reply.trim()
    setReply('')
    const optimistic: Message = {
      id: `temp-${Date.now()}`, direction: 'outbound', content,
      sent_at: new Date().toISOString(), sent_by: currentUserId,
      is_automated: false, external_message_id: null,
    }
    setMessages(prev => [...prev, optimistic])
    const res = await fetch('/api/inbox/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversation.id, content }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setReply(content)
    } else {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, id: data.messageId } : m))
    }
    setSending(false)
  }

  async function toggleClose() {
    setClosing(true)
    const newStatus = isClosed ? 'open' : 'closed'
    const res = await fetch('/api/inbox/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversation.id, status: newStatus }),
    })
    if (res.ok) { onClose(); toast.success(isClosed ? 'Conversation reopened' : 'Conversation closed') }
    else toast.error('Failed to update conversation')
    setClosing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Thread header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, backgroundColor: av.bg, color: av.color, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {contact ? `${contact.first_name[0]}${contact.last_name[0]}` : '?'}
          </div>
          <div>
            <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }}>
              {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'}
            </p>
            {contact?.phone && (
              <p style={{ color: C.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone style={{ width: 11, height: 11 }} />{contact.phone}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, padding: '3px 8px', letterSpacing: '0.08em',
            backgroundColor: isClosed ? 'rgba(44,62,80,0.06)' : 'rgba(118,165,143,0.1)',
            color: isClosed ? C.muted : '#5d8c76',
            border: `1px solid ${isClosed ? 'rgba(44,62,80,0.12)' : 'rgba(118,165,143,0.25)'}`,
          }} className="uppercase">
            {isClosed ? 'Closed' : 'Open'}
          </span>
          <button onClick={toggleClose} disabled={closing}
            style={{ padding: '5px 10px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: closing ? 'default' : 'pointer', opacity: closing ? 0.6 : 1 }}
            className="uppercase hover:opacity-70 transition-opacity">
            {isClosed ? 'Reopen' : 'Close'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
            <p style={{ color: C.muted, fontSize: 13 }}>No messages yet</p>
            {!isClosed && <p style={{ color: C.muted, fontSize: 11 }}>Send the first message below</p>}
          </div>
        ) : (
          messages.map(m => {
            const isOut = m.direction === 'outbound'
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start', gap: 4 }}>
                  <div style={{
                    padding: '9px 14px', fontSize: 13, lineHeight: 1.5,
                    backgroundColor: isOut ? C.navy : '#fff',
                    color: isOut ? '#fff' : C.fg,
                    border: isOut ? 'none' : `1px solid ${C.border}`,
                  }}>
                    {m.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted, flexDirection: isOut ? 'row-reverse' : 'row' }}>
                    <span>{formatMsgTime(m.sent_at)}</span>
                    {isOut && (m.external_message_id
                      ? <CheckCheck style={{ width: 11, height: 11, color: C.sage }} />
                      : <Clock style={{ width: 11, height: 11 }} />)}
                    {m.is_automated && <span style={{ color: C.muted }}>· auto</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {!isClosed && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, backgroundColor: C.cream, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Reply</span>
            <DraftReplyButton conversationId={conversation.id} onDraft={text => setReply(text)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={2}
              style={{ flex: 1, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0, padding: '9px 12px', fontSize: 13, color: C.fg, resize: 'none', outline: 'none', lineHeight: 1.5 }} />
            <button onClick={sendReply} disabled={!reply.trim() || sending}
              style={{ width: 38, height: 38, backgroundColor: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: !reply.trim() || sending ? 'default' : 'pointer', opacity: !reply.trim() || sending ? 0.4 : 1, flexShrink: 0 }}>
              <Send style={{ width: 15, height: 15 }} />
            </button>
          </div>
          {conversation.channel === 'sms' && (
            <p style={{ color: C.muted, fontSize: 10, marginTop: 6 }}>
              SMS via Twilio · {reply.length}/160 chars
            </p>
          )}
        </div>
      )}
    </div>
  )
}
