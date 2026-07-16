import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const {
    name, abn, phone, email, address, default_payment_terms_days, timezone,
    bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions,
  } = body

  const { data, error } = await supabase
    .from('organisations')
    .update({
      name, abn, phone, email, address, default_payment_terms_days, timezone,
      bank_account_name: bank_account_name || null,
      bank_bsb: bank_bsb || null,
      bank_account_number: bank_account_number || null,
      bank_payid: bank_payid || null,
      payment_instructions: payment_instructions || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
