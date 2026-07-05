'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, ExternalLink, Trash2, CheckCircle, Clock, AlertCircle, FileText, X } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

interface Contract {
  id: string; title: string; description: string | null; url: string
  signed: boolean; signed_at: string | null; expires_at: string | null
  created_at: string; user_id: string
  users: { full_name: string; email: string; role: string } | null
}

interface TeamMember { id: string; full_name: string; email: string; role: string }
interface Props { initialContracts: Contract[]; teamMembers: TeamMember[]; canManage: boolean }

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 30
}
function isExpired(date: string | null) {
  if (!date) return false
  return new Date(date) < new Date()
}

export function ContractsTab({ initialContracts, teamMembers, canManage }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ user_id: '', title: '', description: '', url: '', expires_at: '' })

  const byMember = teamMembers.reduce<Record<string, Contract[]>>((acc, m) => {
    acc[m.id] = contracts.filter(c => c.user_id === m.id)
    return acc
  }, {})

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.user_id || !form.title.trim() || !form.url.trim()) { toast.error('Employee, title and URL are required'); return }
    setSaving(true)
    try {
      const payload = { ...form, expires_at: form.expires_at || null }
      const res = await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContracts(prev => [data, ...prev])
      toast.success('Contract added')
      setShowForm(false)
      setForm({ user_id: '', title: '', description: '', url: '', expires_at: '' })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleSigned(contract: Contract) {
    const res = await fetch(`/api/admin/contracts/${contract.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed: !contract.signed }),
    })
    const data = await res.json()
    if (res.ok) { setContracts(prev => prev.map(c => c.id === contract.id ? data : c)); toast.success(data.signed ? 'Marked as signed' : 'Marked as unsigned') }
    else toast.error('Update failed')
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this contract?')) return
    const res = await fetch(`/api/admin/contracts/${id}`, { method: 'DELETE' })
    if (res.ok) { setContracts(prev => prev.filter(c => c.id !== id)); toast.success('Contract removed') }
    else toast.error('Delete failed')
  }

  const unsigned = contracts.filter(c => !c.signed).length
  const expiringSoon = contracts.filter(c => isExpiringSoon(c.expires_at)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p style={{ color: C.muted, fontSize: 13 }}>{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
          {unsigned > 0 && <span style={{ color: '#b45309', fontSize: 11 }} className="flex items-center gap-1"><Clock style={{ width: 11, height: 11 }} />{unsigned} unsigned</span>}
          {expiringSoon > 0 && <span style={{ color: '#dc2626', fontSize: 11 }} className="flex items-center gap-1"><AlertCircle style={{ width: 11, height: 11 }} />{expiringSoon} expiring soon</span>}
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Add Contract
          </button>
        )}
      </div>

      {teamMembers.length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <FileText style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>No team members yet</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 4, opacity: 0.7 }}>Add team members in Settings first</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teamMembers.map(member => {
            const memberContracts = byMember[member.id] ?? []
            const av = AVATAR_COLORS[member.full_name.charCodeAt(0) % AVATAR_COLORS.length]
            return (
              <div key={member.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', overflow: 'hidden' }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 14px', backgroundColor: C.cream }} className="flex items-center gap-3">
                  <div style={{ width: 32, height: 32, backgroundColor: av.bg, color: av.color, fontSize: 12, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                    {member.full_name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{member.full_name}</p>
                    <p style={{ color: C.muted, fontSize: 11, textTransform: 'capitalize' }}>{member.role} · {member.email}</p>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11 }}>{memberContracts.length} contract{memberContracts.length !== 1 ? 's' : ''}</div>
                </div>
                {memberContracts.length === 0 ? (
                  <div style={{ padding: '12px 14px', color: C.muted, fontSize: 12 }}>No contracts on file</div>
                ) : (
                  <div className="divide-y divide-[rgba(44,62,80,0.07)]">
                    {memberContracts.map(c => {
                      const expired = isExpired(c.expires_at)
                      const expiring = isExpiringSoon(c.expires_at)
                      return (
                        <div key={c.id} style={{ padding: '12px 14px' }} className="flex items-center gap-3 group">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{c.title}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {c.description && <span style={{ color: C.muted, fontSize: 11 }}>{c.description}</span>}
                              {c.expires_at && (
                                <span style={{ color: expired ? '#dc2626' : expiring ? '#b45309' : C.muted, fontSize: 11 }} className="flex items-center gap-1">
                                  {(expired || expiring) && <AlertCircle style={{ width: 10, height: 10 }} />}
                                  Expires {formatDate(c.expires_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {canManage && (
                              <button onClick={() => toggleSigned(c)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                                  padding: '4px 10px', border: `1px solid ${c.signed ? 'rgba(118,165,143,0.4)' : 'rgba(44,62,80,0.15)'}`,
                                  backgroundColor: c.signed ? 'rgba(118,165,143,0.08)' : 'transparent',
                                  color: c.signed ? C.sage : C.muted, cursor: 'pointer',
                                }}>
                                <CheckCircle style={{ width: 11, height: 11 }} />
                                {c.signed ? `Signed ${c.signed_at ? formatDate(c.signed_at) : ''}` : 'Mark Signed'}
                              </button>
                            )}
                            {!canManage && c.signed && (
                              <span style={{ color: C.sage, fontSize: 11 }} className="flex items-center gap-1"><CheckCircle style={{ width: 11, height: 11 }} />Signed</span>
                            )}
                            <a href={c.url} target="_blank" rel="noopener noreferrer"
                              style={{ color: C.sage, width: 28, height: 28 }} className="flex items-center justify-center hover:opacity-70 transition-opacity" title="Open document">
                              <ExternalLink style={{ width: 13, height: 13 }} />
                            </a>
                            {canManage && (
                              <button onClick={() => handleDelete(c.id)}
                                style={{ color: C.muted, width: 28, height: 28, opacity: 0 }} className="flex items-center justify-center group-hover:opacity-100 hover:text-[#dc2626] transition-all">
                                <Trash2 style={{ width: 13, height: 13 }} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>Add Employee Contract</h3>
              <button onClick={() => setShowForm(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Employee</label>
                <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v ?? '' }))}>
                  <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none">
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                    {teamMembers.map(m => <SelectItem key={m.id} value={m.id} style={{ color: C.fg, fontSize: 12 }}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Contract Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Employment Agreement 2025" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Document URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://drive.google.com/file/..." style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Description <span style={{ textTransform: 'none', opacity: 0.7 }}>(optional)</span></label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Full-time, casual, etc." style={inp} className="focus:border-[#76A58F]" />
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Expiry Date <span style={{ textTransform: 'none', opacity: 0.7 }}>(optional)</span></label>
                  <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    style={inp} className="focus:border-[#76A58F]" />
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : 'Add Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
