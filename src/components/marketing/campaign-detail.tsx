'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CampaignForm } from './campaign-form'
import { toast } from 'sonner'
import { ArrowLeft, Mail, MessageSquare, Send, Clock, Users, MousePointer, Eye, MessageCircle, Edit2, Trash2 } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/format'

interface PipelineStage { id: string; name: string }

interface Campaign {
  id: string; name: string; type: string; status: string; subject: string | null
  content: string | null; audience_filters: Record<string, unknown>; scheduled_at: string | null
  sent_at: string | null; recipient_count: number; open_count: number; click_count: number
  reply_count: number; created_at: string
}

interface Props {
  campaign: Campaign
  pipelineStages: PipelineStage[]
  canManage: boolean
}

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  scheduled: { bg: 'rgba(245,158,11,0.08)',  color: '#b45309', border: 'rgba(245,158,11,0.2)' },
  sent:      { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  cancelled: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
}

function rate(num: number, denom: number) {
  if (!denom) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export function CampaignDetail({ campaign: initial, pipelineStages, canManage }: Props) {
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign>(initial)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!confirm(`Send "${campaign.name}" now? This cannot be undone.`)) return
    setSending(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Sent to ${data.recipient_count} contacts`)
      setCampaign(data.campaign)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally { setSending(false) }
  }

  async function handleDelete() {
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Campaign deleted'); router.push('/marketing') }
    else toast.error('Delete failed')
  }

  const ss = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft
  const stageName = campaign.audience_filters?.pipeline_stage_id
    ? pipelineStages.find(s => s.id === campaign.audience_filters.pipeline_stage_id)?.name
    : null

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/marketing')}
            style={{ color: C.sage, fontSize: 11, letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
            className="uppercase hover:opacity-70 transition-opacity">
            <ArrowLeft style={{ width: 12, height: 12 }} />Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, backgroundColor: 'rgba(118,165,143,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {campaign.type === 'email'
                ? <Mail style={{ width: 16, height: 16, color: C.sage }} />
                : <MessageSquare style={{ width: 16, height: 16, color: C.sage }} />}
            </div>
            <div>
              <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 26, fontWeight: 300 }}>{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 10, padding: '2px 8px', backgroundColor: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, letterSpacing: '0.05em', textTransform: 'capitalize' }}>
                  {campaign.status}
                </span>
                <span style={{ color: C.muted, fontSize: 12, textTransform: 'capitalize' }}>{campaign.type} campaign</span>
                {stageName && <span style={{ color: C.muted, fontSize: 12 }}>· {stageName} audience</span>}
              </div>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {campaign.status !== 'sent' && (
              <>
                <button onClick={() => setShowForm(true)}
                  style={{ padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: '#4A5A65', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  className="uppercase hover:opacity-70 transition-opacity">
                  <Edit2 style={{ width: 12, height: 12 }} />Edit
                </button>
                <button onClick={handleSend} disabled={sending}
                  style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em', border: 'none', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                  className="uppercase">
                  <Send style={{ width: 12, height: 12 }} />
                  {sending ? 'Sending…' : 'Send Now'}
                </button>
              </>
            )}
            <button onClick={handleDelete}
              style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(220,38,38,0.3)`, color: '#dc2626', background: '#fff', cursor: 'pointer' }}
              className="hover:opacity-70 transition-opacity">
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Recipients', value: campaign.recipient_count || '—', sub: null },
            { icon: Eye, label: 'Opens', value: campaign.open_count || '—', sub: campaign.recipient_count ? rate(campaign.open_count, campaign.recipient_count) + ' rate' : null },
            { icon: MousePointer, label: 'Clicks', value: campaign.click_count || '—', sub: campaign.recipient_count ? rate(campaign.click_count, campaign.recipient_count) + ' rate' : null },
            { icon: MessageCircle, label: 'Replies', value: campaign.reply_count || '—', sub: campaign.recipient_count ? rate(campaign.reply_count, campaign.recipient_count) + ' rate' : null },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${C.navy}`, padding: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon style={{ width: 14, height: 14, color: C.navy }} />
                <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24 }}>{s.value}</p>
              {s.sub && <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {campaign.subject && (
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
                <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Subject</p>
                <p style={{ color: C.navy, fontSize: 13 }}>{campaign.subject}</p>
              </div>
            )}
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Content Preview</p>
              <pre style={{ color: '#4A5A65', fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>
                {campaign.content || <span style={{ color: C.muted, fontStyle: 'italic' }}>No content</span>}
              </pre>
            </div>
          </div>
          <div>
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Campaign Info</p>
              <div className="space-y-2">
                {[
                  { label: 'Created', value: formatDate(campaign.created_at), color: C.fg },
                  campaign.sent_at ? { label: 'Sent', value: formatDateTime(campaign.sent_at), color: C.fg } : null,
                  campaign.scheduled_at && campaign.status === 'scheduled'
                    ? { label: 'Scheduled', value: formatDateTime(campaign.scheduled_at), color: '#b45309' } : null,
                  { label: 'Audience', value: stageName ?? 'All contacts', color: C.fg },
                ].filter(Boolean).map((item) => (
                  <div key={item!.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>{item!.label}</span>
                    <span style={{ color: item!.color, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {item!.label === 'Scheduled' && <Clock style={{ width: 11, height: 11 }} />}
                      {item!.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CampaignForm open={showForm} onClose={() => setShowForm(false)}
        onSaved={c => setCampaign(c)} pipelineStages={pipelineStages} initial={campaign} />
    </div>
  )
}
