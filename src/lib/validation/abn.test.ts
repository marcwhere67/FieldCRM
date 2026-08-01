import { describe, it, expect } from 'vitest'
import { isValidAbn, formatAbn, normaliseAbn, zAbn, zAbnOptional } from './abn'

// Checksum-valid ABNs (hand-verified against the modulus-89 algorithm):
//   51 824 753 556 — the ATO's own documented worked example
//   88 000 014 675 — Woolworths Group Limited (real, public)
const VALID_SPACED = '51 824 753 556'
const VALID_UNSPACED = '88000014675'

describe('isValidAbn', () => {
  it('accepts checksum-valid ABNs, spaced or unspaced', () => {
    expect(isValidAbn(VALID_SPACED)).toBe(true)
    expect(isValidAbn('51824753556')).toBe(true)
    expect(isValidAbn(VALID_UNSPACED)).toBe(true)
    expect(isValidAbn('88 000 014 675')).toBe(true)
  })

  it('rejects a one-digit-off ABN (the whole point of a checksum)', () => {
    // 51 824 753 55[7] instead of 55[6] — passes a regex, fails the checksum.
    expect(isValidAbn('51824753557')).toBe(false)
    expect(isValidAbn('88000014676')).toBe(false)
  })

  it('rejects wrong lengths', () => {
    expect(isValidAbn('5182475355')).toBe(false) // 10 digits
    expect(isValidAbn('518247535567')).toBe(false) // 12 digits
    expect(isValidAbn('')).toBe(false)
  })

  it('rejects a leading zero (no valid ABN starts with 0)', () => {
    expect(isValidAbn('01824753556')).toBe(false)
  })

  it('rejects non-digit noise beyond spaces', () => {
    expect(isValidAbn('51-824-753-abc')).toBe(false)
    expect(isValidAbn('ABN 51 824 753 556 X')).toBe(false)
  })
})

describe('normaliseAbn', () => {
  it('strips spaces and punctuation to bare digits', () => {
    expect(normaliseAbn('51 824 753 556')).toBe('51824753556')
    expect(normaliseAbn('51-824-753-556')).toBe('51824753556')
  })
})

describe('formatAbn', () => {
  it('groups 11 digits as 2-3-3-3', () => {
    expect(formatAbn('51824753556')).toBe('51 824 753 556')
    expect(formatAbn('51 824 753 556')).toBe('51 824 753 556')
  })

  it('leaves partial input untouched (does not mangle mid-typing)', () => {
    expect(formatAbn('5182')).toBe('5182')
    expect(formatAbn('  ')).toBe('')
  })
})

describe('zAbn', () => {
  it('stores the canonical spaced form', () => {
    expect(zAbn.parse('51824753556')).toBe('51 824 753 556')
  })

  it('rejects an invalid ABN with an actionable message', () => {
    const r = zAbn.safeParse('51824753557')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain('checksum')
  })
})

describe('zAbnOptional', () => {
  it('normalises missing/null/empty to null (tenant may not have one)', () => {
    expect(zAbnOptional.parse(undefined)).toBeNull()
    expect(zAbnOptional.parse(null)).toBeNull()
    expect(zAbnOptional.parse('')).toBeNull()
    expect(zAbnOptional.parse('   ')).toBeNull()
  })

  it('still validates a supplied ABN', () => {
    expect(zAbnOptional.parse('88000014675')).toBe('88 000 014 675')
    expect(zAbnOptional.safeParse('88000014676').success).toBe(false)
  })
})
