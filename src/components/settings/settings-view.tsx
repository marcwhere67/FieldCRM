'use client'

import { useState } from 'react'
import { BusinessSettings } from './business-settings'
import { TeamSettings } from './team-settings'
import { ProfileSettings } from './profile-settings'
import { TemplatesSettings } from './templates-settings'
import { Building2, Users, User, Mail } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  border: 'rgba(44,62,80,0.09)', muted: '#8A9BA6',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

interface Org { id: string; name: string; abn: string | null; phone: string | null; email: string | null; address: string | null; default_payment_terms_days: number; timezone: string; subscription_plan: string }
interface TeamMember { id: string; full_name: string; email: string; role: string; phone: string | null; is_active: boolean; hourly_rate: number | null }
interface Profile { id: string; full_name: string; email: string; phone: string | null; role: string; hourly_rate: number | null }
interface Props { org: Org; team: TeamMember[]; profile: Profile; isAdmin: boolean }

const TABS = [
  { id: 'business',  label: 'Business',  icon: Building2, adminOnly: true },
  { id: 'templates', label: 'Templates', icon: Mail,      adminOnly: true },
  { id: 'team',      label: 'Team',      icon: Users,     adminOnly: false },
  { id: 'profile',   label: 'Profile',   icon: User,      adminOnly: false },
]

export function SettingsView({ org, team, profile, isAdmin }: Props) {
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)
  const [activeTab, setActiveTab] = useState(visibleTabs[0].id)

  return (
    <div style={{ maxWidth: 896 }} className="space-y-0 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }}>
        <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Account</p>
        <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Settings</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Manage your business, team, and account preferences</p>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: '#fff', display: 'flex', padding: '0 24px' }}>
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 16px',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: activeTab === tab.id ? C.navy : C.muted,
              borderBottom: activeTab === tab.id ? `2px solid ${C.sage}` : '2px solid transparent',
              backgroundColor: 'transparent',
              marginBottom: -1,
              transition: 'all 150ms ease',
            }}>
            <tab.icon style={{ width: 13, height: 13 }} />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px', backgroundColor: C.cream }}>
        {activeTab === 'business' && isAdmin && <BusinessSettings org={org} />}
        {activeTab === 'templates' && isAdmin && <TemplatesSettings canManage={isAdmin} />}
        {activeTab === 'team' && <TeamSettings initialTeam={team} canManage={isAdmin} currentUserId={profile.id} />}
        {activeTab === 'profile' && <ProfileSettings profile={profile} />}
      </div>
    </div>
  )
}
