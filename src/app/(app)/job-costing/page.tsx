import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { computeTotals, type MoneyLine } from '@/lib/money'
import { JobCostingView, type CostRow } from '@/components/finances/job-costing-view'

function one<T>(v: T | T[] | null): T | null { return Array.isArray(v) ? (v[0] ?? null) : v }

export default async function JobCostingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getAppProfile(user!.id)
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const org = profile.org_id

  // Completed / invoiced / paid jobs are the ones worth costing.
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, status, scheduled_start, line_items, contacts!jobs_contact_id_fkey(id, first_name, last_name)')
    .eq('org_id', org)
    .in('status', ['completed', 'invoiced', 'paid'])
    .order('scheduled_start', { ascending: false })
    .limit(300)

  const jobIds = (jobs ?? []).map(j => j.id)

  const [{ data: invoices }, { data: timesheets }, { data: expenses }] = jobIds.length
    ? await Promise.all([
        supabase.from('invoices').select('job_id, total').eq('org_id', org).in('job_id', jobIds),
        supabase.from('timesheets').select('job_id, total_minutes, users!timesheets_user_id_fkey(hourly_rate)').eq('org_id', org).in('job_id', jobIds),
        supabase.from('expenses').select('job_id, amount').eq('org_id', org).in('job_id', jobIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  // Aggregate cost inputs per job.
  const revenueByJob = new Map<string, number>()
  for (const inv of invoices ?? []) revenueByJob.set(inv.job_id, (revenueByJob.get(inv.job_id) ?? 0) + Number(inv.total || 0))

  const labourByJob = new Map<string, number>()
  for (const ts of timesheets ?? []) {
    const rate = Number(one(ts.users as never)?.['hourly_rate'] ?? 0)
    const hours = (Number(ts.total_minutes) || 0) / 60
    labourByJob.set(ts.job_id, (labourByJob.get(ts.job_id) ?? 0) + hours * rate)
  }

  const expenseByJob = new Map<string, number>()
  for (const ex of expenses ?? []) expenseByJob.set(ex.job_id, (expenseByJob.get(ex.job_id) ?? 0) + Number(ex.amount || 0))

  const rows: CostRow[] = (jobs ?? []).map(j => {
    const contact = one(j.contacts as never) as { first_name: string; last_name: string } | null
    // Revenue: the linked invoice if there is one, else the job's own line items.
    const invoiced = revenueByJob.get(j.id)
    const revenue = invoiced != null ? invoiced
      : computeTotals((Array.isArray(j.line_items) ? j.line_items : []) as MoneyLine[]).total
    const labour = Math.round((labourByJob.get(j.id) ?? 0) * 100) / 100
    const materials = Math.round((expenseByJob.get(j.id) ?? 0) * 100) / 100
    const margin = Math.round((revenue - labour - materials) * 100) / 100
    return {
      id: j.id, job_number: j.job_number, title: j.title, status: j.status,
      scheduled_start: j.scheduled_start,
      customer: contact ? `${contact.first_name} ${contact.last_name}` : '—',
      revenue, labour, materials, margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 100) : null,
    }
  })

  return <JobCostingView rows={rows} />
}
