'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatTime } from '@/lib/format'
import { Search, Plus, MapPin, Calendar, Briefcase, ChevronRight } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  draft:       { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)',    dot: '#8A9BA6' },
  scheduled:   { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)',   dot: '#2563eb' },
  in_progress: { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)',    dot: '#f59e0b' },
  completed:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
  cancelled:   { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)',   dot: '#dc2626' },
  invoiced:    { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)',  dot: '#7c3aed' },
  paid:        { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
}

interface Job {
  id: string
  job_number: string
  title: string
  status: string
  job_type: string
  scheduled_start: string | null
  scheduled_end: string | null
  assigned_users: string[]
  contacts: { first_name: string; last_name: string; phone: string | null }[] | { first_name: string; last_name: string; phone: string | null } | null
  properties: { address_line1: string; suburb: string; state: string }[] | { address_line1: string; suburb: string; state: string } | null
}

interface Props {
  jobs: Job[]
  teamMembers: { id: string; full_name: string }[]
  userRole: string
  filters: { q?: string; status?: string; assigned?: string; from?: string; to?: string }
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

export function JobsTable({ jobs, teamMembers, userRole, filters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.q ?? '')

  function updateFilter(key: string, value: string | null) {
    const p = new URLSearchParams()
    if (filters.status) p.set('status', filters.status)
    if (filters.assigned) p.set('assigned', filters.assigned)
    if (value && value !== 'all') p.set(key, value)
    else p.delete(key)
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  function getContact(job: Job) {
    if (!job.contacts) return null
    return Array.isArray(job.contacts) ? job.contacts[0] : job.contacts
  }

  function getProperty(job: Job) {
    if (!job.properties) return null
    return Array.isArray(job.properties) ? job.properties[0] : job.properties
  }

  const filteredJobs = search
    ? jobs.filter(j => {
        const c = getContact(j)
        const name = c ? `${c.first_name} ${c.last_name}`.toLowerCase() : ''
        return j.title.toLowerCase().includes(search.toLowerCase()) ||
          j.job_number.toLowerCase().includes(search.toLowerCase()) ||
          name.includes(search.toLowerCase())
      })
    : jobs

  const counts = Object.keys(STATUS_STYLE).reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between pb-5" style={{ borderBottom: '1px solid rgba(44,62,80,0.1)' }}>
        <div>
          <p style={{ color: '#76A58F', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Operations</p>
          <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50' }} className="text-3xl font-light">Jobs</h1>
          <p style={{ color: '#8A9BA6' }} className="text-xs mt-1">{filteredJobs.length} total</p>
        </div>
        <Link href="/jobs/new">
          <button style={{ backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em' }} className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-normal transition-all hover:opacity-80 active:scale-[0.98]">
            <Plus className="w-3.5 h-3.5" />New Job
          </button>
        </Link>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {[{ value: 'all', label: 'All', count: jobs.length }, ...Object.keys(STATUS_STYLE).map(s => ({ value: s, label: s.replace('_', ' '), count: counts[s] ?? 0 }))].map(item => {
          const active = (filters.status ?? 'all') === item.value
          const st = item.value !== 'all' ? STATUS_STYLE[item.value] : null
          return (
            <button
              key={item.value}
              onClick={() => updateFilter('status', item.value === 'all' ? null : item.value)}
              style={active
                ? { backgroundColor: st?.bg ?? 'rgba(44,62,80,0.08)', color: st?.color ?? '#2C3E50', border: `1px solid ${st?.border ?? 'rgba(44,62,80,0.2)'}` }
                : { backgroundColor: '#fff', color: '#8A9BA6', border: '1px solid rgba(44,62,80,0.1)' }
              }
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.08em] font-normal transition-all hover:opacity-80"
            >
              {st && <span style={{ backgroundColor: active ? st.dot : '#8A9BA6', width: 5, height: 5, borderRadius: '50%', display: 'inline-block' }} />}
              {item.label}
              <span style={{ opacity: 0.6 }} className="text-[9px]">({item.count})</span>
            </button>
          )
        })}
      </div>

      {/* Search + team filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#1C2A35' }}
            className="pl-9 placeholder:text-[#8A9BA6]"
          />
        </div>
        <Select value={filters.assigned ?? 'all'} onValueChange={v => updateFilter('assigned', v)}>
          <SelectTrigger style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65' }} className="w-40 text-sm">
            <SelectValue placeholder="All team" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
            <SelectItem value="all" style={{ color: '#1C2A35' }}>All team</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.id} value={m.id} style={{ color: '#1C2A35' }}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.status || filters.assigned || search) && (
          <button style={{ color: '#8A9BA6' }} className="text-xs hover:text-[#2C3E50] transition-colors px-2"
            onClick={() => { setSearch(''); startTransition(() => router.push(pathname)) }}>
            Clear
          </button>
        )}
      </div>

      {/* Jobs list */}
      <div className={`space-y-px ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        {filteredJobs.length === 0 ? (
          <div style={{ border: '1px solid rgba(44,62,80,0.1)', backgroundColor: '#fff' }} className="flex flex-col items-center justify-center py-20 gap-3">
            <Briefcase className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
            <p style={{ color: '#8A9BA6' }} className="text-xs">No jobs found</p>
            <Link href="/jobs/new">
              <button style={{ color: '#76A58F', letterSpacing: '0.1em' }} className="text-[10px] uppercase hover:opacity-70 transition-opacity mt-1">
                Create first job →
              </button>
            </Link>
          </div>
        ) : filteredJobs.map((job, i) => {
          const contact = getContact(job)
          const property = getProperty(job)
          const st = STATUS_STYLE[job.status] ?? STATUS_STYLE.draft
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              style={{
                backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8',
                borderLeft: `3px solid ${st.dot}`,
                borderBottom: '1px solid rgba(44,62,80,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '14px 16px',
                transition: 'background-color 150ms ease',
                textDecoration: 'none',
              }}
              className="group hover:bg-[#F0EDE8]"
            >
              {/* Job info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: '#8A9BA6', fontFamily: 'monospace', fontSize: '11px' }}>{job.job_number}</span>
                  {job.job_type === 'recurring' && (
                    <span style={{ color: '#76A58F', fontSize: '9px', letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '1px 6px' }} className="uppercase">Recurring</span>
                  )}
                </div>
                <p style={{ color: '#1C2A35', fontSize: '13px', fontWeight: 500 }} className="truncate group-hover:text-[#2C3E50] transition-colors">
                  {job.title}
                </p>
                {contact && (
                  <p style={{ color: '#8A9BA6', fontSize: '12px', marginTop: 2 }}>
                    {contact.first_name} {contact.last_name}
                  </p>
                )}
              </div>

              {/* Schedule */}
              {job.scheduled_start && (
                <div className="hidden md:flex flex-col items-end text-right shrink-0 gap-0.5">
                  <div className="flex items-center gap-1.5" style={{ color: '#4A5A65', fontSize: '12px' }}>
                    <Calendar className="w-3 h-3" style={{ color: '#8A9BA6' }} />
                    {formatDate(job.scheduled_start)}
                  </div>
                  <span style={{ color: '#8A9BA6', fontSize: '11px' }}>
                    {formatTime(job.scheduled_start)}{job.scheduled_end && ` – ${formatTime(job.scheduled_end)}`}
                  </span>
                </div>
              )}

              {/* Location */}
              {property && (
                <div className="hidden lg:flex items-center gap-1.5 shrink-0 max-w-40" style={{ color: '#8A9BA6', fontSize: '12px' }}>
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{property.suburb}, {property.state}</span>
                </div>
              )}

              {/* Assigned avatars */}
              {job.assigned_users.length > 0 && (
                <div className="hidden md:flex -space-x-1 shrink-0">
                  {job.assigned_users.slice(0, 3).map((uid, idx) => {
                    const member = teamMembers.find(m => m.id === uid)
                    const initials = member ? member.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'
                    const col = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                    return (
                      <div key={uid} style={{ width: 24, height: 24, backgroundColor: col.bg, color: col.color, fontSize: 9, border: '2px solid #F5F0EB' }} className="flex items-center justify-center font-medium">
                        {initials}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Status badge */}
              <span
                style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, letterSpacing: '0.08em', fontSize: '9px', padding: '2px 8px', flexShrink: 0 }}
                className="uppercase font-normal"
              >
                {job.status.replace('_', ' ')}
              </span>

              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#8A9BA6' }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
