'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, CheckCircle, FileText, Archive, X } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const CATEGORIES = ['General', 'Safety', 'Operations', 'Customer Service', 'Equipment', 'HR', 'Finance', 'Quality']

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft:    { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  active:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  archived: { bg: 'rgba(44,62,80,0.04)',    color: C.muted,   border: 'rgba(44,62,80,0.10)' },
}

interface SOP {
  id: string; title: string; category: string; content: string
  status: string; created_at: string; users: { full_name: string } | null
}

interface Props { initialSops: SOP[]; canManage: boolean }

export function SopsTab({ initialSops, canManage }: Props) {
  const [sops, setSops] = useState<SOP[]>(initialSops)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SOP | null>(null)
  const [form, setForm] = useState({ title: '', category: 'General', content: '', status: 'draft' })
  const [saving, setSaving] = useState(false)

  const filtered = sops.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || s.category === catFilter
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchCat && matchStatus
  })

  const grouped = filtered.reduce<Record<string, SOP[]>>((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s]
    return acc
  }, {})

  function openCreate() { setEditing(null); setForm({ title: '', category: 'General', content: '', status: 'draft' }); setShowForm(true) }
  function openEdit(s: SOP) { setEditing(s); setForm({ title: s.title, category: s.category, content: s.content, status: s.status }); setShowForm(true) }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/sops/${editing.id}` : '/api/admin/sops'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSops(prev => editing ? prev.map(s => s.id === editing.id ? data : s) : [data, ...prev])
      toast.success(editing ? 'SOP updated' : 'SOP created')
      setShowForm(false)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this SOP?')) return
    const res = await fetch(`/api/admin/sops/${id}`, { method: 'DELETE' })
    if (res.ok) { setSops(prev => prev.filter(s => s.id !== id)); toast.success('SOP deleted') }
    else toast.error('Delete failed')
  }

  async function toggleStatus(sop: SOP) {
    const newStatus = sop.status === 'active' ? 'archived' : 'active'
    const res = await fetch(`/api/admin/sops/${sop.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    const data = await res.json()
    if (res.ok) { setSops(prev => prev.map(s => s.id === sop.id ? data : s)); toast.success(`SOP ${newStatus}`) }
    else toast.error('Update failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ color: C.muted, fontSize: 13 }}>{sops.filter(s => s.status === 'active').length} active SOPs</p>
        {canManage && (
          <button onClick={openCreate}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />New SOP
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SOPs…"
            style={{ ...inp, paddingLeft: 30 }} className="focus:border-[#76A58F]" />
        </div>
        <Select value={catFilter} onValueChange={v => setCatFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 144, height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
            <SelectItem value="all" style={{ color: C.fg, fontSize: 12 }}>All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} style={{ color: C.fg, fontSize: 12 }}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 120, height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
            <SelectItem value="all" style={{ color: C.fg, fontSize: 12 }}>All</SelectItem>
            <SelectItem value="active" style={{ color: C.fg, fontSize: 12 }}>Active</SelectItem>
            <SelectItem value="draft" style={{ color: C.fg, fontSize: 12 }}>Draft</SelectItem>
            <SelectItem value="archived" style={{ color: C.fg, fontSize: 12 }}>Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <FileText style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>{sops.length === 0 ? 'Create your first SOP to get started' : 'No SOPs match your filters'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="space-y-2">
            <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{cat}</p>
            {items.map(sop => {
              const st = STATUS_STYLE[sop.status] ?? STATUS_STYLE.draft
              return (
                <div key={sop.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', overflow: 'hidden' }}>
                  <div className="flex items-center gap-3 cursor-pointer hover:bg-[rgba(44,62,80,0.02)] transition-colors"
                    style={{ padding: '12px 14px' }}
                    onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2">
                        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{sop.title}</p>
                        <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px', textTransform: 'uppercase' }}>{sop.status}</span>
                      </div>
                      <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{sop.users?.full_name ?? 'Unknown'} · {formatDate(sop.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(sop)} title="Edit"
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                            <Edit2 style={{ width: 13, height: 13 }} />
                          </button>
                          <button onClick={() => toggleStatus(sop)} title={sop.status === 'active' ? 'Archive' : 'Activate'}
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#76A58F] transition-colors">
                            {sop.status === 'active' ? <Archive style={{ width: 13, height: 13 }} /> : <CheckCircle style={{ width: 13, height: 13 }} />}
                          </button>
                          <button onClick={() => handleDelete(sop.id)} title="Delete"
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors">
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </>
                      )}
                      {expanded === sop.id
                        ? <ChevronUp style={{ width: 14, height: 14, color: C.muted }} />
                        : <ChevronDown style={{ width: 14, height: 14, color: C.muted }} />}
                    </div>
                  </div>
                  {expanded === sop.id && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 14px', backgroundColor: C.cream }}>
                      <pre style={{ color: '#4A5A65', fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7 }}>{sop.content}</pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{editing ? 'Edit SOP' : 'New SOP'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Lawn Mowing Procedure" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Category</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? 'General' }))}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} style={{ color: C.fg, fontSize: 12 }}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Status</label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'draft' }))}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      <SelectItem value="draft" style={{ color: C.fg, fontSize: 12 }}>Draft</SelectItem>
                      <SelectItem value="active" style={{ color: C.fg, fontSize: 12 }}>Active</SelectItem>
                      <SelectItem value="archived" style={{ color: C.fg, fontSize: 12 }}>Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Content</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={"Step 1: ...\nStep 2: ...\nStep 3: ..."} rows={10}
                  style={{ ...inp, resize: 'none', height: 'auto', lineHeight: 1.6, fontFamily: 'monospace' }} className="focus:border-[#76A58F]" />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create SOP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
