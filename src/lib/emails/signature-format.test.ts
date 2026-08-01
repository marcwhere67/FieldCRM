import { describe, it, expect } from 'vitest'
import { buildSenderSignatureHtml, buildSenderSignatureText, type SignatureOrg } from './signature-format'

const org: SignatureOrg = { name: 'Salt Air Cleaning', phone: '0484093136', email: 'hello@saltaircleaning.com.au' }

describe('buildSenderSignatureHtml', () => {
  it('includes name, org, and org phone/email when no job title or personal phone are set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, org)
    expect(html).toContain('Marc')
    expect(html).toContain('Salt Air Cleaning')
    expect(html).toContain('0484093136')
    expect(html).toContain('hello@saltaircleaning.com.au')
  })

  it('inserts job title on its own line when set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Tegan', jobTitle: 'Co-Founder' }, org)
    expect(html).toContain('Tegan<br>Co-Founder<br>Salt Air Cleaning')
  })

  it('omits the job title line when blank or whitespace-only', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Tegan', jobTitle: '   ' }, org)
    expect(html).toContain('Tegan<br>Salt Air Cleaning')
  })

  it("prefers the sender's own phone over the org phone", () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc', phone: '0400 111 222' }, org)
    expect(html).toContain('0400 111 222')
    expect(html).not.toContain('0484093136')
  })

  it('falls back to the org phone when the sender has none', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc', phone: null }, org)
    expect(html).toContain('0484093136')
  })

  it('escapes HTML in the name and job title (defence in depth for admin-entered text)', () => {
    const html = buildSenderSignatureHtml({ fullName: '<b>Marc</b>', jobTitle: '<i>Boss</i>' }, org)
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<i>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&lt;i&gt;')
  })

  it('omits the org name line when the org has none', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, { ...org, name: null })
    expect(html).toContain('Marc<br>0484093136')
  })
})

describe('buildSenderSignatureText', () => {
  it('mirrors the HTML version in plain text', () => {
    const text = buildSenderSignatureText({ fullName: 'Tegan', jobTitle: 'Co-Founder', phone: '0400 999 888' }, org)
    expect(text).toBe('Kind regards,\n\nTegan\nCo-Founder\nSalt Air Cleaning\n0400 999 888\nhello@saltaircleaning.com.au')
  })

  it('drops blank lines the same way as the HTML version', () => {
    const text = buildSenderSignatureText({ fullName: 'Marc' }, org)
    expect(text).toBe('Kind regards,\n\nMarc\nSalt Air Cleaning\n0484093136\nhello@saltaircleaning.com.au')
  })
})
