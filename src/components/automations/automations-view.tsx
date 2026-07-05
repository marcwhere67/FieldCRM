'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Zap, Play, Pause, Trash2, Edit2, CheckCircle, XCircle, Clock, Activity } from 'lucide-react'
import { WorkflowBuilder } from './workflow-builder'

interface Stage { id: string; name: string; color: string }
interface Step { id: string; type: string; config: Record<string, unknown> }
interface Workflow {
  id: string; name: string; description: string | null; is_active: boolean
  trigger_type: string; trigger_conditions: Record<string, unknown>
  steps: Step[]; stats: Record<string, unknown>; created_at: string
}
interface Execution {
  id: string; workflow_id: string; status: string; started_at: string
  completed_at: string | null; steps_completed: number; error: string | null
  contacts: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null
}
interface Props { workflows: Workflow[]; executions: Execution[]; stages: Stage[]; orgId: string }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const TRIGGER_LABELS: Record<string, string> = {
  contact_stage_change: 'Contact moves to a stage',
  job_status_change:    'Job status changes',
  new_quote:            'New quote created',
  invoice_overdue:      'Invoice becomes overdue',
  contact_created:      'New contact created',
  job_completed:        'Job marked completed',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0')
  return `${d.getDate()} ${months[d.getMonth()]} ${h < 12 ? h||12 : h-12||12}:${m}${h<12?'am':'pm'}`
}

export function AutomationsView({ workflows: initial, executions, stages, orgId }: Props) {
  const [workflows, setWorkflows] = useState(initial)
  const [building, setBuilding] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [tab, setTab] = useState<'automations' | 'log'>('automations')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  async function toggleActive(w: Workflow) {
    setToggling(p => new Set(p).add(w.id))
    const res = await fetch('/api/automations/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: w.id, isActive: !w.is_active }),
    })
    if (res.ok) {
      setWorkflows(ws => ws.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x))
      toast.success(w.is_active ? 'Automation paused' : 'Automation enabled')
    } else toast.error('Failed to update')
    setToggling(p => { const s = new Set(p); s.delete(w.id); return s })
  }

  async function deleteWorkflow(id: string) {
    setDeleting(p => new Set(p).add(id))
    const res = await fetch('/api/automations/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: id }),
    })
    if (res.ok) { setWorkflows(ws => ws.filter(w => w.id !== id)); toast.success('Automation deleted') }
    else toast.error('Failed to delete')
    setDeleting(p => { const s = new Set(p); s.delete(id); return s })
  }

  function onSaved(workflow: Workflow) {
    if (editing) setWorkflows(ws => ws.map(w => w.id === workflow.id ? workflow : w))
    else setWorkflows(ws => [workflow, ...ws])
    setBuilding(false); setEditing(null)
  }

  if (building || editing) {
    return <WorkflowBuilder workflow={editing} stages={stages} orgId={orgId} onSaved={onSaved} onCancel={() => { setBuilding(false); setEditing(null) }} />
  }

  const activeCount  = workflows.filter(w => w.is_active).length
  const now          = new Date()
  const todayExecs   = executions.filter(e => new Date(e.started_at).toDateString() === now.toDateString())
  const failedCount  = executions.filter(e => e.status === 'failed').length

  const STAT_CARDS = [
    { label: 'Active automations', value: activeCount,         sub: `of ${workflows.length} total`,  topColor: C.sage },
    { label: 'Runs today',         value: todayExecs.length,   sub: 'executions',                    topColor: C.navy },
    { label: 'Failed',             value: failedCount,         sub: 'recent errors',                 topColor: failedCount > 0 ? '#dc2626' : C.muted },
  ]

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ backgroundColor: C.cream, borderBottom: `1px solid ${C.border}`, padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ color: C.sage, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Workflow</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Automations</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>Trigger actions automatically based on events</p>
        </div>
        <button onClick={() => setBuilding(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer', marginTop: 4 }}
          className="uppercase hover:opacity-90 transition-opacity">
          <Plus style={{ width: 13, height: 13 }} />New automation
        </button>
      </div>

      <div style={{ padding: '24px 32px' }} className="space-y-6">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {STAT_CARDS.map(sc => (
            <div key={sc.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `3px solid ${sc.topColor}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>{sc.label}</p>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{sc.value}</p>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{sc.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, gap: 0 }}>
          {([['automations', 'Automations'], ['log', 'Execution log']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)}
              style={{ padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em', border: 'none', borderBottom: tab === val ? `2px solid ${C.navy}` : '2px solid transparent', color: tab === val ? C.navy : C.muted, background: 'none', cursor: 'pointer', marginBottom: -1 }}
              className="uppercase">
              {label}
            </button>
          ))}
        </div>

        {tab === 'automations' ? (
          workflows.length === 0 ? (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '64px 24px', textAlign: 'center' }}>
              <Zap style={{ width: 32, height: 32, color: C.border, margin: '0 auto 12px' }} />
              <p style={{ color: C.navy, fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No automations yet</p>
              <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Automate repetitive tasks like sending follow-up SMS or moving pipeline stages</p>
              <button onClick={() => setBuilding(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }}
                className="uppercase">
                <Plus style={{ width: 13, height: 13 }} />Create first automation
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map(w => (
                <div key={w.id} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: w.is_active ? 1 : 0.6 }}>
                  <div style={{ width: 36, height: 36, backgroundColor: w.is_active ? 'rgba(118,165,143,0.12)' : 'rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap style={{ width: 16, height: 16, color: w.is_active ? C.sage : C.muted }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{w.name}</p>
                      <span style={{ fontSize: 9, padding: '2px 7px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: w.is_active ? 'rgba(118,165,143,0.1)' : 'rgba(44,62,80,0.06)', color: w.is_active ? '#5d8c76' : C.muted }}>
                        {w.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p style={{ color: C.muted, fontSize: 11 }}>
                      {TRIGGER_LABELS[w.trigger_type] ?? w.trigger_type} → {w.steps.length} action{w.steps.length !== 1 ? 's' : ''}
                    </p>
                    {w.description && <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }} className="truncate">{w.description}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleActive(w)} disabled={toggling.has(w.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, letterSpacing: '0.08em', padding: '4px 10px', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: toggling.has(w.id) ? 'default' : 'pointer', opacity: toggling.has(w.id) ? 0.5 : 1 }}
                      className="uppercase hover:opacity-70 transition-opacity">
                      {w.is_active ? <><Pause style={{ width: 11, height: 11 }} />Pause</> : <><Play style={{ width: 11, height: 11 }} />Enable</>}
                    </button>
                    <button onClick={() => setEditing(w)}
                      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer' }}
                      className="hover:opacity-70 transition-opacity">
                      <Edit2 style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => deleteWorkflow(w.id)} disabled={deleting.has(w.id)}
                      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, background: 'none', border: `1px solid ${C.border}`, cursor: deleting.has(w.id) ? 'default' : 'pointer', opacity: deleting.has(w.id) ? 0.5 : 1 }}
                      className="hover:opacity-70 transition-opacity">
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {executions.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Activity style={{ width: 28, height: 28, color: C.border, margin: '0 auto 12px' }} />
                <p style={{ color: C.muted, fontSize: 13 }}>No executions yet</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Automation','Contact','Started','Steps','Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {executions.map((e, i) => {
                    const wf      = workflows.find(w => w.id === e.workflow_id)
                    const contact = Array.isArray(e.contacts) ? e.contacts[0] : e.contacts
                    return (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={{ padding: '10px 14px', color: C.navy, fontSize: 12 }}>{wf?.name ?? '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12 }}>{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{formatTime(e.started_at)}</td>
                        <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12 }}>{e.steps_completed}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {e.status === 'completed' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5d8c76', fontSize: 11 }}><CheckCircle style={{ width: 12, height: 12 }} />Completed</span>
                          ) : e.status === 'failed' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 11 }} title={e.error ?? ''}><XCircle style={{ width: 12, height: 12 }} />Failed</span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309', fontSize: 11 }}><Clock style={{ width: 12, height: 12 }} />Running</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
