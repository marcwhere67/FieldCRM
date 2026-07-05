'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Settings, Phone, Mail, Building2 } from 'lucide-react'
import { StageModal } from './stage-modal'
import { QuickAddModal } from './quick-add-modal'

interface Stage { id: string; name: string; position: number; color: string }
interface Contact { id: string; first_name: string; last_name: string; company_name: string | null; phone: string | null; email: string | null; pipeline_stage_id: string | null; created_at: string }
interface Props { stages: Stage[]; contacts: Contact[]; orgId: string }

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
  { bg: 'rgba(217,119,6,0.08)',   color: '#b45309' },
]

export function PipelineBoard({ stages: initialStages, contacts: initialContacts, orgId }: Props) {
  const [stages, setStages] = useState(initialStages)
  const [contacts, setContacts] = useState(initialContacts)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [showStageModal, setShowStageModal] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null)

  function getContactsForStage(stageId: string) { return contacts.filter(c => c.pipeline_stage_id === stageId) }
  const unassigned = contacts.filter(c => !c.pipeline_stage_id)

  async function onDrop(e: React.DragEvent, stageId: string | null) {
    e.preventDefault(); setDragOverStage(null)
    if (!draggingId) return
    const prev = contacts.find(c => c.id === draggingId)?.pipeline_stage_id
    if (prev === stageId) { setDraggingId(null); return }
    setContacts(cs => cs.map(c => c.id === draggingId ? { ...c, pipeline_stage_id: stageId } : c))
    setDraggingId(null)
    const res = await fetch('/api/pipeline/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: draggingId, stageId }) })
    if (!res.ok) { toast.error('Failed to move contact'); setContacts(cs => cs.map(c => c.id === draggingId ? { ...c, pipeline_stage_id: prev ?? null } : c)) }
  }

  function onStageCreated(stage: Stage) { setStages(prev => [...prev, stage].sort((a, b) => a.position - b.position)); setShowStageModal(false) }
  function onStageUpdated(stage: Stage) { setStages(prev => prev.map(s => s.id === stage.id ? stage : s)); setEditingStage(null) }
  async function onStageDeleted(stageId: string) {
    const res = await fetch('/api/pipeline/stage', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stageId }) })
    if (res.ok) { setStages(prev => prev.filter(s => s.id !== stageId)); setContacts(prev => prev.map(c => c.pipeline_stage_id === stageId ? { ...c, pipeline_stage_id: null } : c)); setEditingStage(null); toast.success('Stage deleted') }
    else toast.error('Failed to delete stage')
  }
  function onContactAdded(contact: Contact) { setContacts(prev => [contact, ...prev]); setShowQuickAdd(null) }

  const assignedContacts = contacts.filter(c => c.pipeline_stage_id).length

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -mx-6 -mt-6">
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(44,62,80,0.1)', backgroundColor: '#F5F0EB' }} className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <p style={{ color: '#76A58F', letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Sales</p>
          <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 28, fontWeight: 300 }}>Pipeline</h1>
          <p style={{ color: '#8A9BA6', fontSize: 12, marginTop: 2 }}>{assignedContacts} of {contacts.length} contacts in pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStageModal(true)}
            style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity"
          >
            <Settings className="w-3.5 h-3.5" />Manage stages
          </button>
          <button
            onClick={() => setShowQuickAdd('new')}
            style={{ backgroundColor: '#2C3E50', color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />Add lead
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6 pt-4" style={{ backgroundColor: '#F5F0EB' }}>
        <div className="flex gap-4 h-full min-w-max">
          {stages.length === 0 ? (
            <div className="flex items-center justify-center w-full">
              <div className="text-center space-y-3">
                <p style={{ color: '#4A5A65', fontSize: 14 }}>No pipeline stages yet</p>
                <p style={{ color: '#8A9BA6', fontSize: 12 }}>Create your first stage to start tracking leads</p>
                <button onClick={() => setShowStageModal(true)}
                  style={{ backgroundColor: '#2C3E50', color: '#fff', padding: '8px 18px', fontSize: 11, letterSpacing: '0.1em' }}
                  className="inline-flex items-center gap-2 uppercase hover:opacity-80 transition-opacity mt-2">
                  <Plus className="w-3.5 h-3.5" />Add first stage
                </button>
              </div>
            </div>
          ) : (
            <>
              {stages.map(stage => {
                const stageContacts = getContactsForStage(stage.id)
                const isDragOver = dragOverStage === stage.id
                return (
                  <div key={stage.id} className="flex flex-col w-72 shrink-0"
                    onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={e => onDrop(e, stage.id)}>

                    {/* Column header */}
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span style={{ color: '#2C3E50', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{stage.name}</span>
                        <span style={{ color: '#8A9BA6', fontSize: 10, backgroundColor: 'rgba(44,62,80,0.08)', padding: '1px 7px' }}>{stageContacts.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowQuickAdd(stage.id)}
                          style={{ color: '#8A9BA6', width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50] hover:bg-white transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingStage(stage)}
                          style={{ color: '#8A9BA6', width: 24, height: 24 }} className="flex items-center justify-center hover:text-[#2C3E50] hover:bg-white transition-colors">
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Cards */}
                    <div style={{
                      border: isDragOver ? `1px solid #76A58F` : '1px solid rgba(44,62,80,0.1)',
                      backgroundColor: isDragOver ? 'rgba(118,165,143,0.04)' : 'rgba(255,255,255,0.6)',
                      transition: 'all 150ms ease',
                      padding: 8,
                      flex: 1,
                      overflowY: 'auto',
                      minHeight: 200,
                    }} className="space-y-2">
                      {stageContacts.map(contact => (
                        <ContactCard key={contact.id} contact={contact} isDragging={draggingId === contact.id}
                          onDragStart={() => setDraggingId(contact.id)} onDragEnd={() => setDraggingId(null)} />
                      ))}
                      {stageContacts.length === 0 && (
                        <div className="flex items-center justify-center h-20">
                          <p style={{ color: 'rgba(44,62,80,0.2)', fontSize: 11 }}>Drop contacts here</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Unassigned */}
              {unassigned.length > 0 && (
                <div className="flex flex-col w-72 shrink-0"
                  onDragOver={e => { e.preventDefault(); setDragOverStage('__unassigned__') }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={e => onDrop(e, null)}>
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#8A9BA6' }} />
                    <span style={{ color: '#8A9BA6', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Unassigned</span>
                    <span style={{ color: '#8A9BA6', fontSize: 10, backgroundColor: 'rgba(44,62,80,0.06)', padding: '1px 7px' }}>{unassigned.length}</span>
                  </div>
                  <div style={{
                    border: dragOverStage === '__unassigned__' ? '1px solid #76A58F' : '1px dashed rgba(44,62,80,0.15)',
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    padding: 8, flex: 1, overflowY: 'auto', minHeight: 200,
                  }} className="space-y-2">
                    {unassigned.map(contact => (
                      <ContactCard key={contact.id} contact={contact} isDragging={draggingId === contact.id}
                        onDragStart={() => setDraggingId(contact.id)} onDragEnd={() => setDraggingId(null)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {(showStageModal || editingStage) && (
        <StageModal orgId={orgId} stage={editingStage} nextPosition={stages.length}
          onClose={() => { setShowStageModal(false); setEditingStage(null) }}
          onCreated={onStageCreated} onUpdated={onStageUpdated} onDeleted={onStageDeleted} />
      )}
      {showQuickAdd && (
        <QuickAddModal orgId={orgId} defaultStageId={showQuickAdd === 'new' ? (stages[0]?.id ?? null) : showQuickAdd}
          stages={stages} onClose={() => setShowQuickAdd(null)} onCreated={onContactAdded} />
      )}
    </div>
  )
}

function ContactCard({ contact, isDragging, onDragStart, onDragEnd }: {
  contact: Contact; isDragging: boolean; onDragStart: () => void; onDragEnd: () => void
}) {
  const router = useRouter()
  const didDrag = useRef(false)
  const initials = `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase()
  const name = `${contact.first_name} ${contact.last_name}`
  const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div
      draggable
      onDragStart={() => { didDrag.current = false; onDragStart() }}
      onDrag={() => { didDrag.current = true }}
      onDragEnd={onDragEnd}
      onClick={() => { if (!didDrag.current) router.push(`/contacts/${contact.id}`) }}
      style={{
        backgroundColor: '#fff',
        border: '1px solid rgba(44,62,80,0.09)',
        boxShadow: '0 1px 3px rgba(44,62,80,0.06)',
        padding: '10px 12px',
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 150ms ease, box-shadow 150ms ease',
      }}
      className="hover:shadow-md"
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div style={{ width: 28, height: 28, backgroundColor: avatarColor.bg, color: avatarColor.color, fontSize: 10, fontWeight: 600, flexShrink: 0 }} className="flex items-center justify-center">
          {initials}
        </div>
        <div className="min-w-0">
          <p style={{ color: '#1C2A35', fontSize: 12, fontWeight: 500 }} className="truncate">{name}</p>
          {contact.company_name && (
            <p style={{ color: '#8A9BA6', fontSize: 10, marginTop: 1 }} className="flex items-center gap-1 truncate">
              <Building2 className="w-2.5 h-2.5 shrink-0" />{contact.company_name}
            </p>
          )}
        </div>
      </div>
      {(contact.phone || contact.email) && (
        <div style={{ borderTop: '1px solid rgba(44,62,80,0.06)', paddingTop: 6, marginTop: 4 }} className="space-y-0.5">
          {contact.phone && (
            <p style={{ color: '#8A9BA6', fontSize: 10 }} className="flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 shrink-0" />{contact.phone}
            </p>
          )}
          {contact.email && (
            <p style={{ color: '#8A9BA6', fontSize: 10 }} className="flex items-center gap-1 truncate">
              <Mail className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{contact.email}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
