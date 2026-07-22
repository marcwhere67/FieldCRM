'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QuoteBuilder } from '@/components/quotes/quote-builder'
import { formatCurrency, formatDate, melbourneDateOnly } from '@/lib/format'
import { toast } from 'sonner'
import { ArrowLeft, Send, CheckCircle, Copy, Trash2, Edit2, ExternalLink, MoreHorizontal, Download } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', subtle: 'rgba(44,62,80,0.08)',
  border: 'rgba(44,62,80,0.09)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  sent:      { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  viewed:    { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  approved:  { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  declined:  { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
  expired:   { bg: 'rgba(44,62,80,0.06)',    color: '#8A9BA6', border: 'rgba(44,62,80,0.15)' },
  converted: { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
}

interface LineItem { id: string; description: string; quantity: number; unit_price: number; subtotal: number; tax_rate: number }
interface Contact { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }
interface Property { id: string; label: string | null; address_line1: string | null; suburb: string | null; state: string | null; postcode: string | null }
interface Quote {
  id: string; quote_number: string; status: string; subtotal: number; tax: number; total: number
  valid_until: string | null; sent_at: string | null; approved_at: string | null; declined_at: string | null
  notes_client: string | null; notes_internal: string | null; line_items: LineItem[]
  deposit_type: string; deposit_value: number; deposit_amount: number; created_at: string
  clean_type: string | null
  contacts: Contact[] | Contact | null; properties: Property[] | Property | null
}
interface Service { id: string; name: string; description: string | null; unit_price: number; unit: string; tax_rate: number }
interface CatalogueItem { id: string; name: string; description: string | null; unit_price: number; unit: string; type?: 'service' | 'product'; category?: string | null }
interface Props {
  quote: Quote; services: Service[]; products?: CatalogueItem[]; contacts: Contact[]
  org: { name: string; abn: string | null; email: string | null; phone: string | null; address: string | null; logo_url: string | null; default_payment_terms_days: number | null } | null
  orgId: string
}

export function QuoteDetail({ quote, services, products = [], contacts, org, orgId }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const property = Array.isArray(quote.properties) ? quote.properties[0] : quote.properties
  const approvalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/quote-approval/${quote.id}`
  const st = STATUS_STYLE[quote.status] ?? STATUS_STYLE.draft

  async function sendQuote() {
    if (!contact?.email) { toast.error('Contact has no email address'); return }
    startTransition(async () => {
      const res = await fetch(`/api/quotes/${quote.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to send quote'); return }
      toast.success(`Quote emailed to ${contact.email}`)
      router.refresh()
    })
  }

  async function deleteQuote() {
    if (!confirm('Delete this quote? This cannot be undone.')) return
    startTransition(async () => {
      const { error } = await supabase.from('quotes').delete().eq('id', quote.id)
      if (error) { toast.error('Failed to delete quote'); return }
      toast.success('Quote deleted'); router.push('/quotes')
    })
  }

  async function copyApprovalLink() { await navigator.clipboard.writeText(approvalUrl); toast.success('Approval link copied') }

  async function markApproved() {
    if (!confirm('Mark this quote as approved on the client\'s behalf? Do this only if the client has confirmed (e.g. by phone).')) return
    startTransition(async () => {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', quote.id)
      if (error) { toast.error('Failed to mark as approved'); return }
      toast.success('Quote marked as approved')
      router.refresh()
    })
  }

  async function convertToJob() {
    startTransition(async () => {
      const { data: job, error } = await supabase.from('jobs').insert({
        org_id: orgId, contact_id: contact?.id, property_id: property?.id,
        title: `Job from ${quote.quote_number}`, status: 'draft', quote_id: quote.id,
        clean_type: quote.clean_type ?? null,
      }).select('id').single()
      if (error || !job) { toast.error('Failed to convert to job'); return }
      if (quote.deposit_type !== 'none' && quote.deposit_amount > 0) {
        await supabase.from('invoices').insert({
          org_id: orgId, contact_id: contact?.id, job_id: job.id, quote_id: quote.id,
          invoice_type: 'deposit', status: 'sent',
          line_items: [{ description: `Deposit for ${quote.quote_number}`, quantity: 1, unit_price: quote.deposit_amount, tax_rate: 0, subtotal: quote.deposit_amount }],
          
          due_date: melbourneDateOnly(new Date(Date.now() + 7 * 86400000)),
        })
      }
      await supabase.from('quotes').update({ status: 'converted' }).eq('id', quote.id)
      toast.success(quote.deposit_amount > 0 ? 'Converted to job — deposit invoice created' : 'Converted to job')
      router.push(`/jobs/${job.id}`)
    })
  }

  if (editing) {
    return <QuoteBuilder quote={quote} contacts={contacts} services={services} products={products} org={org} orgId={orgId} mode="edit" onCancel={() => setEditing(false)} />
  }

  return (
    <div style={{ maxWidth: 896 }} className="space-y-5">
      {/* Back */}
      <Link href="/quotes" style={{ color: C.muted }} className="inline-flex items-center gap-1.5 text-xs hover:text-[#2C3E50] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />Back to quotes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{quote.quote_number}</h1>
            <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px' }} className="uppercase">{quote.status}</span>
          </div>
          {contact && (
            <Link href={`/contacts/${contact.id}`} style={{ color: C.muted, fontSize: 13 }} className="hover:text-[#2C3E50] transition-colors">
              {contact.first_name} {contact.last_name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <button onClick={sendQuote} disabled={isPending}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />Send & notify
            </button>
          )}
          {quote.status === 'sent' && (
            <button onClick={markApproved} disabled={isPending}
              style={{ backgroundColor: C.sage, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <CheckCircle className="w-3.5 h-3.5" />Mark approved
            </button>
          )}
          {quote.status === 'approved' && (
            <button onClick={convertToJob} disabled={isPending}
              style={{ backgroundColor: C.sage, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <CheckCircle className="w-3.5 h-3.5" />Convert to job
            </button>
          )}
          <a href={`/api/quotes/${quote.id}/pdf`} download
            style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Download className="w-3.5 h-3.5" />PDF
          </a>
          <button onClick={copyApprovalLink}
            style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <ExternalLink className="w-3.5 h-3.5" />Client link
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', width: 34, height: 34 }} className="flex items-center justify-center hover:opacity-80 transition-opacity" />
              }
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none w-40">
              <DropdownMenuItem style={{ color: C.fg, fontSize: 12 }} className="cursor-pointer hover:bg-[#F5F0EB]" onClick={() => setEditing(true)}>
                <Edit2 className="w-3.5 h-3.5 mr-2" />Edit quote
              </DropdownMenuItem>
              <DropdownMenuItem style={{ color: C.fg, fontSize: 12 }} className="cursor-pointer hover:bg-[#F5F0EB]" onClick={copyApprovalLink}>
                <Copy className="w-3.5 h-3.5 mr-2" />Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ backgroundColor: C.border }} />
              <DropdownMenuItem style={{ color: '#dc2626', fontSize: 12 }} className="cursor-pointer hover:bg-[#F5F0EB]" onClick={deleteQuote}>
                <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Approved → ready to schedule prompt */}
      {quote.status === 'approved' && (
        <div style={{ backgroundColor: 'rgba(118,165,143,0.10)', border: '1px solid rgba(118,165,143,0.28)', padding: '14px 20px' }} className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: '#5d8c76' }} />
            <span style={{ color: '#3f6b57', fontSize: 13 }}>
              Approved by the client{quote.deposit_amount > 0 ? ` — a ${formatCurrency(quote.deposit_amount)} deposit invoice will be created` : ''}. Ready to schedule.
            </span>
          </div>
          <button onClick={convertToJob} disabled={isPending}
            style={{ backgroundColor: C.navy, color: '#fff', border: 'none', padding: '9px 16px', fontSize: 11, letterSpacing: '0.08em', flexShrink: 0 }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-90 transition-opacity disabled:opacity-40">
            <CheckCircle className="w-3.5 h-3.5" />{isPending ? 'Creating…' : 'Create the job'}
          </button>
        </div>
      )}

      {/* Timeline strip */}
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '12px 20px' }} className="flex flex-wrap gap-6">
        {[
          { label: 'Created', value: formatDate(quote.created_at), color: C.fg },
          quote.sent_at ? { label: 'Sent', value: formatDate(quote.sent_at), color: C.fg } : null,
          quote.valid_until ? { label: 'Valid until', value: formatDate(quote.valid_until), color: new Date(quote.valid_until) < new Date() ? '#dc2626' : C.fg } : null,
          quote.approved_at ? { label: 'Approved', value: formatDate(quote.approved_at), color: C.sage } : null,
          quote.declined_at ? { label: 'Declined', value: formatDate(quote.declined_at), color: '#dc2626' } : null,
        ].filter(Boolean).map((item, i) => (
          <div key={i}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>{item!.label}</p>
            <p style={{ color: item!.color, fontSize: 13 }}>{item!.value}</p>
          </div>
        ))}
      </div>

      {/* Quote document */}
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.04)' }}>
        {/* Company header */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '24px' }} className="flex items-start justify-between">
          <div>
            {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 48, width: 'auto', marginBottom: 10 }} />}
            <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 400 }}>{org?.name}</p>
            {org?.abn && <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>ABN {org.abn}</p>}
            {org?.email && <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 4 }}>{org.email}</p>}
            {org?.phone && <p style={{ color: '#4A5A65', fontSize: 12 }}>{org.phone}</p>}
          </div>
          <div className="text-right">
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Quote</p>
            <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 22 }}>{quote.quote_number}</p>
          </div>
        </div>

        {/* Bill to / Property */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }} className="grid grid-cols-2 gap-6">
          <div>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Bill to</p>
            {contact ? (
              <>
                <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>{contact.first_name} {contact.last_name}</p>
                {contact.email && <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 2 }}>{contact.email}</p>}
                {contact.phone && <p style={{ color: '#4A5A65', fontSize: 12 }}>{contact.phone}</p>}
              </>
            ) : <p style={{ color: C.muted, fontSize: 13 }}>—</p>}
          </div>
          {property && (
            <div>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Service address</p>
              <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>{property.label ?? property.address_line1}</p>
              <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 2 }}>{[property.suburb, property.state, property.postcode].filter(Boolean).join(', ')}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
          <table className="w-full" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, textAlign: 'left', paddingBottom: 10 }}>Description</th>
                <th style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, textAlign: 'right', paddingBottom: 10, width: 60 }}>Qty</th>
                <th style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, textAlign: 'right', paddingBottom: 10, width: 110 }}>Unit price</th>
                <th style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, textAlign: 'right', paddingBottom: 10, width: 110 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(quote.line_items ?? []).map((item, i) => (
                <tr key={item.id ?? i} style={{ borderBottom: `1px solid ${C.subtle}` }}>
                  <td style={{ color: '#4A5A65', padding: '10px 0' }}>{item.description}</td>
                  <td style={{ color: '#4A5A65', padding: '10px 0', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ color: '#4A5A65', padding: '10px 0', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                  <td style={{ fontFamily: C.serif, color: C.navy, fontSize: 15, padding: '10px 0', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
          <div style={{ marginLeft: 'auto', width: 256 }} className="space-y-2">
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ color: '#4A5A65' }}>Subtotal</span>
              <span style={{ color: '#4A5A65' }}>{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ color: '#4A5A65' }}>GST (10%)</span>
              <span style={{ color: '#4A5A65' }}>{formatCurrency(quote.tax)}</span>
            </div>
            <div className="flex justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>Total</span>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>{formatCurrency(quote.total)}</span>
            </div>
            {quote.deposit_type !== 'none' && quote.deposit_amount > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }} className="space-y-1.5">
                <div className="flex justify-between">
                  <span style={{ color: '#b45309', fontSize: 13 }}>
                    Deposit required{quote.deposit_type === 'percentage' && <span style={{ opacity: 0.65 }}> ({quote.deposit_value}%)</span>}
                  </span>
                  <span style={{ fontFamily: C.serif, color: '#b45309', fontSize: 15 }}>{formatCurrency(quote.deposit_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: C.muted, fontSize: 12 }}>Balance on completion</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{formatCurrency(quote.total - quote.deposit_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {quote.notes_client && (
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</p>
            <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6 }} className="whitespace-pre-wrap">{quote.notes_client}</p>
          </div>
        )}
        {quote.notes_internal && (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Internal notes</p>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }} className="whitespace-pre-wrap">{quote.notes_internal}</p>
          </div>
        )}
      </div>
    </div>
  )
}
