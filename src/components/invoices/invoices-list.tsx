'use client'

import { useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format'
import { FileText, ChevronRight } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  draft:   { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)',    dot: '#8A9BA6' },
  sent:    { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.18)',   dot: '#2563eb' },
  viewed:  { bg: 'rgba(44,62,80,0.08)',    color: '#2C3E50', border: 'rgba(44,62,80,0.18)',   dot: '#2C3E50' },
  partial: { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)',    dot: '#f59e0b' },
  paid:    { bg: 'rgba(118,165,143,0.10)', color: '#5d8c76', border: 'rgba(118,165,143,0.28)', dot: '#76A58F' },
  overdue: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.18)',   dot: '#dc2626' },
  void:    { bg: 'rgba(44,62,80,0.04)',    color: '#8A9BA6', border: 'rgba(44,62,80,0.10)',    dot: '#c5d0d8' },
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  status: string
  subtotal: number
  tax: number
  total: number
  deposit_credit: number
  due_date: string | null
  paid_at: string | null
  sent_at: string | null
  created_at: string
  is_overdue: boolean
  contacts: { id: string; first_name: string; last_name: string; email: string | null } | { id: string; first_name: string; last_name: string; email: string | null }[] | null
}

interface Props {
  invoices: Invoice[]
  filters: { status?: string; type?: string }
  total?: number
}

export function InvoicesList({ invoices, filters, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function updateFilter(key: string, value: string | null) {
    const p = new URLSearchParams()
    if (value && value !== 'all') p.set(key, value)
    if (key !== 'status' && filters.status) p.set('status', filters.status)
    if (key !== 'type' && filters.type) p.set('type', filters.type)
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  function getContact(inv: Invoice) {
    if (!inv.contacts) return null
    return Array.isArray(inv.contacts) ? inv.contacts[0] : inv.contacts
  }

  function displayStatus(inv: Invoice): string {
    return inv.is_overdue ? 'overdue' : inv.status
  }

  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.total, 0)
  const overdue = invoices.filter(i => i.is_overdue).reduce((s, i) => s + i.total, 0)
  const paidThisMonth = invoices.filter(i => {
    if (i.status !== 'paid' || !i.paid_at) return false
    const d = new Date(i.paid_at), now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between pb-5" style={{ borderBottom: '1px solid rgba(44,62,80,0.1)' }}>
        <div>
          <p style={{ color: '#76A58F', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">Finance</p>
          <h1 style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50' }} className="text-3xl font-light">Invoices</h1>
          <p style={{ color: '#8A9BA6' }} className="text-xs mt-1">
            {(total ?? invoices.length)} total
            {(total ?? 0) > invoices.length && <> · showing most recent {invoices.length}</>}
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Outstanding', value: formatCurrency(outstanding), accent: '#2563eb', sub: 'awaiting payment' },
          { label: 'Overdue',     value: formatCurrency(overdue),     accent: overdue > 0 ? '#dc2626' : '#8A9BA6', sub: overdue > 0 ? 'needs attention' : 'all clear' },
          { label: 'Paid this month', value: formatCurrency(paidThisMonth), accent: '#76A58F', sub: 'collected' },
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

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { key: 'status', value: filters.status ?? 'all', options: [
            { value: 'all', label: 'All statuses' },
            { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' },
            { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }, { value: 'void', label: 'Void' },
          ]},
          { key: 'type', value: filters.type ?? 'all', options: [
            { value: 'all', label: 'All types' },
            { value: 'standard', label: 'Standard' }, { value: 'deposit', label: 'Deposit' }, { value: 'final', label: 'Final' },
          ]},
        ].map(f => (
          <Select key={f.key} value={f.value} onValueChange={v => updateFilter(f.key, v)}>
            <SelectTrigger style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.15)', color: '#4A5A65' }} className="w-36 text-sm rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.12)' }} className="rounded-none">
              {f.options.map(o => (
                <SelectItem key={o.value} value={o.value} style={{ color: '#1C2A35' }} className="text-sm">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {(filters.status || filters.type) && (
          <button style={{ color: '#8A9BA6' }} className="text-xs hover:text-[#2C3E50] transition-colors px-2"
            onClick={() => startTransition(() => router.push(pathname))}>
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className={`space-y-px ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        {invoices.length === 0 ? (
          <div style={{ border: '1px solid rgba(44,62,80,0.1)', backgroundColor: '#fff' }} className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-8 h-8" style={{ color: 'rgba(44,62,80,0.12)' }} />
            <p style={{ color: '#8A9BA6' }} className="text-xs">No invoices yet</p>
            <p style={{ color: '#8A9BA6', opacity: 0.6 }} className="text-[10px]">Invoices are created from approved quotes or jobs</p>
          </div>
        ) : invoices.map((inv, i) => {
          const contact = getContact(inv)
          const status = displayStatus(inv)
          const st = STATUS_STYLE[status] ?? STATUS_STYLE.draft
          const balanceDue = inv.total - inv.deposit_credit

          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              style={{
                backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8',
                borderLeft: `3px solid ${st.dot}`,
                borderBottom: '1px solid rgba(44,62,80,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '14px 16px',
                textDecoration: 'none',
                transition: 'background-color 150ms ease',
              }}
              className="group hover:bg-[#F0EDE8]"
            >
              {/* Invoice info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: '#8A9BA6', fontFamily: 'monospace', fontSize: '11px' }}>{inv.invoice_number}</span>
                  {inv.invoice_type !== 'standard' && (
                    <span style={{ color: '#76A58F', fontSize: '9px', letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '1px 6px' }} className="uppercase">{inv.invoice_type}</span>
                  )}
                </div>
                {contact && (
                  <p style={{ color: '#1C2A35', fontSize: '13px', fontWeight: 500 }} className="group-hover:text-[#2C3E50] transition-colors">
                    {contact.first_name} {contact.last_name}
                  </p>
                )}
                <p style={{ color: '#8A9BA6', fontSize: '11px', marginTop: 2 }}>
                  {formatDate(inv.created_at)}
                  {inv.due_date && <> · Due {formatDate(inv.due_date)}</>}
                  {inv.paid_at && <> · Paid {formatDate(inv.paid_at)}</>}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p style={{ fontFamily: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)", color: '#2C3E50', fontSize: '20px', lineHeight: 1 }}>
                  {formatCurrency(balanceDue)}
                </p>
                {inv.deposit_credit > 0 && (
                  <p style={{ color: '#8A9BA6', fontSize: '10px', marginTop: 2 }}>after {formatCurrency(inv.deposit_credit)} deposit</p>
                )}
                {!inv.deposit_credit && inv.tax > 0 && (
                  <p style={{ color: '#8A9BA6', fontSize: '10px', marginTop: 2 }}>incl. {formatCurrency(inv.tax)} GST</p>
                )}
              </div>

              {/* Status */}
              <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, letterSpacing: '0.08em', fontSize: '9px', padding: '2px 8px', flexShrink: 0 }} className="uppercase">
                {status}
              </span>

              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#8A9BA6' }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
