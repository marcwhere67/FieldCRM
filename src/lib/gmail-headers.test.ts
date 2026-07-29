import { describe, it, expect } from 'vitest'
import { encodeHeader, encodeAddressHeader } from './gmail'

// MIME headers are ASCII-only (RFC 5322). Non-ASCII must be wrapped as an
// RFC 2047 encoded-word or recipients see mojibake — this bit us with an em
// dash in a quote-accepted subject, and would hit any accented customer name.
function decodeWord(s: string): string {
  const m = s.match(/^=\?UTF-8\?B\?(.*)\?=$/)
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : s
}

describe('encodeHeader', () => {
  it('leaves pure ASCII untouched (stays human-readable in transit)', () => {
    const s = 'Quote accepted: Q-0042 - Sarah Mitchell ($495)'
    expect(encodeHeader(s)).toBe(s)
  })

  it('encodes an em dash and round-trips', () => {
    const s = 'Quote accepted: Q-0042 — Sarah Mitchell ($495)'
    const encoded = encodeHeader(s)
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/)
    expect(decodeWord(encoded)).toBe(s)
  })

  it('encodes accented customer names and round-trips', () => {
    const s = 'Renée, your quote from Salt Air Cleaning (Q-0042)'
    expect(decodeWord(encodeHeader(s))).toBe(s)
  })

  it('encodes curly apostrophes', () => {
    const s = 'Here’s your invoice'
    expect(decodeWord(encodeHeader(s))).toBe(s)
  })

  it('never emits raw non-ASCII', () => {
    // eslint-disable-next-line no-control-regex
    expect(/[^\x00-\x7F]/.test(encodeHeader('Café — naïve'))).toBe(false)
  })
})

describe('encodeAddressHeader', () => {
  it('keeps an ASCII display name and address literal', () => {
    expect(encodeAddressHeader('"Salt Air Cleaning" <hello@saltaircleaning.com.au>'))
      .toBe('"Salt Air Cleaning" <hello@saltaircleaning.com.au>')
  })

  it('encodes only the display name, leaving the address readable', () => {
    const out = encodeAddressHeader('"Café Cleaning" <hi@example.com>')
    expect(out).toMatch(/ <hi@example\.com>$/)
    expect(decodeWord(out.replace(' <hi@example.com>', ''))).toBe('Café Cleaning')
  })

  it('handles a bare address with no display name', () => {
    expect(encodeAddressHeader('hi@example.com')).toBe('hi@example.com')
  })
})
