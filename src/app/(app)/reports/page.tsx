import { createClient, getAppProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsView } from '@/components/reports/reports-view'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user.id)
  if (!profile) return redirect('/login')

  const orgId = profile.org_id

  const [
    { data: jobs },
    { data: invoices },
    { data: payments },
    { data: expenses },
    { data: contacts },
    { data: timesheets },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('jobs').select('id, status, job_type, created_at, scheduled_start, users!jobs_assigned_to_fkey(full_name)').eq('org_id', orgId),
    supabase.from('invoices').select('id, total, amount_paid, status, due_date, paid_at, contacts!invoices_contact_id_fkey(id, first_name, last_name)').eq('org_id', orgId),
    supabase.from('payments').select('id, amount, recorded_at').eq('org_id', orgId),
    supabase.from('expenses').select('id, amount, expense_date').eq('org_id', orgId),
    supabase.from('contacts').select('id, first_name, last_name, created_at').eq('org_id', orgId),
    supabase.from('timesheets').select('id, total_minutes, clocked_in_at, users!timesheets_user_id_fkey(full_name)').eq('org_id', orgId).not('total_minutes', 'is', null),
    supabase.from('users').select('id, full_name, role').eq('org_id', orgId).neq('role', 'client'),
  ])

  const now = new Date()

  // Revenue by month (last 12)
  const revenueByMonth = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const revenue = (payments ?? [])
      .filter(p => { const pd = new Date(p.recorded_at); return pd.getFullYear() === year && pd.getMonth() === month })
      .reduce((s, p) => s + p.amount, 0)
    const exp = (expenses ?? [])
      .filter(e => { const ed = new Date(e.expense_date); return ed.getFullYear() === year && ed.getMonth() === month })
      .reduce((s, e) => s + e.amount, 0)
    return { label: `${MONTH_LABELS[month]} ${year !== now.getFullYear() ? year : ''}`.trim(), revenue, expenses: exp, profit: revenue - exp }
  })

  // Jobs by status
  const jobsByStatus = (jobs ?? []).reduce((acc: Record<string, number>, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1
    return acc
  }, {})

  // Jobs by month (last 6)
  const jobsByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const count = (jobs ?? []).filter(j => {
      const jd = new Date(j.created_at)
      return jd.getFullYear() === year && jd.getMonth() === month
    }).length
    return { label: MONTH_LABELS[month], count }
  })

  // Top clients by revenue
  const clientRevenue: Record<string, { name: string; total: number; invoiceCount: number }> = {}
  ;(invoices ?? []).forEach(inv => {
    const contact = Array.isArray(inv.contacts) ? inv.contacts[0] : inv.contacts
    if (!contact) return
    const key = contact.id
    if (!clientRevenue[key]) clientRevenue[key] = { name: `${contact.first_name} ${contact.last_name}`, total: 0, invoiceCount: 0 }
    clientRevenue[key].total += inv.amount_paid ?? 0
    clientRevenue[key].invoiceCount += 1
  })
  const topClients = Object.values(clientRevenue).sort((a, b) => b.total - a.total).slice(0, 8)

  // Technician performance
  const techPerformance = (teamMembers ?? []).map(member => {
    const memberJobs = (jobs ?? []).filter(j => {
      const assigned = Array.isArray(j.users) ? j.users[0] : j.users
      return assigned && assigned.full_name === member.full_name
    })
    const memberSheets = (timesheets ?? []).filter(t => {
      const u = Array.isArray(t.users) ? t.users[0] : t.users
      return u && u.full_name === member.full_name
    })
    const totalMinutes = memberSheets.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
    return {
      name: member.full_name ?? 'Unknown',
      role: member.role,
      jobsCompleted: memberJobs.filter(j => j.status === 'completed').length,
      jobsTotal: memberJobs.length,
      hoursLogged: Math.round(totalMinutes / 60),
    }
  }).filter(t => t.jobsTotal > 0 || t.hoursLogged > 0)

  // Summary stats
  const totalRevenue = (payments ?? []).reduce((s, p) => s + p.amount, 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0)
  const outstandingAmount = (invoices ?? []).filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0)
  const completionRate = (jobs ?? []).length > 0 ? Math.round(((jobsByStatus['completed'] ?? 0) / (jobs ?? []).length) * 100) : 0
  const newContactsThisMonth = (contacts ?? []).filter(c => {
    const cd = new Date(c.created_at)
    return cd.getFullYear() === now.getFullYear() && cd.getMonth() === now.getMonth()
  }).length

  return (
    <ReportsView
      revenueByMonth={revenueByMonth}
      jobsByStatus={jobsByStatus}
      jobsByMonth={jobsByMonth}
      topClients={topClients}
      techPerformance={techPerformance}
      totalRevenue={totalRevenue}
      totalExpenses={totalExpenses}
      outstandingAmount={outstandingAmount}
      completionRate={completionRate}
      newContactsThisMonth={newContactsThisMonth}
      totalJobs={jobs?.length ?? 0}
      totalContacts={contacts?.length ?? 0}
    />
  )
}
