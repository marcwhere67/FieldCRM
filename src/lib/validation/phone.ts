// Australian phone normalisation to E.164 (SPEC.md §3).
//
// "Normalise every number to E.164 +61… on write. Accept 04xx, +614xx,
// (03) 5xxx input." Storing one canonical form means dedupe, SMS (Twilio wants
// E.164) and display all agree.
//
// Handled:
//   mobiles          04XX XXX XXX            -> +614XXXXXXXX
//   landlines        (0X) XXXX XXXX          -> +61XXXXXXXXX   (area codes 2,3,7,8)
//   13/1300/1800     13 XX XX / 1300/1800…   -> +611300XXXXXX etc.
//   already-E.164    +61 4XX XXX XXX         -> passthrough (re-normalised)
//   missing trunk 0  4XX XXX XXX             -> +614XXXXXXXX   (common paste)
import { z } from 'zod'

// Geographic + mobile national numbers are 9 digits. First digit: 4 (mobile),
// or 2/3/7/8 (landline area codes). 13/1300/1800 are handled separately.
const GEO_MOBILE = /^[2-478]\d{8}$/ // 9 digits, first in {2,3,4,7,8}
const NUM_1300_1800 = /^1(?:300|800)\d{6}$/ // 1300/1800 + 6 digits
const NUM_13 = /^13\d{4}$/ // 13 + 4 digits

/**
 * Returns the E.164 form (`+61…`) of an Australian number, or `null` if the
 * input isn't a recognisable AU number. Never throws.
 */
export function normaliseAuPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits === '') return null

  // Strip the country code if present, leaving the national number.
  let national: string
  if (digits.startsWith('0061')) {
    national = digits.slice(4)
  } else if (digits.startsWith('61') && (hadPlus || digits.length >= 11)) {
    national = digits.slice(2)
  } else {
    national = digits
  }

  // Strip a single trunk 0 (national dialling prefix).
  if (national.startsWith('0')) national = national.slice(1)

  if (GEO_MOBILE.test(national) || NUM_1300_1800.test(national) || NUM_13.test(national)) {
    return `+61${national}`
  }
  return null
}

/** True if `raw` is a recognisable AU phone number. */
export function isValidAuPhone(raw: string): boolean {
  return normaliseAuPhone(raw) !== null
}

/**
 * Pretty display form for a normalised E.164 mobile/landline:
 *   +61412345678 -> 0412 345 678   (mobile)
 *   +61395001234 -> (03) 9500 1234 (landline)
 * Anything else (13/1300/1800 or non-AU) is returned unchanged.
 */
export function formatAuPhone(e164: string): string {
  const m = /^\+61(\d{9})$/.exec(e164)
  if (!m) return e164
  const n = m[1]
  if (n[0] === '4') return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  return `(0${n[0]}) ${n.slice(1, 5)} ${n.slice(5)}`
}

/** Required AU phone, stored E.164. */
export const zAuPhone = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const e164 = normaliseAuPhone(s)
    if (e164 === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Australian phone number' })
      return z.NEVER
    }
    return e164
  })

/**
 * Optional AU phone: missing / null / empty all normalise to null. A *present*
 * value must be a valid AU number and is stored as E.164.
 */
export const zAuPhoneOptional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v.trim() === '') return null
    const e164 = normaliseAuPhone(v)
    if (e164 === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Australian phone number' })
      return z.NEVER
    }
    return e164
  })
