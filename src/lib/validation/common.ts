// Shared Zod primitives for request validation (SPEC.md §1 rule 2).
//
// Every route handler that mutates data parses its body through one of these
// schemas via `parseBody()` in src/lib/http.ts. Hand-rolled `String(body.x)`
// coercion is not acceptable: it silently turns `undefined` into "undefined"
// and lets unknown keys through to the insert.
import { z } from 'zod'

// Deliberately laxer than `z.uuid()`. Zod 4's built-in enforces the RFC 4122
// version/variant nibbles, which would reject this app's own seeded identifiers
// (e.g. the demo org `00000000-0000-0000-0000-000000000001`). Postgres `uuid`
// accepts any 32 hex digits, so we match Postgres, not the RFC.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const zUuid = z.string().regex(UUID_RE, 'Must be a valid ID')

/** Optional foreign key: absent, null, or an empty string all mean "not set". */
export const zOptionalUuid = z
  .union([zUuid, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

/**
 * A money amount in dollars, as stored today (`numeric(12,2)`).
 *
 * ASSUMPTION (DECISIONS.md D-002): SPEC.md mandates integer cents, but the live
 * schema stores dollars. This schema enforces the *invariants* cents would give
 * us — finite, non-negative, at most 2 decimal places — so the cents migration
 * later becomes a representation change, not a correctness fix.
 */
export const zMoney = z
  .number({ error: 'Enter a valid amount' })
  .finite('Enter a valid amount')
  .nonnegative('Amount cannot be negative')
  .max(99_999_999.99, 'Amount is too large')
  // Compare against the rounded cent value with a tolerance, so genuine
  // float representation drift (1234.56 * 100 === 123455.99999999999) passes
  // but real sub-cent precision (10.999) does not.
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
    message: 'Amount cannot have more than 2 decimal places',
  })

/** Money that must actually be a payment — strictly greater than zero. */
export const zPositiveMoney = zMoney.refine((n) => n > 0, {
  message: 'Enter an amount greater than zero',
})

/**
 * Accepts a JSON number or the numeric string an <input type="number"> sends.
 * Rejects "" and "abc" rather than coercing them to 0/NaN.
 */
export const zNumericLike = z.preprocess((v) => {
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (trimmed === '') return undefined
    const n = Number(trimmed)
    return Number.isNaN(n) ? v : n
  }
  return v
}, z.number())

/**
 * Money arriving from a form. `<input type="number">` state is a string, so
 * "250.00" must be accepted — but "" and "abc" must still fail rather than
 * becoming 0/NaN. Use these on route handlers; use `zMoney` for internal
 * server-to-server payloads that are already numeric.
 */
export const zMoneyInput = zNumericLike.pipe(zMoney)
export const zPositiveMoneyInput = zNumericLike.pipe(zPositiveMoney)

/** Calendar date `YYYY-MM-DD`, validated as a real date (rejects 2026-02-31). */
export const zDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }, 'That date does not exist')

/** Short free text (names, references). Trimmed; empty becomes undefined. */
export function zShortText(max = 200) {
  return z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((s) => (s === '' ? undefined : s))
}

/** Long free text (notes, messages). */
export function zLongText(max = 5000) {
  return z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((s) => (s === '' ? undefined : s))
}

/** Required free text — rejects "" and "   " instead of storing blank rows. */
export function zRequiredText(max = 200) {
  return z.string().trim().min(1, 'This field is required').max(max, `Keep this under ${max} characters`)
}

/** A nullable optional field: missing/""/null all normalise to null. */
export function zNullableText(max = 200) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null
      const t = v.trim().slice(0, max)
      return t === '' ? null : t
    })
}

export const zEmail = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'))

/** Australian 4-digit postcode. */
export const zPostcode = z.string().regex(/^\d{4}$/, 'Enter a 4-digit postcode')

export const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const
export const zAuState = z.enum(AU_STATES, { error: 'Choose an Australian state or territory' })

/**
 * A quote/invoice/PO line item. Canonical keys are description/quantity
 * (project convention — NOT name/qty). Totals are recomputed server-side by DB
 * triggers for quotes/invoices, so client-sent subtotal is accepted but not
 * trusted there; POs carry their own totals.
 */
export const zLineItem = z.object({
  description: z.string().trim().max(500).default(''),
  quantity: zNumericLike.pipe(z.number().finite().min(0)),
  unit_price: zNumericLike.pipe(z.number().finite()),
  subtotal: zNumericLike.pipe(z.number().finite()).optional(),
  tax_rate: zNumericLike.pipe(z.number().finite().min(0).max(100)).optional(),
})

export const zLineItems = z.array(zLineItem).max(500, 'Too many line items')

/** Booleans that tolerate the string forms a form post can produce. */
export const zBoolish = z.preprocess((v) => {
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}, z.boolean())
