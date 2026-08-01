import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, requireRole, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zUuid, zLineItems } from '@/lib/validation/common'
import { melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/invoices'

const bodySchema = z.object({
  contact_id: zUuid,
  line_items: zLineItems.min(1, 'Add at least one line item'),
})

// Standalone invoice — no quote/job behind it. Used for clients billed
// per-visit with no quote step, e.g. Airbnb/property-manager cleans.
export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const body = await parseBody(req, bodySchema)
  if (!body.ok) return body.response
  const { contact_id, line_items } = body.data

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contact_id)
    .eq('org_id', profile.org_id)
    .single()
  if (!contact) return jsonError('Client not found', 404)

  const { data: org } = await supabase
    .from('organisations').select('default_payment_terms_days').eq('id', profile.org_id).single()
  const termsDays = org?.default_payment_terms_days ?? 14
  const dueDate = melbourneDateOnly(new Date(Date.now() + termsDays * 86400000))

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      org_id: profile.org_id,
      contact_id,
      job_id: null,
      quote_id: null,
      status: 'draft',
      invoice_type: 'standard',
      line_items,
      due_date: dueDate,
    })
    .select('id')
    .single()

  if (invErr || !invoice) {
    await captureError(invErr ?? new Error('Invoice insert returned no row'), {
      source: SOURCE, level: 'critical', orgId: profile.org_id, userId: profile.id,
      context: { contactId: contact_id },
    })
    return jsonError(invErr ? friendlyDbError(invErr) : 'Failed to create invoice', 400)
  }

  return NextResponse.json({ id: invoice.id })
}
