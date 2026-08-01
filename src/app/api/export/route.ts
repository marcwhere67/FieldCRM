import { z } from 'zod'
import { requireRole, parseParams, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zDateOnly } from '@/lib/validation/common'
import { toCsv } from '@/lib/export/csv'
import {
  xeroInvoiceRows, myobInvoiceRows, basSummary, basSummaryRows,
  XERO_COLUMNS, MYOB_COLUMNS, BAS_COLUMNS,
  type ExportInvoice, type ExportExpense,
} from '@/lib/export/accounting'

// GET /api/export?type=xero-invoices|myob-invoices|bas&from=YYYY-MM-DD&to=YYYY-MM-DD
const querySchema = z.object({
  type: z.enum(['xero-invoices', 'myob-invoices', 'bas'], { error: 'Unknown export type' }),
  from: zDateOnly,
  to: zDateOnly,
})

// Column set + object shape line up 1:1, so `toCsv` gets a concrete row type.
const INVOICE_SELECT =
  'invoice_number, created_at, due_date, status, subtotal, tax, total, line_items, contacts!invoices_contact_id_fkey(first_name, last_name, company_name)'

export async function GET(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = parseParams(new URL(req.url).searchParams, querySchema)
  if (!parsed.ok) return parsed.response
  const { type, from, to } = parsed.data

  if (from > to) return jsonError('The "from" date must be on or before the "to" date', 400)

  // Inclusive of the whole "to" day.
  const toExclusive = new Date(`${to}T00:00:00.000Z`)
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
  const toIso = toExclusive.toISOString()
  const fromIso = `${from}T00:00:00.000Z`

  const { data: invRows, error: invErr } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('org_id', profile.org_id)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .order('created_at', { ascending: true })
    .limit(5000)
  if (invErr) return jsonError(friendlyDbError(invErr), 400)

  const invoices: ExportInvoice[] = (invRows ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts
    return {
      invoice_number: r.invoice_number,
      created_at: r.created_at,
      due_date: r.due_date,
      status: r.status,
      subtotal: Number(r.subtotal ?? 0),
      tax: Number(r.tax ?? 0),
      total: Number(r.total ?? 0),
      contact: contact ?? null,
      line_items: Array.isArray(r.line_items) ? r.line_items : [],
    }
  })

  let csv: string
  let filename: string

  if (type === 'xero-invoices') {
    csv = toCsv(xeroInvoiceRows(invoices), XERO_COLUMNS)
    filename = `xero-invoices_${from}_${to}.csv`
  } else if (type === 'myob-invoices') {
    csv = toCsv(myobInvoiceRows(invoices), MYOB_COLUMNS)
    filename = `myob-invoices_${from}_${to}.csv`
  } else {
    // BAS: also pull expenses in the period for the GST-on-purchases side.
    const { data: expRows, error: expErr } = await supabase
      .from('expenses')
      .select('expense_date, category, description, amount, tax_included')
      .eq('org_id', profile.org_id)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .limit(5000)
    if (expErr) return jsonError(friendlyDbError(expErr), 400)

    const expenses: ExportExpense[] = (expRows ?? []).map((e) => ({
      expense_date: e.expense_date,
      category: e.category,
      description: e.description,
      amount: Number(e.amount ?? 0),
      tax_included: e.tax_included ?? true,
    }))

    csv = toCsv(basSummaryRows(basSummary(invoices, expenses, { from, to })), BAS_COLUMNS)
    filename = `bas-gst-summary_${from}_${to}.csv`
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Financial data — never cache in a shared CDN.
      'Cache-Control': 'private, no-store',
    },
  })
}
