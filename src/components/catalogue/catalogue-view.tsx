'use client'

import { useState } from 'react'
import { Plus, Search, Package, Wrench, Pencil, Archive, ArchiveRestore, X } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

interface Product {
  id: string; name: string; description: string | null
  type: 'service' | 'product'; unit_price: number; unit: string
  category: string | null; active: boolean
}
interface Props { initialProducts: Product[]; canManage: boolean }

const UNITS = ['each', 'hour', 'day', 'm²', 'm', 'kg', 'litre', 'visit', 'job']
const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const emptyForm = { name: '', description: '', type: 'service' as 'service' | 'product', unit_price: '', unit: 'each', category: '' }

export function CatalogueView({ initialProducts, canManage }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'product'>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = products.filter(p => {
    if (!showInactive && !p.active) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, description: p.description ?? '', type: p.type, unit_price: String(p.unit_price), unit: p.unit, category: p.category ?? '' })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return }
    setSaving(true); setError('')
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || null, type: form.type, unit_price: price, unit: form.unit, category: form.category.trim() || null }
      const res = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      if (editing) setProducts(prev => prev.map(p => p.id === editing.id ? data : p))
      else setProducts(prev => [...prev, data])
      setShowModal(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(p: Product) {
    const res = await fetch(`/api/products/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !p.active }) })
    if (res.ok) { const data = await res.json(); setProducts(prev => prev.map(x => x.id === p.id ? data : x)) }
  }

  const services = filtered.filter(p => p.type === 'service')
  const items = filtered.filter(p => p.type === 'product')

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Pricing</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Products & Services</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{products.filter(p => p.active).length} active items</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Add Item
          </button>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or category…"
              style={{ ...inp, paddingLeft: 30 }} className="focus:border-[#76A58F]" />
          </div>
          <div className="flex gap-2">
            {(['all','service','product'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                  backgroundColor: typeFilter === t ? C.navy : '#fff', color: typeFilter === t ? '#fff' : C.muted,
                  border: `1px solid ${typeFilter === t ? C.navy : C.border}` }}
                className="hover:opacity-80 transition-opacity">
                {t === 'all' ? 'All' : t === 'service' ? 'Services' : 'Products'}
              </button>
            ))}
            <button onClick={() => setShowInactive(!showInactive)}
              style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                backgroundColor: showInactive ? C.cream : '#fff', color: showInactive ? C.navy : C.muted, border: `1px solid ${C.border}` }}
              className="hover:opacity-80 transition-opacity">Archived</button>
          </div>
        </div>

        {/* Services */}
        {(typeFilter === 'all' || typeFilter === 'service') && (
          <section>
            <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <Wrench style={{ width: 13, height: 13, color: C.sage }} />
              <h2 style={{ color: C.navy, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Services</h2>
              <span style={{ color: C.muted, fontSize: 11 }}>({services.length})</span>
            </div>
            {services.length === 0 ? (
              <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ color: C.muted, fontSize: 13 }}>No services yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map(p => <ProductCard key={p.id} product={p} canManage={canManage} onEdit={openEdit} onToggle={toggleActive} />)}
              </div>
            )}
          </section>
        )}

        {/* Products */}
        {(typeFilter === 'all' || typeFilter === 'product') && (
          <section>
            <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <Package style={{ width: 13, height: 13, color: '#b45309' }} />
              <h2 style={{ color: C.navy, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Products / Materials</h2>
              <span style={{ color: C.muted, fontSize: 11 }}>({items.length})</span>
            </div>
            {items.length === 0 ? (
              <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ color: C.muted, fontSize: 13 }}>No products yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(p => <ProductCard key={p.id} product={p} canManage={canManage} onEdit={openEdit} onToggle={toggleActive} />)}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{editing ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={() => setShowModal(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20 }} className="space-y-4">
              {/* Type picker */}
              <div className="grid grid-cols-2 gap-2">
                {(['service','product'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{ padding: '8px 0', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                      backgroundColor: form.type === t ? C.navy : '#fff', color: form.type === t ? '#fff' : C.muted,
                      border: `1px solid ${form.type === t ? C.navy : C.border}` }}>
                    {t === 'service' ? 'Service' : 'Product / Material'}
                  </button>
                ))}
              </div>
              {[
                { label: 'Name *', key: 'name', placeholder: 'e.g. High Pressure Wash' },
                { label: 'Category', key: 'category', placeholder: 'e.g. Cleaning, Labour' },
                { label: 'Description', key: 'description', placeholder: 'Optional description' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  <input value={(form as Record<string,string>)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder} style={inp} className="focus:border-[#76A58F]" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Unit Price *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                    <input value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      placeholder="0.00" type="number" min="0" step="0.01" style={{ ...inp, paddingLeft: 22 }} className="focus:border-[#76A58F]" />
                  </div>
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px 0', backgroundColor: C.navy, color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product: p, canManage, onEdit, onToggle }: { product: Product; canManage: boolean; onEdit: (p: Product) => void; onToggle: (p: Product) => void }) {
  return (
    <div style={{ border: `1px solid rgba(44,62,80,0.09)`, backgroundColor: '#fff', padding: 16, opacity: p.active ? 1 : 0.5 }}>
      <div className="flex items-start justify-between gap-2">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <p style={{ color: '#2C3E50', fontWeight: 500, fontSize: 13 }} className="truncate">{p.name}</p>
            {p.category && <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', backgroundColor: 'rgba(44,62,80,0.06)', color: '#8A9BA6' }}>{p.category}</span>}
          </div>
          {p.description && <p style={{ color: '#8A9BA6', fontSize: 11, marginTop: 4 }} className="line-clamp-2">{p.description}</p>}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(p)} style={{ color: '#8A9BA6', width: 26, height: 26 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
              <Pencil style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={() => onToggle(p)} style={{ color: '#8A9BA6', width: 26, height: 26 }} className="flex items-center justify-center hover:text-[#b45309] transition-colors">
              {p.active ? <Archive style={{ width: 12, height: 12 }} /> : <ArchiveRestore style={{ width: 12, height: 12 }} />}
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#76A58F', fontSize: 18 }}>{fmt(p.unit_price)}</span>
        <span style={{ color: '#8A9BA6', fontSize: 11 }}>per {p.unit}</span>
      </div>
    </div>
  )
}
