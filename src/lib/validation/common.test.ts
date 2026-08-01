import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  zUuid,
  zOptionalUuid,
  zMoney,
  zPositiveMoney,
  zMoneyInput,
  zPositiveMoneyInput,
  zNumericLike,
  zDateOnly,
  zShortText,
  zRequiredText,
  zNullableText,
  zEmail,
  zPostcode,
  zAuState,
  zBoolish,
} from './common'

describe('zUuid', () => {
  it('accepts the app\'s own seeded non-RFC identifiers', () => {
    // Regression guard: Zod 4's built-in z.uuid() rejects these because the
    // version nibble is 0. Postgres accepts them, so we must too.
    expect(zUuid.safeParse('00000000-0000-0000-0000-000000000001').success).toBe(true)
    expect(zUuid.safeParse('00000000-0000-0000-0003-000000000001').success).toBe(true)
  })

  it('accepts a real v4 uuid, case-insensitively', () => {
    expect(zUuid.safeParse('a0e418d7-056c-4f09-96e1-2f94808ece85').success).toBe(true)
    expect(zUuid.safeParse('A0E418D7-056C-4F09-96E1-2F94808ECE85').success).toBe(true)
  })

  it('rejects junk, wrong lengths and SQL-ish input', () => {
    for (const bad of ['', 'abc', '1234', "' OR 1=1--", 'a0e418d7056c4f0996e12f94808ece85']) {
      expect(zUuid.safeParse(bad).success).toBe(false)
    }
  })
})

describe('zOptionalUuid', () => {
  it('normalises absent, null and empty string to null', () => {
    expect(zOptionalUuid.parse(undefined)).toBeNull()
    expect(zOptionalUuid.parse(null)).toBeNull()
    expect(zOptionalUuid.parse('')).toBeNull()
  })

  it('passes a valid id through', () => {
    expect(zOptionalUuid.parse('00000000-0000-0000-0000-000000000001')).toBe(
      '00000000-0000-0000-0000-000000000001',
    )
  })

  it('rejects a malformed id rather than silently nulling it', () => {
    expect(zOptionalUuid.safeParse('not-an-id').success).toBe(false)
  })
})

describe('zMoney', () => {
  it('accepts whole dollars and exact cents', () => {
    for (const good of [0, 1, 250, 1234.56, 0.05]) {
      expect(zMoney.safeParse(good).success).toBe(true)
    }
  })

  it('rejects sub-cent precision', () => {
    expect(zMoney.safeParse(10.999).success).toBe(false)
    expect(zMoney.safeParse(0.001).success).toBe(false)
  })

  it('rejects negatives, NaN, Infinity and strings', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity, '100']) {
      expect(zMoney.safeParse(bad).success).toBe(false)
    }
  })

  it('rejects absurd amounts', () => {
    expect(zMoney.safeParse(100_000_000).success).toBe(false)
  })
})

describe('zPositiveMoney', () => {
  it('rejects zero but accepts one cent', () => {
    expect(zPositiveMoney.safeParse(0).success).toBe(false)
    expect(zPositiveMoney.safeParse(0.01).success).toBe(true)
  })

  it('gives an actionable message', () => {
    const r = zPositiveMoney.safeParse(0)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Enter an amount greater than zero')
  })
})

describe('zMoneyInput / zPositiveMoneyInput', () => {
  it('accepts the string a number input produces', () => {
    // Regression guard: the payment modal seeds amount as balanceDue.toFixed(2),
    // i.e. a STRING. A plain z.number() here 400s every payment.
    expect(zPositiveMoneyInput.parse('250.00')).toBe(250)
    expect(zMoneyInput.parse('0.00')).toBe(0)
    expect(zMoneyInput.parse(1234.56)).toBe(1234.56)
  })

  it('still enforces the money rules after coercion', () => {
    expect(zPositiveMoneyInput.safeParse('0.00').success).toBe(false)
    expect(zPositiveMoneyInput.safeParse('-5').success).toBe(false)
    expect(zMoneyInput.safeParse('10.999').success).toBe(false)
    expect(zMoneyInput.safeParse('').success).toBe(false)
    expect(zMoneyInput.safeParse('abc').success).toBe(false)
  })
})

describe('zNumericLike', () => {
  it('accepts the numeric strings a number input sends', () => {
    expect(zNumericLike.parse('12.5')).toBe(12.5)
    expect(zNumericLike.parse(12.5)).toBe(12.5)
  })

  it('rejects empty and non-numeric strings instead of coercing to 0/NaN', () => {
    // This is the exact bug Number(body.x) has: Number('') === 0.
    expect(zNumericLike.safeParse('').success).toBe(false)
    expect(zNumericLike.safeParse('abc').success).toBe(false)
    expect(zNumericLike.safeParse(undefined).success).toBe(false)
  })
})

describe('zDateOnly', () => {
  it('accepts a real date', () => {
    expect(zDateOnly.safeParse('2026-07-31').success).toBe(true)
    expect(zDateOnly.safeParse('2028-02-29').success).toBe(true) // leap year
  })

  it('rejects dates that do not exist', () => {
    expect(zDateOnly.safeParse('2026-02-31').success).toBe(false)
    expect(zDateOnly.safeParse('2026-13-01').success).toBe(false)
    expect(zDateOnly.safeParse('2026-02-29').success).toBe(false) // not a leap year
  })

  it('rejects other date formats', () => {
    for (const bad of ['31/07/2026', '2026-7-31', '', '2026-07-31T00:00:00Z']) {
      expect(zDateOnly.safeParse(bad).success).toBe(false)
    }
  })
})

describe('text schemas', () => {
  it('zShortText trims and turns blank into undefined', () => {
    expect(zShortText().parse('  hello  ')).toBe('hello')
    expect(zShortText().parse('   ')).toBeUndefined()
  })

  it('zShortText enforces its max', () => {
    expect(zShortText(5).safeParse('123456').success).toBe(false)
  })

  it('zRequiredText rejects whitespace-only input', () => {
    expect(zRequiredText().safeParse('   ').success).toBe(false)
    expect(zRequiredText().parse(' Deep clean ')).toBe('Deep clean')
  })

  it('zNullableText normalises to null and truncates', () => {
    expect(zNullableText().parse(undefined)).toBeNull()
    expect(zNullableText().parse(null)).toBeNull()
    expect(zNullableText().parse('  ')).toBeNull()
    expect(zNullableText(4).parse('abcdefgh')).toBe('abcd')
  })
})

describe('Australian primitives', () => {
  it('lowercases and validates email', () => {
    expect(zEmail.parse('  Marc@SaltAir.com.AU ')).toBe('marc@saltair.com.au')
    expect(zEmail.safeParse('nope').success).toBe(false)
  })

  it('accepts 4-digit postcodes only', () => {
    expect(zPostcode.safeParse('3121').success).toBe(true)
    expect(zPostcode.safeParse('312').success).toBe(false)
    expect(zPostcode.safeParse('3121 ').success).toBe(false)
  })

  it('accepts the eight AU states and territories', () => {
    for (const s of ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']) {
      expect(zAuState.safeParse(s).success).toBe(true)
    }
    expect(zAuState.safeParse('vic').success).toBe(false)
    expect(zAuState.safeParse('CA').success).toBe(false)
  })
})

describe('zBoolish', () => {
  it('accepts booleans and their string forms', () => {
    expect(zBoolish.parse(true)).toBe(true)
    expect(zBoolish.parse('false')).toBe(false)
  })

  it('rejects everything else', () => {
    expect(zBoolish.safeParse('yes').success).toBe(false)
    expect(zBoolish.safeParse(1).success).toBe(false)
  })
})

describe('unknown-key stripping (mass assignment)', () => {
  it('drops keys the schema does not declare', () => {
    const schema = z.object({ name: zRequiredText() })
    const parsed = schema.parse({ name: 'Deep clean', org_id: 'attacker-org', id: 'forced-id' })
    expect(parsed).toEqual({ name: 'Deep clean' })
    expect('org_id' in parsed).toBe(false)
  })
})
