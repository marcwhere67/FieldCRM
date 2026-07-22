'use client'

import { useState, useRef } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Camera, X, CheckCircle } from 'lucide-react'
import { procedurePhotoSrc } from '@/lib/photo-url'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const CLEAN_TYPES = [
  { value: 'regular', label: 'Regular Clean' },
  { value: 'deep', label: 'Deep Clean' },
  { value: 'airbnb', label: 'Airbnb / Turnover' },
] as const

const AREAS = ['kitchen', 'bathroom', 'bedroom', 'living', 'laundry', 'floors', 'turnover', 'general'] as const
const AREA_LABELS: Record<string, string> = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom', living: 'Living',
  laundry: 'Laundry', floors: 'Floors & Finishing', turnover: 'Turnover', general: 'General',
}

interface ProcedureStep {
  id: string; procedure_id: string; area: string; order_index: number
  title: string; description: string | null; is_required: boolean
  reference_photo_path: string | null; status: string
}
interface Procedure {
  id: string; clean_type: string; title: string; description: string | null
  status: string; procedure_steps: ProcedureStep[]
}

interface Props { initialProcedures: Procedure[]; canManage: boolean }

export function ProceduresTab({ initialProcedures, canManage }: Props) {
  const [procedures, setProcedures] = useState<Procedure[]>(initialProcedures)
  const [showStepForm, setShowStepForm] = useState<{ procedureId: string; step: ProcedureStep | null } | null>(null)
  const [stepForm, setStepForm] = useState({ title: '', area: 'general', description: '', is_required: true })
  const [saving, setSaving] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  function activeSteps(p: Procedure) {
    return [...p.procedure_steps].filter(s => s.status === 'active').sort((a, b) => a.order_index - b.order_index)
  }

  async function createProcedure(cleanType: string, title: string) {
    const res = await fetch('/api/admin/procedures', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clean_type: cleanType, title, status: 'active' }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to create procedure'); return }
    setProcedures(prev => [...prev, { ...data, procedure_steps: [] }])
    toast.success('Procedure created')
  }

  function openAddStep(procedureId: string) {
    setStepForm({ title: '', area: 'general', description: '', is_required: true })
    setShowStepForm({ procedureId, step: null })
  }
  function openEditStep(procedureId: string, step: ProcedureStep) {
    setStepForm({ title: step.title, area: step.area, description: step.description ?? '', is_required: step.is_required })
    setShowStepForm({ procedureId, step })
  }

  async function handleSaveStep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!showStepForm || !stepForm.title.trim()) { toast.error('Title is required'); return }
    const { procedureId, step } = showStepForm
    setSaving(true)
    try {
      const url = step ? `/api/admin/procedures/${procedureId}/steps/${step.id}` : `/api/admin/procedures/${procedureId}/steps`
      const method = step ? 'PATCH' : 'POST'
      const body = step ? stepForm : { ...stepForm, order_index: (procedures.find(p => p.id === procedureId)?.procedure_steps.length ?? 0) + 1 }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProcedures(prev => prev.map(p => p.id !== procedureId ? p : {
        ...p,
        procedure_steps: step ? p.procedure_steps.map(s => s.id === step.id ? data : s) : [...p.procedure_steps, data],
      }))
      toast.success(step ? 'Step updated' : 'Step added')
      setShowStepForm(null)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleRequired(procedureId: string, step: ProcedureStep) {
    const res = await fetch(`/api/admin/procedures/${procedureId}/steps/${step.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_required: !step.is_required }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error('Update failed'); return }
    setProcedures(prev => prev.map(p => p.id !== procedureId ? p : { ...p, procedure_steps: p.procedure_steps.map(s => s.id === step.id ? data : s) }))
  }

  async function moveStep(procedureId: string, step: ProcedureStep, direction: -1 | 1) {
    const p = procedures.find(pr => pr.id === procedureId)
    if (!p) return
    const siblings = activeSteps(p).filter(s => s.area === step.area)
    const idx = siblings.findIndex(s => s.id === step.id)
    const neighbor = siblings[idx + direction]
    if (!neighbor) return
    const [a, b] = [step.order_index, neighbor.order_index]
    const [ra, rb] = await Promise.all([
      fetch(`/api/admin/procedures/${procedureId}/steps/${step.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_index: b }) }),
      fetch(`/api/admin/procedures/${procedureId}/steps/${neighbor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_index: a }) }),
    ])
    const [da, db] = await Promise.all([ra.json(), rb.json()])
    if (!ra.ok || !rb.ok) { toast.error('Reorder failed'); return }
    setProcedures(prev => prev.map(pr => pr.id !== procedureId ? pr : {
      ...pr, procedure_steps: pr.procedure_steps.map(s => s.id === da.id ? da : s.id === db.id ? db : s),
    }))
  }

  async function deleteStep(procedureId: string, stepId: string) {
    if (!confirm('Remove this step? Steps already used on jobs will be archived instead of deleted.')) return
    const res = await fetch(`/api/admin/procedures/${procedureId}/steps/${stepId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (!res.ok) { toast.error('Delete failed'); return }
    setProcedures(prev => prev.map(p => p.id !== procedureId ? p : {
      ...p,
      procedure_steps: data?.archived
        ? p.procedure_steps.map(s => s.id === stepId ? { ...s, status: 'archived' } : s)
        : p.procedure_steps.filter(s => s.id !== stepId),
    }))
    toast.success(data?.archived ? 'Step archived' : 'Step deleted')
  }

  async function uploadPhoto(procedureId: string, stepId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/admin/procedures/${procedureId}/steps/${stepId}/photo`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
    setProcedures(prev => prev.map(p => p.id !== procedureId ? p : { ...p, procedure_steps: p.procedure_steps.map(s => s.id === stepId ? data : s) }))
    toast.success('Reference photo uploaded')
  }

  return (
    <div className="space-y-5">
      <p style={{ color: C.muted, fontSize: 13 }}>Standardized checklists techs follow on the job — grouped by area, with reference photos and required/optional steps.</p>

      {CLEAN_TYPES.map(ct => {
        const procedure = procedures.find(p => p.clean_type === ct.value)
        if (!procedure) {
          return (
            <div key={ct.value} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '20px' }} className="flex items-center justify-between">
              <div>
                <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>{ct.label}</p>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>No procedure set up yet</p>
              </div>
              {canManage && (
                <button onClick={() => createProcedure(ct.value, ct.label)}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
                  <Plus style={{ width: 13, height: 13 }} />Create
                </button>
              )}
            </div>
          )
        }

        const steps = activeSteps(procedure)
        const grouped = AREAS.map(area => ({ area, steps: steps.filter(s => s.area === area) })).filter(g => g.steps.length > 0)

        return (
          <div key={procedure.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream }} className="flex items-center justify-between">
              <div>
                <p style={{ color: C.navy, fontSize: 15, fontWeight: 500 }}>{procedure.title}</p>
                <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{steps.length} active step{steps.length === 1 ? '' : 's'}</p>
              </div>
              {canManage && (
                <button onClick={() => openAddStep(procedure.id)}
                  style={{ border: `1px solid rgba(118,165,143,0.4)`, color: '#5d8c76', padding: '6px 12px', fontSize: 10, letterSpacing: '0.08em' }}
                  className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
                  <Plus style={{ width: 12, height: 12 }} />Add step
                </button>
              )}
            </div>

            {grouped.length === 0
              ? <p style={{ color: C.muted, fontSize: 12, padding: '16px 18px' }}>No steps yet</p>
              : grouped.map(({ area, steps: areaSteps }) => (
                  <div key={area} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '10px 18px 4px' }}>{AREA_LABELS[area]}</p>
                    {areaSteps.map((step, i) => (
                      <div key={step.id} style={{ padding: '8px 18px', borderTop: i === 0 ? 'none' : '1px solid rgba(44,62,80,0.04)' }} className="flex items-center gap-3">
                        {step.reference_photo_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={procedurePhotoSrc(step.reference_photo_path)} alt="" style={{ width: 34, height: 34, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 34, height: 34, border: `1px dashed rgba(44,62,80,0.15)`, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2">
                            <p style={{ color: C.fg, fontSize: 13 }}>{step.title}</p>
                            <button onClick={() => canManage && toggleRequired(procedure.id, step)}
                              disabled={!canManage}
                              style={{
                                fontSize: 9, letterSpacing: '0.06em', padding: '1px 6px', textTransform: 'uppercase',
                                border: `1px solid ${step.is_required ? 'rgba(217,119,6,0.3)' : C.border}`,
                                color: step.is_required ? '#b45309' : C.muted,
                                backgroundColor: step.is_required ? 'rgba(217,119,6,0.06)' : 'transparent',
                              }}>
                              {step.is_required ? 'Required' : 'Optional'}
                            </button>
                          </div>
                          {step.description && <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{step.description}</p>}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => moveStep(procedure.id, step, -1)} title="Move up" style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50]"><ArrowUp style={{ width: 12, height: 12 }} /></button>
                            <button onClick={() => moveStep(procedure.id, step, 1)} title="Move down" style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50]"><ArrowDown style={{ width: 12, height: 12 }} /></button>
                            <input ref={el => { fileInputs.current[step.id] = el }} type="file" accept="image/*" hidden
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(procedure.id, step.id, f); e.target.value = '' }} />
                            <button onClick={() => fileInputs.current[step.id]?.click()} title="Upload reference photo" style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#76A58F]"><Camera style={{ width: 13, height: 13 }} /></button>
                            <button onClick={() => openEditStep(procedure.id, step)} title="Edit" style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50]"><Edit2 style={{ width: 13, height: 13 }} /></button>
                            <button onClick={() => deleteStep(procedure.id, step.id)} title="Remove" style={{ color: C.muted, width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#dc2626]"><Trash2 style={{ width: 13, height: 13 }} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
            }
          </div>
        )
      })}

      {/* Step form modal */}
      {showStepForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
              <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{showStepForm.step ? 'Edit Step' : 'New Step'}</h3>
              <button onClick={() => setShowStepForm(null)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleSaveStep} style={{ padding: 20 }} className="space-y-4">
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Step title</label>
                <input value={stepForm.title} onChange={e => setStepForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Interior microwave cleaning" style={inp} className="focus:border-[#76A58F]" />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Area</label>
                <Select value={stepForm.area} onValueChange={v => setStepForm(f => ({ ...f, area: v ?? 'general' }))}>
                  <SelectTrigger style={{ height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12 }} className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="rounded-none">
                    {AREAS.map(a => <SelectItem key={a} value={a} style={{ color: C.fg, fontSize: 12 }}>{AREA_LABELS[a]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <textarea value={stepForm.description} onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} style={{ ...inp, resize: 'none', height: 'auto', lineHeight: 1.6 }} className="focus:border-[#76A58F]" />
              </div>
              <button type="button" onClick={() => setStepForm(f => ({ ...f, is_required: !f.is_required }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', width: '100%', textAlign: 'left', border: `1px solid ${stepForm.is_required ? 'rgba(217,119,6,0.35)' : C.border}`, backgroundColor: stepForm.is_required ? 'rgba(217,119,6,0.06)' : '#fff', fontSize: 12, color: stepForm.is_required ? '#b45309' : C.fg }}>
                <div style={{ width: 14, height: 14, border: stepForm.is_required ? '1px solid #b45309' : `1px solid ${C.muted}`, backgroundColor: stepForm.is_required ? '#b45309' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {stepForm.is_required && <CheckCircle style={{ width: 10, height: 10, color: '#fff' }} />}
                </div>
                Required to complete the job
              </button>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowStepForm(null)}
                  style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
                  className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : showStepForm.step ? 'Save Changes' : 'Add Step'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
