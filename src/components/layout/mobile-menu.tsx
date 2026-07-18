'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, FileText, Receipt, Calendar, MessageSquare,
  GitBranch, Zap, Megaphone, Star, TrendingUp, Settings,
  LogOut, X, Clock, Repeat
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const MENU_ITEMS = [
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Schedule', href: '/schedule', icon: Calendar },
  { label: 'Recurring', href: '/agreements', icon: Repeat },
  { label: 'Quotes', href: '/quotes', icon: FileText },
  { label: 'Invoices', href: '/invoices', icon: Receipt },
  { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { label: 'Inbox', href: '/inbox', icon: MessageSquare },
  { label: 'Timesheets', href: '/timesheets', icon: Clock },
  { label: 'Automations', href: '/automations', icon: Zap },
  { label: 'Marketing', href: '/marketing', icon: Megaphone },
  { label: 'Reputation', href: '/reputation', icon: Star },
  { label: 'Finances', href: '/finances', icon: TrendingUp },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface Props { open: boolean; onClose: () => void }

const C = { navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

export function MobileMenu({ open, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 12 }}>
          {MENU_ITEMS.map(({ label, href, icon: Icon }) => {
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
