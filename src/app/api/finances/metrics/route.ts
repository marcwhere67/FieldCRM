import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'month' // day, week, month, year

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const orgId = profile.org_id

  // Calculate date range based on period
  const now = new Date()
  let startDate = new Date()
  let groupBy = 'day'

  switch (period) {
    case 'day':
      startDate.setDate(now.getDate() - 7)
      groupBy = 'day'
      break
    case 'week':
      startDate.setDate(now.getDate() - 28)
      groupBy = 'week'
      break
    case 'month':
      startDate.setMonth(now.getMonth() - 12)
      groupBy = 'month'
      break
    case 'year':
      startDate.setFullYear(now.getFullYear() - 3)
      groupBy = 'year'
      break
  }

  // Get revenue (invoices)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total, amount_paid, created_at, status')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())

  // Get quotes (for conversion rate)
  const { data: quotes } = await supabase
    .from('quotes')
    .select('status, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())

  // Calculate metrics
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0
  const paidRevenue = invoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0
  const outstandingRevenue = totalRevenue - paidRevenue

  const quoteSent = quotes?.length || 0
  const quoteApproved = quotes?.filter(q => q.status === 'approved').length || 0
  const conversionRate = quoteSent > 0 ? ((quoteApproved / quoteSent) * 100).toFixed(1) : '0'
  const pendingQuoteValue = quotes?.filter(q => q.status === 'pending' || q.status === 'sent').length || 0

  // Group by period for chart data
  const chartData = groupByPeriod(invoices || [], groupBy)

  return NextResponse.json({
    metrics: {
      totalRevenue,
      outstandingRevenue,
      conversionRate: parseFloat(conversionRate as string),
      pendingQuoteValue,
    },
    chartData,
    period,
  })
}

function groupByPeriod(invoices: any[], groupBy: string) {
  const grouped: Record<string, number> = {}

  invoices.forEach(inv => {
    const date = new Date(inv.created_at)
    let key = ''

    switch (groupBy) {
      case 'day':
        key = date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = `Week ${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`
        break
      case 'month':
        key = date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
        break
      case 'year':
        key = date.getFullYear().toString()
        break
    }

    grouped[key] = (grouped[key] || 0) + (inv.total || 0)
  })

  return Object.entries(grouped)
    .sort((a, b) => {
      const dateA = new Date(a[0])
      const dateB = new Date(b[0])
      return dateA.getTime() - dateB.getTime()
    })
    .map(([label, value]) => ({ label, value }))
}
