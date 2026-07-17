import { describe, it, expect } from 'vitest'
import { formatCurrency, melbourneDateOnly, formatTime, formatDate, toMelbourne } from './format'

describe('formatCurrency', () => {
  it('formats AUD as whole dollars', () => {
    expect(formatCurrency(495)).toBe('$495')
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(1234.56)).toBe('$1,235') // rounds to whole dollars
  })
})

describe('toMelbourne (daylight-saving-aware)', () => {
  it('winter instant is AEST (+10)', () => {
    const d = toMelbourne('2026-07-15T02:30:00Z')
    expect(d.getHours()).toBe(12) // 02:30Z + 10h
    expect(d.getMinutes()).toBe(30)
    expect(d.getDate()).toBe(15)
  })

  it('summer instant is AEDT (+11)', () => {
    const d = toMelbourne('2026-01-15T02:30:00Z')
    expect(d.getHours()).toBe(13) // 02:30Z + 11h (daylight saving)
    expect(d.getDate()).toBe(15)
  })
})

describe('melbourneDateOnly', () => {
  it('rolls to the correct Melbourne day just after local midnight', () => {
    // 14:30Z on 16 Jul = 00:30 on 17 Jul in Melbourne (AEST)
    expect(melbourneDateOnly('2026-07-16T14:30:00Z')).toBe('2026-07-17')
  })

  it('stays on the same day mid-afternoon', () => {
    expect(melbourneDateOnly('2026-07-17T02:00:00Z')).toBe('2026-07-17')
  })

  it('handles a future instant (today + N days pattern)', () => {
    expect(melbourneDateOnly('2026-12-25T00:00:00Z')).toBe('2026-12-25')
  })
})

describe('formatTime / formatDate are deterministic (hydration-safe)', () => {
  it('same input yields the same string regardless of call site', () => {
    const iso = '2026-07-17T23:15:00Z' // 09:15 next day Melbourne
    expect(formatTime(iso)).toBe(formatTime(iso))
    expect(formatTime(iso)).toBe('09:15')
    expect(formatDate('2026-07-16T14:30:00Z')).toBe('17 Jul 2026')
  })

  it('null-ish dates render an em dash', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatTime(undefined)).toBe('—')
  })
})
