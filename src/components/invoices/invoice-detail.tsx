'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, melbourneDateOnly } from '@/lib/format'
import { toast } from 'sonner'
import { ArrowLeft, Send, CheckCircle, Trash2, MoreHorizontal, AlertCircle, FileText, Download, Pencil } from 'lucide-react'
import { SendEmailModal, type EmailDraft } from '@/components/emails/send-email-modal'
import { defaultReceiptMessage } from '@/lib/emails/invoice-email'
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
interface Payment { id: string; receipt_number: string | null; amount: number; method: string; recorded_at: string | null; reference: string | null }
interface Props { invoice: Invoice; org: Org | null; orgId: string; depositInvoice: DepositInvoice | null; payments?: Payment[] }

export function InvoiceDetail({ invoice, org, orgId, depositInvoice, payments = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs
  const quote = Array.isArray(invoice.quotes) ? invoice.quotes[0] : invoice.quotes

  const now = melbourneDateOnly()
  const isOverdue = invoice.status === 'sent' && invoice.due_date && invoice.due_date < now
  const displayStatus = isOverdue ? 'overdue' : invoice.status
  const balanceDue = invoice.total - (invoice.deposit_credit ?? 0)
  const st = STATUS_STYLE[displayStatus] ?? STATUS_STYLE.draft

  const [showPayment, setShowPayment] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: balanceDue.toFixed(2),
    payment_date: now,
    method: 'bank_transfer',
    reference: invoice.invoice_number,
    note: '',
    send_receipt: !!contact?.email,
  })
  const setPay = (k: string, v: string | boolean) => setPayForm(f => ({ ...f, [k]: v }))
  // Editable receipt message. null = untouched → track the amount live.
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null)
  const defaultReceiptMsg = defaultReceiptMessage({
    firstName: contact?.first_name?.trim(),
    paidLine: formatCurrency(Number(payForm.amount) || 0),
    invoiceNumber: invoice.invoice_number,
  })
  const receiptValue = receiptMsg ?? defaultReceiptMsg

  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)

  function markSent(override?: { subject: string; message: string }) {
    if (!contact?.email) { toast.error('Contact has no email address'); return }
    startTransition(async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        ...(override && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(override) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error ?? 'Failed to send invoice'); return }
      toast.success(`Invoice emailed to ${contact.email}`); setEmailDraft(null); router.refresh()
    })
  }

  async function openReview() {
    if (!contact?.email) { toast.error('Contact has no email address'); return }
    setLoadingDraft(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not load the email'); return }
      setEmailDraft(data)
    } finally {
      setLoadingDraft(false)
    }
  }

  async function recordPayment() {
    if (!(Number(payForm.amount) > 0)) { toast.error('Enter an amount greater than zero'); return }
    startTransition(async () => {
      const res = await fetch(`/api/invoices/${invoice.id}/payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payForm, receipt_message: payForm.send_receipt ? receiptValue : undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error ?? 'Failed to record payment'); return }
      const msg = data.status === 'paid' ? 'Payment recorded — invoice paid in full' : `Payment recorded — ${formatCurrency(data.balance_remaining)} remaining`
      if (data.receipt_warning) toast.warning(`${msg}. Receipt email failed: ${data.receipt_warning}`)
      else toast.success(payForm.send_receipt && contact?.email ? `${msg} — receipt sent` : msg)
      setShowPayment(false); router.refresh()
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
  const canMarkPaid = ['sent', 'overdue', 'partial'].includes(displayStatus)
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
            <button onClick={openReview} disabled={isPending || loadingDraft}
              style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <Pencil className="w-3.5 h-3.5" />{loadingDraft ? 'Loading…' : 'Review & send'}
            </button>
          )}
          {canSend && (
            <button onClick={() => markSent()} disabled={isPending}
              style={{ backgroundColor: '#2563eb', color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />{isPending ? 'Sending…' : 'Send invoice'}
            </button>
          )}
          {canMarkPaid && (
            <button onClick={() => { setPayForm(f => ({ ...f, amount: balanceDue.toFixed(2) })); setShowPayment(true) }} disabled={isPending}
              style={{ backgroundColor: C.sage, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
              <CheckCircle className="w-3.5 h-3.5" />Record payment
            </button>
          )}
          <a href={`/api/invoices/${invoice.id}/pdf`} download
            style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', textDecoration: 'none' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Download className="w-3.5 h-3.5" />PDF
          </a>
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

      {/* Payment history */}
      {payments.length > 0 && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px' }}>
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Payments</p>
          </div>
          {payments.map(p => (
            <div key={p.id} style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 24px' }} className="flex items-center gap-4 flex-wrap">
              <span style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{formatCurrency(p.amount)}</span>
              <span style={{ color: '#4A5A65', fontSize: 12 }}>{p.recorded_at ? formatDate(p.recorded_at) : '—'}</span>
              <span style={{ color: C.muted, fontSize: 12 }} className="capitalize">{p.method.replace(/_/g, ' ')}</span>
              {p.reference && <span style={{ color: C.muted, fontSize: 12 }}>Ref: {p.reference}</span>}
              {p.receipt_number && (
                <a href={`/api/payments/${p.id}/pdf`} download
                  style={{ marginLeft: 'auto', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '5px 12px', fontSize: 10, letterSpacing: '0.08em', textDecoration: 'none' }}
                  className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
                  <Download className="w-3 h-3" />{p.receipt_number}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showPayment && (
        <div onClick={() => !isPending && setShowPayment(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 420, padding: 24 }}>
            <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300, marginBottom: 4 }}>Record Payment</h3>
            <p style={{ color: C.muted, fontSize: 12, marginBottom: 18 }}>Invoice {invoice.invoice_number} · {formatCurrency(balanceDue)} owing</p>

            {(() => {
              const lbl = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' as const }
              const inp = { backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' as const }
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={lbl}>Amount</label>
                      <input type="number" step="0.01" min="0" value={payForm.amount} onChange={e => setPay('amount', e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" value={payForm.payment_date} onChange={e => setPay('payment_date', e.target.value)} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Method</label>
                    <select value={payForm.method} onChange={e => setPay('method', e.target.value)} style={{ ...inp, appearance: 'auto' as const }}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Reference</label>
                    <input value={payForm.reference} onChange={e => setPay('reference', e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Note (optional)</label>
                    <input value={payForm.note} onChange={e => setPay('note', e.target.value)} style={inp} />
                  </div>
                  {contact?.email && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.fg, cursor: 'pointer' }}>
                      <input type="checkbox" checked={payForm.send_receipt} onChange={e => setPay('send_receipt', e.target.checked)} />
                      Email receipt to {contact.email}
                    </label>
                  )}
                  {contact?.email && payForm.send_receipt && (
                    <div>
                      <label style={lbl}>Receipt message</label>
                      <textarea value={receiptValue} onChange={e => setReceiptMsg(e.target.value)} rows={5}
                        style={{ ...inp, height: 'auto', padding: '8px 10px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} />
                      <p style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>Your logo, the paid/balance line and sign-off are added automatically. The receipt PDF will be attached.</p>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
              <button onClick={() => setShowPayment(false)} disabled={isPending}
                style={{ border: `1px solid ${C.border}`, color: C.muted, backgroundColor: '#fff', padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em' }}
                className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">Cancel</button>
              <button onClick={recordPayment} disabled={isPending}
                style={{ backgroundColor: C.sage, color: '#fff', padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em' }}
                className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                {isPending ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailDraft && (
        <SendEmailModal
          draft={emailDraft}
          sending={isPending}
          onSend={(subject, message) => markSent({ subject, message })}
          onClose={() => setEmailDraft(null)}
        />
      )}
    </div>
  )
}
