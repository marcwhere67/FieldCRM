import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody, requireRole, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zLineItems } from '@/lib/validation/common'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/invoices/[id]'

const bodySchema = z.object({
  line_items: zLineItems.min(1, 'Add at least one line item'),
})

// Amend an existing invoice's line items (scope changes / add-ons). Only
// unpaid, non-void invoices can be edited — a paid or part-paid invoice must
// stay as issued, so extra work goes on a NEW invoice instead. Totals are
// recomputed by the recompute_document_totals trigger on line_items update,
// so we send line_items only (same as POST /api/invoices). The invoice_number
// is never touched, so gapless numbering is unaffected.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const body = await parseBody(req, bodySchema)
  if (!body.ok) return body.response
  const { line_items } = body.data

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, amount_paid')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return jsonError('Invoice not found', 404)

  if (invoice.status === 'void') {
    return jsonError('A void invoice can’t be edited.', 422)
  }
  if (Number(invoice.amount_paid ?? 0) > 0) {
    return jsonError('This invoice already has a payment recorded and can’t be edited. Create a new invoice for the additional work.', 422)
  }

  const { error } = await supabase
    .from('invoices')
    .update({ line_items })
    .eq('id', id)
    .eq('org_id', profile.org_id)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { invoiceId: id },
    })
    return jsonError(friendlyDbError(error), 500)
  }

  return NextResponse.json({ id, status: invoice.status })
}
