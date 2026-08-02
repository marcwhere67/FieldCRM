import { describe, it, expect } from 'vitest'
import { signoffHtml, signoffText, shellHtml, htmlSignatureToText, type EmailShell } from './shell'

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

  it('does NOT include a logo in the generic fallback — the header banner in shellHtml carries it', () => {
    const out = signoffHtml(base)
    expect(out).not.toContain('<img')
  })
})

describe('shellHtml', () => {
  it('renders a header banner with the org logo at the top of every email', () => {
    const html = shellHtml(base, '<p>Hello</p>')
    expect(html.indexOf(`<img src="${base.logoUrl}"`)).toBeGreaterThan(-1)
    // Header comes before the message content.
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('Hello'))
  })

  it('shows exactly one logo when the fallback sign-off is used (header only, no duplicate below)', () => {
    const html = shellHtml(base, '<p>Hello</p>')
    expect((html.match(/<img/g) ?? []).length).toBe(1)
  })

  it('allows a real signature with its own logo alongside the header banner (two different marks, not a duplicate of the same one)', () => {
    const html = shellHtml(
      { ...base, signatureHtml: '<p><img src="/logo.png" height="32"/></p>\n<p>Kind regards,</p><p>Marc</p>' },
      '<p>Hello</p>',
    )
    expect((html.match(/<img/g) ?? []).length).toBe(2)
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

describe('htmlSignatureToText', () => {
  it('strips tags and normalises entities, trimmed', () => {
    expect(htmlSignatureToText(GMAIL_SIG)).toBe('Kindest Regards,\nTegan Chalmers\nCo-Founder | Salt Air Cleaning')
  })

  it('collapses excess blank lines', () => {
    expect(htmlSignatureToText('<p>A</p><p></p><p></p><p>B</p>')).not.toMatch(/\n{3,}/)
  })

  it('decodes common HTML entities', () => {
    expect(htmlSignatureToText('<p>Smith &amp; Co&nbsp;Pty</p>')).toBe('Smith & Co Pty')
  })
})
