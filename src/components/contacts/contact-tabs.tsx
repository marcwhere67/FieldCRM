'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { Briefcase, FileText, Receipt, MessageSquare, StickyNote, Activity, MapPin, Phone, Mail, Building, Folder, Send, Pencil } from 'lucide-react'
import { ContactDocuments, type ClientDocument } from './contact-documents'
import { SendEmailModal, type EmailDraft } from '@/components/emails/send-email-modal'

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  draft:       { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  scheduled:   { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  in_progress: { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)' },
  completed:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  cancelled:   { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
  invoiced:    { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  paid:        { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  sent:        { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  viewed:      { bg: 'rgba(44,62,80,0.08)',    color: '#2C3E50', border: 'rgba(44,62,80,0.18)' },
  approved:    { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  declined:    { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
  overdue:     { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
  open:        { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  resolved:    { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
}

const TABS = [
  { id: 'overview',       label: 'Overview',       icon: Activity },
  { id: 'jobs',           label: 'Jobs',           icon: Briefcase },
  { id: 'quotes',         label: 'Quotes',         icon: FileText },
  { id: 'invoices',       label: 'Invoices',       icon: Receipt },
  { id: 'conversations',  label: 'Conversations',  icon: MessageSquare },
  { id: 'documents',      label: 'Documents',      icon: Folder },
  { id: 'notes',          label: 'Notes',          icon: StickyNote },
]

const CHANNEL_ICONS: Record<string, string> = {
  sms: '💬', email: '📧', facebook_dm: '📘', instagram_dm: '📸', whatsapp: '🟢', live_chat: '💭', call: '📞',
}

interface Contact {
  id: string
  first_name: string; last_name: string; email: string | null; phone: string | null
  company_name: string | null; address_line1: string | null; suburb: string | null
  state: string | null; postcode: string | null; source: string | null; notes: string | null
  created_at: string; custom_fields: Record<string, unknown>; do_not_contact: boolean | null
}

interface Props {
  contact: Contact
  jobs: { id: string; job_number: string; title: string; status: string; scheduled_start: string | null }[]
  quotes: { id: string; quote_number: string; status: string; total: number; created_at: string }[]
  invoices: { id: string; invoice_number: string; status: string; total: number; amount_paid: number; due_date: string | null }[]
  conversations: { id: string; channel: string; status: string; last_message_at: string | null; unread_count: number }[]
  documents: ClientDocument[]
  properties: { id: string; label: string | null; address_line1: string; suburb: string; state: string; postcode: string; access_notes: string | null }[]
}

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.draft
  return (
    <span style={{ backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px', flexShrink: 0 }} className="uppercase">{status.replace('_', ' ')}</span>
  )
}

export function ContactTabs({ contact, jobs, quotes, invoices, conversations, documents, properties }: Props) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(TABS.some(t => t.id === initialTab) ? initialTab! : 'overview')

  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(() => {
    const preselect = searchParams.get('preselect')
    return preselect ? new Set(preselect.split(',')) : new Set()
  })
  const [sendingQuotes, setSendingQuotes] = useState(false)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)

  function toggleQuote(id: string) {
    setSelectedQuoteIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function sendSelectedQuotes(override?: { subject: string; message: string }) {
    if (selectedQuoteIds.size < 2) return
    setSendingQuotes(true)
    try {
      const res = await fetch('/api/quotes/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: Array.from(selectedQuoteIds), ...override }),
      })
      const data = await res.json()
      if (!res.ok || !data.sent) throw new Error(data.error ?? 'Failed to send quotes')
      toast.success(`${data.count} quotes emailed to ${contact.first_name}`)
      setSelectedQuoteIds(new Set())
      setEmailDraft(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send quotes')
    } finally {
      setSendingQuotes(false)
    }
  }

  async function openBatchReview() {
    if (selectedQuoteIds.size < 2) return
    setLoadingDraft(true)
    try {
      const res = await fetch('/api/quotes/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: Array.from(selectedQuoteIds), preview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load the email')
      setEmailDraft(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load the email')
    } finally {
      setLoadingDraft(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)', boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.04)' }} className="overflow-hidden">
      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid rgba(44,62,80,0.09)', backgroundColor: '#F5F0EB' }} className="flex overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={activeTab === id
              ? { color: '#2C3E50', borderBottom: '2px solid #76A58F', backgroundColor: '#fff', padding: '12px 18px', fontSize: 11, letterSpacing: '0.1em' }
              : { color: '#8A9BA6', borderBottom: '2px solid transparent', padding: '12px 18px', fontSize: 11, letterSpacing: '0.1em' }
            }
            className="flex items-center gap-2 whitespace-nowrap uppercase font-normal transition-colors hover:text-[#2C3E50]"
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Contact Details</p>
              <dl className="space-y-3">
                {[
                  { icon: Mail,     label: 'Email',       value: contact.email },
                  { icon: Phone,    label: 'Phone',       value: contact.phone },
                  { icon: Building, label: 'Company',     value: contact.company_name },
                  { icon: MapPin,   label: 'Address',     value: [contact.address_line1, contact.suburb, contact.state, contact.postcode].filter(Boolean).join(', ') || null },
                  { icon: Activity, label: 'Lead source', value: contact.source?.replace(/_/g, ' ') ?? null },
                  { icon: Activity, label: 'Created',     value: formatDate(contact.created_at) },
                ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3" style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', paddingBottom: 10 }}>
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#8A9BA6' }} />
                    <div>
                      <dt style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</dt>
                      <dd style={{ color: '#1C2A35', fontSize: 13 }}>{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              {(() => {
                const cf = contact.custom_fields ?? {}
                const prefs = [
                  { label: 'Preferred method', value: cf.preferred_contact },
                  { label: 'Best days',        value: cf.preferred_days },
                  { label: 'Best time',        value: cf.preferred_time },
                ].filter(p => typeof p.value === 'string' && p.value)
                const consented = contact.do_not_contact === false
                return (prefs.length > 0 || contact.do_not_contact != null) && (
                  <div className="pt-4">
                    <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Contact Preferences</p>
                    <dl className="space-y-3">
                      {prefs.map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-3" style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', paddingBottom: 10 }}>
                          <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#8A9BA6' }} />
                          <div>
                            <dt style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</dt>
                            <dd style={{ color: '#1C2A35', fontSize: 13 }}>{value as string}</dd>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-start gap-3">
                        <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#8A9BA6' }} />
                        <div>
                          <dt style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>Marketing</dt>
                          <dd style={{ color: consented ? '#3f6b57' : '#b45309', fontSize: 13 }}>{consented ? 'Opted in' : 'Do not contact'}</dd>
                        </div>
                      </div>
                    </dl>
                  </div>
                )
              })()}
            </div>

            <div className="space-y-4">
              <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Service Locations</p>
              {properties.length === 0
                ? <p style={{ color: '#8A9BA6', fontSize: 13 }}>No properties added yet</p>
                : <div className="space-y-2">
                    {properties.map(p => (
                      <div key={p.id} style={{ border: '1px solid rgba(44,62,80,0.09)', padding: '10px 12px' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#76A58F' }} />
                          <span style={{ color: '#2C3E50', fontSize: 13, fontWeight: 500 }}>{p.label ?? 'Property'}</span>
                        </div>
                        <p style={{ color: '#8A9BA6', fontSize: 12, paddingLeft: 20 }}>{p.address_line1}, {p.suburb} {p.state} {p.postcode}</p>
                        {p.access_notes && <p style={{ color: '#b45309', fontSize: 11, paddingLeft: 20, marginTop: 4 }}>🔑 {p.access_notes}</p>}
                      </div>
                    ))}
                  </div>
              }
              {contact.notes && (
                <div className="mt-4">
                  <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</p>
                  <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, backgroundColor: '#F5F0EB', padding: '12px 14px' }} className="whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-1">
            <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Jobs ({jobs.length})</p>
            {jobs.length === 0
              ? <p style={{ color: '#8A9BA6', fontSize: 13, padding: '2rem 0' }}>No jobs yet</p>
              : jobs.map((job, i) => (
                  <a key={job.id} href={`/jobs/${job.id}`}
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '12px 12px', textDecoration: 'none' }}
                    className="group hover:bg-[#F0EDE8] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p style={{ color: '#1C2A35', fontSize: 13, fontWeight: 500 }} className="truncate group-hover:text-[#2C3E50]">{job.title}</p>
                      <p style={{ color: '#8A9BA6', fontSize: 11, marginTop: 1 }}>{job.job_number} · {job.scheduled_start ? formatDate(job.scheduled_start) : 'Unscheduled'}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </a>
                ))
            }
          </div>
        )}

        {activeTab === 'quotes' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Quotes ({quotes.length})</p>
              {selectedQuoteIds.size > 0 && (
                <div className="flex items-center gap-2">
                  {selectedQuoteIds.size >= 2 && (
                    <button
                      onClick={openBatchReview}
                      disabled={sendingQuotes || loadingDraft}
                      style={{
                        backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65',
                        fontSize: 11, letterSpacing: '0.05em', padding: '6px 12px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        cursor: sendingQuotes || loadingDraft ? 'default' : 'pointer',
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {loadingDraft ? 'Loading…' : 'Review & send'}
                    </button>
                  )}
                  <button
                    onClick={() => sendSelectedQuotes()}
                    disabled={selectedQuoteIds.size < 2 || sendingQuotes}
                    style={{
                      backgroundColor: selectedQuoteIds.size < 2 ? 'rgba(44,62,80,0.15)' : '#2C3E50',
                      color: '#fff', fontSize: 11, letterSpacing: '0.05em', padding: '6px 14px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      cursor: selectedQuoteIds.size < 2 || sendingQuotes ? 'default' : 'pointer',
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingQuotes
                      ? 'Sending…'
                      : selectedQuoteIds.size < 2
                        ? `Select ${2 - selectedQuoteIds.size} more to send together`
                        : `Send ${selectedQuoteIds.size} quotes in one email`}
                  </button>
                </div>
              )}
            </div>
            {quotes.length === 0
              ? <p style={{ color: '#8A9BA6', fontSize: 13, padding: '2rem 0' }}>No quotes yet</p>
              : quotes.map((q, i) => (
                  <div key={q.id}
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '12px 12px' }}
                    className="group hover:bg-[#F0EDE8] transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedQuoteIds.has(q.id)}
                      onChange={() => toggleQuote(q.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 15, height: 15, accentColor: '#2C3E50', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <a href={`/quotes/${q.id}`} className="flex-1 min-w-0 flex items-center gap-4" style={{ textDecoration: 'none' }}>
                      <div className="flex-1">
                        <p style={{ color: '#1C2A35', fontSize: 13, fontWeight: 500 }}>{q.quote_number}</p>
                        <p style={{ color: '#8A9BA6', fontSize: 11, marginTop: 1 }}>{formatDate(q.created_at)}</p>
                      </div>
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 18 }}>{formatCurrency(q.total)}</span>
                      <StatusBadge status={q.status} />
                    </a>
                  </div>
                ))
            }
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-1">
            <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Invoices ({invoices.length})</p>
            {invoices.length === 0
              ? <p style={{ color: '#8A9BA6', fontSize: 13, padding: '2rem 0' }}>No invoices yet</p>
              : invoices.map((inv, i) => (
                  <a key={inv.id} href={`/invoices/${inv.id}`}
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '12px 12px', textDecoration: 'none' }}
                    className="group hover:bg-[#F0EDE8] transition-colors">
                    <div className="flex-1">
                      <p style={{ color: '#1C2A35', fontSize: 13, fontWeight: 500 }}>{inv.invoice_number}</p>
                      <p style={{ color: '#8A9BA6', fontSize: 11, marginTop: 1 }}>Due {inv.due_date ? formatDate(inv.due_date) : '—'}</p>
                    </div>
                    <div className="text-right">
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 18 }}>{formatCurrency(inv.total)}</span>
                      {inv.amount_paid > 0 && inv.amount_paid < inv.total && (
                        <p style={{ color: '#b45309', fontSize: 10, marginTop: 1 }}>{formatCurrency(inv.amount_paid)} paid</p>
                      )}
                    </div>
                    <StatusBadge status={inv.status} />
                  </a>
                ))
            }
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-1">
            <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Conversations ({conversations.length})</p>
            {conversations.length === 0
              ? <p style={{ color: '#8A9BA6', fontSize: 13, padding: '2rem 0' }}>No conversations yet</p>
              : conversations.map((c, i) => (
                  <a key={c.id} href={`/inbox?conversation=${c.id}`}
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '12px 12px', textDecoration: 'none' }}
                    className="group hover:bg-[#F0EDE8] transition-colors">
                    <span className="text-lg">{CHANNEL_ICONS[c.channel] ?? '💬'}</span>
                    <div className="flex-1">
                      <p style={{ color: '#1C2A35', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{c.channel.replace('_', ' ')}</p>
                      <p style={{ color: '#8A9BA6', fontSize: 11, marginTop: 1 }}>{c.last_message_at ? formatDateTime(c.last_message_at) : 'No messages'}</p>
                    </div>
                    {c.unread_count > 0 && (
                      <span style={{ backgroundColor: '#76A58F', color: '#fff', fontSize: 10, fontWeight: 600, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread_count}</span>
                    )}
                    <StatusBadge status={c.status} />
                  </a>
                ))
            }
          </div>
        )}

        {activeTab === 'documents' && (
          <ContactDocuments contactId={contact.id} initialDocs={documents} />
        )}

        {activeTab === 'notes' && (
          <div>
            <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Notes</p>
            {contact.notes
              ? <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, backgroundColor: '#F5F0EB', padding: '16px' }} className="whitespace-pre-wrap">{contact.notes}</p>
              : <p style={{ color: '#8A9BA6', fontSize: 13, padding: '2rem 0' }}>No notes yet</p>
            }
          </div>
        )}
      </div>

      {emailDraft && (
        <SendEmailModal
          draft={emailDraft}
          sending={sendingQuotes}
          onSend={(subject, message) => sendSelectedQuotes({ subject, message })}
          onClose={() => setEmailDraft(null)}
        />
      )}
    </div>
  )
}
