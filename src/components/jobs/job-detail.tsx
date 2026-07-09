'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatDateTime, formatMinutes } from '@/lib/format'
import { jobPhotoSrc } from '@/lib/photo-url'
import { ClockWidget } from '@/components/timeclock/clock-widget'
import { ChevronLeft, MapPin, Phone, Mail, Clock, Camera, CheckSquare, Square, FileText, Receipt, ExternalLink, Timer, Trash2, ChevronRight } from 'lucide-react'

const JobSummaryButton = dynamic(() => import('@/components/ai/job-summary-button').then(m => ({ default: m.JobSummaryButton })), { ssr: false })
const JobNotes = dynamic(() => import('@/components/jobs/job-notes').then(m => ({ default: m.JobNotes })), { ssr: false })

const STATUS_STEPS = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid']
const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  draft:       { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)',    dot: '#8A9BA6' },
  scheduled:   { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)',   dot: '#2563eb' },
  in_progress: { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)',    dot: '#f59e0b' },
  completed:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
  cancelled:   { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)',   dot: '#dc2626' },
  invoiced:    { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)',  dot: '#7c3aed' },
  paid:        { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

interface ChecklistItem { label: string; completed: boolean; completed_by: string | null; completed_at: string | null }

interface Props {
  job: {
    id: string; job_number: string; title: string; description: string | null; status: string; job_type: string
    scheduled_start: string | null; scheduled_end: string | null; actual_start: string | null; actual_end: string | null
    assigned_users: string[]; checklist: ChecklistItem[]; instructions: string | null
    photos: { url: string; caption: string | null }[]
    materials_used: { name: string; qty: number; unit_price: number; subtotal: number }[]
    total_hours: number | null
    contacts: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }[] | null
    properties: { id: string; label: string | null; address_line1: string; suburb: string; state: string; postcode: string; lat: number | null; lng: number | null; access_notes: string | null }[] | null
    quotes: { id: string; quote_number: string; total: number; status: string }[] | null
    invoices: { id: string; invoice_number: string; total: number; status: string }[] | null
  }
  teamMembers: { id: string; full_name: string; role: string; phone: string | null }[]
  timesheets: { id: string; user_id: string; clocked_in_at: string; clocked_out_at: string | null; total_minutes: number | null; clock_in_address: string | null; clock_out_address: string | null }[]
  jobNotes: { id: string; content: string; note_type: 'text' | 'photo' | 'signature'; created_by_name: string | null; created_at: string }[]
  currentUserId: string
  userRole: string
  myActiveTimesheet?: { id: string; clocked_in_at: string } | null
}

const C = {
  card: { backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)', boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.04)' } as React.CSSProperties,
  label: { color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const },
  text: { color: '#1C2A35', fontSize: 13 },
  muted: { color: '#8A9BA6', fontSize: 12 },
  divider: { borderTop: '1px solid rgba(44,62,80,0.08)' },
}

export function JobDetail({ job, teamMembers, timesheets, jobNotes, currentUserId, userRole, myActiveTimesheet }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job.checklist ?? [])
  const [status, setStatus] = useState(job.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const contact = Array.isArray(job.contacts) ? job.contacts[0] : job.contacts
  const property = Array.isArray(job.properties) ? job.properties[0] : job.properties
  const quote = Array.isArray(job.quotes) ? job.quotes[0] : job.quotes
  const invoice = Array.isArray(job.invoices) ? job.invoices[0] : job.invoices
  const stepIndex = STATUS_STEPS.indexOf(status)
  const completedChecklist = checklist.filter(i => i.completed).length
  const totalTimesheetMinutes = timesheets.reduce((sum, t) => sum + (t.total_minutes ?? 0), 0)
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.draft

  async function toggleChecklistItem(index: number) {
    const updated = checklist.map((item, i) => i === index ? {
      ...item, completed: !item.completed,
      completed_by: !item.completed ? (teamMembers.find(m => m.id === currentUserId)?.full_name ?? null) : null,
      completed_at: !item.completed ? new Date().toISOString() : null,
    } : item)
    setChecklist(updated)
    const { error } = await supabase.from('jobs').update({ checklist: updated }).eq('id', job.id)
    if (error) toast.error('Failed to update checklist')
  }

  async function deleteJob() {
    if (!confirm('Delete this job? This cannot be undone.')) return
    const { error } = await supabase.from('jobs').delete().eq('id', job.id)
    if (error) { toast.error('Failed to delete job'); return }
    toast.success('Job deleted'); router.push('/jobs')
  }

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true); setStatus(newStatus)
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id)
    if (error) { toast.error('Failed to update status'); setStatus(job.status) }
    else { toast.success(`Job marked as ${newStatus.replace('_', ' ')}`); router.refresh() }
    setUpdatingStatus(false)
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <Link href="/jobs" style={{ color: '#8A9BA6' }} className="inline-flex items-center gap-1.5 text-xs hover:text-[#2C3E50] transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />Back to jobs
      </Link>

      {/* Header card */}
      <div style={C.card} className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: '#8A9BA6', fontFamily: 'monospace', fontSize: 11 }}>{job.job_number}</span>
              {job.job_type === 'recurring' && (
                <span style={{ color: '#76A58F', fontSize: 9, letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '1px 6px' }} className="uppercase">Recurring</span>
              )}
              <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px' }} className="uppercase">{status.replace('_', ' ')}</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 28, fontWeight: 300, lineHeight: 1.2 }}>{job.title}</h1>
            {job.description && <p style={C.muted} className="mt-1.5">{job.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <JobSummaryButton jobId={job.id} />
            {['admin', 'manager'].includes(userRole) && (
              <button onClick={deleteJob} style={{ color: '#dc2626' }} className="w-8 h-8 flex items-center justify-center hover:bg-red-50 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div style={C.divider} className="pt-4">
          <p style={C.label} className="mb-3">Progress</p>
          <div className="flex items-center gap-0 overflow-x-auto">
            {STATUS_STEPS.map((s, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              const isClickable = userRole !== 'field' || s === 'in_progress' || s === 'completed'
              const sStyle = STATUS_STYLE[s]
              return (
                <div key={s} className="flex items-center">
                  <button
                    onClick={() => isClickable && updateStatus(s)}
                    disabled={updatingStatus || !isClickable}
                    style={isActive
                      ? { backgroundColor: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}`, letterSpacing: '0.08em' }
                      : isDone
                      ? { color: '#76A58F', letterSpacing: '0.08em' }
                      : { color: isClickable ? '#8A9BA6' : 'rgba(44,62,80,0.2)', letterSpacing: '0.08em' }
                    }
                    className="px-3 py-1.5 text-[10px] uppercase font-normal whitespace-nowrap transition-all hover:opacity-80 disabled:pointer-events-none"
                  >
                    {isDone && !isActive && <span className="mr-1">✓</span>}
                    {s.replace('_', ' ')}
                  </button>
                  {i < STATUS_STEPS.length - 1 && (
                    <div style={{ width: 20, height: 1, backgroundColor: i < stepIndex ? '#76A58F' : 'rgba(44,62,80,0.12)', margin: '0 2px' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Checklist */}
          <div style={C.card} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <p style={C.label}>Checklist</p>
                {checklist.length > 0 && <span style={{ color: '#4A5A65', fontSize: 11 }}>{completedChecklist}/{checklist.length}</span>}
              </div>
              {checklist.length > 0 && (
                <div style={{ width: 80, height: 2, backgroundColor: 'rgba(44,62,80,0.1)' }} className="overflow-hidden">
                  <div style={{ width: `${(completedChecklist / checklist.length) * 100}%`, height: '100%', backgroundColor: '#76A58F', transition: 'width 300ms ease' }} />
                </div>
              )}
            </div>
            {checklist.length === 0
              ? <p style={C.muted}>No checklist items</p>
              : <div className="space-y-1">
                  {checklist.map((item, i) => (
                    <button key={i} onClick={() => toggleChecklistItem(i)}
                      style={{ borderBottom: '1px solid rgba(44,62,80,0.05)' }}
                      className="flex items-start gap-3 w-full text-left p-2.5 hover:bg-[#F5F0EB] transition-colors group">
                      {item.completed
                        ? <CheckSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#76A58F' }} />
                        : <Square className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'rgba(44,62,80,0.2)' }} />}
                      <div className="flex-1 min-w-0">
                        <span style={{ color: item.completed ? '#8A9BA6' : '#1C2A35', fontSize: 13, textDecoration: item.completed ? 'line-through' : 'none' }}>{item.label}</span>
                        {item.completed && item.completed_by && (
                          <p style={{ color: '#8A9BA6', fontSize: 10, marginTop: 2 }}>{item.completed_by} · {item.completed_at ? formatDateTime(item.completed_at) : ''}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Instructions */}
          {job.instructions && (
            <div style={C.card} className="p-5">
              <p style={C.label} className="mb-3">Instructions</p>
              <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6 }} className="whitespace-pre-wrap">{job.instructions}</p>
            </div>
          )}

          {/* Photos */}
          <div style={C.card} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={C.label}>Photos ({job.photos?.length ?? 0})</p>
              <button style={{ color: '#76A58F', fontSize: 10, letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '4px 10px' }} className="uppercase hover:opacity-70 transition-opacity flex items-center gap-1.5">
                <Camera className="w-3 h-3" />Add
              </button>
            </div>
            {!job.photos || job.photos.length === 0
              ? <div style={{ border: '2px dashed rgba(44,62,80,0.1)', padding: '2rem' }} className="text-center">
                  <Camera className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(44,62,80,0.15)' }} />
                  <p style={C.muted}>No photos yet</p>
                </div>
              : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {job.photos.map((photo, i) => (
                    <div key={i} className="aspect-square overflow-hidden relative" style={{ backgroundColor: '#EDE8E2' }}>
                      <Image
                        src={jobPhotoSrc(photo.url)}
                        alt={photo.caption ?? `Photo ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        priority={i === 0}
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Materials */}
          {job.materials_used && job.materials_used.length > 0 && (
            <div style={C.card} className="p-5">
              <p style={C.label} className="mb-3">Materials Used</p>
              <div className="space-y-px">
                {job.materials_used.map((m, i) => (
                  <div key={i} style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }} className="flex items-center justify-between px-2 py-2.5">
                    <span style={C.text}>{m.name}</span>
                    <div className="flex items-center gap-6">
                      <span style={C.muted}>×{m.qty}</span>
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 16 }}>{formatCurrency(m.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clock widget */}
          <ClockWidget jobId={job.id} jobTitle={job.title} activeTimesheet={myActiveTimesheet} />

          {/* Job Notes */}
          <Suspense fallback={<div style={C.card} className="p-5"><p style={C.muted}>Loading notes...</p></div>}>
            <JobNotes
              jobId={job.id}
              notes={jobNotes}
              onNoteAdded={(note) => {
                window.location.reload()
              }}
              canEdit={userRole !== 'client'}
            />
          </Suspense>

          {/* Time logs */}
          <div style={C.card} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={C.label}>Time Logs</p>
              {totalTimesheetMinutes > 0 && (
                <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 18 }}>{formatMinutes(totalTimesheetMinutes)}</span>
              )}
            </div>
            {timesheets.length === 0
              ? <p style={C.muted}>No time logged yet</p>
              : <div className="space-y-px">
                  {timesheets.map((t, idx) => {
                    const member = teamMembers.find(m => m.id === t.user_id)
                    const initials = member ? member.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'
                    const col = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                    return (
                      <div key={t.id} style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', backgroundColor: idx % 2 === 0 ? '#fff' : '#FAFAF8' }} className="flex items-center gap-3 px-2 py-3">
                        <div style={{ width: 28, height: 28, backgroundColor: col.bg, color: col.color, fontSize: 10, fontWeight: 500, flexShrink: 0 }} className="flex items-center justify-center">{initials}</div>
                        <div className="flex-1">
                          <p style={C.text} className="font-medium">{member?.full_name ?? 'Unknown'}</p>
                          <p style={C.muted}>{formatDateTime(t.clocked_in_at)} → {t.clocked_out_at ? formatDateTime(t.clocked_out_at) : 'Active'}</p>
                        </div>
                        <div className="flex items-center gap-1.5" style={{ color: '#4A5A65', fontSize: 13 }}>
                          <Timer className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
                          {formatMinutes(t.total_minutes)}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Client */}
          {contact && (
            <div style={C.card} className="p-4">
              <p style={C.label} className="mb-3">Client</p>
              <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 group mb-3">
                <div style={{ width: 36, height: 36, backgroundColor: 'rgba(118,165,143,0.12)', color: '#5d8c76', fontSize: 13, fontWeight: 500, flexShrink: 0 }} className="flex items-center justify-center">
                  {contact.first_name[0]}{contact.last_name[0]}
                </div>
                <p style={{ color: '#1C2A35', fontSize: 14, fontWeight: 500 }} className="group-hover:text-[#76A58F] transition-colors">{contact.first_name} {contact.last_name}</p>
              </Link>
              <div className="space-y-2" style={C.divider}>
                <div className="pt-3 space-y-2">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={C.muted} className="flex items-center gap-2 hover:text-[#2C3E50] transition-colors">
                      <Phone className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />{contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={C.muted} className="flex items-center gap-2 hover:text-[#2C3E50] transition-colors truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: '#8A9BA6' }} /><span className="truncate">{contact.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Property */}
          {property && (
            <div style={C.card} className="p-4">
              <p style={C.label} className="mb-3">Location</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#76A58F' }} />
                <div>
                  <p style={C.text}>{property.address_line1}</p>
                  <p style={C.muted}>{property.suburb} {property.state} {property.postcode}</p>
                </div>
              </div>
              {property.access_notes && (
                <div style={{ backgroundColor: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)', marginTop: 10, padding: '8px 10px' }}>
                  <p style={{ color: '#b45309', fontSize: 11 }}>🔑 {property.access_notes}</p>
                </div>
              )}
              {property.lat && property.lng && (
                <a href={`https://maps.google.com/?q=${property.lat},${property.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#76A58F', fontSize: 11, letterSpacing: '0.08em', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }} className="uppercase hover:opacity-70 transition-opacity">
                  <ExternalLink className="w-3 h-3" />Open in Maps
                </a>
              )}
            </div>
          )}

          {/* Schedule */}
          <div style={C.card} className="p-4">
            <p style={C.label} className="mb-3">Schedule</p>
            <div className="space-y-2">
              {[
                { label: 'Scheduled', value: job.scheduled_start ? formatDate(job.scheduled_start) : null },
                { label: 'Started',   value: job.actual_start ? formatDateTime(job.actual_start) : null },
                { label: 'Finished',  value: job.actual_end ? formatDateTime(job.actual_end) : null },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between items-center" style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', paddingBottom: 6 }}>
                  <span style={C.muted}>{r.label}</span>
                  <span style={C.text}>{r.value}</span>
                </div>
              ))}
              {totalTimesheetMinutes > 0 && (
                <div className="flex justify-between items-center pt-1">
                  <span style={C.muted}>Total time</span>
                  <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 18 }}>{formatMinutes(totalTimesheetMinutes)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Crew */}
          <div style={C.card} className="p-4">
            <p style={C.label} className="mb-3">Crew</p>
            {job.assigned_users.length === 0
              ? <p style={C.muted}>No crew assigned</p>
              : <div className="space-y-2">
                  {job.assigned_users.map((uid, idx) => {
                    const m = teamMembers.find(t => t.id === uid)
                    if (!m) return null
                    const col = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                    const initials = m.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                    return (
                      <div key={uid} className="flex items-center gap-2.5">
                        <div style={{ width: 28, height: 28, backgroundColor: col.bg, color: col.color, fontSize: 10, fontWeight: 500, flexShrink: 0 }} className="flex items-center justify-center">{initials}</div>
                        <div>
                          <p style={C.text}>{m.full_name}</p>
                          <p style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{m.role}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Documents */}
          {(quote || invoice) && (
            <div style={C.card} className="p-4">
              <p style={C.label} className="mb-3">Documents</p>
              <div className="space-y-1">
                {quote && (
                  <Link href={`/quotes/${quote.id}`} style={{ borderBottom: '1px solid rgba(44,62,80,0.06)' }} className="flex items-center justify-between py-2.5 hover:bg-[#F5F0EB] px-1 group transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
                      <span style={C.text} className="group-hover:text-[#76A58F] transition-colors">{quote.quote_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 15 }}>{formatCurrency(quote.total)}</span>
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
                    </div>
                  </Link>
                )}
                {invoice && (
                  <Link href={`/invoices/${invoice.id}`} className="flex items-center justify-between py-2.5 hover:bg-[#F5F0EB] px-1 group transition-colors">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
                      <span style={C.text} className="group-hover:text-[#76A58F] transition-colors">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 15 }}>{formatCurrency(invoice.total)}</span>
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: '#8A9BA6' }} />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {status === 'completed' && !invoice && (
              <button style={{ backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em', width: '100%', padding: '10px 16px', fontSize: 11 }} className="uppercase flex items-center justify-center gap-2 hover:opacity-80 transition-opacity">
                <Receipt className="w-3.5 h-3.5" />Create Invoice
              </button>
            )}
            <Link href={`/clock?job=${job.id}`} style={{ display: 'block' }}>
              <button style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', letterSpacing: '0.1em', width: '100%', padding: '10px 16px', fontSize: 11, backgroundColor: '#fff' }} className="uppercase flex items-center justify-center gap-2 hover:bg-[#F5F0EB] transition-colors">
                <Clock className="w-3.5 h-3.5" />Clock In/Out
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
