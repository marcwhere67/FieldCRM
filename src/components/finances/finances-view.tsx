'use client'

import { useState } from 'react'
import { LogExpenseModal } from './log-expense-modal'
import { toast } from 'sonner'
import { RevenueChart } from './revenue-chart'
import { formatCurrency, formatDate } from '@/lib/format'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Plus, Receipt, ArrowUpRight, Trash2 } from 'lucide-react'
import Link from 'next/link'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const CATEGORY_DOT: Record<string, string> = {
  Materials: '#3b82f6', Labour: '#8b5cf6', Equipment: '#7c3aed',
  Fuel: '#f59e0b', Vehicle: '#f97316', Marketing: '#ec4899',
  Software: '#06b6d4', Insurance: '#14b8a6', Subcontractor: '#10b981', Other: '#8A9BA6',
}

interface Invoice { id: string; invoice_number: string; status: string; total: number; amount_paid: number; due_date: string | null; paid_at: string | null; contacts: { first_name: string; last_name: string } | null }
interface Payment { id: string; amount: number; method: string; recorded_at: string; invoices: { invoice_number: string } | null; contacts: { first_name: string; last_name: string } | null }
interface Expense { id: string; category: string; description: string | null; amount: number; expense_date: string; tax_included: boolean; job_id: string | null; jobs: { title: string } | null }
interface MonthBar { label: string; revenue: number; expenses: number }
interface Props { invoices: Invoice[]; payments: Payment[]; initialExpenses: Expense[]; chartData: MonthBar[]; canManage: boolean }

export function FinancesView({ invoices, payments, initialExpenses, chartData, canManage }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showLogExpense, setShowLogExpense] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDeleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setExpenses(prev => prev.filter(e => e.id !== id)); toast.success('Expense deleted')
    } catch { toast.error('Failed to delete expense') }
    finally { setDeletingId(null) }
  }

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const outstanding = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0)
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')
  const outstandingInvoices = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).slice(0, 8)
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc }, {})
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxExpense = sortedCategories[0]?.[1] ?? 1

  const statCards = [
    { label: 'Total Revenue',  value: totalRevenue,  icon: TrendingUp,   accent: C.sage,    sub: `${payments.length} payments received` },
    { label: 'Total Expenses', value: totalExpenses,  icon: TrendingDown, accent: '#dc2626', sub: `${expenses.length} expenses logged` },
    { label: 'Net Profit',     value: netProfit,      icon: DollarSign,   accent: netProfit >= 0 ? C.navy : '#dc2626', sub: totalRevenue > 0 ? `${Math.round((netProfit / totalRevenue) * 100)}% margin` : '' },
    { label: 'Outstanding',    value: outstanding,    icon: AlertCircle,  accent: overdueInvoices.length > 0 ? '#b45309' : C.navy, sub: overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : 'All current' },
  ]

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Business</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Finances</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Revenue, expenses and outstanding invoices at a glance</p>
        </div>
        {canManage && (
          <button onClick={() => setShowLogExpense(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />Log Expense
          </button>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, accent, sub }) => (
            <div key={label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${accent}`, padding: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon style={{ width: 14, height: 14, color: accent }} />
                <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
              </div>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24 }}>{formatCurrency(value)}</p>
              {sub && <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* Chart + expense breakdown */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <RevenueChart data={chartData} />
          </div>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', marginBottom: 14 }}>Expenses by Category</p>
            {sortedCategories.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13 }}>No expenses logged yet</p>
            ) : (
              <div className="space-y-3">
                {sortedCategories.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ color: '#4A5A65', fontSize: 12 }} className="flex items-center gap-1.5">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: CATEGORY_DOT[cat] ?? C.muted, flexShrink: 0, display: 'inline-block' }} />
                        {cat}
                      </span>
                      <span style={{ color: C.muted, fontSize: 11 }}>{formatCurrency(amt)}</span>
                    </div>
                    <div style={{ height: 3, backgroundColor: 'rgba(44,62,80,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(amt / maxExpense) * 100}%`, backgroundColor: CATEGORY_DOT[cat] ?? C.muted, transition: 'width 500ms ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Outstanding + recent payments */}
        <div className="grid grid-cols-2 gap-6">
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }} className="flex items-center justify-between">
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Outstanding Invoices</p>
              <Link href="/invoices" style={{ color: C.sage, fontSize: 11 }} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                View all <ArrowUpRight style={{ width: 11, height: 11 }} />
              </Link>
            </div>
            {outstandingInvoices.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>All invoices paid</div>
            ) : (
              <div className="divide-y divide-[rgba(44,62,80,0.07)]">
                {outstandingInvoices.map((inv, i) => {
                  const balance = inv.total - inv.amount_paid
                  const isOverdue = inv.status === 'overdue'
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}
                      className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                      <div>
                        <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>{inv.invoice_number}</p>
                        <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
                          {inv.contacts ? `${inv.contacts.first_name} ${inv.contacts.last_name}` : 'Unknown'}
                          {inv.due_date && <span style={{ color: isOverdue ? '#dc2626' : C.muted }}> · Due {formatDate(inv.due_date)}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p style={{ fontFamily: C.serif, color: isOverdue ? '#dc2626' : C.navy, fontSize: 15 }}>{formatCurrency(balance)}</p>
                        <p style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>{inv.status}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }}>
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Recent Payments</p>
            </div>
            {payments.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No payments yet</div>
            ) : (
              <div className="divide-y divide-[rgba(44,62,80,0.07)]">
                {payments.slice(0, 8).map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: 28, height: 28, backgroundColor: 'rgba(118,165,143,0.1)', color: C.sage, flexShrink: 0 }} className="flex items-center justify-center">
                        <Receipt style={{ width: 13, height: 13 }} />
                      </div>
                      <div>
                        <p style={{ color: C.fg, fontSize: 12 }}>{p.contacts ? `${p.contacts.first_name} ${p.contacts.last_name}` : 'Unknown'}</p>
                        <p style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{p.invoices?.invoice_number} · {p.method} · {formatDate(p.recorded_at)}</p>
                      </div>
                    </div>
                    <p style={{ fontFamily: C.serif, color: C.sage, fontSize: 15 }}>{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent expenses */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}` }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 16px' }} className="flex items-center justify-between">
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Recent Expenses</p>
            {canManage && (
              <button onClick={() => setShowLogExpense(true)} style={{ color: C.sage, fontSize: 11 }} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
                <Plus style={{ width: 11, height: 11 }} />Log Expense
              </button>
            )}
          </div>
          {expenses.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No expenses logged yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Date','Category','Description','Amount','Tax',''].map((h, i) => (
                    <th key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400, padding: '8px 14px', textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 10).map((e, i) => (
                  <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }} className="group hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                    <td style={{ color: C.muted, fontSize: 12, padding: '10px 14px' }}>{formatDate(e.expense_date)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: '#4A5A65', fontSize: 12 }} className="flex items-center gap-1.5">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: CATEGORY_DOT[e.category] ?? C.muted, flexShrink: 0, display: 'inline-block' }} />
                        {e.category}
                      </span>
                    </td>
                    <td style={{ color: C.muted, fontSize: 12, padding: '10px 14px' }}>{e.description ?? '—'}</td>
                    <td style={{ fontFamily: C.serif, color: '#dc2626', fontSize: 14, padding: '10px 14px', textAlign: 'right' }}>{formatCurrency(e.amount)}</td>
                    <td style={{ color: C.muted, fontSize: 10, padding: '10px 14px' }}>{e.tax_included ? 'incl. GST' : 'ex-GST'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {canManage && (
                        <button onClick={() => handleDeleteExpense(e.id)} disabled={deletingId === e.id}
                          style={{ color: C.muted, width: 28, height: 28, opacity: 0 }} className="flex items-center justify-center group-hover:opacity-100 hover:text-[#dc2626] transition-all">
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <LogExpenseModal open={showLogExpense} onClose={() => setShowLogExpense(false)} onSaved={e => setExpenses(prev => [e, ...prev])} />
    </div>
  )
}
