'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt,
  Calendar, MessageSquare, GitBranch, Zap, Clock,
  MapPin, Megaphone, Star, TrendingUp, Settings, ShieldCheck,
  ChevronLeft, ChevronRight, LogOut, BarChart2, BookOpen, Package, UserCheck, Truck, DollarSign, Calculator, Repeat, Coins
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type NavLink = { href: string; label: string; icon: React.ElementType; noActive?: boolean }
type NavDivider = { divider: string }
type NavEntry = NavLink | NavDivider

const NAV: NavEntry[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { divider: 'CRM' },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { divider: 'Operations' },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/agreements', label: 'Recurring', icon: Repeat },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/quotes/calculator', label: 'Quote Calculator', icon: Calculator, noActive: true },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { divider: 'Field' },
  { href: '/field-map', label: 'Field Map', icon: MapPin },
  { href: '/timesheets', label: 'Timesheets', icon: Clock },
  { href: '/assets', label: 'Assets', icon: Package },
  { href: '/team', label: 'Team', icon: UserCheck },
  { divider: 'Business' },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/reputation', label: 'Reputation', icon: Star },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/catalogue', label: 'Catalogue', icon: BookOpen },
  { href: '/finances', label: 'Finances', icon: TrendingUp },
  { href: '/job-costing', label: 'Job Costing', icon: Coins },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/admin', label: 'Admin Hub', icon: ShieldCheck },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      style={{ backgroundColor: '#2C3E50', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      className={cn(
        'flex flex-col h-screen transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        className={cn('flex items-center justify-center px-4 py-4', collapsed ? 'px-2' : 'px-4')}
      >
        {collapsed ? (
          <div style={{ backgroundColor: '#76A58F', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600 }}>SA</span>
          </div>
        ) : (
          <div className="flex flex-col items-start w-full gap-1">
            <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 10px', display: 'inline-block' }}>
              <img src="/salt-air-logo.png" alt="Salt Air Cleaning" className="h-7 w-auto" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', display: 'none' }} className="logo-fallback">SALT AIR</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.25em', paddingLeft: 2 }} className="text-[7px] font-normal uppercase tracking-widest">FieldCRM</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-scroll py-2 px-0" style={{ scrollbarWidth: 'auto' }}>
        {NAV.map((entry, idx) => {
          if ('divider' in entry) {
            if (collapsed) return <div key={idx} style={{ borderColor: 'rgba(255,255,255,0.08)' }} className="my-2 border-t" />
            return (
              <p key={idx} style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em' }} className="px-5 pt-5 pb-1 text-[8px] font-normal uppercase select-none">
                {entry.divider}
              </p>
            )
          }
          const { href, label, icon: Icon, noActive } = entry
          const navHrefs = NAV.filter(e => 'href' in e).map(e => (e as NavLink).href)
          const moreSpecificMatch = navHrefs.some(h => h !== href && h.startsWith(href + '/') && pathname.startsWith(h))
          const active = !noActive && !moreSpecificMatch && (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={active
                ? { color: '#fff', borderLeft: '2px solid #76A58F', backgroundColor: 'rgba(118,165,143,0.12)' }
                : { color: 'rgba(255,255,255,0.5)', borderLeft: '2px solid transparent' }
              }
              className={cn(
                'flex items-center gap-3 px-4 py-[8px] text-[12px] font-normal tracking-[0.03em] transition-colors mb-0',
                !active && 'hover:text-white hover:bg-white/5',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className="w-[15px] h-[15px] shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="px-0 pb-2 pt-1 space-y-0">
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          style={pathname.startsWith('/settings')
            ? { color: '#fff', borderLeft: '2px solid #76A58F', backgroundColor: 'rgba(118,165,143,0.12)' }
            : { color: 'rgba(255,255,255,0.5)', borderLeft: '2px solid transparent' }
          }
          className={cn(
            'flex items-center gap-3 px-4 py-[8px] text-[12px] font-normal tracking-[0.03em] transition-colors hover:text-white hover:bg-white/5',
            collapsed && 'justify-center px-0'
          )}
        >
          <Settings className="w-[15px] h-[15px] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{ color: 'rgba(255,255,255,0.35)', borderLeft: '2px solid transparent' }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-[8px] text-[12px] font-normal tracking-[0.03em] transition-colors hover:text-red-300 hover:bg-white/5',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-[15px] h-[15px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : undefined}
          style={{ color: 'rgba(255,255,255,0.25)', borderLeft: '2px solid transparent' }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-[8px] text-[12px] font-normal tracking-[0.03em] transition-colors hover:text-white hover:bg-white/5',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed
            ? <ChevronRight className="w-[15px] h-[15px]" />
            : <><ChevronLeft className="w-[15px] h-[15px]" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )
}
