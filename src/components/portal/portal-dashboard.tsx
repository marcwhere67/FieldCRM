'use client'

import Link from 'next/link'
import { FileText, Receipt, Briefcase, ChevronRight, LogOut, Phone, Mail } from 'lucide-react'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Quote { id: string; quote_number: string; status: string; total: number; created_at: string; valid_until: string | null }
interface Invoice { id: string; invoice_number: string; status: string; total: number; due_date: string | null }
interface Job { id: string; title: string; status: string; scheduled_start: string | null; scheduled_end: string | null; description: string | null }
interface Contact { first_name: string; last_name: string; email: string }
interface Props { contact: Contact; orgName: string; orgPhone: string | null; orgEmail: string | null; quotes: Quote[]; invoices: Invoice[]; jobs: Job[] }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const QUOTE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sent:      { label: 'Awaiting approval', bg: 'rgba(37,99,235,0.07)',   color: '#2563eb' },
  approved:  { label: 'Approved',          bg: 'rgba(118,165,143,0.1)',  color: '#5d8c76' },
  declined:  { label: 'Declined',          bg: 'rgba(220,38,38,0.07)',   color: '#dc2626' },
  converted: { label: 'Booked',            bg: 'rgba(118,165,143,0.1)',  color: '#5d8c76' },
}

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sent:    { label: 'Unpaid',   bg: 'rgba(37,99,235,0.07)',  color: '#2563eb' },
  paid:    { label: 'Paid',     bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  overdue: { label: 'Overdue',  bg: 'rgba(220,38,38,0.07)',  color: '#dc2626' },
  void:    { label: 'Void',     bg: 'rgba(44,62,80,0.06)',   color: '#8A9BA6' },
}

const JOB_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(245,158,11,0.08)', color: '#b45309' },
  scheduled:   { label: 'Scheduled',   bg: 'rgba(37,99,235,0.07)',  color: '#2563eb' },
  in_progress: { label: 'In progress', bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  completed:   { label: 'Completed',   bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(44,62,80,0.06)',   color: '#8A9BA6' },
}

export function PortalDashboard({ contact, orgName, orgPhone, orgEmail, quotes, invoices, jobs }: Props) {
  const router = useRouter()
  const supabase = createClient()
  async function signOut() { await supabase.auth.signOut(); router.push('/portal/login') }

  const pendingQuotes = quotes.filter(q => q.status === 'sent')
  const outstandingInvoices = invoices.filter(i => ['sent', 'overdue'].includes(i.status))
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0)
  const activeJobs = jobs.filter(j => ['scheduled', 'in_progress'].includes(j.status))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream }}>
      {/* Top bar */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/salt-air-logo.png" alt="Salt Air Cleaning" style={{ height: 32, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: C.muted, fontSize: 12 }} className="hidden sm:block">
              {contact.first_name} {contact.last_name}
            </span>
            <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
              className="hover:opacity-70 transition-opacity">
              <LogOut style={{ width: 14, height: 14 }} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 840, margin: '0 auto', padding: '32px 24px' }} className="space-y-8">
        {/* Welcome */}
        <div>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Hi, {contact.first_name}</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Here's an overview of your account with {orgName}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: FileText, label: 'Quotes awaiting approval', value: String(pendingQuotes.length), accent: pendingQuotes.length > 0 ? C.sage : C.muted },
            { icon: Receipt, label: 'Outstanding balance', value: outstandingInvoices.length > 0 ? formatCurrency(outstandingTotal) : '$0.00', accent: outstandingInvoices.length > 0 ? '#b45309' : C.muted },
            { icon: Briefcase, label: 'Active jobs', value: String(activeJobs.length), accent: C.navy },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.accent}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <card.icon style={{ width: 14, height: 14, color: card.accent }} />
                <span style={{ color: C.muted, fontSize: 11 }}>{card.label}</span>
              </div>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 26 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Pending quotes alert */}
        {pendingQuotes.length > 0 && (
          <div style={{ backgroundColor: 'rgba(118,165,143,0.08)', border: `1px solid rgba(118,165,143,0.25)`, padding: '14px 16px' }} className="space-y-3">
            <p style={{ color: C.sage, fontSize: 13, fontWeight: 500 }}>
              You have {pendingQuotes.length} quote{pendingQuotes.length > 1 ? 's' : ''} awaiting your approval
            </p>
            <div className="space-y-2">
              {pendingQuotes.map(q => (
                <Link key={q.id} href={`/portal/quotes/${q.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '12px 14px', border: `1px solid ${C.border}`, textDecoration: 'none' }}
                  className="hover:opacity-80 transition-opacity group">
                  <div>
                    <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{q.quote_number}</p>
                    <p style={{ color: C.muted, fontSize: 11 }}>Valid until {q.valid_until ? formatDate(q.valid_until) : '—'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 16 }}>{formatCurrency(q.total)}</span>
                    <ChevronRight style={{ width: 14, height: 14, color: C.muted }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quotes */}
        <PortalSection title="Quotes" icon={<FileText style={{ width: 14, height: 14 }} />}>
          {quotes.length === 0 ? <PortalEmpty text="No quotes yet" /> : quotes.slice(0, 5).map(q => {
            const ss = QUOTE_STATUS[q.status] ?? { label: q.status, bg: 'rgba(44,62,80,0.06)', color: C.muted }
            return (
              <Link key={q.id} href={`/portal/quotes/${q.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', textDecoration: 'none' }}
                className="hover:bg-[rgba(44,62,80,0.02)] transition-colors group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{q.quote_number}</p>
                    <p style={{ color: C.muted, fontSize: 11 }}>{formatDate(q.created_at)}</p>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.06em' }}>{ss.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 15 }}>{formatCurrency(q.total)}</span>
                  <ChevronRight style={{ width: 13, height: 13, color: C.muted }} />
                </div>
              </Link>
            )
          })}
        </PortalSection>

        {/* Invoices */}
        <PortalSection title="Invoices" icon={<Receipt style={{ width: 14, height: 14 }} />}>
          {invoices.length === 0 ? <PortalEmpty text="No invoices yet" /> : invoices.slice(0, 5).map(inv => {
            const ss = INVOICE_STATUS[inv.status] ?? { label: inv.status, bg: 'rgba(44,62,80,0.06)', color: C.muted }
            return (
              <Link key={inv.id} href={`/portal/invoices/${inv.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', textDecoration: 'none' }}
                className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{inv.invoice_number}</p>
                    <p style={{ color: C.muted, fontSize: 11 }}>{inv.due_date ? `Due ${formatDate(inv.due_date)}` : 'No due date'}</p>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.06em' }}>{ss.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 15 }}>{formatCurrency(inv.total)}</span>
                  <ChevronRight style={{ width: 13, height: 13, color: C.muted }} />
                </div>
              </Link>
            )
          })}
        </PortalSection>

        {/* Jobs */}
        <PortalSection title="Jobs" icon={<Briefcase style={{ width: 14, height: 14 }} />}>
          {jobs.length === 0 ? <PortalEmpty text="No jobs yet" /> : jobs.slice(0, 5).map(job => {
            const ss = JOB_STATUS[job.status] ?? { label: job.status, bg: 'rgba(44,62,80,0.06)', color: C.muted }
            return (
              <Link key={job.id} href={`/portal/jobs/${job.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', textDecoration: 'none' }}
                className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                <div>
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{job.title}</p>
                  <p style={{ color: C.muted, fontSize: 11 }}>{job.scheduled_start ? formatDateTime(job.scheduled_start) : 'Not yet scheduled'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.06em' }}>{ss.label}</span>
                  <ChevronRight style={{ width: 13, height: 13, color: C.muted }} />
                </div>
              </Link>
            )
          })}
        </PortalSection>

        {/* Contact / support */}
        {(orgPhone || orgEmail) && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-3">
            <h2 style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Need help?</h2>
            <p style={{ color: C.muted, fontSize: 13 }}>Get in touch and we'll be happy to assist.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {orgPhone && (
                <a href={`tel:${orgPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4A5A65', fontSize: 13, textDecoration: 'none' }}
                  className="hover:opacity-70 transition-opacity">
                  <Phone style={{ width: 14, height: 14, color: C.sage }} />{orgPhone}
                </a>
              )}
              {orgEmail && (
                <a href={`mailto:${orgEmail}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4A5A65', fontSize: 13, textDecoration: 'none' }}
                  className="hover:opacity-70 transition-opacity">
                  <Mail style={{ width: 14, height: 14, color: C.sage }} />{orgEmail}
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function PortalSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const C = { navy: '#2C3E50', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }
  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, color: C.muted }}>
        {icon}
        <h2 style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>{title}</h2>
      </div>
      <div className="divide-y divide-[rgba(44,62,80,0.06)]">{children}</div>
    </div>
  )
}

function PortalEmpty({ text }: { text: string }) {
  return <div style={{ padding: '28px 16px', textAlign: 'center', color: '#8A9BA6', fontSize: 13 }}>{text}</div>
}
