'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pin, Trash2, Megaphone, Edit2, X } from 'lucide-react'
import { formatDateTime } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

interface Notice {
  id: string
  title: string
  content: string
  pinned: boolean
  created_at: string
  users: { full_name: string } | null
}

interface Props { initialNotices: Notice[]; canManage: boolean }

export function NoticesTab({ initialNotices, canManage }: Props) {
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', pinned: false })

  function openCreate() { setEditing(null); setForm({ title: '', content: '', pinned: false }); setShowForm(true) }
  function openEdit(n: Notice) { setEditing(n); setForm({ title: n.title, content: n.content, pinned: n.pinned }); setShowForm(true) }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/notices/${editing.id}` : '/api/admin/notices'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNotices(prev => {
        const updated = editing ? prev.map(n => n.id === editing.id ? data : n) : [data, ...prev]
        return updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      })
      toast.success(editing ? 'Notice updated' : 'Notice posted')
      setShowForm(false)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function togglePin(notice: Notice) {
    const res = await fetch(`/api/admin/notices/${notice.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !notice.pinned }) })
    const data = await res.json()
    if (res.ok) {
      setNotices(prev => prev.map(n => n.id === notice.id ? data : n).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
      toast.success(data.pinned ? 'Notice pinned' : 'Notice unpinned')
    } else toast.error('Update failed')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice?')) return
    const res = await fetch(`/api/admin/notices/${id}`, { method: 'DELETE' })
    if (res.ok) { setNotices(prev => prev.filter(n => n.id !== id)); toast.success('Notice deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ color: C.muted, fontSize: 13 }}>{notices.length} notice{notices.length !== 1 ? 's' : ''}</p>
        {canManage && (
          <button onClick={openCreate}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Post Notice
          </button>
        )}
      </div>

      {notices.length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <Megaphone style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>No notices yet</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 4, opacity: 0.7 }}>Post announcements for your whole team here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(notice => (
            <div key={notice.id} style={{
              border: `1px solid ${notice.pinned ? 'rgba(118,165,143,0.3)' : C.border}`,
              backgroundColor: notice.pinned ? 'rgba(118,165,143,0.04)' : '#fff',
              borderLeft: notice.pinned ? `3px solid ${C.sage}` : `3px solid transparent`,
            }}>
              <div style={{ padding: '14px 16px' }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2">
                      {notice.pinned && <Pin style={{ width: 12, height: 12, color: C.sage, flexShrink: 0 }} />}
                      <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }}>{notice.title}</p>
                    </div>
                    <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      {notice.users?.full_name ?? 'Unknown'} · {formatDateTime(notice.created_at)}
                    </p>
                    <p style={{ color: '#4A5A65', fontSize: 13, marginTop: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notice.content}</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => togglePin(notice)} title={notice.pinned ? 'Unpin' : 'Pin'}
                        style={{ color: notice.pinned ? C.sage : C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:opacity-70 transition-opacity">
                        <Pin style={{ width: 13, height: 13 }} />
                      </button>
                      <button onClick={() => openEdit(notice)}
                        style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                        <Edit2 style={{ width: 13, height: 13 }} />
                      </button>
                      <button onClick={() => handleDelete(notice.id)}
                        style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors">
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{editing ? 'Edit Notice' : 'Post Notice'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Important team update" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Content</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your announcement here…" rows={5}
                  style={{ ...inp, resize: 'none', height: 'auto', lineHeight: 1.6 }} className="focus:border-[#76A58F]" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  style={{ width: 14, height: 14, accentColor: C.sage }} />
                <span style={{ color: '#4A5A65', fontSize: 12 }}>Pin to top of notice board</span>
              </label>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
