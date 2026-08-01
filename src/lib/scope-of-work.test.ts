import { describe, it, expect } from 'vitest'
import { isCleanType, getScope, SCOPE, CLEAN_TYPE_LABELS } from './scope-of-work'

describe('isCleanType', () => {
  it('accepts all four known clean types', () => {
    expect(isCleanType('regular')).toBe(true)
    expect(isCleanType('deep')).toBe(true)
    expect(isCleanType('airbnb')).toBe(true)
    expect(isCleanType('end_of_lease')).toBe(true)
  })

  it('rejects unknown values, null and undefined', () => {
    expect(isCleanType('spring_clean')).toBe(false)
    expect(isCleanType(null)).toBe(false)
    expect(isCleanType(undefined)).toBe(false)
    expect(isCleanType('')).toBe(false)
  })
})

describe('getScope', () => {
  it('returns null for an unrecognised clean type (e.g. "none" from the quote builder)', () => {
    expect(getScope('none')).toBeNull()
    expect(getScope(null)).toBeNull()
  })

  it('returns a scope definition for end_of_lease with a non-empty bullet list', () => {
    const scope = getScope('end_of_lease')
    expect(scope).not.toBeNull()
    expect(scope!.title).toBe('End of Lease Clean')
    expect(scope!.includes.length).toBeGreaterThan(10)
  })
})

describe('SCOPE / CLEAN_TYPE_LABELS coverage', () => {
  it('every clean type has both a label and a scope definition', () => {
    const types = ['regular', 'deep', 'airbnb', 'end_of_lease'] as const
    for (const t of types) {
      expect(CLEAN_TYPE_LABELS[t]).toBeTruthy()
      expect(SCOPE[t]).toBeTruthy()
      expect(SCOPE[t].includes.length).toBeGreaterThan(0)
    }
  })

  it('end_of_lease does not promise a bond-back guarantee or free re-clean (a contractual decision, not scope wording)', () => {
    const text = JSON.stringify(SCOPE.end_of_lease).toLowerCase()
    expect(text).not.toContain('bond back')
    expect(text).not.toContain('bond-back')
    expect(text).not.toContain('guarantee')
    expect(text).not.toContain('re-clean')
  })
})
