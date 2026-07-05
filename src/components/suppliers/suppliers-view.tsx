'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, X, Pencil, Trash2, ChevronDown, ChevronUp,
  Package, Building2, ShoppingCart, CheckCircle, Send, Ban
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  sent:      { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  received:  { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  cancelled: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
}

interface Supplier {
  id: string; name: string; contact_name: string | null; email: string | null
  phone: string | null; address: string | null; website: string | null
  category: string | null; notes: string | null; is_active: boolean
}
interface LineItem { description: string; quantity: number; unit_price: number; subtotal: number }
interface PurchaseOrder {
  id: string; supplier_id: string; job_id: string | null; po_number: string
  status: 'draft' | 'sent' | 'received' | 'cancelled'; line_items: LineItem[]
  subtotal: number; tax: number; total: number; notes: string | null
  expected_date: string | null; received_date: string | null; expense_id: string | null; created_at: string
  suppliers: { id: string; name: string } | null
}
interface Job { id: string; title: string }
interface Props {
  initialSuppliers: Supplier[]; initialPOs: PurchaseOrder[]; jobs: Job[]
  canManage: boolean; nextPoNumber: string
}

const emptySupplier = { name: '', contact_name: '', email: '', phone: '', address: '', website: '', category: '', notes: '' }
const emptyPO = { supplier_id: '', job_id: '', notes: '', expected_date: '' }
const emptyLine: LineItem = { description: '', quantity: 1, unit_price: 0, subtotal: 0 }

export function SuppliersView({ initialSuppliers, initialPOs, jobs, canManage, nextPoNumber }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs)
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState(emptySupplier)

  const [showPoModal, setShowPoModal] = useState(false)
  const [poForm, setPoForm] = useState(emptyPO)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLine }])
  const [expandedPo, setExpandedPo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'supplier' | 'po'; id: string } | null>(null)

  const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0)
  const tax = Math.round(subtotal * 0.1 * 100) / 100
  const total = subtotal + tax

  const filteredSuppliers = suppliers.filter(s => {
    if (!s.is_active) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !(s.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredPos = pos.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search) {
      const sName = getSupplierName(p.supplier_id)
      if (!p.po_number.toLowerCase().includes(search.toLowerCase()) &&
          !sName.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  })

  function getSupplierName(id: string) { return suppliers.find(s => s.id === id)?.name ?? '—' }

  function openCreateSupplier() { setEditingSupplier(null); setSupplierForm(emptySupplier); setShowSupplierModal(true) }
  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s)
    setSupplierForm({ name: s.name, contact_name: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', website: s.website ?? '', category: s.category ?? '', notes: s.notes ?? '' })
    setShowSupplierModal(true)
  }

  async function saveSupplier() {
    if (!supplierForm.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const body = { name: supplierForm.name.trim(), contact_name: supplierForm.contact_name || null, email: supplierForm.email || null, phone: supplierForm.phone || null, address: supplierForm.address || null, website: supplierForm.website || null, category: supplierForm.category || null, notes: supplierForm.notes || null }
    try {
      if (editingSupplier) {
        const res = await fetch(`/api/suppliers/${editingSupplier.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? updated : s))
        toast.success('Supplier updated')
      } else {
        const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error)
        const created = await res.json()
        setSuppliers(prev => [created, ...prev])
        toast.success('Supplier added')
      }
      setShowSupplierModal(false)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  function openCreatePo() { setPoForm(emptyPO); setLineItems([{ ...emptyLine }]); setShowPoModal(true) }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') updated.subtotal = Number(updated.quantity) * Number(updated.unit_price)
      return updated
    }))
  }

  async function savePo() {
    if (!poForm.supplier_id) { toast.error('Select a supplier'); return }
    if (lineItems.every(l => !l.description.trim())) { toast.error('Add at least one line item'); return }
    setSaving(true)
    const items = lineItems.filter(l => l.description.trim())
    const sub = items.reduce((s, i) => s + i.subtotal, 0)
    const t = Math.round(sub * 0.1 * 100) / 100
    try {
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_id: poForm.supplier_id, job_id: poForm.job_id || null, po_number: nextPoNumber, status: 'draft', line_items: items, subtotal: sub, tax: t, total: sub + t, notes: poForm.notes || null, expected_date: poForm.expected_date || null }) })
      if (!res.ok) throw new Error((await res.json()).error)
      const created = await res.json()
      setPos(prev => [created, ...prev])
      toast.success('Purchase order created')
      setShowPoModal(false)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function updatePoStatus(id: string, status: PurchaseOrder['status']) {
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) { toast.error('Failed to update'); return }
    const updated = await res.json()
    setPos(prev => prev.map(p => p.id === id ? updated : p))
    const msgs: Record<string, string> = { sent: 'PO marked as sent', received: 'PO received — expense logged', cancelled: 'PO cancelled' }
    toast.success(msgs[status] ?? 'Updated')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { type, id } = deleteTarget
    const url = type === 'supplier' ? `/api/suppliers/${id}` : `/api/purchase-orders/${id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    if (type === 'supplier') setSuppliers(prev => prev.filter(s => s.id !== id))
    else setPos(prev => prev.filter(p => p.id !== id))
    setDeleteTarget(null); toast.success('Deleted')
  }

  const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Procurement</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Suppliers</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            {suppliers.filter(s => s.is_active).length} supplier{suppliers.filter(s => s.is_active).length !== 1 ? 's' : ''} · {pos.length} order{pos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={openCreateSupplier}
              style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
              <Building2 style={{ width: 13, height: 13 }} />Add Supplier
            </button>
            <button onClick={openCreatePo}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
              <Plus style={{ width: 13, height: 13 }} />New PO
            </button>
          </div>
        )}
      </div>

      <div className="px-6 space-y-5">
        {/* Tabs + search */}
        <div className="flex items-center justify-between gap-4">
          <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
            {(['suppliers', 'orders'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: activeTab === tab ? C.navy : C.muted,
                  borderBottom: `2px solid ${activeTab === tab ? C.sage : 'transparent'}`,
                  marginBottom: -1, background: 'none', cursor: 'pointer',
                }}>
                {tab === 'orders' ? 'Purchase Orders' : 'Suppliers'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div style={{ position: 'relative' }}>
              <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                style={{ ...inp, width: 192, paddingLeft: 30 }} className="focus:border-[#76A58F]" />
            </div>
            {activeTab === 'orders' && (
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {['all', 'draft', 'sent', 'received', 'cancelled'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={{ padding: '6px 10px', fontSize: 11, textTransform: 'capitalize',
                      backgroundColor: statusFilter === s ? C.navy : '#fff', color: statusFilter === s ? '#fff' : C.muted, cursor: 'pointer' }}
                    className="hover:opacity-80 transition-opacity">{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suppliers tab */}
        {activeTab === 'suppliers' && (
          filteredSuppliers.length === 0 ? (
            <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '64px 24px', textAlign: 'center' }}>
              <Building2 style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.15)', margin: '0 auto 12px' }} />
              <p style={{ color: C.muted, fontSize: 13 }}>No suppliers yet</p>
              {canManage && <button onClick={openCreateSupplier} style={{ color: C.sage, fontSize: 12, marginTop: 8 }} className="hover:underline">Add your first supplier</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSuppliers.map(s => (
                <div key={s.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: 18 }} className="group flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }} className="truncate">{s.name}</p>
                      {s.category && <p style={{ color: C.muted, fontSize: 11 }}>{s.category}</p>}
                    </div>
                    {canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEditSupplier(s)} style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors"><Pencil style={{ width: 12, height: 12 }} /></button>
                        <button onClick={() => setDeleteTarget({ type: 'supplier', id: s.id })} style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors"><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }} className="space-y-1">
                    {s.contact_name && <p style={{ color: '#4A5A65' }}>{s.contact_name}</p>}
                    {s.email && <p>{s.email}</p>}
                    {s.phone && <p>{s.phone}</p>}
                    {s.address && <p className="truncate">{s.address}</p>}
                    {s.website && <a href={s.website} target="_blank" rel="noreferrer" style={{ color: C.sage }} className="hover:underline truncate block">{s.website}</a>}
                  </div>
                  {s.notes && <p style={{ color: C.muted, fontSize: 11, borderTop: `1px solid ${C.border}`, paddingTop: 10 }} className="line-clamp-2">{s.notes}</p>}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <button onClick={() => { setActiveTab('orders'); openCreatePo(); setPoForm(p => ({ ...p, supplier_id: s.id })) }}
                      style={{ color: C.sage, fontSize: 11 }} className="flex items-center gap-1 hover:underline">
                      <ShoppingCart style={{ width: 11, height: 11 }} />Create PO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Orders tab */}
        {activeTab === 'orders' && (
          filteredPos.length === 0 ? (
            <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '64px 24px', textAlign: 'center' }}>
              <ShoppingCart style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.15)', margin: '0 auto 12px' }} />
              <p style={{ color: C.muted, fontSize: 13 }}>No purchase orders yet</p>
              {canManage && <button onClick={openCreatePo} style={{ color: C.sage, fontSize: 12, marginTop: 8 }} className="hover:underline">Create first PO</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPos.map(po => {
                const isExpanded = expandedPo === po.id
                const supplier = suppliers.find(s => s.id === po.supplier_id)
                const st = STATUS_STYLE[po.status]
                return (
                  <div key={po.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', overflow: 'hidden' }}>
                    <div className="flex items-center gap-4" style={{ padding: '14px 16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p style={{ color: C.navy, fontWeight: 500, fontSize: 13, fontFamily: 'monospace' }}>{po.po_number}</p>
                          <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px', textTransform: 'uppercase' }}>{po.status}</span>
                          {po.expense_id && <span style={{ color: C.sage, fontSize: 10 }}>expense logged</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap" style={{ fontSize: 11, color: C.muted }}>
                          <span>{supplier?.name ?? '—'}</span>
                          {po.expected_date && <span>Expected {formatDate(po.expected_date)}</span>}
                          {po.received_date && <span style={{ color: C.sage }}>Received {formatDate(po.received_date)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 15 }}>{formatCurrency(po.total)}</p>
                        {canManage && po.status === 'draft' && (
                          <button onClick={() => updatePoStatus(po.id, 'sent')} title="Mark as sent"
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2563eb] transition-colors">
                            <Send style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                        {canManage && po.status === 'sent' && (
                          <button onClick={() => updatePoStatus(po.id, 'received')} title="Mark as received"
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#76A58F] transition-colors">
                            <CheckCircle style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                        {canManage && ['draft', 'sent'].includes(po.status) && (
                          <button onClick={() => updatePoStatus(po.id, 'cancelled')} title="Cancel PO"
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors">
                            <Ban style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                        {canManage && po.status !== 'received' && (
                          <button onClick={() => setDeleteTarget({ type: 'po', id: po.id })}
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors">
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                        <button onClick={() => setExpandedPo(isExpanded ? null : po.id)}
                          style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                          {isExpanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', backgroundColor: C.cream }} className="space-y-4">
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>
                            <div>Item</div><div>Qty</div><div>Unit price</div><div>Total</div>
                          </div>
                          {po.line_items.map((item, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '6px 4px', fontSize: 12 }}>
                              <div style={{ color: '#4A5A65' }}>{item.description}</div>
                              <div style={{ color: C.muted, textAlign: 'right' }}>{item.quantity}</div>
                              <div style={{ color: C.muted, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</div>
                              <div style={{ color: C.navy, fontWeight: 500, textAlign: 'right' }}>{formatCurrency(item.subtotal)}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="space-y-1.5">
                          {[['Subtotal', po.subtotal], ['GST (10%)', po.tax]].map(([l, v]) => (
                            <div key={l as string} className="flex justify-between" style={{ fontSize: 12, color: C.muted }}>
                              <span>{l}</span><span>{formatCurrency(v as number)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                            <span style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Total</span>
                            <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 15 }}>{formatCurrency(po.total)}</span>
                          </div>
                        </div>
                        {po.notes && <p style={{ color: C.muted, fontSize: 11, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>{po.notes}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Supplier modal */}
      {showSupplierModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setShowSupplierModal(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors"><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }} className="space-y-4">
              <div><label style={labelSt}>Business Name *</label><input value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Bunnings Warehouse" style={inp} className="focus:border-[#76A58F]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelSt}>Contact Name</label><input value={supplierForm.contact_name} onChange={e => setSupplierForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="Full name" style={inp} className="focus:border-[#76A58F]" /></div>
                <div><label style={labelSt}>Category</label><input value={supplierForm.category} onChange={e => setSupplierForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Electrical, Plumbing" style={inp} className="focus:border-[#76A58F]" /></div>
                <div><label style={labelSt}>Email</label><input type="email" value={supplierForm.email} onChange={e => setSupplierForm(p => ({ ...p, email: e.target.value }))} placeholder="orders@supplier.com" style={inp} className="focus:border-[#76A58F]" /></div>
                <div><label style={labelSt}>Phone</label><input value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))} placeholder="02 xxxx xxxx" style={inp} className="focus:border-[#76A58F]" /></div>
              </div>
              <div><label style={labelSt}>Address</label><input value={supplierForm.address} onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))} placeholder="Street address" style={inp} className="focus:border-[#76A58F]" /></div>
              <div><label style={labelSt}>Website</label><input value={supplierForm.website} onChange={e => setSupplierForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" style={inp} className="focus:border-[#76A58F]" /></div>
              <div><label style={labelSt}>Notes</label><textarea value={supplierForm.notes} onChange={e => setSupplierForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Account number, terms, etc." style={{ ...inp, resize: 'none', height: 'auto' }} className="focus:border-[#76A58F]" /></div>
              <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <button onClick={() => setShowSupplierModal(false)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">Cancel</button>
                <button onClick={saveSupplier} disabled={saving} style={{ flex: 1, padding: '8px 0', backgroundColor: C.navy, color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity disabled:opacity-50">{saving ? 'Saving…' : editingSupplier ? 'Save Changes' : 'Add Supplier'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO modal */}
      {showPoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <div>
                <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>New Purchase Order</h3>
                <p style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{nextPoNumber}</p>
              </div>
              <button onClick={() => setShowPoModal(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors"><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: 20 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelSt}>Supplier *</label>
                  <select value={poForm.supplier_id} onChange={e => setPoForm(p => ({ ...p, supplier_id: e.target.value }))} style={inp}>
                    <option value="">Select supplier…</option>
                    {suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Linked Job (optional)</label>
                  <select value={poForm.job_id} onChange={e => setPoForm(p => ({ ...p, job_id: e.target.value }))} style={inp}>
                    <option value="">No job</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Expected Delivery</label>
                  <input type="date" value={poForm.expected_date} onChange={e => setPoForm(p => ({ ...p, expected_date: e.target.value }))} style={inp} className="focus:border-[#76A58F]" />
                </div>
              </div>

              <div className="space-y-2">
                <label style={labelSt}>Line Items</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px', gap: 8, color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 4 }}>
                  <div>Description</div><div style={{ textAlign: 'right' }}>Qty</div><div style={{ textAlign: 'right' }}>Unit price</div><div style={{ textAlign: 'right' }}>Total</div>
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px', gap: 8, alignItems: 'center' }}>
                    <input value={item.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" style={inp} className="focus:border-[#76A58F]" />
                    <input type="number" value={item.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} style={{ ...inp, textAlign: 'right' }} min="0" />
                    <input type="number" value={item.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} style={{ ...inp, textAlign: 'right' }} min="0" step="0.01" />
                    <div className="flex items-center justify-end gap-1">
                      <span style={{ color: '#4A5A65', fontSize: 12 }}>{formatCurrency(item.subtotal)}</span>
                      {lineItems.length > 1 && (
                        <button onClick={() => setLineItems(prev => prev.filter((_, idx) => idx !== i))} style={{ color: C.muted, width: 20, height: 20 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors ml-1">
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={() => setLineItems(prev => [...prev, { ...emptyLine }])} style={{ color: C.sage, fontSize: 11, marginTop: 4 }} className="flex items-center gap-1 hover:underline">
                  <Plus style={{ width: 13, height: 13 }} />Add line
                </button>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }} className="space-y-1.5">
                  {[['Subtotal', subtotal], ['GST (10%)', tax]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between" style={{ fontSize: 12, color: C.muted }}>
                      <span>{l}</span><span>{formatCurrency(v as number)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                    <span style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Total</span>
                    <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 15 }}>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div><label style={labelSt}>Notes</label><textarea value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Delivery instructions, account number, etc." style={{ ...inp, resize: 'none', height: 'auto' }} className="focus:border-[#76A58F]" /></div>

              <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <button onClick={() => setShowPoModal(false)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">Cancel</button>
                <button onClick={savePo} disabled={saving} style={{ flex: 1, padding: '8px 0', backgroundColor: C.navy, color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity disabled:opacity-50">{saving ? 'Creating…' : 'Create PO'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 360, padding: 24, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }} className="space-y-4">
            <h3 style={{ color: C.navy, fontSize: 15, fontWeight: 500 }}>Delete {deleteTarget.type === 'supplier' ? 'supplier' : 'purchase order'}?</h3>
            <p style={{ color: C.muted, fontSize: 13 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '8px 0', backgroundColor: '#dc2626', color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
