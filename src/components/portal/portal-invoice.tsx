'use client'

import Link from 'next/link'
import { ChevronLeft, ExternalLink, Download } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/format'

interface LineItem { description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }
interface Invoice {
  id: string; invoice_number: string; status: string; line_items: LineItem[]
  subtotal: number; tax: number; total: number; due_date: string | null
  created_at: string; stripe_payment_link: string | null | undefined; notes_client?: string | null
}
interface Props { invoice: Invoice; orgName: string }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sent:    { label: 'Unpaid',   bg: 'rgba(37,99,235,0.07)',  color: '#2563eb' },
  paid:    { label: 'Paid',     bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  overdue: { label: 'Overdue',  bg: 'rgba(220,38,38,0.07)',  color: '#dc2626' },
  void:    { label: 'Void',     bg: 'rgba(44,62,80,0.06)',   color: '#8A9BA6' },
}

export function PortalInvoice({ invoice, orgName }: Props) {
  const isPaid = invoice.status === 'paid'
  const isOverdue = invoice.status === 'overdue'
  const canPay = ['sent', 'overdue'].includes(invoice.status) && !!invoice.stripe_payment_link
  const ss = STATUS[invoice.status] ?? { label: invoice.status, bg: 'rgba(44,62,80,0.06)', color: C.muted }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <img src="/salt-air-logo.png" alt="Salt Air Cleaning" style={{ height: 32, width: 'auto' }} />
        </div>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }} className="space-y-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/portal/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, textDecoration: 'none' }}
            className="hover:opacity-70 transition-opacity">
            <ChevronLeft style={{ width: 14, height: 14 }} />Back to dashboard
          </Link>
          <a href={`/api/portal/invoices/${invoice.id}/pdf`} download
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, textDecoration: 'none' }}
            className="hover:opacity-70 transition-opacity">
            <Download style={{ width: 14, height: 14 }} />Download PDF
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{invoice.invoice_number}</h1>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
              Issued {formatDate(invoice.created_at.split('T')[0])}
              {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
            </p>
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ss.label}
          </span>
        </div>

        {isPaid && (
          <div style={{ backgroundColor: 'rgba(118,165,143,0.08)', border: `1px solid rgba(118,165,143,0.25)`, padding: '12px 16px' }}>
            <p style={{ color: '#5d8c76', fontSize: 13 }}>This invoice has been paid. Thank you!</p>
          </div>
        )}
        {isOverdue && (
          <div style={{ backgroundColor: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.2)`, padding: '12px 16px' }}>
            <p style={{ color: '#dc2626', fontSize: 13 }}>This invoice is overdue. Please make payment as soon as possible.</p>
          </div>
        )}

        {/* Line items */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Invoice details</p>
          </div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
              {['Description','Qty','Price','Total'].map((h, i) => (
                <div key={h} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {invoice.line_items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', borderBottom: i < invoice.line_items.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <div style={{ color: C.fg, fontSize: 13 }}>{item.description}</div>
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'right' }}>{item.quantity}</div>
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</div>
                <div style={{ color: C.fg, fontSize: 13, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }} className="space-y-2">
            {[['Subtotal', formatCurrency(invoice.subtotal)], ['GST (10%)', formatCurrency(invoice.tax)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted }}><span>{l}</span><span>{v}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
              <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 18 }}>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {canPay && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-3">
            <h3 style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Pay this invoice</h3>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Pay securely online. Amount due: <strong style={{ color: C.navy }}>{formatCurrency(invoice.total)}</strong>
            </p>
            <a href={invoice.stripe_payment_link ?? '#'} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: C.sage, color: '#fff', padding: '9px 20px', fontSize: 12, letterSpacing: '0.08em', textDecoration: 'none' }}
              className="uppercase hover:opacity-80 transition-opacity">
              <ExternalLink style={{ width: 14, height: 14 }} />Pay now
            </a>
          </div>
        )}
        {!canPay && !isPaid && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.muted, fontSize: 13 }}>Contact us to arrange payment for this invoice.</p>
          </div>
        )}
      </main>
    </div>
  )
}
