'use client'

import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TopbarProps {
  userName?: string
  userRole?: string
}

export function Topbar({ userName = 'User', userRole = 'admin' }: TopbarProps) {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header
      style={{ backgroundColor: '#2C3E50', borderBottom: '1px solid rgba(255,255,255,0.07)', height: 52 }}
      className="flex items-center px-6 gap-4 shrink-0"
    >
      {/* Spacer pushes everything right */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block w-52">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
        <Input
          placeholder="Search…"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '12px',
            height: 32,
          }}
          className="pl-8 rounded-none placeholder:text-white/20 focus:border-[#76A58F] focus:ring-[#76A58F]/20"
        />
      </div>

      {/* Notifications */}
      <button
        style={{ color: 'rgba(255,255,255,0.35)', position: 'relative' }}
        className="w-8 h-8 flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#76A58F' }} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' }} />

      {/* User */}
      <div className="flex items-center gap-2.5">
        <Avatar className="w-7 h-7 rounded-none">
          <AvatarFallback style={{ backgroundColor: '#76A58F', borderRadius: 0 }} className="text-white text-[11px] font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden md:block">
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', lineHeight: 1.2, fontWeight: 500 }}>{userName}</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', letterSpacing: '0.05em' }} className="capitalize">{userRole}</p>
        </div>
      </div>
    </header>
  )
}
