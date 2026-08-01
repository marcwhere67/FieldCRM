'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { computeTotals, lineSubtotal, type MoneyLine } from '@/lib/money'

interface InvoiceLine extends MoneyLine { description: string }

const C = { navy: '#2C3E50', muted: '#8A9BA6', border: 'rgba(44,62,80,0.12)' }
const inp = { width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`, background: '#fff', color: C.navy }
const labelSt = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

interface Contact { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }

interface Props {
  contacts: Contact[]
  onClose: () => void
}

export function NewInvoiceModal({ contacts, onClose }: Props) {
  const router = useRouter()
  const [contactId, setContactId] = useState('')
  const [lineItems, setLineItems] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 },
  ])
  const [saving, setSaving] = useState(false)

  const { subtotal, tax, total } = computeTotals(lineItems)

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') updated.subtotal = lineSubtotal(Number(updated.quantity), Number(updated.unit_price))
      return updated
    }))
  }

  function addLine() { setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 }]) }
  function removeLine(index: number) { setLineItems(prev => prev.filter((_, i) => i !== index)) }

  async function createInvoice() {
    if (!contactId) { toast.error('Please select a client'); return }
    const items = lineItems.filter(i => i.description.trim() !== '')
    if (items.length === 0) { toast.error('Add at least one line item'); return }

    setSaving(true)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, line_items: items }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to create invoice'); return }

    toast.success('Invoice created')
    router.push(`/invoices/${data.id}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>New invoice</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          <p style={{ color: C.muted, fontSize: 11 }}>
            For clients billed directly with no quote step first — e.g. Airbnb/property-manager cleans.
          </p>

          <div>
            <label style={labelSt}>Client</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)} style={inp}>
              <option value="">Search and select a client…</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={labelSt}>Line items</label>
              <button onClick={addLine} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.navy, background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: 12, height: 12 }} />Add line
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '5fr 1fr 1fr 1fr 24px', gap: 8, padding: '4px 8px' }}>
              {['Item', 'Qty', 'Price', 'Total', ''].map((h, i) => (
                <div key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {lineItems.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '5fr 1fr 1fr 1fr 24px', gap: 8, alignItems: 'center', padding: '4px 4px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <input value={item.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" style={{ ...inp, padding: '5px 8px', fontSize: 12 }} />
                <input type="number" value={item.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                <input type="number" value={item.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                <span style={{ color: C.navy, fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{formatCurrency(item.subtotal ?? 0)}</span>
                <button onClick={() => removeLine(i)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 200 }} className="space-y-1">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}><span>Tax</span><span>{formatCurrency(tax)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: C.navy }}><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }} className="uppercase">
            Cancel
          </button>
          <button onClick={createInvoice} disabled={saving} style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }} className="uppercase hover:opacity-90 transition-opacity">
            Create invoice
          </button>
        </div>
      </div>
    </div>
  )
}
