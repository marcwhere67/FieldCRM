import { describe, it, expect } from 'vitest'
import {
  normaliseAuPhone,
  isValidAuPhone,
  formatAuPhone,
  zAuPhone,
  zAuPhoneOptional,
} from './phone'

describe('normaliseAuPhone — mobiles', () => {
  it('normalises the common written forms to one E.164 value', () => {
    for (const input of [
      '0412 345 678',
      '0412345678',
      '+61 412 345 678',
      '+61412345678',
      '61412345678',
      '0061 412 345 678',
      '(0412) 345-678',
    ]) {
      expect(normaliseAuPhone(input)).toBe('+61412345678')
    }
  })

  it('accepts a mobile that is missing its trunk 0 (common paste)', () => {
    expect(normaliseAuPhone('412 345 678')).toBe('+61412345678')
  })
})

describe('normaliseAuPhone — landlines', () => {
  it('normalises area-code forms', () => {
    expect(normaliseAuPhone('(03) 9500 1234')).toBe('+61395001234')
    expect(normaliseAuPhone('03 9500 1234')).toBe('+61395001234')
    expect(normaliseAuPhone('+61 3 9500 1234')).toBe('+61395001234')
    expect(normaliseAuPhone('0295001234')).toBe('+61295001234') // Sydney
    expect(normaliseAuPhone('0895001234')).toBe('+61895001234') // Perth
  })
})

describe('normaliseAuPhone — 13/1300/1800', () => {
  it('normalises special-rate numbers', () => {
    expect(normaliseAuPhone('1300 975 707')).toBe('+611300975707')
    expect(normaliseAuPhone('1800 123 456')).toBe('+611800123456')
    expect(normaliseAuPhone('13 12 34')).toBe('+61131234')
  })
})

describe('normaliseAuPhone — rejects invalid input', () => {
  it('returns null for junk, wrong lengths and non-AU', () => {
    for (const bad of [
      '',
      '   ',
      'not a phone',
      '12345',
      '04123456789', // too long
      '041234567', // too short
      '+1 415 555 0100', // US
      '0612345678', // invalid area code 6
    ]) {
      expect(normaliseAuPhone(bad)).toBeNull()
    }
  })
})

describe('isValidAuPhone', () => {
  it('mirrors normalise', () => {
    expect(isValidAuPhone('0412 345 678')).toBe(true)
    expect(isValidAuPhone('nope')).toBe(false)
  })
})

describe('formatAuPhone', () => {
  it('renders mobiles and landlines for humans', () => {
    expect(formatAuPhone('+61412345678')).toBe('0412 345 678')
    expect(formatAuPhone('+61395001234')).toBe('(03) 9500 1234')
  })

  it('leaves 1300/1800 and non-AU untouched', () => {
    expect(formatAuPhone('+611300975707')).toBe('+611300975707')
    expect(formatAuPhone('+14155550100')).toBe('+14155550100')
  })

  it('round-trips: normalise then format then normalise is stable', () => {
    const e164 = normaliseAuPhone('0412 345 678')!
    expect(normaliseAuPhone(formatAuPhone(e164))).toBe(e164)
  })
})

describe('zAuPhone (required)', () => {
  it('stores E.164', () => {
    expect(zAuPhone.parse('0412 345 678')).toBe('+61412345678')
  })

  it('rejects an invalid number with an actionable message', () => {
    const r = zAuPhone.safeParse('12345')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/Australian phone/i)
  })
})

describe('zAuPhoneOptional', () => {
  it('normalises missing/null/empty to null', () => {
    expect(zAuPhoneOptional.parse(undefined)).toBeNull()
    expect(zAuPhoneOptional.parse(null)).toBeNull()
    expect(zAuPhoneOptional.parse('')).toBeNull()
    expect(zAuPhoneOptional.parse('   ')).toBeNull()
  })

  it('still validates and normalises a supplied number', () => {
    expect(zAuPhoneOptional.parse('0412 345 678')).toBe('+61412345678')
    expect(zAuPhoneOptional.safeParse('12345').success).toBe(false)
  })
})
