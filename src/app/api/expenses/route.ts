import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zMoneyInput, zRequiredText, zNullableText, zOptionalUuid, zDateOnly } from '@/lib/validation/common'
import { melbourneDateOnly } from '@/lib/format'

const expenseSchema = z.object({
  category: zRequiredText(100),
  description: zNullableText(500),
  amount: zMoneyInput,
  job_id: zOptionalUuid,
  // Absent means "today in Melbourne" — but a supplied date must be a real one.
  expense_date: zDateOnly.optional(),
  tax_included: z.boolean().default(true),
})

export async function GET() {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { supabase } = auth.data

  const { data, error } = await supabase
    .from('expenses')
    .select('*, jobs(title)')
    .order('expense_date', { ascending: false })
    .limit(500)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, expenseSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      org_id: profile.org_id,
      category: body.category,
      description: body.description,
      amount: body.amount,
      job_id: body.job_id,
      expense_date: body.expense_date ?? melbourneDateOnly(),
      tax_included: body.tax_included,
      recorded_by: profile.id,
    })
    .select('*, jobs(title)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data, { status: 201 })
}
