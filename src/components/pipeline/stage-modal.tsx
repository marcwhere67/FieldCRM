'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Trash2 } from 'lucide-react'

interface Stage {
  id: string; name: string; position: number; color: string
}

interface Props {
  orgId: string
  stage: Stage | null
  nextPosition: number
  onClose: () => void
  onCreated: (stage: Stage) => void
  onUpdated: (stage: Stage) => void
  onDeleted: (stageId: string) => void
}

const C = {
  navy: '#2C3E50', sage: '#76A58F', fg: '#1C2A35', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

export function StageModal({ orgId, stage, nextPosition, onClose, onCreated, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(stage?.name ?? '')
  const [color, setColor] = useState(stage?.color ?? '#6366f1')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!stage

  async function handleSave() {
    if (!name.trim()) { toast.error('Stage name is required'); return }
    setSaving(true)
    const res = await fetch('/api/pipeline/stage', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit
        ? { stageId: stage.id, name: name.trim(), color }
        : { name: name.trim(), color, position: nextPosition }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to save stage')
    else {
      if (isEdit) onUpdated(data.stage)
      else onCreated(data.stage)
      toast.success(isEdit ? 'Stage updated' : 'Stage created')
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 340, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 20, fontWeight: 300 }}>{isEdit ? 'Edit Stage' : 'New Stage'}</h3>
          <button onClick={onClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          <div>
            <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Stage name</span>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. New Lead, Quoted, Won" style={inp} />
          </div>

          <div>
            <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Colour</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{
                    width: 24, height: 24, backgroundColor: c, border: 'none', cursor: 'pointer',
                    outline: color === c ? `2px solid ${C.navy}` : 'none',
                    outlineOffset: 2,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 150ms',
                  }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', backgroundColor: 'rgba(44,62,80,0.04)', border: `1px solid ${C.border}` }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{name || 'Stage name'}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isEdit && (
              <button onClick={() => confirmDelete ? onDeleted(stage.id) : setConfirmDelete(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 11, letterSpacing: '0.08em',
                  border: `1px solid ${confirmDelete ? 'rgba(220,38,38,0.4)' : C.border}`,
                  backgroundColor: confirmDelete ? 'rgba(220,38,38,0.06)' : '#fff',
                  color: confirmDelete ? '#dc2626' : C.muted, cursor: 'pointer',
                }}
                className="uppercase hover:opacity-80 transition-opacity">
                <Trash2 style={{ width: 11, height: 11 }} />
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button onClick={onClose}
                style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer' }}
                className="uppercase hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
                className="uppercase">
                {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
