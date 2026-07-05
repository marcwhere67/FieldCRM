'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

const CATEGORIES = ['Materials', 'Labour', 'Equipment', 'Fuel', 'Vehicle', 'Marketing', 'Software', 'Insurance', 'Subcontractor', 'Other']

interface Expense {
  id: string
  category: string
  description: string | null
  amount: number
  expense_date: string
  tax_included: boolean
  job_id: string | null
  jobs: { title: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (expense: Expense) => void
}

const C = {
  navy: '#2C3E50', fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

export function LogExpenseModal({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: 'Materials',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    tax_included: 'true',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category, description: form.description || null,
          amount, expense_date: form.expense_date, tax_included: form.tax_included === 'true',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Expense logged')
      onSaved(data)
      onClose()
      setForm({ category: 'Materials', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], tax_included: 'true' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>Log Expense</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span style={labelSt}>Category</span>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <span style={labelSt}>Amount (AUD)</span>
              <input type="number" step="0.01" min="0" value={form.amount}
                onChange={e => set('amount', e.target.value)} placeholder="0.00" style={inp} />
            </div>
          </div>
          <div>
            <span style={labelSt}>Description <span style={{ fontWeight: 400 }}>(optional)</span></span>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Fertiliser for Acacia Ridge job" style={inp} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span style={labelSt}>Date</span>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} style={inp} />
            </div>
            <div>
              <span style={labelSt}>Tax</span>
              <select value={form.tax_included} onChange={e => set('tax_included', e.target.value)} style={inp}>
                <option value="true">GST Included</option>
                <option value="false">Ex-GST</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer' }}
              className="uppercase hover:opacity-70 transition-opacity">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              className="uppercase">
              {loading ? 'Saving…' : 'Log Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
