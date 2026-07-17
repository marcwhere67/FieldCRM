'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import { melbourneDateOnly } from '@/lib/format'

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  gridLine: 'rgba(44,62,80,0.07)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  pending:     { bg: 'rgba(180,83,9,0.07)',   border: 'rgba(180,83,9,0.2)',   color: '#b45309', dot: '#f59e0b' },
  scheduled:   { bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.2)',  color: '#2563eb', dot: '#60a5fa' },
  in_progress: { bg: 'rgba(118,165,143,0.10)',border: 'rgba(118,165,143,0.3)',color: '#5d8c76', dot: '#76A58F' },
  completed:   { bg: 'rgba(44,62,80,0.06)',   border: 'rgba(44,62,80,0.15)',  color: '#4A5A65', dot: '#76A58F' },
  cancelled:   { bg: 'rgba(220,38,38,0.05)',  border: 'rgba(220,38,38,0.15)', color: '#dc2626', dot: '#dc2626' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6)

interface AssignedUser {
  user_id: string
  users: { id: string; full_name: string; avatar_url: string | null } | { id: string; full_name: string; avatar_url: string | null }[] | null
}
interface Job {
  id: string; title: string; status: string; scheduled_start: string | null; scheduled_end: string | null
  contacts: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null
  properties: { id: string; suburb: string | null; address_line1: string | null } | { id: string; suburb: string | null; address_line1: string | null }[] | null
  job_assignments: AssignedUser[]
}
interface User { id: string; full_name: string; avatar_url: string | null; role: string }
interface Props { jobs: Job[]; users: User[]; orgId: string; initialDate: string; initialView: 'month' | 'week' | 'day' }

function initials(u: { full_name: string }) { const p = u.full_name.split(' '); return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '') }
function startOfWeek(date: Date): Date { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
function addDays(date: Date, n: number): Date { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function formatHour(h: number) { return h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm` }
function formatMonthDay(d: Date) { return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}` }

export function ScheduleView({ jobs, users, orgId, initialDate, initialView }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'week' | 'day' | 'month'>(initialView)
  const [focusDate, setFocusDate] = useState(() => new Date(initialDate + 'T00:00:00'))

  const weekStart = startOfWeek(focusDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date(); today.setHours(0,0,0,0)

  function navigate(dir: -1 | 1) {
    const next = new Date(focusDate)
    if (view === 'month') next.setMonth(next.getMonth() + dir)
    else next.setDate(next.getDate() + (view === 'week' ? dir * 7 : dir))
    setFocusDate(next)
    router.replace(`/schedule?date=${melbourneDateOnly(next)}&view=${view}`, { scroll: false })
  }

  function goToday() {
    const now = new Date(); setFocusDate(now)
    router.replace(`/schedule?date=${melbourneDateOnly(now)}&view=${view}`, { scroll: false })
  }

  function switchView(v: 'week' | 'day' | 'month') {
    setView(v)
    router.replace(`/schedule?date=${melbourneDateOnly(focusDate)}&view=${v}`, { scroll: false })
  }

  function getJobsForDay(day: Date) { return jobs.filter(j => j.scheduled_start && sameDay(new Date(j.scheduled_start), day)) }
  function getContact(job: Job) { if (!job.contacts) return null; return Array.isArray(job.contacts) ? job.contacts[0] : job.contacts }
  function getAssignees(job: Job): { id: string; full_name: string; avatar_url: string | null }[] {
    return (job.job_assignments ?? []).map(a => { const u = a.users; if (!u) return null; return Array.isArray(u) ? u[0] : u }).filter(Boolean) as { id: string; full_name: string; avatar_url: string | null }[]
  }
  function jobPosition(job: Job): { top: number; height: number } | null {
    if (!job.scheduled_start) return null
    const start = new Date(job.scheduled_start)
    const startH = start.getHours() + start.getMinutes() / 60
    const endH = job.scheduled_end ? new Date(job.scheduled_end).getHours() + new Date(job.scheduled_end).getMinutes() / 60 : startH + 1
    const top = (startH - 6) * 60; const height = Math.max((endH - startH) * 60, 28)
    return { top, height }
  }

  const displayDays = view === 'week' ? weekDays : [focusDate]
  const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const headerLabel = view === 'month'
    ? `${MONTHS_LONG[focusDate.getMonth()]} ${focusDate.getFullYear()}`
    : view === 'week' ? `${formatMonthDay(weekDays[0])} – ${formatMonthDay(weekDays[6])} ${weekDays[6].getFullYear()}`
    : `${DAYS[focusDate.getDay()]}, ${formatMonthDay(focusDate)} ${focusDate.getFullYear()}`

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream }} className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Operations</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Schedule</h1>
        </div>
        <Link href="/jobs/new">
          <button style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />New job
          </button>
        </Link>
      </div>

      {/* Toolbar */}
      <div style={{ backgroundColor: C.cream, borderBottom: `1px solid ${C.border}`, padding: '10px 24px' }} className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', color: '#4A5A65', width: 30, height: 30 }}
            className="flex items-center justify-center hover:opacity-80 transition-opacity">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(1)} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', color: '#4A5A65', width: 30, height: 30 }}
            className="flex items-center justify-center hover:opacity-80 transition-opacity">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={goToday} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', color: '#4A5A65', padding: '0 12px', height: 30, fontSize: 11, letterSpacing: '0.08em' }}
            className="uppercase hover:opacity-80 transition-opacity">Today</button>
          <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 16, marginLeft: 8 }}>{headerLabel}</span>
        </div>
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', display: 'flex', padding: 2 }}>
          {(['month', 'week', 'day'] as const).map(v => (
            <button key={v} onClick={() => switchView(v)}
              style={{
                padding: '4px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                backgroundColor: view === v ? C.navy : 'transparent',
                color: view === v ? '#fff' : '#4A5A65',
                transition: 'all 150ms ease',
              }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#fff', borderBottom: `1px solid ${C.border}` }} className="flex flex-col mx-6 mb-3">
        {view === 'month' ? (
          <MonthGrid focusDate={focusDate} jobs={jobs} today={today} getJobsForDay={getJobsForDay} getContact={getContact} onDayClick={day => { setFocusDate(day); switchView('day') }} />
        ) : (
          <>
            {/* Day headers */}
            <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }} className="flex">
              <div style={{ width: 52, flexShrink: 0 }} />
              {displayDays.map((day, i) => {
                const isToday = sameDay(day, today)
                const dayJobs = getJobsForDay(day)
                return (
                  <div key={i} style={{
                    flex: 1, padding: '8px 8px', textAlign: 'center',
                    borderLeft: `1px solid ${C.border}`,
                    backgroundColor: isToday ? 'rgba(118,165,143,0.04)' : 'transparent',
                    cursor: 'pointer',
                  }} onClick={() => { setFocusDate(day); if (view === 'week') switchView('day') }}
                    className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                    <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{DAYS[day.getDay()]}</p>
                    <p style={{ color: isToday ? C.sage : C.navy, fontSize: 18, fontFamily: C.serif, fontWeight: isToday ? 500 : 300, lineHeight: 1.2, marginTop: 1 }}>{day.getDate()}</p>
                    {dayJobs.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {dayJobs.slice(0, 4).map((j, ji) => (
                          <span key={ji} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: (STATUS_STYLE[j.status] ?? STATUS_STYLE.pending).dot }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Hour grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="flex" style={{ minHeight: `${HOURS.length * 60}px` }}>
                <div style={{ width: 52, flexShrink: 0, position: 'relative' }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ position: 'absolute', top: `${(h - 6) * 60}px`, left: 0, right: 0, height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8 }}>
                      <span style={{ color: C.muted, fontSize: 10, marginTop: -7 }}>{formatHour(h)}</span>
                    </div>
                  ))}
                </div>
                {displayDays.map((day, di) => {
                  const isToday = sameDay(day, today)
                  const dayJobs = getJobsForDay(day)
                  return (
                    <div key={di} style={{
                      flex: 1, borderLeft: `1px solid ${C.border}`, position: 'relative',
                      minHeight: `${HOURS.length * 60}px`,
                      backgroundColor: isToday ? 'rgba(118,165,143,0.02)' : 'transparent',
                    }}>
                      {HOURS.map(h => <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: `${(h - 6) * 60}px`, borderTop: `1px solid ${C.gridLine}` }} />)}
                      {isToday && (() => {
                        const n = new Date(); const nowH = n.getHours() + n.getMinutes() / 60
                        if (nowH >= 6 && nowH <= 20) return (
                          <div style={{ position: 'absolute', left: 0, right: 0, top: `${(nowH - 6) * 60}px`, zIndex: 20, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: C.sage, marginLeft: -3.5, flexShrink: 0 }} />
                            <div style={{ flex: 1, borderTop: `1px solid ${C.sage}` }} />
                          </div>
                        )
                      })()}
                      {dayJobs.map(job => {
                        const pos = jobPosition(job)
                        if (!pos) return null
                        const contact = getContact(job)
                        const assignees = getAssignees(job)
                        const ss = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending
                        return (
                          <Link key={job.id} href={`/jobs/${job.id}`} style={{
                            position: 'absolute', left: 3, right: 3, top: pos.top + 1, height: pos.height - 2,
                            backgroundColor: ss.bg, border: `1px solid ${ss.border}`,
                            padding: '4px 8px', overflow: 'hidden', zIndex: 10,
                          }} className="hover:brightness-95 transition-all block">
                            <p style={{ color: ss.color, fontSize: 11, fontWeight: 500, lineHeight: 1.3 }} className="truncate">{job.title}</p>
                            {contact && <p style={{ color: ss.color, fontSize: 10, opacity: 0.75, marginTop: 1 }} className="truncate">{contact.first_name} {contact.last_name}</p>}
                            {pos.height > 50 && assignees.length > 0 && (
                              <div className="flex gap-0.5 mt-1">
                                {assignees.slice(0, 3).map(u => (
                                  <div key={u.id} style={{ width: 16, height: 16, backgroundColor: 'rgba(44,62,80,0.12)', color: C.navy, fontSize: 8, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
                                    {initials(u)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Unscheduled strip */}
      <UnscheduledStrip jobs={jobs.filter(j => !j.scheduled_start)} />
    </div>
  )
}

function MonthGrid({ focusDate, jobs, today, getJobsForDay, getContact, onDayClick }: {
  focusDate: Date; jobs: Job[]; today: Date
  getJobsForDay: (d: Date) => Job[]; getContact: (j: Job) => { first_name: string; last_name: string } | null; onDayClick: (d: Date) => void
}) {
  const year = focusDate.getFullYear(); const month = focusDate.getMonth()
  const firstOfMonth = new Date(year, month, 1); const startPad = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) { const d = i - startPad + 1; cells.push(d >= 1 && d <= daysInMonth ? new Date(year, month, d) : null) }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', borderRight: `1px solid ${C.border}` }} className="last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, backgroundColor: 'rgba(44,62,80,0.02)', minHeight: 90 }} />
          const isToday = sameDay(day, today)
          const dayJobs = getJobsForDay(day)
          return (
            <div key={i} onClick={() => onDayClick(day)} style={{
              borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
              padding: 6, minHeight: 90, cursor: 'pointer',
              backgroundColor: isToday ? 'rgba(118,165,143,0.04)' : 'transparent',
            }} className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
              <p style={{
                fontSize: 11, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', marginBottom: 4,
                backgroundColor: isToday ? C.sage : 'transparent',
                color: isToday ? '#fff' : C.muted,
              }}>{day.getDate()}</p>
              <div className="space-y-0.5">
                {dayJobs.slice(0, 3).map(job => {
                  const contact = getContact(job)
                  const ss = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending
                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`} onClick={e => e.stopPropagation()}
                      style={{ display: 'block', backgroundColor: ss.bg, border: `1px solid ${ss.border}`, color: ss.color, fontSize: 10, padding: '1px 5px', lineHeight: 1.4 }} className="truncate">
                      {job.title}{contact ? ` · ${contact.first_name}` : ''}
                    </Link>
                  )
                })}
                {dayJobs.length > 3 && <p style={{ fontSize: 10, color: C.muted, paddingLeft: 4 }}>+{dayJobs.length - 3} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UnscheduledStrip({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null
  return (
    <div style={{ padding: '0 24px 16px', flexShrink: 0 }}>
      <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }} className="flex items-center gap-1.5">
        <Clock className="w-3 h-3" />{jobs.length} unscheduled
      </p>
      <div className="flex flex-wrap gap-2">
        {jobs.slice(0, 8).map(job => {
          const contact = Array.isArray(job.contacts) ? job.contacts[0] : job.contacts
          const ss = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending
          return (
            <Link key={job.id} href={`/jobs/${job.id}`}
              style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:shadow-sm transition-shadow">
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ss.dot, flexShrink: 0 }} />
              <span style={{ color: C.fg, fontSize: 11 }}>{job.title}</span>
              {contact && <span style={{ color: C.muted, fontSize: 11 }}>{contact.first_name} {contact.last_name}</span>}
            </Link>
          )
        })}
        {jobs.length > 8 && <span style={{ color: C.muted, fontSize: 11, padding: '5px 0' }}>+{jobs.length - 8} more</span>}
      </div>
    </div>
  )
}
