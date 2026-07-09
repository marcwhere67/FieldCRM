'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail, RefreshCw, ExternalLink, Search, User } from 'lucide-react'
import { formatDateTime } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

interface EmailContact { id: string; first_name: string; last_name: string; email: string | null }
interface Email {
  id: string
  gmail_id: string
  from_email: string
  from_name: string | null
  to_email: string
  subject: string | null
  body: string | null
  received_at: string | null
  email_contacts: { contact: EmailContact | EmailContact[] | null }[] | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime(); const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function linkedContact(e: Email): EmailContact | null {
  const link = e.email_contacts?.[0]
  if (!link) return null
  return Array.isArray(link.contact) ? (link.contact[0] ?? null) : link.contact
}

export function EmailInbox() {
  const [emails, setEmails] = useState<Email[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'disconnected'>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/emails?limit=100')
      if (!res.ok) { setStatus('disconnected'); return }
      const data = await res.json()
      if (!data.connected) { setStatus('disconnected'); return }
      setEmails(data.emails ?? [])
      setStatus('ready')
      setSelectedId(prev => prev ?? data.emails?.[0]?.id ?? null)
    } catch {
      setStatus('disconnected')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Synced ${data.emailsSync} emails from Gmail`)
      await load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Sync failed') }
    finally { setSyncing(false) }
  }

  if (status === 'disconnected') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.cream }}>
        <Mail style={{ width: 36, height: 36, color: 'rgba(44,62,80,0.12)' }} />
        <p style={{ color: C.muted, fontSize: 13 }}>Gmail isn&apos;t connected yet</p>
        <Link href="/settings"
          style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 16px', fontSize: 11, letterSpacing: '0.1em' }}
          className="uppercase hover:opacity-80 transition-opacity">
          Connect in Settings
        </Link>
      </div>
    )
  }

  const filtered = emails.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (e.from_name ?? '').toLowerCase().includes(q)
      || e.from_email.toLowerCase().includes(q)
      || (e.subject ?? '').toLowerCase().includes(q)
  })

  const selected = emails.find(e => e.id === selectedId) ?? null
  const selectedContact = selected ? linkedContact(selected) : null

  return (
    <>
      {/* Email list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: C.navy, fontSize: 13, fontWeight: 500 }} className="flex items-center gap-2">
              <Mail style={{ width: 14, height: 14, color: C.sage }} />Email
            </h2>
            <button onClick={handleSync} disabled={syncing}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '4px 10px', fontSize: 10, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <RefreshCw style={{ width: 11, height: 11 }} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing' : 'Sync'}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: 12, height: 12, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails…"
              style={{ width: '100%', backgroundColor: C.cream, border: `1px solid ${C.border}`, borderRadius: 0, padding: '6px 10px 6px 28px', fontSize: 12, color: C.fg, outline: 'none' }}
              className="focus:border-[#76A58F]" />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {status === 'loading' ? (
            <p style={{ color: C.muted, fontSize: 12, padding: 24, textAlign: 'center' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Mail style={{ width: 28, height: 28, color: 'rgba(44,62,80,0.15)', margin: '0 auto 8px' }} />
              <p style={{ color: C.muted, fontSize: 12 }}>{emails.length === 0 ? 'No emails synced yet — hit Sync' : 'No matches'}</p>
            </div>
          ) : filtered.map(e => {
            const isSelected = e.id === selectedId
            const contact = linkedContact(e)
            return (
              <button key={e.id} onClick={() => setSelectedId(e.id)} style={{
                width: '100%', display: 'block', padding: '12px 14px', textAlign: 'left',
                borderBottom: `1px solid rgba(44,62,80,0.06)`,
                borderLeft: isSelected ? `2px solid ${C.sage}` : '2px solid transparent',
                backgroundColor: isSelected ? 'rgba(118,165,143,0.05)' : 'transparent',
              }} className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                <div className="flex items-center justify-between mb-0.5">
                  <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{e.from_name || e.from_email}</p>
                  {e.received_at && <span style={{ color: C.muted, fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{timeAgo(e.received_at)}</span>}
                </div>
                <p style={{ color: C.fg, fontSize: 11 }} className="truncate">{e.subject || '(no subject)'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p style={{ color: C.muted, fontSize: 10, flex: 1 }} className="truncate">{(e.body ?? '').slice(0, 80)}</p>
                  {contact && (
                    <span style={{ color: '#5d8c76', backgroundColor: 'rgba(118,165,143,0.12)', fontSize: 8, letterSpacing: '0.08em', padding: '1px 5px', flexShrink: 0 }} className="uppercase">
                      {contact.first_name}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: C.cream, minWidth: 0 }}>
        {selected ? (
          <>
            <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '18px 24px' }}>
              <div className="flex items-start justify-between gap-4">
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 22, fontWeight: 400, lineHeight: 1.25 }}>{selected.subject || '(no subject)'}</h1>
                  <p style={{ color: C.fg, fontSize: 12, marginTop: 6 }}>
                    {selected.from_name ? `${selected.from_name} · ` : ''}<span style={{ color: C.muted }}>{selected.from_email}</span>
                  </p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                    To {selected.to_email}{selected.received_at ? ` · ${formatDateTime(selected.received_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedContact && (
                    <Link href={`/contacts/${selectedContact.id}`}
                      style={{ color: '#5d8c76', border: '1px solid rgba(118,165,143,0.3)', padding: '5px 10px', fontSize: 10, letterSpacing: '0.08em' }}
                      className="inline-flex items-center gap-1.5 uppercase hover:opacity-70 transition-opacity">
                      <User style={{ width: 11, height: 11 }} />
                      {selectedContact.first_name} {selectedContact.last_name}
                    </Link>
                  )}
                  <a href={`https://mail.google.com/mail/u/0/#all/${selected.gmail_id}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#4A5A65', border: '1px solid rgba(44,62,80,0.15)', padding: '5px 10px', fontSize: 10, letterSpacing: '0.08em' }}
                    className="inline-flex items-center gap-1.5 uppercase hover:opacity-70 transition-opacity">
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    Open in Gmail
                  </a>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
                <p style={{ color: C.fg, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {selected.body || '(no content)'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Mail style={{ width: 36, height: 36, color: 'rgba(44,62,80,0.12)' }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Select an email</p>
          </div>
        )}
      </div>
    </>
  )
}
