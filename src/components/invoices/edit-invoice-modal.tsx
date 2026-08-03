'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { computeTotals, lineSubtotal, type MoneyLine } from '@/lib/money'

interface InvoiceLine extends MoneyLine { description: string }

const C = { navy: '#2C3E50', muted: '#8A9BA6', border: 'rgba(44,62,80,0.12)' }
const inp = { width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`, background: '#fff', color: C.navy }
const labelSt = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

interface Props {
  invoiceId: string
  invoiceNumber: string | null
  initialLines: InvoiceLine[]
  onClose: () => void
  // Called after a successful save. wasSent lets the parent prompt a re-send.
  onSaved: () => void
}

export function EditInvoiceModal({ invoiceId, invoiceNumber, initialLines, onClose, onSaved }: Props) {
  const [lineItems, setLineItems] = useState<InvoiceLine[]>(
    initialLines.length > 0
      ? initialLines.map(l => ({ ...l, subtotal: lineSubtotal(Number(l.quantity), Number(l.unit_price)) }))
      : [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, subtotal: 0 }],
  )
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

  async function save() {
    const items = lineItems.filter(i => i.description.trim() !== '')
    if (items.length === 0) { toast.error('Add at least one line item'); return }

    setSaving(true)
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_items: items }),
    })
    const data = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) { toast.error(data?.error ?? 'Failed to update invoice'); return }

    toast.success('Invoice updated')
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>Edit invoice{invoiceNumber ? ` ${invoiceNumber}` : ''}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          <div className="space-y-2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={labelSt}>Line items</label>
              <button onClick={addLine} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.navy, background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: 12, height: 12 }} />Add line
              </button>
            </div>
            <div className="hidden sm:grid" style={{ gridTemplateColumns: '5fr 1fr 1fr 1fr 24px', gap: 8, padding: '4px 8px' }}>
              {['Item', 'Qty', 'Price', 'Total', ''].map((h, i) => (
                <div key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[5fr_1fr_1fr_1fr_24px]" style={{ gap: 8, alignItems: 'center', padding: '8px 4px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <input value={item.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" style={{ ...inp, padding: '5px 8px', fontSize: 12 }} />
                <div className="grid grid-cols-3 gap-2 sm:contents">
                  <div>
                    <span className="sm:hidden" style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Qty</span>
                    <input type="number" value={item.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                  </div>
                  <div>
                    <span className="sm:hidden" style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Price</span>
                    <input type="number" value={item.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} min="0" style={{ ...inp, padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="sm:hidden block" style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>{formatCurrency(item.subtotal ?? 0)}</span>
                  </div>
                </div>
                <button onClick={() => removeLine(i)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', justifySelf: 'end' }} className="sm:justify-self-auto">
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
          <button onClick={save} disabled={saving} style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }} className="uppercase hover:opacity-90 transition-opacity">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
