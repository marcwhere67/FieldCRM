import { describe, it, expect } from 'vitest'
import { buildSenderSignatureHtml, buildSenderSignatureText, type SignatureOrg } from './signature-format'

const org: SignatureOrg = { name: 'Salt Air Cleaning', phone: '0484093136', email: 'hello@saltaircleaning.com.au' }
const orgWithSocials: SignatureOrg = {
  ...org,
  website: 'https://www.saltaircleaning.com.au/',
  instagramUrl: 'https://www.instagram.com/saltaircleaning',
}

describe('buildSenderSignatureHtml', () => {
  it('includes name, org, and labelled phone/email when no job title or personal phone are set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, org)
    expect(html).toContain('Marc')
    expect(html).toContain('Salt Air Cleaning')
    expect(html).toContain('Phone: 0484093136')
    expect(html).toContain('Email: hello@saltaircleaning.com.au')
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
    expect(html).toContain('Phone: 0400 111 222')
    expect(html).not.toContain('0484093136')
  })

  it('falls back to the org phone when the sender has none', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc', phone: null }, org)
    expect(html).toContain('Phone: 0484093136')
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
    expect(html).toContain('Marc<br>Phone: 0484093136')
  })

  it('omits website/Instagram lines entirely when not set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, org)
    expect(html).not.toContain('Website:')
    expect(html).not.toContain('Instagram:')
  })

  it('renders website as a clean, clickable link', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, orgWithSocials)
    expect(html).toContain('Website: <a href="https://www.saltaircleaning.com.au/">saltaircleaning.com.au</a>')
  })

  it('renders Instagram as a clickable @handle extracted from the URL', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, orgWithSocials)
    expect(html).toContain('Instagram: <a href="https://www.instagram.com/saltaircleaning">@saltaircleaning</a>')
  })

  it('adds https:// to a bare domain typed without a protocol', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, { ...org, website: 'saltaircleaning.com.au' })
    expect(html).toContain('href="https://saltaircleaning.com.au"')
  })

  it('escapes a quote in a hostile website value so it cannot break out of the href attribute', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, { ...org, website: 'https://x.com/" onmouseover="alert(1)' })
    expect(html).not.toContain('" onmouseover="alert(1)"')
    expect(html).toContain('&quot;')
  })

  it('puts contact lines in a fixed order: phone, email, website, instagram', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, orgWithSocials)
    const phoneIdx = html.indexOf('Phone:')
    const emailIdx = html.indexOf('Email:')
    const websiteIdx = html.indexOf('Website:')
    const instaIdx = html.indexOf('Instagram:')
    expect(phoneIdx).toBeLessThan(emailIdx)
    expect(emailIdx).toBeLessThan(websiteIdx)
    expect(websiteIdx).toBeLessThan(instaIdx)
  })

  it('renders no logo when logoUrl is not set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, org)
    expect(html).not.toContain('<img')
  })

  it('renders the logo above "Kind regards" when logoUrl is set', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, { ...org, logoUrl: '/salt-air-logo.png' })
    expect(html).toContain('<img src="/salt-air-logo.png"')
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('Kind regards,'))
  })

  it('escapes a hostile logoUrl so it cannot break out of the src attribute', () => {
    const html = buildSenderSignatureHtml({ fullName: 'Marc' }, { ...org, logoUrl: '"><script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;')
  })
})

describe('buildSenderSignatureText', () => {
  it('mirrors the HTML version in plain text with labels', () => {
    const text = buildSenderSignatureText({ fullName: 'Tegan', jobTitle: 'Co-Founder', phone: '0400 999 888' }, org)
    expect(text).toBe('Kind regards,\n\nTegan\nCo-Founder\nSalt Air Cleaning\nPhone: 0400 999 888\nEmail: hello@saltaircleaning.com.au')
  })

  it('drops blank lines the same way as the HTML version', () => {
    const text = buildSenderSignatureText({ fullName: 'Marc' }, org)
    expect(text).toBe('Kind regards,\n\nMarc\nSalt Air Cleaning\nPhone: 0484093136\nEmail: hello@saltaircleaning.com.au')
  })

  it('includes the full URL (not a shortened handle) for website/Instagram in plain text', () => {
    const text = buildSenderSignatureText({ fullName: 'Marc' }, orgWithSocials)
    expect(text).toContain('Website: https://www.saltaircleaning.com.au/')
    expect(text).toContain('Instagram: https://www.instagram.com/saltaircleaning')
  })
})
