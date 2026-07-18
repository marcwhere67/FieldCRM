import { describe, it, expect } from 'vitest'
import { occurrencesBetween, melbourneToUtcISO } from './recurring'

describe('occurrencesBetween', () => {
  it('weekly steps by 7 days and includes the anchor when in window', () => {
    expect(occurrencesBetween('2026-07-07', 'weekly', '2026-07-06', '2026-07-28'))
      .toEqual(['2026-07-07', '2026-07-14', '2026-07-21', '2026-07-28'])
  })

  it('fortnightly steps by 14 days', () => {
    expect(occurrencesBetween('2026-07-07', 'fortnightly', '2026-07-06', '2026-08-05'))
      .toEqual(['2026-07-07', '2026-07-21', '2026-08-04'])
  })

  it('four_weekly steps by 28 days', () => {
    expect(occurrencesBetween('2026-07-07', 'four_weekly', '2026-07-06', '2026-09-01'))
      .toEqual(['2026-07-07', '2026-08-04', '2026-09-01'])
  })

  it('monthly keeps day-of-month and clamps short months', () => {
    expect(occurrencesBetween('2026-01-31', 'monthly', '2026-01-01', '2026-04-30'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('fromExclusive is exclusive (no double-generation)', () => {
    expect(occurrencesBetween('2026-07-07', 'weekly', '2026-07-07', '2026-07-21'))
      .toEqual(['2026-07-14', '2026-07-21'])
  })

  it('never generates past end_date', () => {
    expect(occurrencesBetween('2026-07-07', 'weekly', '2026-07-06', '2026-08-31', '2026-07-21'))
      .toEqual(['2026-07-07', '2026-07-14', '2026-07-21'])
  })

  it('returns nothing when the window is before the anchor', () => {
    expect(occurrencesBetween('2026-07-07', 'weekly', '2026-06-01', '2026-07-06')).toEqual([])
  })
})

describe('melbourneToUtcISO (DST-aware)', () => {
  it('winter 9am AEST (+10) → 23:00 UTC previous day', () => {
    expect(melbourneToUtcISO('2026-07-15', '09:00')).toBe('2026-07-14T23:00:00.000Z')
  })

  it('summer 9am AEDT (+11) → 22:00 UTC previous day', () => {
    expect(melbourneToUtcISO('2026-01-15', '09:00')).toBe('2026-01-14T22:00:00.000Z')
  })

  it('defaults to 09:00 when time is blank', () => {
    expect(melbourneToUtcISO('2026-07-15', '')).toBe('2026-07-14T23:00:00.000Z')
  })
})
