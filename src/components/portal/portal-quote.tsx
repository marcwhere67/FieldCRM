'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronLeft, CheckCircle, XCircle, Download } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/format'

interface LineItem { description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }
interface Quote {
  id: string; quote_number: string; status: string; line_items: LineItem[]
  subtotal: number; tax: number; total: number; notes_client: string | null
  valid_until: string | null; deposit_type: string | null; deposit_amount: number | null; created_at: string
}
interface Props { quote: Quote; orgName: string }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  sent:      { label: 'Awaiting approval', bg: 'rgba(37,99,235,0.07)',   color: '#2563eb' },
  approved:  { label: 'Approved',          bg: 'rgba(118,165,143,0.1)',  color: '#5d8c76' },
  declined:  { label: 'Declined',          bg: 'rgba(220,38,38,0.07)',   color: '#dc2626' },
  converted: { label: 'Booked',            bg: 'rgba(118,165,143,0.1)',  color: '#5d8c76' },
}

export function PortalQuote({ quote, orgName }: Props) {
  const [status, setStatus] = useState(quote.status)
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const supabase = createClient()

  async function respond(action: 'approve' | 'decline') {
    setLoading(action)
    const newStatus = action === 'approve' ? 'approved' : 'declined'
    const { error } = await supabase.from('quotes').update({ status: newStatus }).eq('id', quote.id)
    if (error) toast.error('Something went wrong. Please try again.')
    else { setStatus(newStatus); toast.success(action === 'approve' ? 'Quote approved!' : 'Quote declined.') }
    setLoading(null)
  }

  const canRespond = status === 'sent'
  const ss = STATUS[status] ?? { label: status, bg: 'rgba(44,62,80,0.06)', color: C.muted }

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
          <a href={`/api/portal/quotes/${quote.id}/pdf`} download
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, textDecoration: 'none' }}
            className="hover:opacity-70 transition-opacity">
            <Download style={{ width: 14, height: 14 }} />Download PDF
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{quote.quote_number}</h1>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
              Created {formatDate(quote.created_at.split('T')[0])}
              {quote.valid_until && ` · Valid until ${formatDate(quote.valid_until)}`}
            </p>
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ss.label}
          </span>
        </div>

        {status === 'approved' && (
          <div style={{ backgroundColor: 'rgba(118,165,143,0.08)', border: `1px solid rgba(118,165,143,0.25)`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle style={{ width: 16, height: 16, color: '#5d8c76', flexShrink: 0 }} />
            <p style={{ color: '#5d8c76', fontSize: 13 }}>You approved this quote. We'll be in touch to schedule the work.</p>
          </div>
        )}
        {status === 'declined' && (
          <div style={{ backgroundColor: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.2)`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0 }} />
            <p style={{ color: '#dc2626', fontSize: 13 }}>You declined this quote. Contact us if you'd like to discuss.</p>
          </div>
        )}

        {/* Line items */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Quote details</p>
          </div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
              {['Description','Qty','Price','Total'].map((h, i) => (
                <div key={h} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {quote.line_items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', borderBottom: i < quote.line_items.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <div style={{ color: C.fg, fontSize: 13 }}>{item.description}</div>
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'right' }}>{item.quantity}</div>
                <div style={{ color: C.muted, fontSize: 13, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</div>
                <div style={{ color: C.fg, fontSize: 13, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }} className="space-y-2">
            {[['Subtotal', formatCurrency(quote.subtotal)], ['GST (10%)', formatCurrency(quote.tax)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted }}><span>{l}</span><span>{v}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
              <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 18 }}>{formatCurrency(quote.total)}</span>
            </div>
            {quote.deposit_amount && quote.deposit_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10, fontSize: 13, color: '#b45309', fontWeight: 500 }}>
                <span>Deposit required to book</span>
                <span>{formatCurrency(quote.deposit_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {quote.notes_client && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Notes</p>
            <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.notes_client}</p>
          </div>
        )}

        {canRespond && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-3">
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Ready to proceed?</p>
            <p style={{ color: C.muted, fontSize: 13 }}>Review the details above then approve or decline this quote.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => respond('decline')} disabled={!!loading}
                style={{ flex: 1, padding: '9px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                className="uppercase hover:opacity-70 transition-opacity">
                <XCircle style={{ width: 14, height: 14 }} />
                {loading === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button onClick={() => respond('approve')} disabled={!!loading}
                style={{ flex: 1, padding: '9px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                className="uppercase">
                <CheckCircle style={{ width: 14, height: 14 }} />
                {loading === 'approve' ? 'Approving…' : 'Approve quote'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
