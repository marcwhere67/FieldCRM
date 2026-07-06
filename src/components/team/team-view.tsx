'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, Pencil, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, BadgeCheck, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

const ROLE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  admin:   { bg: 'rgba(124,58,237,0.07)', color: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  manager: { bg: 'rgba(37,99,235,0.07)',  color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  field:   { bg: 'rgba(44,62,80,0.06)',   color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
}

const LEAVE_STATUS: Record<string, { bg: string; color: string; border: string }> = {
  pending:  { bg: 'rgba(180,83,9,0.07)',    color: '#b45309', border: 'rgba(180,83,9,0.18)' },
  approved: { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  declined: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
}

interface Certification { name: string; issued: string; expires: string; issuer: string }
interface EmployeeProfile { id?: string; user_id: string; hire_date: string | null; job_title: string | null; department: string | null; employment_type: string; skills: string[]; certifications: Certification[]; emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relation: string | null; notes: string | null }
interface LeaveRequest { id: string; user_id: string; type: string; start_date: string; end_date: string; start_time: string | null; end_time: string | null; days: number; reason: string | null; status: 'pending' | 'approved' | 'declined'; reviewed_by: string | null; reviewed_at: string | null }
interface TeamMember { id: string; full_name: string; email: string; role: string; phone: string | null; hourly_rate: number | null; is_active: boolean; employee_profiles: EmployeeProfile | null }
interface Props { members: TeamMember[]; leaveRequests: LeaveRequest[]; currentUserId: string; isManager: boolean }

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'casual', 'contractor']
const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other']

function initials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }
function businessDays(start: string, end: string, startTime?: string, endTime?: string) {
  let count = 0; const cur = new Date(start); const last = new Date(end)
  while (cur <= last) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1) }
  if (start === end && startTime && endTime) return 0.5
  return count
}

const emptyProfile: Omit<EmployeeProfile, 'user_id'> = { hire_date: '', job_title: '', department: '', employment_type: 'full_time', skills: [], certifications: [], emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '', notes: '' }
const emptyLeave = { type: 'annual', start_date: '', end_date: '', start_time: '', end_time: '', days: 0, reason: '' }

const inputCls = { backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', borderRadius: 0, color: '#1C2A35', fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' } as React.CSSProperties
const labelSt = { color: '#8A9BA6', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 5, display: 'block' }

export function TeamView({ members: initialMembers, leaveRequests: initialLeave, currentUserId, isManager }: Props) {
  const [members] = useState<TeamMember[]>(initialMembers)
  const [leave, setLeave] = useState<LeaveRequest[]>(initialLeave)
  const [activeTab, setActiveTab] = useState<'members' | 'leave'>('members')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState<Omit<EmployeeProfile, 'user_id'>>(emptyProfile)
  const [hourlyRate, setHourlyRate] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [newCert, setNewCert] = useState<Certification>({ name: '', issued: '', expires: '', issuer: '' })
  const [showCertForm, setShowCertForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState(emptyLeave)
  const [leaveUserId, setLeaveUserId] = useState(currentUserId)

  const pendingCount = leave.filter(l => l.status === 'pending').length
  const today = new Date().toISOString().split('T')[0]

  const expiringSoon = members.flatMap(m =>
    (m.employee_profiles?.certifications ?? [])
      .filter(c => c.expires && c.expires >= today && c.expires <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0])
      .map(c => ({ member: m.full_name, cert: c.name, expires: c.expires }))
  )

  function openEdit(m: TeamMember) {
    const p = m.employee_profiles
    setProfileForm({ hire_date: p?.hire_date ?? '', job_title: p?.job_title ?? '', department: p?.department ?? '', employment_type: p?.employment_type ?? 'full_time', skills: p?.skills ?? [], certifications: p?.certifications ?? [], emergency_contact_name: p?.emergency_contact_name ?? '', emergency_contact_phone: p?.emergency_contact_phone ?? '', emergency_contact_relation: p?.emergency_contact_relation ?? '', notes: p?.notes ?? '' })
    setHourlyRate(m.hourly_rate != null ? String(m.hourly_rate) : '')
    setSkillInput(''); setShowCertForm(false); setEditingId(m.id)
  }

  async function saveProfile() {
    if (!editingId) return; setSaving(true)
    try {
      const res = await fetch(`/api/team/profiles/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profileForm, hire_date: profileForm.hire_date || null, job_title: profileForm.job_title || null, department: profileForm.department || null, emergency_contact_name: profileForm.emergency_contact_name || null, emergency_contact_phone: profileForm.emergency_contact_phone || null, emergency_contact_relation: profileForm.emergency_contact_relation || null, notes: profileForm.notes || null, hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null }) })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Profile saved'); setEditingId(null); window.location.reload()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  function addSkill() { const s = skillInput.trim(); if (!s || profileForm.skills.includes(s)) return; setProfileForm(p => ({ ...p, skills: [...p.skills, s] })); setSkillInput('') }
  function removeSkill(s: string) { setProfileForm(p => ({ ...p, skills: p.skills.filter(x => x !== s) })) }
  function addCert() { if (!newCert.name.trim()) return; setProfileForm(p => ({ ...p, certifications: [...p.certifications, newCert] })); setNewCert({ name: '', issued: '', expires: '', issuer: '' }); setShowCertForm(false) }
  function removeCert(i: number) { setProfileForm(p => ({ ...p, certifications: p.certifications.filter((_, idx) => idx !== i) })) }

  async function submitLeave() {
    if (!leaveForm.start_date || !leaveForm.end_date) { toast.error('Set dates'); return }
    const days = businessDays(leaveForm.start_date, leaveForm.end_date); setSaving(true)
    try {
      const res = await fetch('/api/team/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...leaveForm, days, user_id: leaveUserId, reason: leaveForm.reason || null, start_time: leaveForm.start_time || null, end_time: leaveForm.end_time || null }) })
      if (!res.ok) throw new Error((await res.json()).error)
      const created = await res.json()
      setLeave(prev => [created, ...prev]); toast.success('Leave request submitted'); setShowLeaveModal(false); setLeaveForm(emptyLeave)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to submit') }
    finally { setSaving(false) }
  }

  async function reviewLeave(id: string, status: 'approved' | 'declined') {
    const res = await fetch(`/api/team/leave/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) { toast.error('Failed'); return }
    setLeave(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    toast.success(status === 'approved' ? 'Leave approved' : 'Leave declined')
  }

  async function deleteLeave(id: string) {
    const res = await fetch(`/api/team/leave/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    setLeave(prev => prev.filter(l => l.id !== id)); toast.success('Request deleted')
  }

  function memberName(id: string) { return members.find(m => m.id === id)?.full_name ?? '—' }

  return (
    <div className="space-y-5 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>People</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Team</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{members.filter(m => m.is_active).length} active members</p>
        </div>
        <button onClick={() => { setShowLeaveModal(true); setLeaveUserId(currentUserId) }}
          style={{ backgroundColor: C.sage, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
          className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
          <Plus className="w-3.5 h-3.5" />Request leave
        </button>
      </div>

      <div className="px-6 space-y-5">
        {/* Cert expiry alerts */}
        {expiringSoon.length > 0 && (
          <div style={{ backgroundColor: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', padding: '12px 16px' }} className="flex items-start gap-3">
            <AlertTriangle style={{ width: 14, height: 14, color: '#b45309', flexShrink: 0, marginTop: 2 }} />
            <div className="space-y-0.5">
              {expiringSoon.map((e, i) => (
                <p key={i} style={{ color: '#b45309', fontSize: 12 }}><span style={{ fontWeight: 500 }}>{e.member}</span> — {e.cert} expires {formatDate(e.expires)}</p>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 24 }}>
          {(['members', 'leave'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              paddingBottom: 10, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: activeTab === tab ? C.navy : C.muted,
              borderBottom: activeTab === tab ? `2px solid ${C.sage}` : '2px solid transparent',
              marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all 150ms ease',
            }}>
              {tab}
              {tab === 'leave' && pendingCount > 0 && (
                <span style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {activeTab === 'members' && (
          <div className="space-y-2">
            {members.map(m => {
              const isExpanded = expandedId === m.id
              const isEditing = editingId === m.id
              const isSelf = m.id === currentUserId
              const canEditFull = isManager
              const canEdit = isManager || isSelf
              const p = m.employee_profiles
              const av = AVATAR_COLORS[m.full_name.charCodeAt(0) % AVATAR_COLORS.length]
              const rb = ROLE_BADGE[m.role] ?? ROLE_BADGE.field

              return (
                <div key={m.id} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, overflow: 'hidden', opacity: m.is_active ? 1 : 0.6 }}>
                  <div style={{ padding: '14px 16px' }} className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, backgroundColor: av.bg, color: av.color, fontSize: 13, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                      {initials(m.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{m.full_name}</p>
                        <span style={{ backgroundColor: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '2px 7px', textTransform: 'uppercase' }}>{m.role}</span>
                        {!m.is_active && <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Inactive</span>}
                      </div>
                      <div style={{ marginTop: 2 }} className="flex items-center gap-3 flex-wrap">
                        <span style={{ color: C.muted, fontSize: 11 }}>{m.email}</span>
                        {m.phone && <span style={{ color: C.muted, fontSize: 11 }}>{m.phone}</span>}
                        {p?.job_title && <span style={{ color: '#4A5A65', fontSize: 11 }}>{p.job_title}</span>}
                        {p?.department && <span style={{ color: C.muted, fontSize: 11 }}>{p.department}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <button onClick={() => isEditing ? setEditingId(null) : openEdit(m)}
                          style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                          <Pencil style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                        {isExpanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                      </button>
                    </div>
                  </div>

                  {/* View expanded */}
                  {isExpanded && !isEditing && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px', backgroundColor: C.cream }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {(p?.employment_type || p?.hire_date || m.hourly_rate != null) && (
                          <div>
                            <p style={labelSt}>Employment</p>
                            <div className="space-y-1.5">
                              {p?.employment_type && <Row label="Type" value={p.employment_type.replace('_', ' ')} />}
                              {p?.hire_date && <Row label="Hire date" value={formatDate(p.hire_date)} />}
                              {m.hourly_rate != null && <Row label="Hourly rate" value={`$${m.hourly_rate}/hr`} />}
                            </div>
                          </div>
                        )}
                        {(p?.emergency_contact_name || p?.emergency_contact_phone) && (
                          <div>
                            <p style={labelSt}>Emergency contact</p>
                            <div className="space-y-1.5">
                              {p.emergency_contact_name && <Row label="Name" value={p.emergency_contact_name} />}
                              {p.emergency_contact_relation && <Row label="Relation" value={p.emergency_contact_relation} />}
                              {p.emergency_contact_phone && <Row label="Phone" value={p.emergency_contact_phone} />}
                            </div>
                          </div>
                        )}
                        {p?.notes && <div><p style={labelSt}>Notes</p><p style={{ color: '#4A5A65', fontSize: 12 }}>{p.notes}</p></div>}
                      </div>
                      <div className="space-y-4">
                        {(p?.skills?.length ?? 0) > 0 && (
                          <div>
                            <p style={labelSt}>Skills</p>
                            <div className="flex flex-wrap gap-1.5">
                              {p!.skills.map(s => <span key={s} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, color: '#4A5A65', fontSize: 10, padding: '3px 9px' }}>{s}</span>)}
                            </div>
                          </div>
                        )}
                        {(p?.certifications?.length ?? 0) > 0 && (
                          <div>
                            <p style={labelSt}>Certifications</p>
                            <div className="space-y-1.5">
                              {p!.certifications.map((cert, i) => {
                                const expired = cert.expires && cert.expires < today
                                const expiring = cert.expires && !expired && cert.expires <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
                                return (
                                  <div key={i} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '8px 12px' }} className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <BadgeCheck style={{ width: 13, height: 13, color: expired ? '#dc2626' : expiring ? '#b45309' : C.sage }} />
                                      <div>
                                        <p style={{ color: C.navy, fontSize: 11, fontWeight: 500 }}>{cert.name}</p>
                                        {cert.issuer && <p style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{cert.issuer}</p>}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      {cert.issued && <p style={{ color: C.muted, fontSize: 10 }}>Issued {formatDate(cert.issued)}</p>}
                                      {cert.expires && <p style={{ color: expired ? '#dc2626' : expiring ? '#b45309' : C.muted, fontSize: 10 }}>{expired ? 'Expired' : 'Expires'} {formatDate(cert.expires)}</p>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit expanded */}
                  {isExpanded && isEditing && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px', backgroundColor: C.cream }} className="space-y-5">
                      {!canEditFull && (
                        <p style={{ color: C.muted, fontSize: 11 }}>You can update your skills, emergency contact and notes. Job title, pay rate and other HR details are managed by an admin.</p>
                      )}
                      {canEditFull && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: 'Job title', key: 'job_title', placeholder: 'e.g. Senior Technician' },
                          { label: 'Department', key: 'department', placeholder: 'e.g. Field Operations' },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key}>
                            <label style={labelSt}>{label}</label>
                            <input value={(profileForm as unknown as Record<string, string>)[key] ?? ''} onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={inputCls} className="focus:border-[#76A58F]" />
                          </div>
                        ))}
                        <div>
                          <label style={labelSt}>Employment type</label>
                          <select value={profileForm.employment_type} onChange={e => setProfileForm(p => ({ ...p, employment_type: e.target.value }))} style={inputCls} className="focus:border-[#76A58F]">
                            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelSt}>Hire date</label>
                          <input type="date" value={profileForm.hire_date ?? ''} onChange={e => setProfileForm(p => ({ ...p, hire_date: e.target.value }))} style={inputCls} className="focus:border-[#76A58F]" />
                        </div>
                        <div>
                          <label style={labelSt}>Hourly rate ($)</label>
                          <input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputCls} className="focus:border-[#76A58F]" />
                        </div>
                      </div>
                      )}

                      {/* Skills */}
                      <div>
                        <label style={labelSt}>Skills</label>
                        <div className="flex gap-2 mb-2">
                          <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder="Type a skill, press Enter" style={{ ...inputCls, flex: 1 }} className="focus:border-[#76A58F]" />
                          <button onClick={addSkill} style={{ backgroundColor: C.navy, color: '#fff', padding: '0 12px', fontSize: 11 }} className="uppercase hover:opacity-80 transition-opacity">Add</button>
                        </div>
                        {profileForm.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {profileForm.skills.map(s => (
                              <span key={s} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, color: '#4A5A65', fontSize: 10, padding: '3px 9px' }} className="flex items-center gap-1">
                                {s}<button onClick={() => removeSkill(s)} style={{ color: C.muted }} className="hover:text-[#dc2626] transition-colors"><X style={{ width: 10, height: 10 }} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Certifications */}
                      {canEditFull && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label style={labelSt}>Certifications</label>
                          <button onClick={() => setShowCertForm(v => !v)} style={{ color: C.sage, fontSize: 11 }} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                            <Plus style={{ width: 11, height: 11 }} />Add
                          </button>
                        </div>
                        {showCertForm && (
                          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 14, marginBottom: 8 }} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {[{ label: 'Certificate name', key: 'name', ph: 'e.g. White Card' },{ label: 'Issuing body', key: 'issuer', ph: 'e.g. SafeWork NSW' }].map(f => (
                                <div key={f.key}>
                                  <label style={labelSt}>{f.label}</label>
                                  <input value={(newCert as unknown as Record<string, string>)[f.key]} onChange={e => setNewCert(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={inputCls} className="focus:border-[#76A58F]" />
                                </div>
                              ))}
                              {[{ label: 'Date issued', key: 'issued' },{ label: 'Expiry date', key: 'expires' }].map(f => (
                                <div key={f.key}>
                                  <label style={labelSt}>{f.label}</label>
                                  <input type="date" value={(newCert as unknown as Record<string, string>)[f.key]} onChange={e => setNewCert(p => ({ ...p, [f.key]: e.target.value }))} style={inputCls} className="focus:border-[#76A58F]" />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setShowCertForm(false)} style={{ flex: 1, border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '6px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                              <button onClick={addCert} style={{ flex: 1, backgroundColor: C.sage, color: '#fff', padding: '6px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity">Add cert</button>
                            </div>
                          </div>
                        )}
                        {profileForm.certifications.length > 0 && (
                          <div className="space-y-1.5">
                            {profileForm.certifications.map((cert, i) => (
                              <div key={i} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '7px 12px' }} className="flex items-center justify-between">
                                <span style={{ color: C.navy, fontSize: 11, fontWeight: 500 }}>{cert.name}</span>
                                <div className="flex items-center gap-3">
                                  {cert.expires && <span style={{ color: C.muted, fontSize: 10 }}>exp. {formatDate(cert.expires)}</span>}
                                  <button onClick={() => removeCert(i)} style={{ color: C.muted }} className="hover:text-[#dc2626] transition-colors"><X style={{ width: 12, height: 12 }} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Emergency contact */}
                      <div>
                        <label style={labelSt}>Emergency contact</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[{ k: 'emergency_contact_name', ph: 'Full name', lbl: 'Name' },{ k: 'emergency_contact_relation', ph: 'e.g. Partner', lbl: 'Relationship' },{ k: 'emergency_contact_phone', ph: '04xx xxx xxx', lbl: 'Phone' }].map(f => (
                            <div key={f.k}>
                              <label style={{ ...labelSt, marginBottom: 4 }}>{f.lbl}</label>
                              <input value={(profileForm as unknown as Record<string, string>)[f.k] ?? ''} onChange={e => setProfileForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} style={inputCls} className="focus:border-[#76A58F]" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={labelSt}>Notes</label>
                        <textarea value={profileForm.notes ?? ''} onChange={e => setProfileForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any additional notes..." style={{ ...inputCls, height: 'auto', padding: '8px 10px', resize: 'none' }} className="focus:border-[#76A58F]" />
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} style={{ flex: 1, border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '8px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                        <button onClick={saveProfile} disabled={saving} style={{ flex: 1, backgroundColor: C.sage, color: '#fff', padding: '8px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">{saving ? 'Saving…' : 'Save profile'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Leave tab */}
        {activeTab === 'leave' && (
          <div className="space-y-2">
            {leave.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <Clock style={{ width: 28, height: 28, color: 'rgba(44,62,80,0.15)', margin: '0 auto 10px' }} />
                <p style={{ color: C.muted, fontSize: 13 }}>No leave requests yet</p>
              </div>
            ) : leave.map(l => {
              const canReview = isManager && l.status === 'pending'
              const canDelete = (l.user_id === currentUserId && l.status === 'pending') || isManager
              const ls = LEAVE_STATUS[l.status]
              return (
                <div key={l.id} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '14px 16px' }} className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{memberName(l.user_id)}</p>
                      <span style={{ backgroundColor: ls.bg, color: ls.color, border: `1px solid ${ls.border}`, fontSize: 9, letterSpacing: '0.1em', padding: '2px 7px', textTransform: 'uppercase' }}>{l.status}</span>
                      <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l.type}</span>
                    </div>
                    <p style={{ color: '#4A5A65', fontSize: 12, marginTop: 3 }}>
                      {formatDate(l.start_date)}{l.start_time && ` ${l.start_time}`} — {formatDate(l.end_date)}{l.end_time && ` ${l.end_time}`}
                      <span style={{ color: C.muted }}> ({l.days === 0.5 ? 'half day' : `${l.days} day${l.days !== 1 ? 's' : ''}`})</span>
                    </p>
                    {l.reason && <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{l.reason}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {canReview && (
                      <>
                        <button onClick={() => reviewLeave(l.id, 'approved')} style={{ color: C.sage, fontSize: 11, fontWeight: 500 }} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
                          <CheckCircle style={{ width: 13, height: 13 }} />Approve
                        </button>
                        <button onClick={() => reviewLeave(l.id, 'declined')} style={{ color: '#dc2626', fontSize: 11, fontWeight: 500 }} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
                          <XCircle style={{ width: 13, height: 13 }} />Decline
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteLeave(l.id)} style={{ color: C.muted }} className="hover:text-[#dc2626] transition-colors">
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Leave request modal */}
      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>Request leave</h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 20 }} className="space-y-4">
              {isManager && (
                <div><label style={labelSt}>For</label>
                  <select value={leaveUserId} onChange={e => setLeaveUserId(e.target.value)} style={inputCls} className="focus:border-[#76A58F]">
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              )}
              <div><label style={labelSt}>Leave type</label>
                <select value={leaveForm.type} onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))} style={inputCls} className="focus:border-[#76A58F]">
                  {LEAVE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelSt}>Start date</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => { const s = e.target.value; const end = leaveForm.end_date < s ? s : leaveForm.end_date; setLeaveForm(p => ({ ...p, start_date: s, end_date: end, days: businessDays(s, end, p.start_time, p.end_time) })) }} style={inputCls} className="focus:border-[#76A58F]" />
                </div>
                <div><label style={labelSt}>End date</label>
                  <input type="date" value={leaveForm.end_date} min={leaveForm.start_date} onChange={e => { const end = e.target.value; setLeaveForm(p => ({ ...p, end_date: end, days: p.start_date ? businessDays(p.start_date, end, p.start_time, p.end_time) : 0 })) }} style={inputCls} className="focus:border-[#76A58F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelSt}>Start time (optional)</label>
                  <input type="time" value={leaveForm.start_time} onChange={e => { const st = e.target.value; setLeaveForm(p => ({ ...p, start_time: st, days: p.start_date && p.end_date ? businessDays(p.start_date, p.end_date, st, p.end_time) : p.days })) }} style={inputCls} className="focus:border-[#76A58F]" />
                </div>
                <div><label style={labelSt}>End time (optional)</label>
                  <input type="time" value={leaveForm.end_time} onChange={e => { const et = e.target.value; setLeaveForm(p => ({ ...p, end_time: et, days: p.start_date && p.end_date ? businessDays(p.start_date, p.end_date, p.start_time, et) : p.days })) }} style={inputCls} className="focus:border-[#76A58F]" />
                </div>
              </div>
              {leaveForm.days > 0 && <p style={{ color: C.sage, fontSize: 11 }}>{leaveForm.days} {leaveForm.days === 0.5 ? 'half day' : `business day${leaveForm.days !== 1 ? 's' : ''}`}</p>}
              <div><label style={labelSt}>Reason (optional)</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Any details for your manager..." style={{ ...inputCls, height: 'auto', padding: '8px 10px', resize: 'none' }} className="focus:border-[#76A58F]" />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex gap-2">
                <button onClick={() => setShowLeaveModal(false)} style={{ flex: 1, border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '8px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button onClick={submitLeave} disabled={saving} style={{ flex: 1, backgroundColor: C.sage, color: '#fff', padding: '8px 0', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">{saving ? 'Submitting…' : 'Submit request'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: '#8A9BA6', fontSize: 12 }}>{label}</span>
      <span style={{ color: '#4A5A65', fontSize: 12 }} className="capitalize">{value}</span>
    </div>
  )
}
