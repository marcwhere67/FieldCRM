'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, ExternalLink, Trash2, FileText, Shield, Wrench, HardHat, BarChart2, FileCheck, Search, X } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const CATEGORIES = ['Policy', 'Insurance', 'Licence', 'Safety', 'Equipment', 'Legal', 'Finance', 'HR', 'General']
const FILE_TYPES = ['PDF', 'Word', 'Excel', 'Spreadsheet', 'Link', 'Other']

const CAT_ICONS: Record<string, React.ElementType> = {
  Policy: FileCheck, Insurance: Shield, Licence: FileCheck, Safety: HardHat,
  Equipment: Wrench, Legal: FileText, Finance: BarChart2, HR: FileText, General: FileText,
}

const FILE_TYPE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PDF:         { bg: 'rgba(220,38,38,0.07)',  color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  Word:        { bg: 'rgba(37,99,235,0.07)',  color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  Excel:       { bg: 'rgba(22,163,74,0.07)',  color: '#16a34a', border: 'rgba(22,163,74,0.2)' },
  Spreadsheet: { bg: 'rgba(22,163,74,0.07)',  color: '#16a34a', border: 'rgba(22,163,74,0.2)' },
  Link:        { bg: 'rgba(118,165,143,0.1)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  Other:       { bg: 'rgba(44,62,80,0.06)',   color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
}

interface Doc {
  id: string; title: string; category: string; description: string | null
  url: string; file_type: string; created_at: string; users: { full_name: string } | null
}

interface Props { initialDocs: Doc[]; canManage: boolean }

export function DocumentsTab({ initialDocs, canManage }: Props) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Policy', description: '', url: '', file_type: 'PDF' })

  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || (d.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || d.category === catFilter
    return matchSearch && matchCat
  })

  const grouped = filtered.reduce<Record<string, Doc[]>>((acc, d) => {
    acc[d.category] = [...(acc[d.category] ?? []), d]
    return acc
  }, {})

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim()) { toast.error('Title and URL are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDocs(prev => [data, ...prev])
      toast.success('Document added')
      setShowForm(false)
      setForm({ title: '', category: 'Policy', description: '', url: '', file_type: 'PDF' })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this document?')) return
    const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' })
    if (res.ok) { setDocs(prev => prev.filter(d => d.id !== id)); toast.success('Document removed') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ color: C.muted, fontSize: 13 }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Add Document
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
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
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <FileText style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>No documents yet</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 4, opacity: 0.7 }}>Add links to policies, insurance certs, licences and more</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const Icon = CAT_ICONS[cat] ?? FileText
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <Icon style={{ width: 12, height: 12, color: C.muted }} />
                <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{cat}</p>
              </div>
              {items.map(doc => {
                const ft = FILE_TYPE_STYLE[doc.file_type] ?? FILE_TYPE_STYLE.Other
                return (
                  <div key={doc.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '12px 14px' }} className="flex items-center gap-4 group">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2">
                        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }} className="truncate">{doc.title}</p>
                        <span style={{ backgroundColor: ft.bg, color: ft.color, border: `1px solid ${ft.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0 }}>{doc.file_type}</span>
                      </div>
                      {doc.description && <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }} className="truncate">{doc.description}</p>}
                      <p style={{ color: C.muted, fontSize: 10, marginTop: 2, opacity: 0.7 }}>{doc.users?.full_name} · {formatDate(doc.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.sage, fontSize: 11 }} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                        <ExternalLink style={{ width: 12, height: 12 }} />Open
                      </a>
                      {canManage && (
                        <button onClick={() => handleDelete(doc.id)}
                          style={{ color: C.muted, width: 28, height: 28, opacity: 0 }} className="flex items-center justify-center group-hover:opacity-100 hover:text-[#dc2626] transition-all">
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>Add Document</h3>
              <button onClick={() => setShowForm(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Public Liability Insurance Certificate" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Category</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? 'Policy' }))}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} style={{ color: C.fg, fontSize: 12 }}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>File Type</label>
                  <Select value={form.file_type} onValueChange={v => setForm(f => ({ ...f, file_type: v ?? 'PDF' }))}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      {FILE_TYPES.map(t => <SelectItem key={t} value={t} style={{ color: C.fg, fontSize: 12 }}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>URL <span style={{ textTransform: 'none', fontSize: 10, letterSpacing: 0, opacity: 0.7 }}>(Google Drive, Dropbox, etc.)</span></label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://drive.google.com/file/..." style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Description <span style={{ textTransform: 'none', fontSize: 10, letterSpacing: 0, opacity: 0.7 }}>(optional)</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Expires June 2026" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : 'Add Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
