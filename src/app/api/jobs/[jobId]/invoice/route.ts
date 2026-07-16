import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  subtotal: number
}

export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Invoices are manager+ only (matches Track A RLS)
  if (!['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only managers or admins can create invoices' }, { status: 403 })
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, org_id, contact_id, quote_id, title, invoice_id, materials_used')
    .eq('id', jobId)
    .eq('org_id', profile.org_id)
    .single()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (job.invoice_id) {
    return NextResponse.json({ error: 'This job already has an invoice', id: job.invoice_id }, { status: 409 })
  }

  // Build line items: prefer the linked quote's items, then job materials, else a single line from the title.
  let lineItems: LineItem[] = []

  if (job.quote_id) {
    const { data: quote } = await supabase
      .from('quotes').select('line_items').eq('id', job.quote_id).eq('org_id', profile.org_id).single()
    if (quote?.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) {
      lineItems = quote.line_items as LineItem[]
    }
  }

  if (lineItems.length === 0 && Array.isArray(job.materials_used) && job.materials_used.length > 0) {
    lineItems = job.materials_used.map((m: { name: string; qty: number; unit_price: number }) => ({
      description: m.name,
      quantity: Number(m.qty) || 1,
      unit_price: Number(m.unit_price) || 0,
      tax_rate: 10,
      subtotal: (Number(m.qty) || 1) * (Number(m.unit_price) || 0),
    }))
  }

  if (lineItems.length === 0) {
    lineItems = [{ description: job.title, quantity: 1, unit_price: 0, tax_rate: 10, subtotal: 0 }]
  }

  const { data: org } = await supabase
    .from('organisations').select('default_payment_terms_days').eq('id', profile.org_id).single()
  const termsDays = org?.default_payment_terms_days ?? 14
  const dueDate = new Date(Date.now() + termsDays * 86400000).toISOString().split('T')[0]

  // invoice_number + totals are assigned by DB triggers (Track A).
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      org_id: profile.org_id,
      contact_id: job.contact_id,
      job_id: job.id,
      quote_id: job.quote_id ?? null,
      status: 'draft',
      invoice_type: 'standard',
      line_items: lineItems,
      due_date: dueDate,
    })
    .select('id')
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? 'Failed to create invoice' }, { status: 400 })
  }

  const { error: jobErr } = await supabase
    .from('jobs')
    .update({ invoice_id: invoice.id, status: 'invoiced' })
    .eq('id', job.id)

  if (jobErr) {
    // Invoice exists but the link failed — surface it rather than pretending all is well.
    return NextResponse.json(
      { id: invoice.id, warning: 'Invoice created but job status was not updated' },
      { status: 200 },
    )
  }

  return NextResponse.json({ id: invoice.id })
}
