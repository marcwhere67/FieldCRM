// Australian Business Number (ABN) validation and formatting.
//
// SPEC.md §3: "validate with the modulus-89 checksum algorithm, not a regex."
// A regex only proves it's 11 digits; the checksum proves it could be a real ABN.
//
// Algorithm (per the ATO):
//   1. Take the 11 digits.
//   2. Subtract 1 from the first (leftmost) digit.
//   3. Multiply each digit by its positional weight.
//   4. Sum the products.
//   5. Valid iff the sum is divisible by 89.
import { z } from 'zod'

// Positional weights, left to right.
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const

/** Strips spaces and any other non-digits. */
export function normaliseAbn(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * True if `raw` is a checksum-valid ABN. Accepts spaced or unspaced input.
 * Rejects anything that isn't exactly 11 digits, or whose leading digit is 0
 * (subtracting 1 would go negative — no valid ABN starts with 0).
 */
export function isValidAbn(raw: string): boolean {
  // Only digits and separating whitespace are acceptable input. Rejecting other
  // characters (letters, an "ABN" prefix, stray punctuation) surfaces a paste
  // error instead of silently stripping it and validating what's left.
  if (!/^[\d\s]+$/.test(raw)) return false
  const digits = normaliseAbn(raw)
  if (!/^\d{11}$/.test(digits)) return false
  if (digits[0] === '0') return false

  const nums = digits.split('').map(Number)
  nums[0] -= 1
  const sum = nums.reduce((acc, n, i) => acc + n * ABN_WEIGHTS[i], 0)
  return sum % 89 === 0
}

/**
 * Formats a valid ABN as `12 345 678 901` (2-3-3-3 grouping, ATO convention).
 * Returns the trimmed input unchanged if it isn't 11 digits, so partial input
 * mid-typing isn't mangled — callers should validate separately.
 */
export function formatAbn(raw: string): string {
  const d = normaliseAbn(raw)
  if (d.length !== 11) return raw.trim()
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`
}

/**
 * A required, checksum-valid ABN, stored in the canonical `12 345 678 901` form.
 */
export const zAbn = z
  .string()
  .trim()
  .refine((s) => isValidAbn(s), { message: 'That is not a valid ABN (checksum failed)' })
  .transform(formatAbn)

/**
 * Optional ABN: missing / null / empty string all normalise to null (a tenant
 * may not have one yet — SPEC.md §3 flags these for no-ABN withholding). A
 * *present* value must still pass the checksum.
 */
export const zAbnOptional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v == null ? '' : v.trim()))
  .refine((s) => s === '' || isValidAbn(s), { message: 'That is not a valid ABN (checksum failed)' })
  .transform((s) => (s === '' ? null : formatAbn(s)))
