import { describe, it, expect } from 'vitest'
import { median, formatSpeedToLead } from './speed-to-lead'

describe('median', () => {
  it('averages the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('picks the single middle value for an odd-length array', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('handles a single value', () => {
    expect(median([42])).toBe(42)
  })

  it('does not mutate the input array', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe('formatSpeedToLead', () => {
  it('renders null as no data', () => {
    expect(formatSpeedToLead(null)).toBe('No data')
  })

  it('renders sub-hour values in minutes', () => {
    expect(formatSpeedToLead(8)).toBe('8 min')
    expect(formatSpeedToLead(59.6)).toBe('60 min')
  })

  it('renders sub-day values in hours', () => {
    expect(formatSpeedToLead(150)).toBe('2.5 hrs')
  })

  it('renders multi-day values in days', () => {
    expect(formatSpeedToLead(2880)).toBe('2.0 days')
    expect(formatSpeedToLead(4320)).toBe('3.0 days')
  })
})
