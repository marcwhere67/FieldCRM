import { createClient, getAppProfile } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Briefcase, Receipt, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { AiInsightsCard } from '@/components/ai/ai-insights-card'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  const orgId = profile?.org_id

  const [
    { count: activeClients },
    { data: todayJobs },
    { data: outstandingInvoices },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'active'),
    supabase.from('jobs').select('id, job_number, title, status, scheduled_start, scheduled_end, contact_id')
      .eq('org_id', orgId)
      .gte('scheduled_start', new Date().toISOString().split('T')[0])
      .lt('scheduled_start', new Date(Date.now() + 86400000).toISOString().split('T')[0])
      .order('scheduled_start'),
    supabase.from('invoices').select('total, amount_paid')
      .eq('org_id', orgId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue']),
    supabase.from('invoices').select('id, invoice_number, total, status, contact_id, contacts(first_name, last_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const outstanding = outstandingInvoices?.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0) ?? 0

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const jobStatusStyle: Record<string, { variant: string; label: string }> = {
    draft:       { variant: 'secondary', label: 'Draft' },
    scheduled:   { variant: 'blue',     label: 'Scheduled' },
    in_progress: { variant: 'amber',    label: 'In Progress' },
    completed:   { variant: 'sage',     label: 'Completed' },
    cancelled:   { variant: 'red',      label: 'Cancelled' },
    invoiced:    { variant: 'purple',   label: 'Invoiced' },
    paid:        { variant: 'sage',     label: 'Paid' },
  }

  const invoiceStatusStyle: Record<string, { variant: string; label: string }> = {
    draft:   { variant: 'secondary', label: 'Draft' },
    sent:    { variant: 'blue',      label: 'Sent' },
    viewed:  { variant: 'navy',      label: 'Viewed' },
    partial: { variant: 'amber',     label: 'Partial' },
    paid:    { variant: 'sage',      label: 'Paid' },
    overdue: { variant: 'red',       label: 'Overdue' },
    void:    { variant: 'secondary', label: 'Void' },
  }

  return (
    <div className="space-y-8 max-w-7xl">

      {/* Page header */}
      <div style={{ borderBottom: '1px solid rgba(44,62,80,0.1)' }} className="pb-6">
        <p style={{ color: '#76A58F', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-1">{greeting}</p>
        <h1 style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", color: '#2C3E50' }} className="text-4xl font-light">{firstName}</h1>
        <p style={{ color: '#8A9BA6' }} className="text-sm mt-1">
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users className="w-4 h-4" style={{ color: '#76A58F' }} />}
          label="Active Clients"
          value={String(activeClients ?? 0)}
          sub="total clients"
          accent="#76A58F"
        />
        <MetricCard
          icon={<Briefcase className="w-4 h-4" style={{ color: '#2C3E50' }} />}
          label="Jobs Today"
          value={String(todayJobs?.length ?? 0)}
          sub="scheduled"
          accent="#2C3E50"
        />
        <MetricCard
          icon={<Receipt className="w-4 h-4" style={{ color: '#b45309' }} />}
          label="Outstanding"
          value={formatCurrency(outstanding)}
          sub="unpaid invoices"
          accent="#b45309"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" style={{ color: '#76A58F' }} />}
          label="MTD Revenue"
          value="$0"
          sub="this month"
          accent="#76A58F"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50', fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", fontSize: '18px', fontWeight: 400 }}>
                <Clock className="w-4 h-4" style={{ color: '#76A58F' }} />
                Today&apos;s Schedule
              </CardTitle>
              <Link href="/schedule" style={{ color: '#76A58F' }} className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pb-4">
            {todayJobs && todayJobs.length > 0 ? todayJobs.map((job, i) => (
              <div
                key={job.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#fff' : '#F5F0EB',
                  borderBottom: '1px solid rgba(44,62,80,0.06)',
                }}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#EDE8E2] group"
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#1C2A35' }} className="text-sm truncate group-hover:text-[#2C3E50]">{job.title}</p>
                  <p style={{ color: '#8A9BA6' }} className="text-xs">
                    {job.scheduled_start ? new Date(job.scheduled_start).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : 'No time set'}
                  </p>
                </div>
                <StatusBadge info={jobStatusStyle[job.status] ?? { variant: 'secondary', label: job.status }} />
              </div>
            )) : (
              <EmptyRow icon={<Clock className="w-5 h-5" />} message="No jobs scheduled today" />
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50', fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", fontSize: '18px', fontWeight: 400 }}>
                <Receipt className="w-4 h-4" style={{ color: '#76A58F' }} />
                Recent Invoices
              </CardTitle>
              <Link href="/invoices" style={{ color: '#76A58F' }} className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pb-4">
            {recentInvoices && recentInvoices.length > 0 ? recentInvoices.map((inv, i) => {
              const contact = Array.isArray(inv.contacts) ? inv.contacts[0] : inv.contacts
              return (
                <div
                  key={inv.id}
                  style={{
                    backgroundColor: i % 2 === 0 ? '#fff' : '#F5F0EB',
                    borderBottom: '1px solid rgba(44,62,80,0.06)',
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#EDE8E2]"
                >
                  <div className="flex-1 min-w-0">
                    <p style={{ color: '#1C2A35' }} className="text-sm font-medium">{inv.invoice_number}</p>
                    <p style={{ color: '#8A9BA6' }} className="text-xs">
                      {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p style={{ color: '#1C2A35', fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)" }} className="text-base font-normal">{formatCurrency(inv.total)}</p>
                    <StatusBadge info={invoiceStatusStyle[inv.status] ?? { variant: 'secondary', label: inv.status }} />
                  </div>
                </div>
              )
            }) : (
              <EmptyRow icon={<Receipt className="w-5 h-5" />} message="No invoices yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <AiInsightsCard />

      {/* Quick Actions */}
      <div>
        <p style={{ color: '#8A9BA6', letterSpacing: '0.2em' }} className="text-[10px] uppercase mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'New Job',     href: '/jobs',      primary: true },
            { label: 'New Quote',   href: '/quotes',    primary: false },
            { label: 'New Contact', href: '/contacts',  primary: false },
            { label: 'Clock In',    href: '/clock',     primary: false },
            { label: 'Field Map',   href: '/field-map', primary: false },
          ].map(action => (
            <a
              key={action.label}
              href={action.href}
              style={action.primary
                ? { backgroundColor: '#2C3E50', color: '#fff', letterSpacing: '0.1em' }
                : { backgroundColor: '#fff', color: '#2C3E50', border: '1px solid rgba(44,62,80,0.15)', letterSpacing: '0.1em' }
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-normal transition-all hover:opacity-80 active:scale-[0.98]"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div style={{ borderTop: `2px solid ${accent}` }} className="pt-4">
          <div className="flex items-start justify-between mb-3">
            <p style={{ color: '#8A9BA6', letterSpacing: '0.15em' }} className="text-[9px] uppercase">{label}</p>
            <div style={{ color: accent }} className="opacity-70">{icon}</div>
          </div>
          <p style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)", color: '#2C3E50', lineHeight: 1 }} className="text-4xl font-light">{value}</p>
          <p style={{ color: '#8A9BA6' }} className="text-xs mt-2">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ info }: { info: { variant: string; label: string } }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    secondary: { bg: '#EDE8E2',                  color: '#4A5A65', border: 'transparent' },
    sage:      { bg: 'rgba(118,165,143,0.12)',    color: '#5d8c76', border: 'rgba(118,165,143,0.3)' },
    navy:      { bg: 'rgba(44,62,80,0.08)',       color: '#2C3E50', border: 'rgba(44,62,80,0.15)' },
    amber:     { bg: 'rgba(217,119,6,0.08)',      color: '#b45309', border: 'rgba(217,119,6,0.2)' },
    red:       { bg: 'rgba(220,38,38,0.08)',      color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
    blue:      { bg: 'rgba(37,99,235,0.08)',      color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
    purple:    { bg: 'rgba(124,58,237,0.08)',     color: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
  }
  const s = styles[info.variant] ?? styles.secondary
  return (
    <span
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: '0.08em' }}
      className="inline-flex items-center px-2 py-0.5 text-[9px] uppercase font-normal"
    >
      {info.label}
    </span>
  )
}

function EmptyRow({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: '#8A9BA6' }}>
      <div style={{ color: 'rgba(44,62,80,0.15)' }} className="w-10 h-10 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-xs">{message}</p>
    </div>
  )
}
