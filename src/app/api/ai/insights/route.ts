import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('supabase_auth_id', user.id)
    .single()

  const orgId = profile!.org_id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString()

  const [
    { data: recentJobs },
    { data: recentInvoices },
    { data: prevInvoices },
    { data: overdueInvoices },
    { count: activeContacts },
    { data: jobsByStatus },
  ] = await Promise.all([
    supabase.from('jobs').select('status, job_type, scheduled_start').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('invoices').select('total, amount_paid, status').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('invoices').select('total, amount_paid').eq('org_id', orgId).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
    supabase.from('invoices').select('total, amount_paid, due_date').eq('org_id', orgId).eq('status', 'overdue'),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
    supabase.from('jobs').select('status').eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
  ])

  const revenue30 = (recentInvoices ?? []).reduce((s, i) => s + (i.amount_paid ?? 0), 0)
  const revenue30prev = (prevInvoices ?? []).reduce((s, i) => s + (i.amount_paid ?? 0), 0)
  const overdueTotal = (overdueInvoices ?? []).reduce((s, i) => s + (i.total - i.amount_paid), 0)
  const completedJobs = (recentJobs ?? []).filter(j => j.status === 'completed').length
  const cancelledJobs = (recentJobs ?? []).filter(j => j.status === 'cancelled').length
  const jobTypes = (recentJobs ?? []).reduce((acc: Record<string, number>, j) => {
    acc[j.job_type] = (acc[j.job_type] ?? 0) + 1
    return acc
  }, {})

  const prompt = `You are a business analyst for a field service company. Analyze the following 30-day performance data and provide 3-4 concise, actionable insights.

Last 30 days:
- Revenue collected: $${revenue30.toFixed(2)}
- Previous 30 days revenue: $${revenue30prev.toFixed(2)}
- Revenue change: ${revenue30prev > 0 ? (((revenue30 - revenue30prev) / revenue30prev) * 100).toFixed(1) : 'N/A'}%
- Total jobs created: ${(recentJobs ?? []).length}
- Completed jobs: ${completedJobs}
- Cancelled jobs: ${cancelledJobs}
- Overdue invoices total: $${overdueTotal.toFixed(2)} (${(overdueInvoices ?? []).length} invoices)
- Active clients: ${activeContacts ?? 0}
- Job types breakdown: ${JSON.stringify(jobTypes)}

Format your response as a JSON array of insight objects with keys: type ("positive"|"warning"|"info"), title (max 6 words), body (1-2 sentences max).
Return ONLY the JSON array, no markdown, no explanation.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
    let insights: { type: string; title: string; body: string }[] = []
    try {
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
      insights = JSON.parse(cleaned)
    } catch {
      insights = []
    }
    return NextResponse.json({ insights })
  } catch {
    // AI unavailable (no credits, key not set, etc.) — return empty silently
    return NextResponse.json({ insights: [] })
  }
  } catch (e: any) {
    console.error('AI insights error:', e)
    return NextResponse.json({ insights: [] })
  }
}
