'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CampaignForm } from './campaign-form'
import { toast } from 'sonner'
import { Plus, Search, Mail, MessageSquare, Send, Clock, FileText, Trash2, Edit2, BarChart2 } from 'lucide-react'
import { formatDate } from '@/lib/format'

interface PipelineStage { id: string; name: string }

interface Campaign {
  id: string; name: string; type: string; status: string; subject: string | null
  content: string | null; audience_filters: Record<string, unknown>; scheduled_at: string | null
  sent_at: string | null; recipient_count: number; open_count: number; click_count: number
  reply_count: number; created_at: string
}

interface Props {
  initialCampaigns: Campaign[]
  pipelineStages: PipelineStage[]
  canManage: boolean
}

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '7px 10px', outline: 'none',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
  scheduled: { bg: 'rgba(245,158,11,0.08)',  color: '#b45309', border: 'rgba(245,158,11,0.2)' },
  sent:      { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)' },
  cancelled: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
}

export function CampaignsList({ initialCampaigns, pipelineStages, canManage }: Props) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Campaign | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const filtered = campaigns.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.type === typeFilter
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
  }

  function handleSaved(campaign: Campaign) {
    setCampaigns(prev => {
      const idx = prev.findIndex(c => c.id === campaign.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = campaign; return next }
      return [campaign, ...prev]
    })
  }

  async function handleSend(campaign: Campaign) {
    if (!confirm(`Send "${campaign.name}" now? This cannot be undone.`)) return
    setSending(campaign.id)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Sent to ${data.recipient_count} contacts`)
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? data.campaign : c))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally { setSending(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) { setCampaigns(prev => prev.filter(c => c.id !== id)); toast.success('Campaign deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Outreach</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Marketing Campaigns</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Create and send email & SMS campaigns</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditTarget(null); setShowForm(true) }}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />New Campaign
          </button>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total',     value: stats.total,     accent: C.navy },
            { label: 'Sent',      value: stats.sent,      accent: C.sage },
            { label: 'Scheduled', value: stats.scheduled, accent: '#b45309' },
            { label: 'Drafts',    value: stats.draft,     accent: C.muted },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${s.accent}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, marginTop: 4 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns…"
              style={{ ...inp, width: '100%', paddingLeft: 32 }} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inp, width: 130 }}>
            <option value="all">All types</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 130 }}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <BarChart2 style={{ width: 32, height: 32, color: C.muted, margin: '0 auto 12px' }} />
              <p style={{ color: C.navy, fontSize: 14 }}>No campaigns found</p>
              <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                {campaigns.length === 0 ? 'Create your first campaign to get started' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Campaign','Type','Status','Recipients','Opens','Clicks','Date',''].map((h, i) => (
                    <th key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, padding: '8px 14px', textAlign: i >= 3 && i <= 5 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft
                  return (
                    <tr key={c.id} onClick={() => router.push(`/marketing/${c.id}`)}
                      style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                      className="hover:bg-[rgba(44,62,80,0.02)] transition-colors group">
                      <td style={{ padding: '11px 14px' }}>
                        <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>{c.name}</p>
                        {c.subject && <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }} className="truncate max-w-[200px]">{c.subject}</p>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ color: '#4A5A65', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.type === 'email' ? <Mail style={{ width: 13, height: 13 }} /> : <MessageSquare style={{ width: 13, height: 13 }} />}
                          <span style={{ textTransform: 'capitalize' }}>{c.type}</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', backgroundColor: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em' }}>
                          {c.status === 'sent' && <Send style={{ width: 10, height: 10 }} />}
                          {c.status === 'scheduled' && <Clock style={{ width: 10, height: 10 }} />}
                          {c.status === 'draft' && <FileText style={{ width: 10, height: 10 }} />}
                          <span style={{ textTransform: 'capitalize' }}>{c.status}</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: C.fg, fontSize: 12 }}>{c.recipient_count || '—'}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: C.fg, fontSize: 12 }}>
                        {c.open_count > 0 ? <span>{c.open_count} <span style={{ color: C.muted, fontSize: 10 }}>({Math.round((c.open_count / c.recipient_count) * 100)}%)</span></span> : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', color: C.fg, fontSize: 12 }}>
                        {c.click_count > 0 ? <span>{c.click_count} <span style={{ color: C.muted, fontSize: 10 }}>({Math.round((c.click_count / c.recipient_count) * 100)}%)</span></span> : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', color: C.muted, fontSize: 12 }}>
                        {c.sent_at ? formatDate(c.sent_at) : c.scheduled_at ? formatDate(c.scheduled_at) : formatDate(c.created_at)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {canManage && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                            {c.status !== 'sent' && (
                              <>
                                <button title="Edit" onClick={() => { setEditTarget(c); setShowForm(true) }}
                                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
                                  className="hover:opacity-70 transition-opacity">
                                  <Edit2 style={{ width: 12, height: 12 }} />
                                </button>
                                <button title="Send now" onClick={() => handleSend(c)} disabled={sending === c.id}
                                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: sending === c.id ? 'default' : 'pointer' }}
                                  className="hover:opacity-70 transition-opacity">
                                  {sending === c.id
                                    ? <span style={{ width: 12, height: 12, display: 'block', border: `2px solid ${C.muted}`, borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
                                    : <Send style={{ width: 12, height: 12 }} />}
                                </button>
                              </>
                            )}
                            <button title="Delete" onClick={() => handleDelete(c.id)}
                              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
                              className="hover:text-[#dc2626] hover:opacity-70 transition-all">
                              <Trash2 style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CampaignForm open={showForm} onClose={() => { setShowForm(false); setEditTarget(null) }}
        onSaved={handleSaved} pipelineStages={pipelineStages} initial={editTarget} />
    </div>
  )
}
