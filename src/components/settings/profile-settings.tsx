'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, KeyRound } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  inputBorder: 'rgba(44,62,80,0.15)',
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
]

interface Profile { id: string; full_name: string; email: string; phone: string | null; role: string; hourly_rate: number | null }

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone ?? '' })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', manager: 'Manager', field: 'Field Staff' }
  const avatarColor = AVATAR_COLORS[profile.full_name.charCodeAt(0) % AVATAR_COLORS.length]

  async function handleSave() {
    if (!form.full_name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Profile updated')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function handlePasswordReset() {
    setResetting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/auth/update-password` })
      if (error) throw error
      toast.success('Password reset email sent — check your inbox')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to send reset email') }
    finally { setResetting(false) }
  }

  const inputStyle = { backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' }
  const labelStyle = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  return (
    <div style={{ maxWidth: 560 }} className="space-y-6">
      <div>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 500 }}>My Profile</h2>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>Update your name and contact details</p>
      </div>

      {/* Avatar row */}
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="flex items-center gap-4">
        <div style={{ width: 52, height: 52, backgroundColor: avatarColor.bg, color: avatarColor.color, fontSize: 20, fontWeight: 500, flexShrink: 0 }} className="flex items-center justify-center">
          {profile.full_name[0].toUpperCase()}
        </div>
        <div>
          <p style={{ color: C.navy, fontSize: 15, fontWeight: 500 }}>{profile.full_name}</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{ROLE_LABELS[profile.role] ?? profile.role}</p>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
        <div>
          <label style={labelStyle}>Full Name</label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inputStyle} className="focus:border-[#76A58F]" />
        </div>
        <div>
          <label style={labelStyle}>Email <span style={{ color: C.muted, fontSize: 10, letterSpacing: 0, textTransform: 'none' }}>(cannot be changed here)</span></label>
          <input value={profile.email} disabled style={{ ...inputStyle, backgroundColor: 'rgba(44,62,80,0.04)', color: C.muted, cursor: 'not-allowed' }} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0400 000 000" style={inputStyle} className="focus:border-[#76A58F]" />
          </div>
          {profile.hourly_rate !== null && (
            <div>
              <label style={labelStyle}>Hourly Rate</label>
              <input value={`$${profile.hourly_rate}/hr`} disabled style={{ ...inputStyle, backgroundColor: 'rgba(44,62,80,0.04)', color: C.muted, cursor: 'not-allowed' }} />
            </div>
          )}
        </div>
      </div>

      {/* Security */}
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
        <h3 style={{ color: C.navy, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Security</h3>
        <div style={{ border: `1px solid ${C.border}`, padding: '14px 16px' }} className="flex items-center justify-between">
          <div>
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Password</p>
            <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Send a reset link to {profile.email}</p>
          </div>
          <button onClick={handlePasswordReset} disabled={resetting}
            style={{ border: `1px solid rgba(44,62,80,0.15)`, backgroundColor: C.cream, color: '#4A5A65', padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
            <KeyRound className="w-3.5 h-3.5" />{resetting ? 'Sending…' : 'Reset Password'}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          style={{ backgroundColor: C.navy, color: '#fff', padding: '8px 18px', fontSize: 11, letterSpacing: '0.1em' }}
          className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
          <Save className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
