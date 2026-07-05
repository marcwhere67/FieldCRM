'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/format'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

interface LineItem { id: string; description: string; quantity: number; unit_price: number; subtotal: number; tax_rate: number }
interface Quote {
  id: string; quote_number: string; status: string; subtotal: number; tax: number; total: number
  valid_until: string | null; notes_client: string | null; line_items: LineItem[]
  deposit_type?: string; deposit_value?: number; deposit_amount?: number
  contacts: { first_name: string; last_name: string; email: string | null } | { first_name: string; last_name: string; email: string | null }[] | null
  properties: { label: string | null; address_line1: string | null; suburb: string | null; state: string | null; postcode: string | null } | null | unknown[]
}
interface Org { name: string; abn: string | null; email: string | null; phone: string | null; address: string | null; logo_url: string | null }
interface Props { quote: Quote; org: Org | null }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

export function QuoteApproval({ quote, org }: Props) {
  const [status, setStatus] = useState(quote.status)
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const supabase = createClient()

  const contact  = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const property = Array.isArray(quote.properties)
    ? (quote.properties as { label: string | null; address_line1: string | null; suburb: string | null; state: string | null; postcode: string | null }[])[0]
    : quote.properties as { label: string | null; address_line1: string | null; suburb: string | null; state: string | null; postcode: string | null } | null
  const isExpired  = quote.valid_until && new Date(quote.valid_until) < new Date()
  const isTerminal = ['approved', 'declined', 'converted'].includes(status)

  async function respond(action: 'approve' | 'decline') {
    setLoading(action)
    const now = new Date().toISOString()
    const update = action === 'approve' ? { status: 'approved', approved_at: now } : { status: 'declined', declined_at: now }
    const { error } = await supabase.from('quotes').update(update).eq('id', quote.id)
    if (!error) setStatus(action === 'approve' ? 'approved' : 'declined')
    setLoading(null)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream, padding: '48px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }} className="space-y-6">
        <div style={{ textAlign: 'center' }}>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 56, width: 'auto', margin: '0 auto 12px' }} />}
          <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{org?.name}</p>
          {org?.abn && <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>ABN {org.abn}</p>}
          {org?.email && <p style={{ color: C.muted, fontSize: 12 }}>{org.email}</p>}
          {org?.phone && <p style={{ color: C.muted, fontSize: 12 }}>{org.phone}</p>}
        </div>

        {status === 'approved' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(118,165,143,0.1)', border: `1px solid rgba(118,165,143,0.3)` }}>
            <CheckCircle style={{ width: 16, height: 16, color: C.sage, flexShrink: 0 }} />
            <p style={{ color: '#5d8c76', fontSize: 13 }}>Quote approved — we'll be in touch to arrange your service.</p>
          </div>
        )}
        {status === 'declined' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.2)` }}>
            <XCircle style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0 }} />
            <p style={{ color: '#dc2626', fontSize: 13 }}>Quote declined. Please contact us if you'd like to discuss further.</p>
          </div>
        )}
        {status === 'converted' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(118,165,143,0.1)', border: `1px solid rgba(118,165,143,0.3)` }}>
            <CheckCircle style={{ width: 16, height: 16, color: C.sage, flexShrink: 0 }} />
            <p style={{ color: '#5d8c76', fontSize: 13 }}>Quote approved and job scheduled.</p>
          </div>
        )}
        {isExpired && !isTerminal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.25)` }}>
            <AlertCircle style={{ width: 16, height: 16, color: '#b45309', flexShrink: 0 }} />
            <p style={{ color: '#b45309', fontSize: 13 }}>This quote expired on {formatDate(quote.valid_until!)}. Contact us to get a fresh quote.</p>
          </div>
        )}

        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Quote</p>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{quote.quote_number}</p>
            </div>
            {quote.valid_until && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: C.muted, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 4 }}>
                  <Clock style={{ width: 11, height: 11 }} />Valid until
                </p>
                <p style={{ fontSize: 12, fontWeight: 500, color: isExpired ? '#dc2626' : C.navy }}>{formatDate(quote.valid_until)}</p>
              </div>
            )}
          </div>

          {(contact || property) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              {contact && (
                <div>
                  <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Prepared for</p>
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{contact.first_name} {contact.last_name}</p>
                  {contact.email && <p style={{ color: C.muted, fontSize: 12 }}>{contact.email}</p>}
                </div>
              )}
              {property && (
                <div>
                  <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Service address</p>
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{property.label ?? property.address_line1}</p>
                  <p style={{ color: C.muted, fontSize: 12 }}>{[property.suburb, property.state, property.postcode].filter(Boolean).join(', ')}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Description','Qty','Price','Total'].map((h, i) => (
                    <th key={h} style={{ padding: '6px 0', textAlign: i === 0 ? 'left' : 'right', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(quote.line_items ?? []).map((item, i) => (
                  <tr key={item.id ?? i} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '10px 0', color: C.fg, fontSize: 13 }}>{item.description}</td>
                    <td style={{ padding: '10px 0', color: C.muted, fontSize: 13, textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ padding: '10px 0', color: C.muted, fontSize: 13, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ padding: '10px 0', color: C.navy, fontSize: 13, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ marginLeft: 'auto', width: 224 }} className="space-y-2">
              {[['Subtotal', formatCurrency(quote.subtotal)], ['GST (10%)', formatCurrency(quote.tax)]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}><span>{l}</span><span>{v}</span></div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total</span>
                <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 18 }}>{formatCurrency(quote.total)}</span>
              </div>
              {quote.deposit_type !== 'none' && (quote.deposit_amount ?? 0) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10, fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                    <span>Deposit required{quote.deposit_type === 'percentage' && <span style={{ color: C.muted, fontWeight: 400 }}> ({quote.deposit_value}%)</span>}</span>
                    <span>{formatCurrency(quote.deposit_amount ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                    <span>Balance on completion</span><span>{formatCurrency(quote.total - (quote.deposit_amount ?? 0))}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {quote.notes_client && (
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</p>
              <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.notes_client}</p>
            </div>
          )}

          {!isTerminal && !isExpired && (
            <div style={{ display: 'flex', gap: 10, padding: '20px 24px' }}>
              <button onClick={() => respond('approve')} disabled={loading !== null}
                style={{ flex: 1, padding: '10px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                className="uppercase">
                <CheckCircle style={{ width: 14, height: 14 }} />
                {loading === 'approve' ? 'Approving…' : 'Approve quote'}
              </button>
              <button onClick={() => respond('decline')} disabled={loading !== null}
                style={{ flex: 1, padding: '10px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid rgba(220,38,38,0.3)`, color: '#dc2626', background: '#fff', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                className="uppercase hover:opacity-70 transition-opacity">
                <XCircle style={{ width: 14, height: 14 }} />
                {loading === 'decline' ? 'Declining…' : 'Decline'}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: C.muted, fontSize: 11 }}>
          Questions? Contact us at {org?.email ?? org?.phone ?? 'info@example.com'}
        </p>
      </div>
    </div>
  )
}
