'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, Clock, MapPin, Menu } from 'lucide-react'
import { useState } from 'react'
import { MobileMenu } from './mobile-menu'

const BOTTOM_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', icon: Briefcase },
  { label: 'Clock', href: '/clock', icon: Clock },
  { label: 'Map', href: '/field-map', icon: MapPin },
]

const C = { navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

export function MobileNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: '#F5F0EB', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch' }}
        className="md:hidden safe-area-pb">
        {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', fontSize: 11, color: active ? C.sage : C.muted, textDecoration: 'none', letterSpacing: '0.05em' }}>
              <Icon style={{ width: 20, height: 20, color: active ? C.sage : C.muted }} />
              <span>{label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMenuOpen(true)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}>
          <Menu style={{ width: 20, height: 20 }} />
          <span>More</span>
        </button>
      </nav>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
