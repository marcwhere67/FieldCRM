import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id, role, id').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // When marking as received, auto-create an expense entry
  if (body.status === 'received' && !body.expense_id) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('id', id).single()

    if (po) {
      const supplierName = Array.isArray(po.suppliers) ? po.suppliers[0]?.name : (po.suppliers as { name: string } | null)?.name
      const { data: expense } = await supabase.from('expenses').insert({
        org_id: profile.org_id,
        job_id: po.job_id ?? null,
        category: 'Materials & Supplies',
        description: `PO ${po.po_number} — ${supplierName ?? 'Supplier'}`,
        amount: po.total,
        tax_included: true,
        recorded_by: profile.id,
        expense_date: new Date().toISOString().split('T')[0],
      }).select('id').single()

      if (expense) body.expense_id = expense.id
    }

    body.received_date = new Date().toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('purchase_orders').update(body).eq('id', id).eq('org_id', profile.org_id)
    .select(`*, suppliers(id, name)`).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('purchase_orders').delete().eq('id', id).eq('org_id', profile.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
