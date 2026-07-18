'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt,
  Calendar, MessageSquare, GitBranch, Zap, Clock,
  MapPin, Megaphone, Star, TrendingUp, Settings, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, BarChart2, BookOpen, Package, UserCheck, Truck, DollarSign, Calculator, Repeat, Coins
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type NavLink = { href: string; label: string; icon: React.ElementType; noActive?: boolean }
type NavGroup = { label: string; items: NavLink[] }

// Everyday items — always visible, no header.
const PRIMARY: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
]

// Secondary items — collapsible groups, collapsed by default.
const GROUPS: NavGroup[] = [
  { label: 'Operations', items: [
    { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
    { href: '/agreements', label: 'Recurring', icon: Repeat },
    { href: '/quotes/calculator', label: 'Quote Calculator', icon: Calculator, noActive: true },
    { href: '/field-map', label: 'Field Map', icon: MapPin },
    { href: '/timesheets', label: 'Timesheets', icon: Clock },
    { href: '/assets', label: 'Assets', icon: Package },
    { href: '/team', label: 'Team', icon: UserCheck },
  ] },
  { label: 'Money', items: [
    { href: '/finances', label: 'Finances', icon: TrendingUp },
    { href: '/job-costing', label: 'Job Costing', icon: Coins },
    { href: '/payroll', label: 'Payroll', icon: DollarSign },
    { href: '/reports', label: 'Reports', icon: BarChart2 },
  ] },
  { label: 'Growth', items: [
    { href: '/marketing', label: 'Marketing', icon: Megaphone },
    { href: '/reputation', label: 'Reputation', icon: Star },
    { href: '/automations', label: 'Automations', icon: Zap },
  ] },
  { label: 'Admin', items: [
    { href: '/suppliers', label: 'Suppliers', icon: Truck },
    { href: '/catalogue', label: 'Catalogue', icon: BookOpen },
    { href: '/admin', label: 'Admin Hub', icon: ShieldCheck },
  ] },
]

const ALL_HREFS = [...PRIMARY, ...GROUPS.flatMap(g => g.items)].map(l => l.href)

function useActive(pathname: string) {
  return (href: string, noActive?: boolean) => {
    if (noActive) return false
    const moreSpecific = ALL_HREFS.some(h => h !== href && h.startsWith(href + '/') && pathname.startsWith(h))
    return !moreSpecific && (pathname === href || pathname.startsWith(href + '/'))
  }
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const isActive = useActive(pathname)

  // Auto-open the group that contains the current page; keep others closed.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const g of GROUPS) initial[g.label] = g.items.some(i => isActive(i.href, i.noActive))
    return initial
  })

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function itemStyle(active: boolean) {
    return active
      ? { color: '#fff', borderLeft: '2px solid #76A58F', backgroundColor: 'rgba(118,165,143,0.12)' }
      : { color: 'rgba(255,255,255,0.55)', borderLeft: '2px solid transparent' }
  }

  const linkClass = (active: boolean) => cn(
    'flex items-center gap-3 px-4 py-[9px] text-[12.5px] font-normal tracking-[0.02em] transition-colors',
    !active && 'hover:text-white hover:bg-white/5',
    collapsed && 'justify-center px-0',
  )

  function NavItem({ item }: { item: NavLink }) {
    const active = isActive(item.href, item.noActive)
    const Icon = item.icon
    return (
      <Link href={item.href} title={collapsed ? item.label : undefined} style={itemStyle(active)} className={linkClass(active)}>
        <Icon className="w-[15px] h-[15px] shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  return (
    <aside
      style={{ backgroundColor: '#2C3E50', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      className={cn('flex flex-col h-screen transition-all duration-200 shrink-0', collapsed ? 'w-16' : 'w-56')}
    >
      {/* Logo */}
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        className={cn('flex items-center py-4', collapsed ? 'justify-center px-2' : 'px-5')}
      >
        {collapsed ? (
          <div style={{ backgroundColor: '#76A58F', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600 }}>SA</span>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1.5">
            <img
              src="/salt-air-logo-white.png"
              alt="Salt Air Cleaning"
              className="h-8 w-auto"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.28em' }} className="text-[8px] uppercase">FieldCRM</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Primary */}
        {PRIMARY.map(item => <NavItem key={item.href} item={item} />)}

        {/* Collapsed: show group items flat, separated by rules */}
        {collapsed
          ? GROUPS.map(g => (
              <React.Fragment key={g.label}>
                <div style={{ borderColor: 'rgba(255,255,255,0.08)' }} className="my-2 border-t" />
                {g.items.map(item => <NavItem key={item.href} item={item} />)}
              </React.Fragment>
            ))
          : GROUPS.map(g => {
              const isOpen = open[g.label]
              const hasActive = g.items.some(i => isActive(i.href, i.noActive))
              return (
                <div key={g.label} className="mt-2">
                  <button
                    onClick={() => setOpen(o => ({ ...o, [g.label]: !o[g.label] }))}
                    style={{ color: hasActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)', letterSpacing: '0.18em' }}
                    className="w-full flex items-center justify-between px-5 pt-3 pb-1.5 text-[10px] uppercase select-none hover:text-white/70 transition-colors"
                  >
                    <span>{g.label}</span>
                    <ChevronDown className={cn('w-3 h-3 transition-transform', !isOpen && '-rotate-90')} />
                  </button>
                  {isOpen && g.items.map(item => <NavItem key={item.href} item={item} />)}
                </div>
              )
            })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="pb-2 pt-1">
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          style={itemStyle(pathname.startsWith('/settings'))}
          className={linkClass(pathname.startsWith('/settings'))}
        >
          <Settings className="w-[15px] h-[15px] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{ color: 'rgba(255,255,255,0.35)', borderLeft: '2px solid transparent' }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-[9px] text-[12.5px] font-normal tracking-[0.02em] transition-colors hover:text-red-300 hover:bg-white/5',
            collapsed && 'justify-center px-0',
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
            'w-full flex items-center gap-3 px-4 py-[9px] text-[12.5px] font-normal tracking-[0.02em] transition-colors hover:text-white hover:bg-white/5',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed
            ? <ChevronRight className="w-[15px] h-[15px]" />
            : <><ChevronLeft className="w-[15px] h-[15px]" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
