'use client'

import { useState } from 'react'
import { MessageThread } from './message-thread'
import { NewConversationModal } from './new-conversation-modal'
import { MessageSquare, Plus, Search, Phone, Mail, Inbox } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

interface Contact { id: string; first_name: string; last_name: string; phone: string | null; email: string | null }
interface Conversation { id: string; channel: string; status: string; last_message_at: string | null; unread_count: number; created_at: string; contacts: Contact | Contact[] | null }
interface Props { conversations: Conversation[]; orgId: string; currentUserId: string; currentUserName: string }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime(); const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function InboxView({ conversations: initial, orgId, currentUserId, currentUserName }: Props) {
  const [conversations, setConversations] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = conversations.filter(c => {
    if (!search) return true
    const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts
    const name = contact ? `${contact.first_name} ${contact.last_name}`.toLowerCase() : ''
    return name.includes(search.toLowerCase()) || (contact?.phone ?? '').includes(search)
  })

  const selected = conversations.find(c => c.id === selectedId) ?? null

  function onNewConversation(conv: Conversation) { setConversations(prev => [conv, ...prev]); setSelectedId(conv.id); setShowNew(false) }

  return (
    <div className="flex h-[calc(100vh-80px)] -mx-6 -mt-6">
      {/* Sidebar */}
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* Sidebar header */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: C.navy, fontSize: 13, fontWeight: 500 }} className="flex items-center gap-2">
              <Inbox style={{ width: 14, height: 14, color: C.sage }} />Inbox
            </h2>
            <button onClick={() => setShowNew(true)}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '4px 10px', fontSize: 10, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1 uppercase hover:opacity-80 transition-opacity">
              <Plus style={{ width: 11, height: 11 }} />New
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: 12, height: 12, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ width: '100%', backgroundColor: C.cream, border: `1px solid ${C.border}`, borderRadius: 0, padding: '6px 10px 6px 28px', fontSize: 12, color: C.fg, outline: 'none' }}
              className="focus:border-[#76A58F]" />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <MessageSquare style={{ width: 28, height: 28, color: 'rgba(44,62,80,0.15)', margin: '0 auto 8px' }} />
              <p style={{ color: C.muted, fontSize: 12 }}>No conversations yet</p>
            </div>
          ) : filtered.map(c => {
            const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts
            const isSelected = c.id === selectedId
            const name = contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'
            const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', textAlign: 'left',
                borderBottom: `1px solid rgba(44,62,80,0.06)`,
                borderLeft: isSelected ? `2px solid ${C.sage}` : '2px solid transparent',
                backgroundColor: isSelected ? 'rgba(118,165,143,0.05)' : 'transparent',
              }} className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                <div style={{ width: 32, height: 32, backgroundColor: avatarColor.bg, color: avatarColor.color, fontSize: 11, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                  {contact ? `${contact.first_name[0]}${contact.last_name[0]}` : '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{name}</p>
                    <span style={{ color: C.muted, fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{timeAgo(c.last_message_at ?? c.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '2px 6px', backgroundColor: c.channel === 'sms' ? 'rgba(37,99,235,0.07)' : 'rgba(44,62,80,0.06)',
                      color: c.channel === 'sms' ? '#2563eb' : C.muted,
                    }}>
                      {c.channel === 'sms' ? <Phone style={{ width: 8, height: 8 }} /> : c.channel === 'email' ? <Mail style={{ width: 8, height: 8 }} /> : <MessageSquare style={{ width: 8, height: 8 }} />}
                      {c.channel}
                    </span>
                    {c.status === 'closed' && <span style={{ color: C.muted, fontSize: 9 }}>Closed</span>}
                    {c.unread_count > 0 && (
                      <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', backgroundColor: C.sage, color: '#fff', fontSize: 9, fontWeight: 600 }} className="flex items-center justify-center">{c.unread_count}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Thread panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.cream }}>
        {selected ? (
          <MessageThread conversation={selected} currentUserId={currentUserId} currentUserName={currentUserName}
            onClose={() => setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, status: 'closed' } : c))} />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <MessageSquare style={{ width: 36, height: 36, color: 'rgba(44,62,80,0.12)' }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Select a conversation</p>
          </div>
        )}
      </div>

      {showNew && <NewConversationModal orgId={orgId} onClose={() => setShowNew(false)} onCreated={onNewConversation} />}
    </div>
  )
}
