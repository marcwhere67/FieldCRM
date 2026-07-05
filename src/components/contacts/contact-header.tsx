'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MessageSquare, FileText, Briefcase, StickyNote, ChevronLeft, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  lead:     { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)' },
  prospect: { bg: 'rgba(124,58,237,0.07)',  color: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  active:   { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  inactive: { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  archived: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)' },
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

interface Props {
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    company_name: string | null
    status: string
    tags: string[]
    pipeline_stage_id: string | null
    assigned_to: string | null
    lifetime_value: number
    pipeline_stages: { id: string; name: string; color: string } | null
    users: { id: string; full_name: string } | null
  }
  pipelineStages: { id: string; name: string; color: string }[]
  teamMembers: { id: string; full_name: string }[]
}

export function ContactHeader({ contact, pipelineStages, teamMembers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [stageId, setStageId] = useState(contact.pipeline_stage_id ?? '')
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to ?? '')

  const initials = `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase()
  const name = `${contact.first_name} ${contact.last_name}`
  const badge = STATUS_BADGE[contact.status] ?? STATUS_BADGE.inactive
  const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

  async function updateStage(value: string | null) {
    if (!value) return
    setStageId(value)
    const { error } = await supabase.from('contacts').update({ pipeline_stage_id: value }).eq('id', contact.id)
    if (error) toast.error('Failed to update stage')
    else { toast.success('Stage updated'); router.refresh() }
  }

  async function updateAssigned(value: string | null) {
    if (!value) return
    setAssignedTo(value)
    const { error } = await supabase.from('contacts').update({ assigned_to: value }).eq('id', contact.id)
    if (error) toast.error('Failed to update assignment')
    else { toast.success('Assignment updated'); router.refresh() }
  }

  return (
    <div className="space-y-4">
      <Link href="/contacts" style={{ color: '#8A9BA6' }} className="inline-flex items-center gap-1.5 text-xs hover:text-[#2C3E50] transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />Back to contacts
      </Link>

      {/* Main card */}
      <div style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)', boxShadow: '0 1px 3px rgba(44,62,80,0.05),0 4px 14px rgba(44,62,80,0.04)' }} className="p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {/* Avatar + name */}
          <div className="flex items-start gap-4 flex-1">
            <div style={{ width: 56, height: 56, backgroundColor: avatarColor.bg, color: avatarColor.color, fontSize: 18, fontWeight: 500, flexShrink: 0 }} className="flex items-center justify-center">
              {initials}
            </div>
            <div>
              <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 28, fontWeight: 300, lineHeight: 1.2 }}>{name}</h1>
              {contact.company_name && (
                <p style={{ color: '#8A9BA6', fontSize: 13, marginTop: 2 }}>{contact.company_name}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px' }} className="uppercase">{contact.status}</span>
                {contact.tags.map(tag => (
                  <span key={tag} style={{ color: '#4A5A65', backgroundColor: '#EDE8E2', fontSize: 10, letterSpacing: '0.05em', padding: '2px 8px' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Contact actions */}
          <div className="flex items-center gap-2 shrink-0">
            {contact.phone && (
              <a href={`tel:${contact.phone}`}>
                <button style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', width: 34, height: 34, backgroundColor: '#fff' }} className="flex items-center justify-center hover:bg-[#F5F0EB] transition-colors" title={contact.phone}>
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <button style={{ border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65', width: 34, height: 34, backgroundColor: '#fff' }} className="flex items-center justify-center hover:bg-[#F5F0EB] transition-colors" title={contact.email}>
                  <Mail className="w-3.5 h-3.5" />
                </button>
              </a>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ borderTop: '1px solid rgba(44,62,80,0.08)', marginTop: 20, paddingTop: 16 }} className="flex flex-wrap gap-5 items-center">
          <div className="flex items-center gap-2">
            <span style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Stage</span>
            <Select value={stageId} onValueChange={updateStage}>
              <SelectTrigger style={{ height: 28, fontSize: 12, backgroundColor: '#F5F0EB', border: '1px solid rgba(44,62,80,0.12)', color: '#2C3E50', minWidth: 140 }} className="rounded-none">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
                {pipelineStages.map(s => (
                  <SelectItem key={s.id} value={s.id} style={{ color: '#1C2A35', fontSize: 12 }}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ color: '#8A9BA6', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Assigned</span>
            <Select value={assignedTo} onValueChange={updateAssigned}>
              <SelectTrigger style={{ height: 28, fontSize: 12, backgroundColor: '#F5F0EB', border: '1px solid rgba(44,62,80,0.12)', color: '#2C3E50', minWidth: 130 }} className="rounded-none">
                <SelectValue placeholder="Assign" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id} style={{ color: '#1C2A35', fontSize: 12 }}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ color: '#8A9BA6', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>Lifetime value</p>
            <p style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: 22, lineHeight: 1 }}>{formatCurrency(contact.lifetime_value ?? 0)}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ borderTop: '1px solid rgba(44,62,80,0.08)', marginTop: 16, paddingTop: 16 }} className="flex flex-wrap gap-2">
          {[
            { label: 'Send message', icon: MessageSquare, primary: true },
            { label: 'New quote',    icon: FileText,      primary: false },
            { label: 'Book job',     icon: Briefcase,     primary: false },
            { label: 'Add note',     icon: StickyNote,    primary: false },
          ].map(({ label, icon: Icon, primary }) => (
            <button
              key={label}
              style={primary
                ? { backgroundColor: '#2C3E50', color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }
                : { backgroundColor: '#fff', color: '#4A5A65', border: '1px solid rgba(44,62,80,0.15)', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }
              }
              className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity"
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
