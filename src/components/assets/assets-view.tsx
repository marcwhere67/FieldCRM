'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Car, Wrench, Package, HelpCircle, Pencil, Trash2, AlertTriangle, X } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

interface TeamMember { id: string; full_name: string }
interface Asset {
  id: string; name: string; type: string; serial_number: string | null
  assigned_to: string | null; purchase_date: string | null; purchase_price: number | null
  maintenance_due: string | null; last_serviced: string | null; notes: string | null
  status: 'active' | 'maintenance' | 'retired'
}
interface Props { initialAssets: Asset[]; team: TeamMember[]; canManage: boolean }

const TYPES = ['vehicle', 'tool', 'equipment', 'other']
const STATUSES = ['active', 'maintenance', 'retired'] as const

const TYPE_ICONS: Record<string, React.ElementType> = {
  vehicle: Car, tool: Wrench, equipment: Package, other: HelpCircle,
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  active:      { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  maintenance: { bg: 'rgba(180,83,9,0.07)',    color: '#b45309', border: 'rgba(180,83,9,0.2)' },
  retired:     { bg: 'rgba(44,62,80,0.06)',    color: C.muted,   border: 'rgba(44,62,80,0.12)' },
}

const emptyForm = {
  name: '', type: 'equipment', serial_number: '', assigned_to: '',
  purchase_date: '', purchase_price: '', maintenance_due: '', last_serviced: '',
  notes: '', status: 'active' as Asset['status'],
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function isOverdue(date: string | null) { if (!date) return false; return date < todayStr() }
function isDueSoon(date: string | null) {
  if (!date) return false
  const soon = new Date(); soon.setDate(soon.getDate() + 30)
  return date >= todayStr() && date <= soon.toISOString().split('T')[0]
}

export function AssetsView({ initialAssets, team, canManage }: Props) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = assets.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !(a.serial_number ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const overdue = assets.filter(a => a.status === 'active' && isOverdue(a.maintenance_due))
  const dueSoon = assets.filter(a => a.status === 'active' && isDueSoon(a.maintenance_due))

  function openCreate() { setEditing(null); setForm(emptyForm); setShowModal(true) }
  function openEdit(a: Asset) {
    setEditing(a)
    setForm({
      name: a.name, type: a.type, serial_number: a.serial_number ?? '',
      assigned_to: a.assigned_to ?? '', purchase_date: a.purchase_date ?? '',
      purchase_price: a.purchase_price != null ? String(a.purchase_price) : '',
      maintenance_due: a.maintenance_due ?? '', last_serviced: a.last_serviced ?? '',
      notes: a.notes ?? '', status: a.status,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const body = {
      name: form.name.trim(), type: form.type,
      serial_number: form.serial_number || null, assigned_to: form.assigned_to || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      maintenance_due: form.maintenance_due || null, last_serviced: form.last_serviced || null,
      notes: form.notes || null, status: form.status,
    }
    try {
      if (editing) {
        const res = await fetch(`/api/assets/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setAssets(prev => prev.map(a => a.id === editing.id ? updated : a))
        toast.success('Asset updated')
      } else {
        const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error)
        const created = await res.json()
        setAssets(prev => [created, ...prev])
        toast.success('Asset added')
      }
      setShowModal(false)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    setAssets(prev => prev.filter(a => a.id !== id))
    setDeleteId(null)
    toast.success('Asset deleted')
  }

  function memberName(id: string | null) {
    if (!id) return null
    return team.find(t => t.id === id)?.full_name ?? null
  }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Fleet</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Assets & Equipment</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{assets.length} item{assets.length !== 1 ? 's' : ''} tracked</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Add Asset
          </button>
        )}
      </div>

      <div className="px-6 space-y-5">
        {/* Alerts */}
        {(overdue.length > 0 || dueSoon.length > 0) && (
          <div className="space-y-2">
            {overdue.length > 0 && (
              <div style={{ border: '1px solid rgba(220,38,38,0.2)', backgroundColor: 'rgba(220,38,38,0.05)', padding: '10px 14px' }} className="flex items-center gap-3">
                <AlertTriangle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }} />
                <p style={{ color: '#dc2626', fontSize: 12 }}>
                  <strong>{overdue.length} asset{overdue.length > 1 ? 's' : ''}</strong> with overdue maintenance: {overdue.map(a => a.name).join(', ')}
                </p>
              </div>
            )}
            {dueSoon.length > 0 && (
              <div style={{ border: '1px solid rgba(180,83,9,0.2)', backgroundColor: 'rgba(180,83,9,0.05)', padding: '10px 14px' }} className="flex items-center gap-3">
                <AlertTriangle style={{ width: 14, height: 14, color: '#b45309', flexShrink: 0 }} />
                <p style={{ color: '#b45309', fontSize: 12 }}>
                  <strong>{dueSoon.length} asset{dueSoon.length > 1 ? 's' : ''}</strong> due for maintenance within 30 days: {dueSoon.map(a => a.name).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div style={{ position: 'relative' }}>
            <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
              style={{ ...inp, width: 224, paddingLeft: 30 }} className="focus:border-[#76A58F]" />
          </div>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {['all', ...TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '6px 12px', fontSize: 11, textTransform: 'capitalize', letterSpacing: '0.04em',
                  backgroundColor: typeFilter === t ? C.navy : '#fff', color: typeFilter === t ? '#fff' : C.muted, cursor: 'pointer' }}
                className="hover:opacity-80 transition-opacity">
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {['all', ...STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '6px 12px', fontSize: 11, textTransform: 'capitalize', letterSpacing: '0.04em',
                  backgroundColor: statusFilter === s ? C.navy : '#fff', color: statusFilter === s ? '#fff' : C.muted, cursor: 'pointer' }}
                className="hover:opacity-80 transition-opacity">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '64px 24px', textAlign: 'center' }}>
            <Package style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.15)', margin: '0 auto 12px' }} />
            <p style={{ color: C.muted, fontSize: 13 }}>No assets found</p>
            {canManage && <button onClick={openCreate} style={{ color: C.sage, fontSize: 12, marginTop: 8, display: 'block', margin: '8px auto 0' }} className="hover:underline">Add your first asset</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(asset => {
              const Icon = TYPE_ICONS[asset.type] ?? HelpCircle
              const st = STATUS_STYLE[asset.status]
              const overdueMaint = isOverdue(asset.maintenance_due)
              const soonMaint = isDueSoon(asset.maintenance_due)
              return (
                <div key={asset.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: 18 }} className="flex flex-col gap-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div style={{ width: 36, height: 36, backgroundColor: C.cream, color: C.muted, flexShrink: 0 }} className="flex items-center justify-center">
                        <Icon style={{ width: 16, height: 16 }} />
                      </div>
                      <div className="min-w-0">
                        <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }} className="truncate">{asset.name}</p>
                        <p style={{ color: C.muted, fontSize: 11, textTransform: 'capitalize' }}>{asset.type}</p>
                      </div>
                    </div>
                    <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '2px 7px', textTransform: 'uppercase', flexShrink: 0 }}>{asset.status}</span>
                  </div>

                  <div style={{ fontSize: 11, color: C.muted }} className="space-y-1.5">
                    {asset.serial_number && (
                      <div className="flex justify-between">
                        <span>Serial</span>
                        <span style={{ color: C.fg, fontFamily: 'monospace' }}>{asset.serial_number}</span>
                      </div>
                    )}
                    {asset.assigned_to && (
                      <div className="flex justify-between">
                        <span>Assigned to</span>
                        <span style={{ color: C.fg }}>{memberName(asset.assigned_to) ?? '—'}</span>
                      </div>
                    )}
                    {asset.last_serviced && (
                      <div className="flex justify-between">
                        <span>Last serviced</span>
                        <span style={{ color: C.fg }}>{formatDate(asset.last_serviced)}</span>
                      </div>
                    )}
                    {asset.maintenance_due && (
                      <div className="flex justify-between">
                        <span>Maintenance due</span>
                        <span style={{ color: overdueMaint ? '#dc2626' : soonMaint ? '#b45309' : C.fg, fontWeight: (overdueMaint || soonMaint) ? 500 : 400 }}>
                          {formatDate(asset.maintenance_due)}
                          {overdueMaint && ' — overdue'}
                          {!overdueMaint && soonMaint && ' — soon'}
                        </span>
                      </div>
                    )}
                    {asset.purchase_price != null && (
                      <div className="flex justify-between">
                        <span>Purchase price</span>
                        <span style={{ color: C.fg, fontFamily: C.serif, fontSize: 13 }}>${asset.purchase_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>

                  {asset.notes && (
                    <p style={{ color: C.muted, fontSize: 11, borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="line-clamp-2">{asset.notes}</p>
                  )}

                  {canManage && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, opacity: 0 }} className="flex gap-2 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(asset)} style={{ color: C.muted, fontSize: 11 }} className="flex items-center gap-1 hover:text-[#2C3E50] transition-colors">
                        <Pencil style={{ width: 12, height: 12 }} />Edit
                      </button>
                      <button onClick={() => setDeleteId(asset.id)} style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' }} className="flex items-center gap-1 hover:text-[#dc2626] transition-colors">
                        <Trash2 style={{ width: 12, height: 12 }} />Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{editing ? 'Edit Asset' : 'Add Asset'}</h3>
              <button onClick={() => setShowModal(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Ford Ranger — Ute 1" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                    {TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Asset['status'] }))} style={inp}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Serial / Rego Number</label>
                <input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))}
                  placeholder="e.g. ABC-123" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Assigned To</label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp}>
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Last Serviced</label>
                  <input type="date" value={form.last_serviced} onChange={e => setForm(p => ({ ...p, last_serviced: e.target.value }))} style={inp} className="focus:border-[#76A58F]" />
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Maintenance Due</label>
                  <input type="date" value={form.maintenance_due} onChange={e => setForm(p => ({ ...p, maintenance_due: e.target.value }))} style={inp} className="focus:border-[#76A58F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} style={inp} className="focus:border-[#76A58F]" />
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Purchase Price ($)</label>
                  <input type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01" style={inp} className="focus:border-[#76A58F]" />
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional details…" rows={2} style={{ ...inp, resize: 'none', height: 'auto' }} className="focus:border-[#76A58F]" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                  className="hover:opacity-80 transition-opacity">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 1, padding: '8px 0', backgroundColor: C.navy, color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                  className="hover:opacity-80 transition-opacity disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(28,42,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 360, padding: 24, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }} className="space-y-4">
            <h3 style={{ color: C.navy, fontSize: 15, fontWeight: 500 }}>Delete asset?</h3>
            <p style={{ color: C.muted, fontSize: 13 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '8px 0', border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                className="hover:opacity-80 transition-opacity">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                style={{ flex: 1, padding: '8px 0', backgroundColor: '#dc2626', color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                className="hover:opacity-80 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
