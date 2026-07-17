// Single source of truth for client-side money math on quotes/invoices.
// Mirrors the authoritative DB triggers (see supabase/migrations/p0_lockdown.sql,
// which recompute subtotal/tax/total server-side and ignore client values).
// Amounts are in DOLLARS (numeric(12,2)), not cents.

export interface MoneyLine {
  quantity: number
  unit_price: number
  tax_rate: number // percent, e.g. 10 for GST
  subtotal: number // quantity * unit_price (stored per line)
}

export type DepositType = 'none' | 'percentage' | 'fixed'

// Round to whole cents (avoids float drift like 0.1 + 0.2).
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// A single line's subtotal.
export function lineSubtotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice)
}

// Totals across all lines. Tax is summed per line so mixed tax rates work.
export function computeTotals(lines: MoneyLine[]): { subtotal: number; tax: number; total: number } {
  const subtotal = roundMoney(lines.reduce((s, i) => s + i.subtotal, 0))
  const tax = roundMoney(lines.reduce((s, i) => s + (i.subtotal * i.tax_rate) / 100, 0))
  const total = roundMoney(subtotal + tax)
  return { subtotal, tax, total }
}

// Deposit amount for a given deposit configuration.
export function depositAmount(type: DepositType, value: number, total: number): number {
  if (type === 'none') return 0
  if (type === 'percentage') return roundMoney((total * value) / 100)
  return roundMoney(value) // fixed
}
