'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Zap, ArrowDown } from 'lucide-react'

interface Stage { id: string; name: string; color: string }
interface Step { id: string; type: string; config: Record<string, unknown> }
interface Workflow {
  id: string; name: string; description: string | null; is_active: boolean
  trigger_type: string; trigger_conditions: Record<string, unknown>
  steps: Step[]; stats: Record<string, unknown>; created_at: string
}
interface Props { workflow: Workflow | null; stages: Stage[]; orgId: string; onSaved: (workflow: Workflow) => void; onCancel: () => void }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const TRIGGERS = [
  { value: 'contact_stage_change', label: 'Contact moves to a stage' },
  { value: 'contact_created',      label: 'New contact created' },
  { value: 'job_status_change',    label: 'Job status changes' },
  { value: 'job_completed',        label: 'Job marked completed' },
  { value: 'new_quote',            label: 'New quote created' },
  { value: 'invoice_overdue',      label: 'Invoice becomes overdue' },
]

const ACTIONS = [
  { value: 'send_sms',     label: 'Send SMS' },
  { value: 'wait',         label: 'Wait' },
  { value: 'update_stage', label: 'Move contact to stage' },
  { value: 'create_note',  label: 'Add a note to contact' },
]

const JOB_STATUSES = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']

function uid() { return Math.random().toString(36).slice(2, 10) }

function StepCard({ step, stages, onUpdate, onDelete, index }: { step: Step; stages: Stage[]; onUpdate: (s: Step) => void; onDelete: () => void; index: number }) {
  function setConfig(key: string, value: unknown) { onUpdate({ ...step, config: { ...step.config, [key]: value } }) }

  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: 'rgba(118,165,143,0.15)', color: C.sage, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
            {index + 1}
          </span>
          <select value={step.type} onChange={e => onUpdate({ ...step, type: e.target.value, config: {} })}
            style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: 12 }}>
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <button onClick={onDelete} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          className="hover:opacity-70 transition-opacity">
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {step.type === 'send_sms' && (
        <div className="space-y-1">
          <textarea value={(step.config.message as string) ?? ''} onChange={e => setConfig('message', e.target.value)}
            placeholder="Message text… Use {{first_name}}, {{last_name}}, {{job_title}}" rows={3}
            style={{ ...inp, resize: 'none' }} />
          <p style={{ color: C.muted, fontSize: 10 }}>Variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{job_title}}'}</p>
        </div>
      )}

      {step.type === 'wait' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} value={(step.config.days as number) ?? 1}
            onChange={e => setConfig('days', parseInt(e.target.value) || 1)}
            style={{ ...inp, width: 64, padding: '5px 8px' }} />
          <span style={{ color: C.muted, fontSize: 12 }}>day(s) before next action</span>
        </div>
      )}

      {step.type === 'update_stage' && (
        <select value={(step.config.stageId as string) ?? ''} onChange={e => setConfig('stageId', e.target.value)}
          style={inp}>
          <option value="">Select stage…</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {step.type === 'create_note' && (
        <textarea value={(step.config.note as string) ?? ''} onChange={e => setConfig('note', e.target.value)}
          placeholder="Note text…" rows={2} style={{ ...inp, resize: 'none' }} />
      )}
    </div>
  )
}

export function WorkflowBuilder({ workflow, stages, orgId, onSaved, onCancel }: Props) {
  const [name, setName] = useState(workflow?.name ?? '')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [triggerType, setTriggerType] = useState(workflow?.trigger_type ?? 'contact_stage_change')
  const [triggerConditions, setTriggerConditions] = useState<Record<string, unknown>>(workflow?.trigger_conditions ?? {})
  const [steps, setSteps] = useState<Step[]>(workflow?.steps ?? [])
  const [saving, setSaving] = useState(false)

  function setCondition(key: string, value: unknown) { setTriggerConditions(prev => ({ ...prev, [key]: value })) }
  function addStep() { setSteps(prev => [...prev, { id: uid(), type: 'send_sms', config: {} }]) }
  function updateStep(id: string, step: Step) { setSteps(prev => prev.map(s => s.id === id ? step : s)) }
  function deleteStep(id: string) { setSteps(prev => prev.filter(s => s.id !== id)) }

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (steps.length === 0) { toast.error('Add at least one action'); return }
    setSaving(true)
    const res = await fetch('/api/automations/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: workflow?.id ?? null, name: name.trim(), description: description.trim() || null, triggerType, triggerConditions, steps }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to save')
    else { toast.success(workflow ? 'Automation updated' : 'Automation created'); onSaved(data.workflow) }
    setSaving(false)
  }

  const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ padding: '0 0 32px' }}>
      <div style={{ backgroundColor: C.cream, borderBottom: `1px solid ${C.border}`, padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onCancel} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          className="hover:opacity-70 transition-opacity">
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{workflow ? 'Edit automation' : 'New automation'}</h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Set a trigger and define what happens next</p>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 640 }} className="space-y-6">
        {/* Name */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
          <div>
            <label style={labelSt}>Automation name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome SMS for new leads" style={inp} />
          </div>
          <div>
            <label style={labelSt}>Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this automation do?" style={inp} />
          </div>
        </div>

        {/* Trigger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, backgroundColor: 'rgba(180,83,9,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: 14, height: 14, color: '#b45309' }} />
            </div>
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Trigger</p>
          </div>

          <div style={{ backgroundColor: '#fff', border: `1px solid rgba(180,83,9,0.2)`, padding: 16 }} className="space-y-3">
            <div>
              <label style={labelSt}>When this happens…</label>
              <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConditions({}) }} style={inp}>
                {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {triggerType === 'contact_stage_change' && (
              <div>
                <label style={labelSt}>Specifically when moved to…</label>
                <select value={(triggerConditions.stageId as string) ?? ''} onChange={e => setCondition('stageId', e.target.value)} style={inp}>
                  <option value="">Any stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {triggerType === 'job_status_change' && (
              <div>
                <label style={labelSt}>Specifically when status changes to…</label>
                <select value={(triggerConditions.status as string) ?? ''} onChange={e => setCondition('status', e.target.value)} style={inp}>
                  <option value="">Any status</option>
                  {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {steps.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown style={{ width: 16, height: 16, color: C.border }} />
          </div>
        )}

        {/* Actions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, backgroundColor: 'rgba(118,165,143,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: C.sage, fontSize: 12, fontWeight: 700 }}>→</span>
            </div>
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Actions</p>
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={step.id}>
                <StepCard step={step} stages={stages} index={i} onUpdate={s => updateStep(step.id, s)} onDelete={() => deleteStep(step.id)} />
                {i < steps.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <ArrowDown style={{ width: 14, height: 14, color: C.border }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={addStep}
            style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', border: `1px dashed rgba(44,62,80,0.2)`, color: C.muted, background: 'none', cursor: 'pointer', fontSize: 12 }}
            className="hover:opacity-70 transition-opacity">
            <Plus style={{ width: 13, height: 13 }} />Add action
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <button onClick={onCancel}
            style={{ padding: '7px 16px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
            className="uppercase hover:opacity-70 transition-opacity">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '7px 20px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            className="uppercase">
            {saving ? 'Saving…' : workflow ? 'Save changes' : 'Create automation'}
          </button>
        </div>
      </div>
    </div>
  )
}
