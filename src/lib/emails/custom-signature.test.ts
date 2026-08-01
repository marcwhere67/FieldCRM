import { describe, it, expect } from 'vitest'
import { renderCustomSignatureHtml, type SignatureRenderInput } from './custom-signature'

const input: SignatureRenderInput = {
  fullName: 'Marc',
  jobTitle: 'Co-Founder',
  phone: '0484093136',
  businessName: 'Salt Air Cleaning',
  email: 'hello@saltaircleaning.com.au',
  website: 'https://www.saltaircleaning.com.au/',
  instagramUrl: 'https://www.instagram.com/saltaircleaning',
  logoUrl: '/salt-air-logo.png',
}

describe('renderCustomSignatureHtml', () => {
  it('substitutes merge fields with the sender/org data', () => {
    const html = renderCustomSignatureHtml('Cheers,\n{{full_name}}\n{{job_title}}', input)
    expect(html).toContain('Cheers,<br>Marc<br>Co-Founder')
  })

  it('converts newlines in the literal template text to <br>', () => {
    const html = renderCustomSignatureHtml('Line one\nLine two', input)
    expect(html).toContain('Line one<br>Line two')
  })

  it('renders {{website}} as a clean clickable link', () => {
    const html = renderCustomSignatureHtml('{{website}}', input)
    expect(html).toBe('<a href="https://www.saltaircleaning.com.au/">saltaircleaning.com.au</a>')
  })

  it('renders {{instagram}} as a clickable @handle', () => {
    const html = renderCustomSignatureHtml('{{instagram}}', input)
    expect(html).toBe('<a href="https://www.instagram.com/saltaircleaning">@saltaircleaning</a>')
  })

  it('renders {{logo}} as a correctly-sized image', () => {
    const html = renderCustomSignatureHtml('{{logo}}', input)
    expect(html).toContain('<img src="/salt-air-logo.png"')
    expect(html).toContain('height:32px')
  })

  it('renders empty string for a field that is not set', () => {
    const html = renderCustomSignatureHtml('[{{job_title}}]', { ...input, jobTitle: null })
    expect(html).toBe('[]')
  })

  it('blanks unknown placeholders rather than leaking raw {{tokens}}', () => {
    const html = renderCustomSignatureHtml('{{not_a_real_field}}', input)
    expect(html).toBe('')
  })

  it('escapes literal HTML the user typed in their own template text', () => {
    const html = renderCustomSignatureHtml('<script>alert(1)</script>{{full_name}}', input)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Marc')
  })

  it('escapes a hostile website value so it cannot break out of the href attribute', () => {
    const html = renderCustomSignatureHtml('{{website}}', { ...input, website: 'https://x.com/" onmouseover="alert(1)' })
    expect(html).not.toContain('" onmouseover="alert(1)"')
    expect(html).toContain('&quot;')
  })

  it('renders blank when phone is null (the caller resolves sender-vs-org phone before calling)', () => {
    const html = renderCustomSignatureHtml('{{phone}}', { ...input, phone: null })
    expect(html).toBe('')
  })
})
