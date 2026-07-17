import { describe, it, expect } from 'vitest'
import { roundMoney, lineSubtotal, computeTotals, depositAmount, type MoneyLine } from './money'

const line = (quantity: number, unit_price: number, tax_rate = 10): MoneyLine => ({
  quantity, unit_price, tax_rate, subtotal: lineSubtotal(quantity, unit_price),
})

describe('roundMoney', () => {
  it('rounds to whole cents and avoids float drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(280.005)).toBe(280.01)
    expect(roundMoney(240)).toBe(240)
  })
})

describe('lineSubtotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineSubtotal(3, 80)).toBe(240)
    expect(lineSubtotal(1, 450)).toBe(450)
    expect(lineSubtotal(0, 100)).toBe(0)
    expect(lineSubtotal(2.5, 40)).toBe(100)
  })
})

describe('computeTotals', () => {
  it('single line with 10% GST', () => {
    // Deep Clean $450 → GST $45 → $495 (matches seed invoice INV-2026-001)
    expect(computeTotals([line(1, 450)])).toEqual({ subtotal: 450, tax: 45, total: 495 })
  })

  it('quantity > 1 (3 × $80 carpet clean)', () => {
    expect(computeTotals([line(3, 80)])).toEqual({ subtotal: 240, tax: 24, total: 264 })
  })

  it('multiple lines sum correctly', () => {
    // Window $150 + House $280 = $430 sub, $43 GST, $473 total (Q-2026-002)
    expect(computeTotals([line(1, 150), line(1, 280)])).toEqual({ subtotal: 430, tax: 43, total: 473 })
  })

  it('supports mixed / zero tax rates per line', () => {
    const r = computeTotals([line(1, 100, 10), line(1, 100, 0)])
    expect(r).toEqual({ subtotal: 200, tax: 10, total: 210 })
  })

  it('empty list is all zero', () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 })
  })

  it('rounds GST cleanly on awkward amounts', () => {
    // $99.99 @ 10% → 9.999 → 10.00
    expect(computeTotals([line(1, 99.99)])).toEqual({ subtotal: 99.99, tax: 10, total: 109.99 })
  })
})

describe('depositAmount', () => {
  const total = 495
  it('none → 0', () => expect(depositAmount('none', 50, total)).toBe(0))
  it('percentage of total', () => expect(depositAmount('percentage', 20, total)).toBe(99))
  it('fixed amount passes through', () => expect(depositAmount('fixed', 100, total)).toBe(100))
  it('percentage rounds to cents', () => expect(depositAmount('percentage', 33, 100)).toBe(33))
})
