'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { ArrowLeft, Send, CheckCircle, Trash2, MoreHorizontal, AlertCircle, FileText } from 'lucide-react'
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
  draft:   { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  sent:    { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  paid:    { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  void:    { bg: 'rgba(44,62,80,0.06)',    color: '#8A9BA6', border: 'rgba(44,62,80,0.15)' },
  overdue: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
}

interface LineItem { description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }
interface Contact { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }
interface Invoice {
  id: string; invoice_number: string; invoice_type: string; status: string
  subtotal: number; tax: number; total: number; deposit_credit: number
  due_date: string | null; paid_at: string | null; sent_at: string | null; notes: string | null
  line_items: LineItem[]; stripe_payment_link: string | null; created_at: string
  job_id: string | null; quote_id: string | null
  contacts: Contact | Contact[] | null
  jobs: { id: string; title: string } | { id: string; title: string }[] | null
  quotes: { id: string; quote_number: string } | { id: string; quote_number: string }[] | null
}
interface Org { name: string; abn: string | null; email: string | null; phone: string | null; address: string | null; logo_url: string | null; default_payment_terms_days: number | null }
interface DepositInvoice { id: string; invoice_number: string; total: number; status: string; paid_at: string | null }
interface Props { invoice: Invoice; org: Org | null; orgId: string; depositInvoice: DepositInvoice | null }

export function InvoiceDetail({ invoice, org, orgId, depositInvoice }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs
  const quote = Array.isArray(invoice.quotes) ? invoice.quotes[0] : invoice.quotes

  const now = new Date().toISOString().split('T')[0]
  const isOverdue = invoice.status === 'sent' && invoice.due_date && invoice.due_date < now
  const displayStatus = isOverdue ? 'overdue' : invoice.status
  const balanceDue = invoice.total - (invoice.deposit_credit ?? 0)
  const st = STATUS_STYLE[displayStatus] ?? STATUS_STYLE.draft

  async function markSent() {
    if (!contact?.email) { toast.error('Contact has no email address'); return }
    startTransition(async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error ?? 'Failed to send invoice'); return }
      toast.success(`Invoice emailed to ${contact.email}`); router.refresh()
    })
  }

  async function markPaid() {
    startTransition(async () => {
      const { error } = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice.id)
      if (error) { toast.error('Failed to update'); return }
      toast.success('Invoice marked as paid'); router.refresh()
    })
  }

  async function voidInvoice() {
    if (!confirm('Void this invoice? This cannot be undone.')) return
    startTransition(async () => {
      const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', invoice.id)
      if (error) { toast.error('Failed to void'); return }
      toast.success('Invoice voided'); router.refresh()
    })
  }

  async function deleteInvoice() {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    startTransition(async () => {
      const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
      if (error) { toast.error('Failed to delete'); return }
      toast.success('Invoice deleted'); router.push('/invoices')
    })
  }

  const canSend = invoice.status === 'draft'
  const canMarkPaid = ['sent', 'overdue'].includes(displayStatus)
  const canVoid = !['void', 'paid'].includes(invoice.status)

  return (
    <div style={{ maxWidth: 896 }} className="space-y-5">
      <Link href="/invoices" style={{ color: C.muted }} className="inline-flex items-center gap-1.5 text-xs hover:text-[#2C3E50] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />Back to invoices
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{invoice.invoice_number}</h1>
            <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px' }} className="uppercase">{displayStatus}</span>
            {invoice.invoice_type !== 'standard' && (
              <span style={{ backgroundColor: 'rgba(180,83,9,0.08)', color: '#b45309', border: '1px solid rgba(180,83,9,0.18)', fontSize: 9, letterSpacing: '0.1em', padding: '3px 10px' }} className="uppercase">{invoice.invoice_type}</span>
            )}
          </div>
          {contact && (
            <Link href={`/contacts/${contact.id}`} style={{ color: C.muted, fontSize: 13 }} className="hover:text-[#2C3E50] transition-colors">
              {contact.first_name} {contact.last_name}
            </Link>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }} className="flex items-center gap-3">
            {job && <Link href={`/jobs/${job.id}`} style={{ color: C.muted }} className="hover:text-[#2C3E50] transition-colors">Job: {job.title}</Link>}
            {quote && <Link href={`/quotes/${quote.id}`} style={{ color: C.muted }} className="hover:text-[#2C3E50] transition-colors">Quote: {quote.quote_number}</Link>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canSend && (
            <button onClick={markSent} disabled={isPending}
              style={{ backgroundColor: '#2563eb', color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />{isPending ? 'Sending…' : 'Send invoice'}
            </button>
          )}
          {canMarkPaid && (
            <button onClick={markPaid} disabled={isPending}
              style={{ backgroundColor: C.sage, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <CheckCircle className="w-3.5 h-3.5" />Mark paid
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', width: 34, height: 34 }} className="flex items-center justify-center hover:opacity-80 transition-opacity" />
              }
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none w-44">
              {canVoid && (
                <DropdownMenuItem style={{ color: '#b45309', fontSize: 12 }} className="cursor-pointer hover:bg-[#F5F0EB]" onClick={voidInvoice}>
                  <FileText className="w-3.5 h-3.5 mr-2" />Void invoice
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator style={{ backgroundColor: C.border }} />
              <DropdownMenuItem style={{ color: '#dc2626', fontSize: 12 }} className="cursor-pointer hover:bg-[#F5F0EB]" onClick={deleteInvoice}>
                <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div style={{ backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', padding: '12px 16px' }} className="flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#dc2626' }} />
          <p style={{ color: '#dc2626', fontSize: 13 }}>This invoice was due {formatDate(invoice.due_date!)} and is overdue.</p>
        </div>
      )}

      {/* Deposit info */}
      {depositInvoice && (
        <div style={{
          backgroundColor: depositInvoice.status === 'paid' ? 'rgba(118,165,143,0.08)' : 'rgba(180,83,9,0.06)',
          border: `1px solid ${depositInvoice.status === 'paid' ? 'rgba(118,165,143,0.25)' : 'rgba(180,83,9,0.2)'}`,
          padding: '12px 16px',
        }} className="flex items-center gap-3">
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: depositInvoice.status === 'paid' ? C.sage : '#b45309' }} />
          <p style={{ color: depositInvoice.status === 'paid' ? '#5d8c76' : '#b45309', fontSize: 13 }}>
            Deposit invoice {depositInvoice.invoice_number} — {formatCurrency(depositInvoice.total)}
            {depositInvoice.status === 'paid' ? ` paid ${formatDate(depositInvoice.paid_at!)}` : ' — awaiting payment'}
          </p>
          <Link href={`/invoices/${depositInvoice.id}`} style={{ marginLeft: 'auto', color: C.muted, fontSize: 11 }} className="hover:text-[#2C3E50] transition-colors">View →</Link>
        </div>
      )}

      {/* Invoice document */}
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
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              {invoice.invoice_type === 'deposit' ? 'Deposit Invoice' : invoice.invoice_type === 'final' ? 'Final Invoice' : 'Invoice'}
            </p>
            <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 22 }}>{invoice.invoice_number}</p>
          </div>
        </div>

        {/* Dates */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }} className="grid grid-cols-3 gap-6">
          <div>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Bill to</p>
            {contact ? (
              <>
                <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>{contact.first_name} {contact.last_name}</p>
                {contact.email && <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 2 }}>{contact.email}</p>}
                {contact.phone && <p style={{ color: '#4A5A65', fontSize: 12 }}>{contact.phone}</p>}
              </>
            ) : <p style={{ color: C.muted }}>—</p>}
          </div>
          <div>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Invoice date</p>
            <p style={{ color: C.fg, fontSize: 13 }}>{formatDate(invoice.created_at)}</p>
          </div>
          <div>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Due date</p>
            <p style={{ color: invoice.due_date && invoice.due_date < now && invoice.status !== 'paid' ? '#dc2626' : C.fg, fontSize: 13 }}>
              {invoice.due_date ? formatDate(invoice.due_date) : '—'}
            </p>
          </div>
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
              {(invoice.line_items ?? []).map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.subtle}` }}>
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
              <span style={{ color: '#4A5A65' }}>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: '#4A5A65' }}>GST (10%)</span>
                <span style={{ color: '#4A5A65' }}>{formatCurrency(invoice.tax)}</span>
              </div>
            )}
            <div className="flex justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>Total</span>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>{formatCurrency(invoice.total)}</span>
            </div>
            {(invoice.deposit_credit ?? 0) > 0 && (
              <>
                <div className="flex justify-between" style={{ fontSize: 13 }}>
                  <span style={{ color: C.sage }}>Deposit paid</span>
                  <span style={{ color: C.sage }}>− {formatCurrency(invoice.deposit_credit)}</span>
                </div>
                <div className="flex justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>Balance due</span>
                  <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 17 }}>{formatCurrency(balanceDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</p>
            <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6 }} className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
