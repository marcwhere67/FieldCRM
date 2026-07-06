'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, Pencil, Mail, MessageSquare, Lock, Trash2 } from 'lucide-react'
import { renderTemplate, variablesForCategory, TEMPLATE_VARIABLES } from '@/lib/templates'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  inputBorder: 'rgba(44,62,80,0.15)',
}

interface Template {
  id: string
  channel: 'email' | 'sms'
  category: string
  template_key: string | null
  name: string
  subject: string | null
  body: string
  is_active: boolean
}

const CATEGORIES = ['quote', 'invoice', 'appointment', 'general', 'custom']
const CATEGORY_LABEL: Record<string, string> = {
  quote: 'Quotes', invoice: 'Invoices', appointment: 'Appointments', general: 'General', custom: 'Custom',
}

const inputStyle = { backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' } as React.CSSProperties
const labelStyle = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

// Sample values for the live preview, keyed by variable name.
const SAMPLE_VARS = Object.fromEntries(TEMPLATE_VARIABLES.map(v => [v.key, v.sample]))

export function TemplatesSettings({ canManage }: { canManage: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/settings/templates')
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Failed to load templates')
        return r.json()
      })
      .then((data: Template[]) => setTemplates(data))
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const g: Record<string, Template[]> = {}
    for (const t of templates) (g[t.category] ??= []).push(t)
    return g
  }, [templates])

  function upsertLocal(t: Template) {
    setTemplates(prev => {
      const i = prev.findIndex(x => x.id === t.id)
      if (i === -1) return [...prev, t]
      const next = [...prev]; next[i] = t; return next
    })
  }
  function removeLocal(id: string) { setTemplates(prev => prev.filter(t => t.id !== id)) }

  if (loading) return <p style={{ color: C.muted, fontSize: 13 }}>Loading templates…</p>

  if (loadError) return (
    <div style={{ backgroundColor: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', padding: 16, maxWidth: 640 }}>
      <p style={{ color: '#b45309', fontSize: 13, fontWeight: 500 }}>Templates aren’t available yet</p>
      <p style={{ color: '#8a6d3b', fontSize: 12, marginTop: 4 }}>
        The <code>message_templates</code> table hasn’t been created in the database yet. Run the migration
        <code> supabase/migrations/message_templates.sql</code> in the Supabase SQL editor, then reload.
      </p>
    </div>
  )

  return (
    <div style={{ maxWidth: 720 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 500 }}>Message Templates</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>Reusable email &amp; SMS wording with {'{{'}variables{'}}'}</p>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />New Template
          </button>
        )}
      </div>

      {templates.length === 0 && (
        <p style={{ color: C.muted, fontSize: 13 }}>No templates yet. Create one to get started.</p>
      )}

      {CATEGORIES.filter(cat => grouped[cat]?.length).map(cat => (
        <div key={cat} className="space-y-2">
          <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{CATEGORY_LABEL[cat]}</p>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }} className="divide-y divide-[rgba(44,62,80,0.07)]">
            {grouped[cat].map(t => (
              <div key={t.id} style={{ padding: '12px 16px' }} className="flex items-center gap-3">
                <div style={{ color: t.channel === 'email' ? '#2563eb' : C.sage, flexShrink: 0 }}>
                  {t.channel === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{t.name}</p>
                    {t.template_key && (
                      <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Lock style={{ width: 9, height: 9 }} />System
                      </span>
                    )}
                    {!t.is_active && <span style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase' }}>Inactive</span>}
                  </div>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }} className="truncate">{t.subject ? `${t.subject} — ` : ''}{t.body}</p>
                </div>
                {canManage && (
                  <button onClick={() => setEditing(t)} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors shrink-0">
                    <Pencil style={{ width: 13, height: 13 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {(creating || editing) && (
        <TemplateEditor
          template={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={t => { upsertLocal(t); setCreating(false); setEditing(null) }}
          onDeleted={id => { removeLocal(id); setEditing(null) }}
        />
      )}
    </div>
  )
}

function TemplateEditor({ template, onClose, onSaved, onDeleted }: {
  template: Template | null
  onClose: () => void
  onSaved: (t: Template) => void
  onDeleted: (id: string) => void
}) {
  const isEdit = !!template
  const [channel, setChannel] = useState<'email' | 'sms'>(template?.channel ?? 'sms')
  const [category, setCategory] = useState(template?.category ?? 'custom')
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isSystem = !!template?.template_key
  const vars = variablesForCategory(category)
  const preview = renderTemplate(body || '', SAMPLE_VARS)
  const subjectPreview = renderTemplate(subject || '', SAMPLE_VARS)

  function insertVar(key: string) {
    setBody(b => `${b}{{${key}}}`)
  }

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!body.trim()) { toast.error('Message body is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/settings/templates/${template!.id}` : '/api/settings/templates'
      const method = isEdit ? 'PATCH' : 'POST'
      const payload = isEdit
        ? { name, subject: channel === 'email' ? subject : null, body }
        : { channel, category, name, subject: channel === 'email' ? subject : null, body }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(isEdit ? 'Template updated' : 'Template created')
      onSaved(data)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!template) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/templates/${template.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Template deleted')
      onDeleted(template.id)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeleting(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(44,62,80,0.15)' }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px', position: 'sticky', top: 0, backgroundColor: '#fff' }} className="flex items-center justify-between">
          <h3 style={{ color: C.navy, fontSize: 16, fontWeight: 400 }}>{isEdit ? 'Edit Template' : 'New Template'}</h3>
          <button onClick={onClose} style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 20 }} className="space-y-4">
          {/* Channel + category — locked once created */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Channel</label>
              <select value={channel} disabled={isEdit} onChange={e => setChannel(e.target.value as 'email' | 'sms')}
                style={{ ...inputStyle, backgroundColor: isEdit ? 'rgba(44,62,80,0.04)' : '#fff', cursor: isEdit ? 'not-allowed' : 'pointer' }} className="focus:border-[#76A58F]">
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={category} disabled={isEdit} onChange={e => setCategory(e.target.value)}
                style={{ ...inputStyle, backgroundColor: isEdit ? 'rgba(44,62,80,0.04)' : '#fff', cursor: isEdit ? 'not-allowed' : 'pointer' }} className="focus:border-[#76A58F]">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Template name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Appointment reminder" style={inputStyle} className="focus:border-[#76A58F]" />
          </div>

          {channel === 'email' && (
            <div>
              <label style={labelStyle}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Your quote from {{business_name}}" style={inputStyle} className="focus:border-[#76A58F]" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Message body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
              placeholder="Hi {{first_name}}, …"
              style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }} className="focus:border-[#76A58F]" />
          </div>

          {/* Variable palette */}
          <div>
            <label style={labelStyle}>Insert variable</label>
            <div className="flex flex-wrap gap-1.5">
              {vars.map(v => (
                <button key={v.key} onClick={() => insertVar(v.key)} title={v.label}
                  style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, color: '#4A5A65', fontSize: 10, padding: '3px 8px' }}
                  className="hover:opacity-80 transition-opacity">
                  {'{{'}{v.key}{'}}'}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <label style={labelStyle}>Preview</label>
            <div style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, padding: 12 }}>
              {channel === 'email' && subject && (
                <p style={{ color: C.navy, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{subjectPreview}</p>
              )}
              <p style={{ color: '#4A5A65', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{preview || <span style={{ color: C.muted }}>Your message preview appears here…</span>}</p>
            </div>
          </div>

          {isSystem && (
            <p style={{ color: C.muted, fontSize: 11 }}>This is a system template used by automated messages — you can edit its wording but it can’t be deleted.</p>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }} className="flex items-center justify-between">
            {isEdit && !isSystem ? (
              <button onClick={del} disabled={deleting} style={{ color: '#dc2626', fontSize: 11, letterSpacing: '0.08em' }} className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
                <Trash2 style={{ width: 13, height: 13 }} />{deleting ? 'Deleting…' : 'Delete'}
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={onClose} style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: C.cream, padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity">Cancel</button>
              <button onClick={save} disabled={saving} style={{ backgroundColor: C.navy, color: '#fff', padding: '8px 18px', fontSize: 11, letterSpacing: '0.08em' }} className="uppercase hover:opacity-80 transition-opacity disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
