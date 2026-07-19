'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, FileText, Receipt, Calendar, MessageSquare,
  GitBranch, Zap, Megaphone, Star, TrendingUp, Settings,
  LogOut, X, Clock, Repeat, Coins, Calculator, Package,
  UserCheck, DollarSign, BarChart2, Truck, BookOpen, ShieldCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Mirrors sidebar.tsx's PRIMARY + GROUPS, minus items already in the bottom bar (Dashboard/Jobs/Clock/Map).
const MENU_GROUPS = [
  { label: 'Everyday', items: [
    { label: 'Contacts', href: '/contacts', icon: Users },
    { label: 'Schedule', href: '/schedule', icon: Calendar },
    { label: 'Quotes', href: '/quotes', icon: FileText },
    { label: 'Invoices', href: '/invoices', icon: Receipt },
    { label: 'Inbox', href: '/inbox', icon: MessageSquare },
  ] },
  { label: 'Operations', items: [
    { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
    { label: 'Recurring', href: '/agreements', icon: Repeat },
    { label: 'Quote Calculator', href: '/quotes/calculator', icon: Calculator },
    { label: 'Timesheets', href: '/timesheets', icon: Clock },
    { label: 'Assets', href: '/assets', icon: Package },
    { label: 'Team', href: '/team', icon: UserCheck },
  ] },
  { label: 'Money', items: [
    { label: 'Finances', href: '/finances', icon: TrendingUp },
    { label: 'Job Costing', href: '/job-costing', icon: Coins },
    { label: 'Payroll', href: '/payroll', icon: DollarSign },
    { label: 'Reports', href: '/reports', icon: BarChart2 },
  ] },
  { label: 'Growth', items: [
    { label: 'Marketing', href: '/marketing', icon: Megaphone },
    { label: 'Reputation', href: '/reputation', icon: Star },
    { label: 'Automations', href: '/automations', icon: Zap },
  ] },
  { label: 'Admin', items: [
    { label: 'Suppliers', href: '/suppliers', icon: Truck },
    { label: 'Catalogue', href: '/catalogue', icon: BookOpen },
    { label: 'Admin Hub', href: '/admin', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: Settings },
  ] },
]

// Field/technician role only ever sees these — must mirror sidebar.tsx's FIELD_ALLOWED_HREFS.
const FIELD_ALLOWED_HREFS = new Set(['/dashboard', '/schedule', '/jobs', '/timesheets', '/field-map'])

interface Props { open: boolean; onClose: () => void; role?: string }

const C = { navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

export function MobileMenu({ open, onClose, role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const groups = role === 'field'
    ? MENU_GROUPS.map(g => ({ ...g, items: g.items.filter(i => FIELD_ALLOWED_HREFS.has(i.href)) })).filter(g => g.items.length > 0)
    : MENU_GROUPS

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} className="md:hidden">
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.cream, borderTop: `1px solid ${C.border}`, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.navy, fontSize: 13, fontWeight: 500, letterSpacing: '0.05em' }}>Menu</span>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: '4px 12px 12px' }}>
          {groups.map(g => (
            <div key={g.label} style={{ marginTop: 12 }}>
              <div style={{ color: C.muted, fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 4px 6px' }}>
                {g.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {g.items.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link key={href} href={href} onClick={onClose}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12,
                        color: active ? C.sage : C.muted, textDecoration: 'none', fontSize: 11,
                        backgroundColor: active ? 'rgba(118,165,143,0.1)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(118,165,143,0.2)' : 'transparent'}`,
                        transition: 'background-color 150ms',
                      }}>
                      <Icon style={{ width: 18, height: 18 }} />
                      <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 12px 24px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleSignOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            className="hover:bg-[rgba(220,38,38,0.05)] transition-colors">
            <LogOut style={{ width: 15, height: 15 }} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
