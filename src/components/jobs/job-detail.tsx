'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, formatDateTime, formatMinutes } from '@/lib/format'
import { jobPhotoSrc, procedurePhotoSrc } from '@/lib/photo-url'
import { ClockWidget } from '@/components/timeclock/clock-widget'
import { ChevronLeft, MapPin, Phone, Mail, Clock, Camera, CheckSquare, Square, Check, CheckCircle, Pin, FileText, Receipt, ExternalLink, Timer, Trash2, ChevronRight, ClipboardCheck } from 'lucide-react'

const CLEAN_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular Clean' },
  { value: 'deep', label: 'Deep Clean' },
  { value: 'airbnb', label: 'Airbnb / Turnover' },
]
const AREA_LABELS: Record<string, string> = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom', living: 'Living',
  laundry: 'Laundry', floors: 'Floors & Finishing', turnover: 'Turnover', general: 'General',
}
const AREA_ORDER = ['kitchen', 'bathroom', 'bedroom', 'living', 'laundry', 'floors', 'turnover', 'general']

interface ProcedureStep { id: string; area: string; order_index: number; title: string; description: string | null; is_required: boolean; reference_photo_path: string | null }
interface ProcedureProgress { id: string; step_id: string; completed: boolean; completed_by: string | null; completed_at: string | null; proof_photo_path: string | null }
interface Procedure { id: string; clean_type: string; title: string }

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
    clean_type: string | null
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
  procedure: Procedure | null
  procedureSteps: ProcedureStep[]
  procedureProgress: ProcedureProgress[]
  propertyNotes: PropertyNote[]
  propertyId: string | null
}

interface PropertyNote { id: string; step_id: string; note: string }

const C = {
  card: { backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)', boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.04)' } as React.CSSProperties,
  label: { color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const },
  text: { color: '#1C2A35', fontSize: 13 },
  muted: { color: '#8A9BA6', fontSize: 12 },
  divider: { borderTop: '1px solid rgba(44,62,80,0.08)' },
}

export function JobDetail({ job, teamMembers, timesheets, jobNotes, currentUserId, userRole, myActiveTimesheet, procedure, procedureSteps, procedureProgress, propertyNotes, propertyId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job.checklist ?? [])
  const [status, setStatus] = useState(job.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [progress, setProgress] = useState<ProcedureProgress[]>(procedureProgress ?? [])
  const [savingCleanType, setSavingCleanType] = useState(false)
  const [notes, setNotes] = useState<PropertyNote[]>(propertyNotes ?? [])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const procFileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function saveNote(stepId: string) {
    if (!propertyId) { toast.error('This job has no property — add one first'); return }
    const text = noteDraft.trim()
    setSavingNote(true)
    if (!text) {
      // clearing an existing note
      const res = await fetch(`/api/properties/${propertyId}/procedure-notes/${stepId}`, { method: 'DELETE' })
      setSavingNote(false)
      if (!res.ok) { toast.error('Failed to remove note'); return }
      setNotes(prev => prev.filter(n => n.step_id !== stepId))
      setEditingNote(null); toast.success('Note removed')
      return
    }
    const res = await fetch(`/api/properties/${propertyId}/procedure-notes/${stepId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: text }),
    })
    const data = await res.json()
    setSavingNote(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to save note'); return }
    setNotes(prev => [...prev.filter(n => n.step_id !== stepId), { id: data.id, step_id: stepId, note: text }])
    setEditingNote(null); toast.success('Note saved for this property')
  }

  function startEditNote(stepId: string) {
    setNoteDraft(notes.find(n => n.step_id === stepId)?.note ?? '')
    setEditingNote(stepId)
  }

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
    if (newStatus === 'completed') {
      const requiredSteps = procedureSteps.filter(s => s.is_required)
      const incomplete = requiredSteps.filter(s => !progress.find(p => p.step_id === s.id)?.completed)
      if (incomplete.length > 0) {
        toast.error(`Complete ${incomplete.length} required cleaning procedure step${incomplete.length === 1 ? '' : 's'} before finishing this job`)
        return
      }
    }
    setUpdatingStatus(true); setStatus(newStatus)
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id)
    if (error) { toast.error(error.message.includes('cleaning procedure') ? error.message : 'Failed to update status'); setStatus(job.status) }
    else { toast.success(`Job marked as ${newStatus.replace('_', ' ')}`); router.refresh() }
    setUpdatingStatus(false)
  }

  async function toggleProcedureStep(stepId: string) {
    const current = progress.find(p => p.step_id === stepId)
    const nextCompleted = !current?.completed
    if (nextCompleted && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15)
    const optimistic: ProcedureProgress = {
      id: current?.id ?? stepId, step_id: stepId, completed: nextCompleted,
      completed_by: nextCompleted ? currentUserId : null,
      completed_at: nextCompleted ? new Date().toISOString() : null,
      proof_photo_path: current?.proof_photo_path ?? null,
    }
    setProgress(prev => [...prev.filter(p => p.step_id !== stepId), optimistic])
    const res = await fetch(`/api/jobs/${job.id}/procedure-steps/${stepId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: nextCompleted }),
    })
    if (!res.ok) { toast.error('Failed to update step'); setProgress(procedureProgress) }
  }

  async function uploadProofPhoto(stepId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/jobs/${job.id}/procedure-steps/${stepId}/photo`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
    setProgress(prev => [...prev.filter(p => p.step_id !== stepId), data])
    toast.success('Proof photo uploaded')
  }

  async function setCleanType(v: string) {
    if (!v) return
    setSavingCleanType(true)
    const { error } = await supabase.from('jobs').update({ clean_type: v }).eq('id', job.id)
    setSavingCleanType(false)
    if (error) { toast.error('Failed to set clean type'); return }
    toast.success('Cleaning procedure attached'); router.refresh()
  }

  const requiredStepCount = procedureSteps.filter(s => s.is_required).length
  const completedRequiredCount = procedureSteps.filter(s => s.is_required && progress.find(p => p.step_id === s.id)?.completed).length
  const allRequiredDone = requiredStepCount > 0 && completedRequiredCount === requiredStepCount
  const canComplete = ['in_progress', 'scheduled', 'draft'].includes(status)
  const proofPhotos = procedureSteps
    .map(s => ({ step: s, p: progress.find(pr => pr.step_id === s.id) }))
    .filter(x => x.p?.proof_photo_path)
  const totalCompletedSteps = procedureSteps.filter(s => progress.find(p => p.step_id === s.id)?.completed).length
  const showCompletionRecord = !!procedure && (status === 'completed' || status === 'invoiced' || status === 'paid') && totalCompletedSteps > 0
  const groupedProcedureSteps = AREA_ORDER
    .map(area => ({ area, steps: procedureSteps.filter(s => s.area === area).sort((a, b) => a.order_index - b.order_index) }))
    .filter(g => g.steps.length > 0)

  async function createInvoice() {
    setCreatingInvoice(true)
    const res = await fetch(`/api/jobs/${job.id}/invoice`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (!res.ok && res.status !== 409) {
      toast.error(data?.error ?? 'Failed to create invoice')
      setCreatingInvoice(false)
      return
    }
    if (data?.warning) toast.warning(data.warning)
    else toast.success('Invoice created')
    router.push(`/invoices/${data.id}`)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <style>{`
        @keyframes proc-tick-pop { 0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        .proc-tick { animation: proc-tick-pop 200ms cubic-bezier(0.34,1.56,0.64,1) }
      `}</style>
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

          {/* Cleaning Procedure */}
          {job.clean_type === null ? (
            ['admin', 'manager'].includes(userRole) && (
              <div style={C.card} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4" style={{ color: '#8A9BA6' }} />
                  <p style={C.label}>Cleaning Procedure</p>
                </div>
                <p style={C.muted} className="mb-3">No clean type set — attach a standard procedure checklist to this job.</p>
                <div style={{ maxWidth: 220 }}>
                  <Select<string> onValueChange={v => setCleanType(v ?? '')} disabled={savingCleanType}>
                    <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#1C2A35', fontSize: 12 }} className="rounded-none">
                      <SelectValue placeholder="Select clean type…" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)' }} className="rounded-none">
                      {CLEAN_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} style={{ color: '#1C2A35', fontSize: 12 }}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          ) : !procedure ? (
            <div style={C.card} className="p-5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" style={{ color: '#8A9BA6' }} />
                <p style={C.label}>Cleaning Procedure</p>
              </div>
              <p style={C.muted} className="mt-2">No active procedure configured for this clean type yet — set one up in Admin → Procedures.</p>
            </div>
          ) : (
            <div style={C.card} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="w-4 h-4" style={{ color: allRequiredDone ? '#76A58F' : '#8A9BA6' }} />
                  <p style={C.label}>{procedure.title}</p>
                  {requiredStepCount > 0 && (
                    allRequiredDone
                      ? <span style={{ color: '#76A58F', fontSize: 11, fontWeight: 500 }}>✓ Ready to complete</span>
                      : <span style={{ color: '#4A5A65', fontSize: 11 }}>{completedRequiredCount}/{requiredStepCount} required</span>
                  )}
                </div>
                {requiredStepCount > 0 && (
                  <div style={{ width: 80, height: 3, backgroundColor: 'rgba(44,62,80,0.1)', borderRadius: 2 }} className="overflow-hidden">
                    <div style={{ width: `${(completedRequiredCount / requiredStepCount) * 100}%`, height: '100%', backgroundColor: '#76A58F', transition: 'width 350ms cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                )}
              </div>
              {groupedProcedureSteps.length === 0
                ? <p style={C.muted}>No steps in this procedure yet</p>
                : groupedProcedureSteps.map(({ area, steps }) => (
                    <div key={area} className="mb-3">
                      <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{AREA_LABELS[area]}</p>
                      <div className="space-y-0.5">
                        {steps.map(step => {
                          const p = progress.find(pr => pr.step_id === step.id)
                          const done = p?.completed ?? false
                          const note = notes.find(n => n.step_id === step.id)
                          const isEditing = editingNote === step.id
                          return (
                            <div key={step.id} style={{ borderBottom: '1px solid rgba(44,62,80,0.05)' }} className="py-1">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleProcedureStep(step.id)}
                                  aria-pressed={done}
                                  className="flex-1 flex items-center gap-3 text-left py-2 pl-1 pr-2 min-h-[48px] active:bg-[#F5F0EB] transition-colors">
                                  <span
                                    aria-hidden
                                    style={{
                                      width: 28, height: 28, flexShrink: 0, borderRadius: 6,
                                      border: done ? '2px solid #76A58F' : '2px solid rgba(44,62,80,0.2)',
                                      backgroundColor: done ? '#76A58F' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'all 160ms cubic-bezier(0.34,1.56,0.64,1)',
                                    }}>
                                    {done && <Check className="w-4 h-4 proc-tick" strokeWidth={3} style={{ color: '#fff' }} />}
                                  </span>
                                  {step.reference_photo_path && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={procedurePhotoSrc(step.reference_photo_path)} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(44,62,80,0.09)', flexShrink: 0 }} />
                                  )}
                                  <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2 flex-wrap">
                                      <span style={{ color: done ? '#8A9BA6' : '#1C2A35', fontSize: 14, textDecoration: done ? 'line-through' : 'none', transition: 'color 160ms ease' }}>{step.title}</span>
                                      {!step.is_required && <span style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.06em', border: '1px solid rgba(44,62,80,0.09)', padding: '1px 5px' }} className="uppercase">Optional</span>}
                                    </span>
                                    {done && p?.completed_at && (
                                      <span style={{ color: '#8A9BA6', fontSize: 10, marginTop: 2 }} className="block">{formatDateTime(p.completed_at)}{p.proof_photo_path ? ' · proof attached' : ''}</span>
                                    )}
                                  </span>
                                </button>
                                <input ref={el => { procFileInputs.current[step.id] = el }} type="file" accept="image/*" hidden
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadProofPhoto(step.id, f); e.target.value = '' }} />
                                <button onClick={() => procFileInputs.current[step.id]?.click()} title="Add proof photo"
                                  style={{ color: p?.proof_photo_path ? '#76A58F' : '#8A9BA6' }}
                                  className="shrink-0 w-11 h-11 flex items-center justify-center hover:text-[#76A58F] active:bg-[#F5F0EB] transition-colors">
                                  <Camera className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Per-property pinned note */}
                              {isEditing ? (
                                <div className="ml-1 mr-2 mb-2 mt-0.5">
                                  <textarea
                                    value={noteDraft}
                                    onChange={e => setNoteDraft(e.target.value)}
                                    autoFocus
                                    rows={2}
                                    placeholder="Property-specific note (e.g. BBQ key in 3rd drawer)…"
                                    style={{ width: '100%', border: '1px solid rgba(118,165,143,0.5)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#1C2A35', outline: 'none', resize: 'none', backgroundColor: '#FCFBF9' }} />
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <button onClick={() => saveNote(step.id)} disabled={savingNote}
                                      style={{ backgroundColor: '#76A58F', color: '#fff', fontSize: 11, letterSpacing: '0.05em', padding: '5px 12px', borderRadius: 4 }}
                                      className="uppercase disabled:opacity-50">{savingNote ? 'Saving…' : 'Save'}</button>
                                    <button onClick={() => setEditingNote(null)} disabled={savingNote}
                                      style={{ color: '#8A9BA6', fontSize: 11, letterSpacing: '0.05em', padding: '5px 8px' }} className="uppercase">Cancel</button>
                                  </div>
                                </div>
                              ) : note ? (
                                <button onClick={() => startEditNote(step.id)}
                                  style={{ backgroundColor: 'rgba(118,165,143,0.1)', border: '1px solid rgba(118,165,143,0.25)', borderRadius: 6 }}
                                  className="ml-1 mr-2 mb-2 mt-0.5 flex items-start gap-2 w-[calc(100%-12px)] text-left px-2.5 py-2 hover:bg-[rgba(118,165,143,0.16)] transition-colors">
                                  <Pin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#76A58F' }} />
                                  <span style={{ color: '#3E5348', fontSize: 12.5, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{note.note}</span>
                                </button>
                              ) : (
                                <button onClick={() => startEditNote(step.id)}
                                  style={{ color: '#8A9BA6', fontSize: 11 }}
                                  className="ml-1 mb-1.5 mt-0.5 inline-flex items-center gap-1 hover:text-[#76A58F] transition-colors">
                                  <Pin className="w-3 h-3" /> Add property note
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
              }
              {allRequiredDone && canComplete && (
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={updatingStatus}
                  style={{ backgroundColor: '#76A58F', color: '#fff', letterSpacing: '0.08em' }}
                  className="w-full mt-3 py-3 text-xs uppercase font-medium transition-opacity hover:opacity-90 disabled:opacity-50">
                  {updatingStatus ? 'Completing…' : '✓ Complete Job'}
                </button>
              )}
            </div>
          )}

          {/* Completion Record — dispute-proof photo evidence, internal */}
          {showCompletionRecord && (
            <div style={{ ...C.card, borderColor: 'rgba(118,165,143,0.3)' }} className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4" style={{ color: '#76A58F' }} />
                <p style={C.label}>Completion Record</p>
              </div>
              <p style={{ color: '#3E5348', fontSize: 12.5 }} className="mb-4">
                {totalCompletedSteps} step{totalCompletedSteps === 1 ? '' : 's'} completed
                {proofPhotos.length > 0 ? ` · ${proofPhotos.length} documented with photos` : ' · no proof photos captured'}
                {procedure && ` · ${procedure.title}`}
              </p>
              {proofPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {proofPhotos.map(({ step, p }) => (
                    <a key={step.id} href={procedurePhotoSrc(p!.proof_photo_path!)} target="_blank" rel="noreferrer"
                      className="block group">
                      <div style={{ aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(44,62,80,0.1)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={procedurePhotoSrc(p!.proof_photo_path!)} alt={step.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          className="group-hover:opacity-90 transition-opacity" />
                      </div>
                      <p style={{ color: '#4A5A65', fontSize: 11, lineHeight: 1.3 }} className="mt-1.5 line-clamp-2">{step.title}</p>
                      {p!.completed_at && <p style={{ color: '#8A9BA6', fontSize: 10 }}>{formatDateTime(p!.completed_at)}</p>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

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
              onNoteAdded={() => {
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
            {status === 'completed' && !invoice && ['admin', 'manager'].includes(userRole) && (
              <button onClick={createInvoice} disabled={creatingInvoice} style={{ backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em', width: '100%', padding: '10px 16px', fontSize: 11 }} className="uppercase flex items-center justify-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50">
                <Receipt className="w-3.5 h-3.5" />{creatingInvoice ? 'Creating…' : 'Create Invoice'}
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
