'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format'
import { Plus, FileText, ChevronRight, Send } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  draft:     { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)',    dot: '#8A9BA6' },
  sent:      { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)',   dot: '#2563eb' },
  viewed:    { bg: 'rgba(44,62,80,0.08)',    color: '#2C3E50', border: 'rgba(44,62,80,0.18)',    dot: '#2C3E50' },
  approved:  { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
  declined:  { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)',   dot: '#dc2626' },
  expired:   { bg: 'rgba(44,62,80,0.04)',    color: '#8A9BA6', border: 'rgba(44,62,80,0.10)',    dot: '#c5d0d8' },
  converted: { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
}

interface Quote {
  id: string
  quote_number: string
  status: string
  subtotal: number
  tax: number
  total: number
  valid_until: string | null
  sent_at: string | null
  approved_at: string | null
  created_at: string
  contacts: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }[] | { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null
}

interface Props {
  quotes: Quote[]
  filters: { status?: string; q?: string }
  total?: number
}

export function QuotesList({ quotes, filters, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  function updateFilter(key: string, value: string | null) {
    const p = new URLSearchParams()
    if (filters.q) p.set('q', filters.q)
    if (value && value !== 'all') p.set(key, value)
    else p.delete(key)
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  function getContact(q: Quote) {
    if (!q.contacts) return null
    return Array.isArray(q.contacts) ? q.contacts[0] : q.contacts
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedQuotes = quotes.filter(q => selectedIds.has(q.id))
  const selectedContactIds = new Set(selectedQuotes.map(q => getContact(q)?.id).filter(Boolean))
  const mixedContacts = selectedContactIds.size > 1

  async function sendSelected() {
    if (selectedIds.size < 2 || mixedContacts) return
    setSending(true)
    try {
      const res = await fetch('/api/quotes/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok || !data.sent) throw new Error(data.error ?? 'Failed to send quotes')
      const contact = getContact(selectedQuotes[0])
      toast.success(`${data.count} quotes emailed to ${contact ? `${contact.first_name} ${contact.last_name}` : 'the contact'}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send quotes')
    } finally {
      setSending(false)
    }
  }

  const totalValue    = quotes.reduce((s, q) => s + q.total, 0)
  const approvedValue = quotes.filter(q => ['approved', 'converted'].includes(q.status)).reduce((s, q) => s + q.total, 0)
  const pendingCount  = quotes.filter(q => ['sent', 'viewed'].includes(q.status)).length
  const winRate       = quotes.length > 0 ? Math.round((quotes.filter(q => ['approved', 'converted'].includes(q.status)).length / quotes.length) * 100) : 0

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between pb-5" style={{ borderBottom: '1px solid rgba(44,62,80,0.1)' }}>
        <div>
          <p style={{ color: '#76A58F', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Sales</p>
          <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50' }} className="text-3xl font-light">Quotes</h1>
          <p style={{ color: '#8A9BA6' }} className="text-xs mt-1">
            {(total ?? quotes.length)} total
            {(total ?? 0) > quotes.length && <> · showing most recent {quotes.length}</>}
          </p>
        </div>
        <Link href="/quotes/new">
          <button style={{ backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em' }} className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-normal transition-all hover:opacity-80 active:scale-[0.98]">
            <Plus className="w-3.5 h-3.5" />New Quote
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pipeline value',    value: formatCurrency(totalValue),    accent: '#2C3E50', sub: 'total quoted' },
          { label: 'Approved',          value: formatCurrency(approvedValue),  accent: '#76A58F', sub: 'won' },
          { label: 'Awaiting response', value: String(pendingCount),           accent: '#b45309', sub: pendingCount === 1 ? 'quote pending' : 'quotes pending' },
          { label: 'Win rate',          value: `${winRate}%`,                  accent: winRate > 50 ? '#76A58F' : '#8A9BA6', sub: 'conversion' },
        ].map(s => (
          <div key={s.label} style={{ border: '1px solid rgba(44,62,80,0.09)', boxShadow: '0 1px 3px rgba(44,62,80,0.05)', backgroundColor: '#fff' }} className="p-5">
            <div style={{ borderTop: `2px solid ${s.accent}` }} className="pt-4">
              <p style={{ color: '#8A9BA6', letterSpacing: '0.15em' }} className="text-[9px] uppercase mb-2">{s.label}</p>
              <p style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', lineHeight: 1 }} className="text-3xl font-light">{s.value}</p>
              <p style={{ color: '#8A9BA6' }} className="text-[10px] mt-1.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {[{ value: 'all', label: 'All', count: quotes.length }, ...Object.keys(STATUS_STYLE).map(s => ({
          value: s, label: s, count: quotes.filter(q => q.status === s).length
        }))].map(item => {
          const active = (filters.status ?? 'all') === item.value
          const st = item.value !== 'all' ? STATUS_STYLE[item.value] : null
          return (
            <button
              key={item.value}
              onClick={() => updateFilter('status', item.value === 'all' ? null : item.value)}
              style={active
                ? { backgroundColor: st?.bg ?? 'rgba(44,62,80,0.08)', color: st?.color ?? '#2C3E50', border: `1px solid ${st?.border ?? 'rgba(44,62,80,0.2)'}` }
                : { backgroundColor: '#fff', color: '#8A9BA6', border: '1px solid rgba(44,62,80,0.1)' }
              }
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.08em] font-normal transition-all hover:opacity-80"
            >
              {st && <span style={{ backgroundColor: active ? st.dot : '#8A9BA6', width: 5, height: 5, borderRadius: '50%', display: 'inline-block' }} />}
              {item.label}
              <span style={{ opacity: 0.6 }} className="text-[9px]">({item.count})</span>
            </button>
          )
        })}
      </div>

      {/* Bulk-send bar */}
      {selectedIds.size > 0 && (
        <div style={{ backgroundColor: '#2C3E50', color: '#fff', border: '1px solid rgba(44,62,80,0.15)' }} className="flex items-center justify-between px-4 py-2.5">
          <p className="text-[11px]" style={{ letterSpacing: '0.03em' }}>
            {selectedIds.size} selected
            {mixedContacts && <span style={{ color: '#f5b942' }}> — must all belong to the same contact to send together</span>}
          </p>
          <button
            onClick={sendSelected}
            disabled={selectedIds.size < 2 || mixedContacts || sending}
            style={{
              backgroundColor: selectedIds.size < 2 || mixedContacts ? 'rgba(255,255,255,0.12)' : '#76A58F',
              color: '#fff', fontSize: 11, letterSpacing: '0.05em', padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: selectedIds.size < 2 || mixedContacts || sending ? 'default' : 'pointer',
            }}
          >
            <Send className="w-3.5 h-3.5" />
            {sending
              ? 'Sending…'
              : selectedIds.size < 2
                ? `Select ${2 - selectedIds.size} more to send together`
                : `Send ${selectedIds.size} quotes in one email`}
          </button>
        </div>
      )}

      {/* List */}
      <div className={`space-y-px ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        {quotes.length === 0 ? (
          <div style={{ border: '1px solid rgba(44,62,80,0.1)', backgroundColor: '#fff' }} className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
            <p style={{ color: '#8A9BA6' }} className="text-xs">No quotes yet</p>
            <Link href="/quotes/new">
              <button style={{ color: '#76A58F', letterSpacing: '0.1em' }} className="text-[10px] uppercase hover:opacity-70 transition-opacity mt-1">
                Create your first quote →
              </button>
            </Link>
          </div>
        ) : quotes.map((quote, i) => {
          const contact = getContact(quote)
          const st = STATUS_STYLE[quote.status] ?? STATUS_STYLE.draft
          const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && !['approved', 'converted', 'declined'].includes(quote.status)

          return (
            <div
              key={quote.id}
              style={{
                backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8',
                borderLeft: `3px solid ${st.dot}`,
                borderBottom: '1px solid rgba(44,62,80,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '14px 16px',
                transition: 'background-color 150ms ease',
              }}
              className="group hover:bg-[#F0EDE8]"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(quote.id)}
                onChange={() => toggleSelected(quote.id)}
                style={{ width: 15, height: 15, accentColor: '#2C3E50', cursor: 'pointer', flexShrink: 0 }}
              />
              <Link href={`/quotes/${quote.id}`} className="flex-1 min-w-0 flex items-center gap-5" style={{ textDecoration: 'none' }}>
              {/* Quote info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: '#8A9BA6', fontFamily: 'monospace', fontSize: '11px' }}>{quote.quote_number}</span>
                </div>
                {contact && (
                  <p style={{ color: '#1C2A35', fontSize: '13px', fontWeight: 500 }} className="group-hover:text-[#2C3E50] transition-colors">
                    {contact.first_name} {contact.last_name}
                  </p>
                )}
                <p style={{ color: '#8A9BA6', fontSize: '11px', marginTop: 2 }}>
                  {formatDate(quote.created_at)}
                  {quote.sent_at && <> · Sent {formatDate(quote.sent_at)}</>}
                  {quote.approved_at && <> · Approved {formatDate(quote.approved_at)}</>}
                </p>
              </div>

              {/* Valid until */}
              {quote.valid_until && (
                <div className="hidden md:block text-right shrink-0">
                  <p style={{ color: '#8A9BA6', fontSize: '10px' }}>Valid until</p>
                  <p style={{ color: isExpired ? '#dc2626' : '#4A5A65', fontSize: '12px' }}>
                    {formatDate(quote.valid_until)}
                  </p>
                </div>
              )}

              {/* Amount */}
              <div className="text-right shrink-0">
                <p style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: '20px', lineHeight: 1 }}>
                  {formatCurrency(quote.total)}
                </p>
                <p style={{ color: '#8A9BA6', fontSize: '10px', marginTop: 2 }}>incl. {formatCurrency(quote.tax)} GST</p>
              </div>

              {/* Status */}
              <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, letterSpacing: '0.08em', fontSize: '9px', padding: '2px 8px', flexShrink: 0 }} className="uppercase">
                {quote.status}
              </span>

              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#8A9BA6' }} />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
