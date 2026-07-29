import { describe, it, expect } from 'vitest'
import { signoffHtml, signoffText, type EmailShell } from './shell'

const base: EmailShell = {
  orgName: 'Salt Air Cleaning',
  orgEmail: 'hello@saltaircleaning.com.au',
  orgPhone: '0484093136',
  senderName: "Marc O'Hare",
  logoUrl: 'https://example.com/logo.png',
}

const GMAIL_SIG = '<div>Kindest Regards,<br><b>Tegan Chalmers</b><br>Co-Founder | Salt Air Cleaning</div>'

describe('signoffHtml', () => {
  it('uses the generic sign-off when no Gmail signature is available', () => {
    const out = signoffHtml(base)
    expect(out).toContain('Kind regards,')
    expect(out).toContain("Marc O&#039;Hare".replace('&#039;', "'"))
    expect(out).toContain('Salt Air Cleaning')
  })

  it('REPLACES the generic sign-off with the Gmail signature (never both)', () => {
    const out = signoffHtml({ ...base, signatureHtml: GMAIL_SIG })
    expect(out).toBe(GMAIL_SIG)
    // The bug this guards: two sign-offs stacked in one email.
    expect(out).not.toContain('Kind regards,')
  })

  it('falls back to the generic sign-off when the signature is null', () => {
    expect(signoffHtml({ ...base, signatureHtml: null })).toContain('Kind regards,')
  })
})

describe('signoffText', () => {
  it('strips the Gmail signature to readable plain text', () => {
    const out = signoffText({ ...base, signatureHtml: GMAIL_SIG })
    expect(out).toContain('Kindest Regards,')
    expect(out).toContain('Tegan Chalmers')
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
  })

  it('collapses excess blank lines from stripped markup', () => {
    const out = signoffText({ ...base, signatureHtml: '<p>A</p><p></p><p></p><p>B</p>' })
    expect(out).not.toMatch(/\n{3,}/)
  })

  it('uses the generic sign-off when no signature is set', () => {
    expect(signoffText(base)).toContain('Kind regards,')
  })
})
