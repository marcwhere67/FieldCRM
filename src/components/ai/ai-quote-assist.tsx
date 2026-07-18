'use client'

import { useState } from 'react'
import { Sparkles, X, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

interface Service { id: string; name: string; description: string | null; unit_price: number; unit: string; tax_rate: number }
interface Suggestion { service_id: string; description: string; quantity: number; unit_price: number }
interface Props {
  services: Service[]
  onAdd: (items: { service_id: string; description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }[]) => void
}

const C = {
  navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.navy, fontSize: 13, padding: '8px 10px', outline: 'none',
}

export function AiQuoteAssist({ services, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  async function generate() {
    if (!prompt.trim()) return
    setLoading(true); setSuggestions([]); setSelected(new Set())
    try {
      const res = await fetch('/api/ai/quote-suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt, services }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuggestions(data.suggestions)
      setSelected(new Set(data.suggestions.map((_: Suggestion, i: number) => i)))
    } catch { toast.error('Failed to generate suggestions') }
    finally { setLoading(false) }
  }

  function addSelected() {
    const items = [...selected].map(i => {
      const s = suggestions[i]
      const svc = services.find(sv => sv.id === s.service_id)
      const taxRate = svc?.tax_rate ?? 0
      const subtotal = s.quantity * s.unit_price
      return { service_id: s.service_id, description: s.description, quantity: s.quantity, unit_price: s.unit_price, tax_rate: taxRate, subtotal }
    })
    onAdd(items)
    setOpen(false)
    toast.success(`Added ${items.length} line item${items.length !== 1 ? 's' : ''}`)
  }

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 11, letterSpacing: '0.06em', border: `1px solid rgba(44,62,80,0.15)`, color: C.muted, background: '#fff', cursor: 'pointer' }}
        className="uppercase hover:opacity-70 transition-opacity">
        <Sparkles style={{ width: 12, height: 12, color: '#7c3aed' }} />
        AI Assist
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles style={{ width: 14, height: 14, color: '#7c3aed' }} />
                <span style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>AI Quote Assistant</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Describe the job and AI will suggest line items from your services list.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
                  placeholder="e.g. End of lease clean for 3 bedroom apartment with oven and carpet steam clean"
                  style={{ ...inp, flex: 1 }} />
                <button onClick={generate} disabled={loading || !prompt.trim()}
                  style={{ padding: '8px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: (loading || !prompt.trim()) ? 'default' : 'pointer', opacity: (loading || !prompt.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  className="uppercase">
                  {loading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="space-y-2">
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, padding: '16px 0', justifyContent: 'center' }}>
                  <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                  <span style={{ fontSize: 13 }}>Analysing job…</span>
                </div>
              )}
              {!loading && suggestions.length === 0 && (
                <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Describe a job above to get AI-suggested line items.</p>
              )}
              {suggestions.map((s, i) => {
                const isSelected = selected.has(i)
                return (
                  <div key={i} onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: isSelected ? `1px solid rgba(124,58,237,0.4)` : `1px solid ${C.border}`, backgroundColor: isSelected ? 'rgba(124,58,237,0.04)' : '#FAFAF8', cursor: 'pointer' }}
                    className="hover:opacity-90 transition-opacity">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 14, height: 14, border: isSelected ? '1px solid #7c3aed' : `1px solid ${C.muted}`, backgroundColor: isSelected ? '#7c3aed' : 'transparent', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: C.navy, fontSize: 13 }} className="truncate">{s.description}</p>
                        <p style={{ color: C.muted, fontSize: 11 }}>Qty: {s.quantity}</p>
                      </div>
                    </div>
                    <span style={{ color: C.navy, fontSize: 13, fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>{formatCurrency(s.quantity * s.unit_price)}</span>
                  </div>
                )
              })}
            </div>

            {suggestions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <span style={{ color: C.muted, fontSize: 12 }}>{selected.size} of {suggestions.length} selected</span>
                <button onClick={addSelected} disabled={selected.size === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: selected.size === 0 ? 'default' : 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}
                  className="uppercase">
                  <Plus style={{ width: 12, height: 12 }} />
                  Add to Quote
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
