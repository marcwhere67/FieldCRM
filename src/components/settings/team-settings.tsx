'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, UserCheck, UserX, Mail, X } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  inputBorder: 'rgba(44,62,80,0.15)',
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

const ROLE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  admin:   { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  manager: { bg: 'rgba(180,83,9,0.07)',    color: '#b45309', border: 'rgba(180,83,9,0.18)' },
  field:   { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
}

interface TeamMember { id: string; full_name: string; email: string; role: string; phone: string | null; is_active: boolean; hourly_rate: number | null }
interface Props { initialTeam: TeamMember[]; canManage: boolean; currentUserId: string }

export function TeamSettings({ initialTeam, canManage, currentUserId }: Props) {
  const [team, setTeam] = useState<TeamMember[]>(initialTeam)
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'field', phone: '' })

  function setInv(field: string, value: string) { setInvite(f => ({ ...f, [field]: value })) }

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!invite.email.trim() || !invite.full_name.trim()) { toast.error('Name and email are required'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/settings/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invite) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Invite sent to ${invite.email}`)
      setTeam(prev => [...prev, data]); setShowInvite(false); setInvite({ email: '', full_name: '', role: 'field', phone: '' })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to invite') }
    finally { setInviting(false) }
  }

  async function toggleActive(member: TeamMember) {
    if (member.id === currentUserId) { toast.error("You can't deactivate yourself"); return }
    setToggling(member.id)
    try {
      const res = await fetch(`/api/settings/team/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !member.is_active }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTeam(prev => prev.map(m => m.id === member.id ? data : m))
      toast.success(data.is_active ? 'Member reactivated' : 'Member deactivated')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update') }
    finally { setToggling(null) }
  }

  async function changeRole(member: TeamMember, role: string) {
    try {
      const res = await fetch(`/api/settings/team/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTeam(prev => prev.map(m => m.id === member.id ? data : m)); toast.success('Role updated')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update role') }
  }

  const inputStyle = { backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' }
  const labelStyle = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  return (
    <div style={{ maxWidth: 640 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 500 }}>Team Members</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{team.filter(m => m.is_active).length} active · {team.length} total</p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />Invite Member
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="divide-y divide-[rgba(44,62,80,0.07)]">
        {team.map(member => {
          const avatarColor = AVATAR_COLORS[member.full_name.charCodeAt(0) % AVATAR_COLORS.length]
          const rb = ROLE_BADGE[member.role] ?? ROLE_BADGE.field
          return (
            <div key={member.id} style={{ padding: '14px 16px', opacity: member.is_active ? 1 : 0.55 }} className="flex items-center gap-3">
              <div style={{ width: 36, height: 36, backgroundColor: avatarColor.bg, color: avatarColor.color, fontSize: 13, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                {member.full_name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{member.full_name}</p>
                  {member.id === currentUserId && <span style={{ color: C.muted, fontSize: 10 }}>(you)</span>}
                  {!member.is_active && <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.08em', backgroundColor: 'rgba(44,62,80,0.06)', padding: '2px 6px', textTransform: 'uppercase' }}>Inactive</span>}
                </div>
                <div style={{ marginTop: 2 }} className="flex items-center gap-3">
                  <span style={{ color: C.muted, fontSize: 11 }} className="flex items-center gap-1">
                    <Mail style={{ width: 10, height: 10 }} />{member.email}
                  </span>
                  {member.phone && <span style={{ color: C.muted, fontSize: 11 }}>{member.phone}</span>}
                  {member.hourly_rate && <span style={{ color: C.muted, fontSize: 11 }}>${member.hourly_rate}/hr</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage && member.id !== currentUserId ? (
                  <Select value={member.role} onValueChange={v => changeRole(member, v ?? member.role)}>
                    <SelectTrigger style={{ height: 26, borderRadius: 0, backgroundColor: rb.bg, border: `1px solid ${rb.border}`, color: rb.color, fontSize: 10, letterSpacing: '0.08em', width: 90, textTransform: 'uppercase' }} className="rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      {['admin','manager','field'].map(r => <SelectItem key={r} value={r} style={{ color: C.fg, fontSize: 12 }} className="capitalize">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span style={{ backgroundColor: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '3px 8px', textTransform: 'uppercase' }}>{member.role}</span>
                )}
                {canManage && member.id !== currentUserId && (
                  <button onClick={() => !toggling && toggleActive(member)} title={member.is_active ? 'Deactivate' : 'Reactivate'}
                    style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] hover:bg-[rgba(44,62,80,0.06)] transition-colors">
                    {toggling === member.id
                      ? <span style={{ width: 14, height: 14, border: '2px solid #2C3E50', borderTopColor: 'transparent', borderRadius: '50%', display: 'block' }} className="animate-spin" />
                      : member.is_active ? <UserX style={{ width: 14, height: 14 }} /> : <UserCheck style={{ width: 14, height: 14, color: C.sage }} />}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleInvite} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={labelStyle}>Full Name</label>
                <input value={invite.full_name} onChange={e => setInv('full_name', e.target.value)} placeholder="Jane Smith" style={inputStyle} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={invite.email} onChange={e => setInv('email', e.target.value)} placeholder="jane@example.com" style={inputStyle} className="focus:border-[#76A58F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Role</label>
                  <Select value={invite.role} onValueChange={v => setInv('role', v ?? 'field')}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, color: C.fg, fontSize: 13 }} className="rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                      {['admin','manager','field'].map(r => <SelectItem key={r} value={r} style={{ color: C.fg, fontSize: 12 }} className="capitalize">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>Phone <span style={{ textTransform: 'none', fontSize: 10, letterSpacing: 0 }}>(optional)</span></label>
                  <input value={invite.phone} onChange={e => setInv('phone', e.target.value)} placeholder="0400 000 000" style={inputStyle} className="focus:border-[#76A58F]" />
                </div>
              </div>
              <p style={{ color: C.muted, fontSize: 11 }}>An invitation email will be sent to this address.</p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={inviting}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">{inviting ? 'Sending…' : 'Send Invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
