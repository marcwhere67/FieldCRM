import { createClient, getAppProfile } from '@/lib/supabase/server'
import { FinancesView } from '@/components/finances/finances-view'
import { redirect } from 'next/navigation'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default async function FinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [
    { data: invoices },
    { data: payments },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, amount_paid, due_date, paid_at, contacts!invoices_contact_id_fkey(first_name, last_name)')
      .order('due_date', { ascending: true }),
    supabase
      .from('payments')
      .select('id, amount, method, recorded_at, invoices(invoice_number), contacts!payments_contact_id_fkey(first_name, last_name)')
      .order('recorded_at', { ascending: false }),
    supabase
      .from('expenses')
      .select('*, jobs(title)')
      .order('expense_date', { ascending: false }),
  ])

  // Build last 6 months chart data
  const now = new Date()
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = MONTH_LABELS[month]

    const revenue = (payments ?? [])
      .filter(p => {
        const pd = new Date(p.recorded_at)
        return pd.getFullYear() === year && pd.getMonth() === month
      })
      .reduce((s, p) => s + p.amount, 0)

    const exp = (expenses ?? [])
      .filter(e => {
        const ed = new Date(e.expense_date)
        return ed.getFullYear() === year && ed.getMonth() === month
      })
      .reduce((s, e) => s + e.amount, 0)

    return { label, revenue, expenses: exp }
  })

  // Normalise joins (Supabase returns arrays for joins)
  const normInvoices = (invoices ?? []).map(inv => ({
    ...inv,
    contacts: Array.isArray(inv.contacts) ? inv.contacts[0] ?? null : inv.contacts,
  }))

  const normPayments = (payments ?? []).map(p => ({
    ...p,
    contacts: Array.isArray(p.contacts) ? p.contacts[0] ?? null : p.contacts,
    invoices: Array.isArray(p.invoices) ? p.invoices[0] ?? null : p.invoices,
  }))

  return (
    <FinancesView
      invoices={normInvoices}
      payments={normPayments}
      initialExpenses={expenses ?? []}
      chartData={chartData}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
