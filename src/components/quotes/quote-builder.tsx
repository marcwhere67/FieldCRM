'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency, melbourneDateOnly } from '@/lib/format'
import { computeTotals, lineSubtotal, depositAmount as calcDeposit } from '@/lib/money'
import { Plus, Trash2, ChevronLeft, Send, Save } from 'lucide-react'
import Link from 'next/link'
import { AiQuoteAssist } from '@/components/ai/ai-quote-assist'

interface LineItem { service_id?: string; description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }
interface CatalogueItem { id: string; name: string; description: string | null; unit_price: number; unit: string; tax_rate?: number; type?: 'service' | 'product'; category?: string | null }
interface Props {
  contacts: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }[]
  services: { id: string; name: string; description: string | null; unit_price: number; unit: string; tax_rate: number }[]
  products?: CatalogueItem[]
  org: { name: string; abn: string | null; email: string | null; phone: string | null; address: string | null; default_payment_terms_days: number | null } | null
  orgId: string
  mode: 'new' | 'edit'
  initialLineItems?: LineItem[]
  initialCleanType?: string
  quote?: {
    id: string; quote_number: string; contact_id?: string; line_items: LineItem[]
    notes_client: string | null; notes_internal: string | null; valid_until: string | null
    clean_type?: string | null
    deposit_type?: string; deposit_value?: number; deposit_amount?: number
    contacts?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }[] | { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null
  }
  onCancel?: () => void
}

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '7px 10px', outline: 'none', width: '100%',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

export function QuoteBuilder({ contacts, services, products = [], org, orgId, mode, quote: existingQuote, initialLineItems, initialCleanType, onCancel }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const existingContact = existingQuote?.contacts
    ? (Array.isArray(existingQuote.contacts) ? existingQuote.contacts[0] : existingQuote.contacts) : null
  const [contactId, setContactId] = useState(existingQuote?.contact_id ?? existingContact?.id ?? '')
  const [lineItems, setLineItems] = useState<LineItem[]>(existingQuote?.line_items ?? initialLineItems ?? [])
  const [notes, setNotes] = useState(existingQuote?.notes_client ?? '')
  const [internalNotes, setInternalNotes] = useState(existingQuote?.notes_internal ?? '')
  const [validDays, setValidDays] = useState(30)
  const [serviceSearch, setServiceSearch] = useState('')
  const [depositType, setDepositType] = useState<'none' | 'percentage' | 'fixed'>((existingQuote?.deposit_type as 'none' | 'percentage' | 'fixed') ?? 'none')
  const [depositValue, setDepositValue] = useState(existingQuote?.deposit_value ?? 0)
  const [cleanType, setCleanType] = useState<'none' | 'regular' | 'deep' | 'airbnb'>(
    (existingQuote?.clean_type as 'regular' | 'deep' | 'airbnb') ?? (initialCleanType as 'regular' | 'deep' | 'airbnb') ?? 'none',
  )

  const { subtotal, tax, total } = computeTotals(lineItems)
  const depositAmount = calcDeposit(depositType, depositValue, total)

  function addCatalogueItem(item: CatalogueItem) {
    setLineItems(prev => [...prev, { service_id: item.id, description: item.name, quantity: 1, unit_price: item.unit_price, tax_rate: item.tax_rate ?? 0, subtotal: item.unit_price }])
    setServiceSearch('')
  }

  function addBlankLine() { setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 }]) }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') updated.subtotal = lineSubtotal(Number(updated.quantity), Number(updated.unit_price))
      return updated
    }))
  }

  function removeLine(index: number) { setLineItems(prev => prev.filter((_, i) => i !== index)) }

  async function saveQuote(action: 'draft' | 'sent') {
    if (!contactId) { toast.error('Please select a client'); return }
    if (lineItems.length === 0) { toast.error('Add at least one line item'); return }

    // Sending emails the quote — the client must have an email address.
    if (action === 'sent') {
      const c = contacts.find(x => x.id === contactId)
      if (!c?.email) { toast.error('This client has no email address — add one, or save as draft'); return }
    }

    setSaving(true)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + validDays)
    // Always save as a draft first; the send route flips it to 'sent' once the email goes out.
    const payload = { org_id: orgId, contact_id: contactId, ...(!existingQuote && { quote_number: '' }), status: 'draft', line_items: lineItems, subtotal, tax, total, notes_client: notes || null, notes_internal: internalNotes || null, valid_until: melbourneDateOnly(validUntil), sent_at: null, deposit_type: depositType, deposit_value: depositValue, deposit_amount: depositAmount, clean_type: cleanType === 'none' ? null : cleanType }

    let quoteId = existingQuote?.id
    if (mode === 'new') {
      const { data, error } = await supabase.from('quotes').insert(payload).select('id').single()
      if (error || !data) { toast.error(error?.message ?? 'Failed to save'); setSaving(false); return }
      quoteId = data.id
    } else {
      const { error } = await supabase.from('quotes').update(payload).eq('id', existingQuote!.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    if (action === 'draft') {
      toast.success('Quote saved as draft')
      setSaving(false)
      router.push(`/quotes/${quoteId}`)
      return
    }

    // action === 'sent' — actually email the quote (PDF attached) via the send route
    const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      toast.error(data?.error ? `Saved as draft — sending failed: ${data.error}` : 'Saved as draft, but sending failed')
    } else {
      toast.success('Quote sent')
    }
    router.push(`/quotes/${quoteId}`)
  }

  const catalogueItems: CatalogueItem[] = [...services.map(s => ({ ...s, type: 'service' as const })), ...products.filter(p => !services.some(s => s.name === p.name))]
  const filteredServices = catalogueItems.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || (s.category ?? '').toLowerCase().includes(serviceSearch.toLowerCase()))

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Back nav */}
      <div style={{ marginBottom: 20 }}>
        {onCancel ? (
          <button onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }} className="hover:opacity-70 transition-opacity">
            <ChevronLeft style={{ width: 14, height: 14 }} />Cancel editing
          </button>
        ) : (
          <Link href="/quotes" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, textDecoration: 'none' }} className="hover:opacity-70 transition-opacity">
            <ChevronLeft style={{ width: 14, height: 14 }} />Back to quotes
          </Link>
        )}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300, marginBottom: 2 }}>{mode === 'new' ? 'New Quote' : 'Edit Quote'}</h1>
          <p style={{ color: C.muted, fontSize: 12 }}>{existingQuote?.quote_number ?? (mode === 'new' ? 'Number assigned on save' : '')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => saveQuote('draft')} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
            className="uppercase hover:opacity-70 transition-opacity">
            <Save style={{ width: 12, height: 12 }} />Save draft
          </button>
          <button onClick={() => saveQuote('sent')} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }}
            className="uppercase hover:opacity-90 transition-opacity">
            <Send style={{ width: 12, height: 12 }} />Save & send
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
        {/* Main column */}
        <div className="space-y-5">
          {/* Client */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 12 }}>Client</p>
            <label style={labelSt}>Select client</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)} style={inp}>
              <option value="">Search and select a client…</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Line Items</p>
              <AiQuoteAssist services={services} onAdd={items => setLineItems(prev => [...prev, ...items])} />
            </div>

            {/* Service search */}
            <div style={{ position: 'relative' }}>
              <input placeholder="Search services to add…" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} style={inp} />
              {serviceSearch && filteredServices.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 2, backgroundColor: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 4px 20px rgba(44,62,80,0.12)', maxHeight: 256, overflowY: 'auto' }}>
                  {filteredServices.map(item => (
                    <button key={item.id} onClick={() => addCatalogueItem(item)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left' }}
                      className="hover:bg-stone-50 transition-colors">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ color: C.navy, fontSize: 13 }} className="truncate">{item.name}</p>
                          {item.type === 'product' && (
                            <span style={{ fontSize: 9, padding: '2px 6px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: 'rgba(245,158,11,0.1)', color: '#b45309', flexShrink: 0 }}>Material</span>
                          )}
                        </div>
                        {item.description && <p style={{ color: C.muted, fontSize: 11 }} className="truncate">{item.description}</p>}
                      </div>
                      <span style={{ color: C.navy, fontSize: 13, fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>{formatCurrency(item.unit_price)} / {item.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            {lineItems.length > 0 && (
              <div className="space-y-1">
                <div style={{ display: 'grid', gridTemplateColumns: '5fr 1fr 1fr 1fr 24px', gap: 8, padding: '4px 8px' }}>
                  {['Item','Qty','Price','Total',''].map((h, i) => (
                    <div key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '5fr 1fr 1fr 1fr 24px', gap: 8, alignItems: 'center', padding: '4px 4px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <input value={item.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" style={{ ...inp, padding: '5px 8px', fontSize: 12 }} />
                    <input type="number" value={item.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                    <input type="number" value={item.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                    <span style={{ color: C.navy, fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{formatCurrency(item.subtotal)}</span>
                    <button onClick={() => removeLine(i)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }} className="hover:opacity-70 transition-opacity">
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={addBlankLine}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.sage, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
              className="hover:opacity-70 transition-opacity">
              <Plus style={{ width: 13, height: 13 }} />Add custom line item
            </button>

            {lineItems.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="space-y-2">
                {[['Subtotal', formatCurrency(subtotal)], ['GST (10%)', formatCurrency(tax)]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}><span>{l}</span><span>{v}</span></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
                  <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total</span>
                  <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 18 }}>{formatCurrency(total)}</span>
                </div>
                {depositType !== 'none' && depositAmount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                      <span>Deposit required{depositType === 'percentage' && <span style={{ color: C.muted, fontWeight: 400 }}> ({depositValue}%)</span>}</span>
                      <span>{formatCurrency(depositAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                      <span>Balance on completion</span><span>{formatCurrency(total - depositAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Notes</p>
            <div>
              <label style={labelSt}>Client-visible notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, what's included, special instructions…" rows={3} style={{ ...inp, resize: 'none' }} />
            </div>
            <div>
              <label style={labelSt}>Internal notes (not shown to client)</label>
              <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Internal notes for your team…" rows={2} style={{ ...inp, resize: 'none' }} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Quote Settings</p>
            <div>
              <label style={labelSt}>Valid for (days)</label>
              <input type="number" value={validDays} onChange={e => setValidDays(parseInt(e.target.value) || 30)} min="1" max="365" style={{ ...inp }} />
            </div>
            <div>
              <label style={labelSt}>Scope of work (clean type)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {([
                  ['none', 'None'],
                  ['regular', 'Regular'],
                  ['deep', 'Deep'],
                  ['airbnb', 'Airbnb'],
                ] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setCleanType(val)}
                    style={{
                      padding: '7px 0', fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer',
                      border: `1px solid ${cleanType === val ? C.sage : C.border}`,
                      backgroundColor: cleanType === val ? C.sage : '#fff',
                      color: cleanType === val ? '#fff' : C.muted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ color: C.muted, fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
                Adds a matching Scope of Work page to the quote. &quot;None&quot; = no scope shown.
              </p>
            </div>
          </div>

          {/* Deposit */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Deposit</p>
            <div style={{ display: 'flex', border: `1px solid ${C.border}` }}>
              {(['none', 'percentage', 'fixed'] as const).map(t => (
                <button key={t} onClick={() => { setDepositType(t); setDepositValue(t === 'percentage' ? 30 : 0) }}
                  style={{ flex: 1, padding: '6px 0', fontSize: 11, letterSpacing: '0.06em', border: 'none', backgroundColor: depositType === t ? C.navy : '#fff', color: depositType === t ? '#fff' : C.muted, cursor: 'pointer' }}
                  className="uppercase">
                  {t === 'none' ? 'None' : t === 'percentage' ? '%' : '$'}
                </button>
              ))}
            </div>
            {depositType !== 'none' && (
              <div>
                <label style={labelSt}>{depositType === 'percentage' ? 'Percentage (%)' : 'Fixed amount ($)'}</label>
                <input type="number" value={depositValue} onChange={e => setDepositValue(parseFloat(e.target.value) || 0)} min="0" max={depositType === 'percentage' ? 100 : undefined} style={inp} />
                {depositAmount > 0 && <p style={{ color: C.sage, fontSize: 11, marginTop: 4 }}>Deposit due: {formatCurrency(depositAmount)}</p>}
              </div>
            )}
          </div>

          {/* Business info */}
          {org && (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-2">
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>From</p>
              <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{org.name}</p>
              {org.abn && <p style={{ color: C.muted, fontSize: 11 }}>ABN: {org.abn}</p>}
              {org.email && <p style={{ color: C.muted, fontSize: 11 }}>{org.email}</p>}
              {org.phone && <p style={{ color: C.muted, fontSize: 11 }}>{org.phone}</p>}
            </div>
          )}

          {/* Summary + actions */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Summary</p>
            <div className="space-y-2">
              {[['Items', lineItems.length.toString()], ['Subtotal', formatCurrency(subtotal)], ['GST', formatCurrency(tax)]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}><span>{l}</span><span>{v}</span></div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: C.navy, fontSize: 13, fontWeight: 600 }}>Total</span>
                <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 16 }}>{formatCurrency(total)}</span>
              </div>
              {depositType !== 'none' && depositAmount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                    <span>Deposit{depositType === 'percentage' && ` (${depositValue}%)`}</span>
                    <span>{formatCurrency(depositAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                    <span>Balance due</span><span>{formatCurrency(total - depositAmount)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2" style={{ paddingTop: 8 }}>
              <button onClick={() => saveQuote('sent')} disabled={saving}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }}
                className="uppercase hover:opacity-90 transition-opacity">
                <Send style={{ width: 12, height: 12 }} />Send quote
              </button>
              <button onClick={() => saveQuote('draft')} disabled={saving}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
                className="uppercase hover:opacity-70 transition-opacity">
                <Save style={{ width: 12, height: 12 }} />Save draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
