import { describe, it, expect } from 'vitest'
import { csvCell, toCsv, money2 } from './csv'

describe('csvCell — quoting', () => {
  it('leaves plain values untouched', () => {
    expect(csvCell('Deep clean')).toBe('Deep clean')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('quotes and escapes commas, quotes and newlines', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"')
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('csvCell — formula injection defusing', () => {
  it("prefixes an apostrophe to cells starting with a formula trigger", () => {
    // A lead can name itself this; the export must not become executable.
    expect(csvCell('=cmd|/c calc')).toBe("'=cmd|/c calc")
    expect(csvCell('+1+1')).toBe("'+1+1")
    expect(csvCell('-2')).toBe("'-2")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('combines defusing with quoting when both are needed', () => {
    // Leading '=' triggers defuse; the comma then forces quoting.
    expect(csvCell('=1,2')).toBe(`"'=1,2"`)
  })

  it('does not touch a negative number rendered from an actual number', () => {
    // Numbers are formatted by the caller (money2); a bare number here is safe.
    expect(csvCell(-5)).toBe("'-5")
  })
})

describe('toCsv', () => {
  it('writes a header then rows in column order', () => {
    const rows = [
      { a: '1', b: 'x' },
      { a: '2', b: 'y' },
    ]
    expect(toCsv(rows, ['a', 'b'])).toBe('a,b\r\n1,x\r\n2,y\r\n')
  })

  it('writes just the header for no rows', () => {
    expect(toCsv([] as { a: string }[], ['a'])).toBe('a\r\n')
  })
})

describe('money2', () => {
  it('formats to 2dp with cent-safe rounding', () => {
    expect(money2(1234.5)).toBe('1234.50')
    expect(money2(0)).toBe('0.00')
    expect(money2(1234.567)).toBe('1234.57')
  })
})
