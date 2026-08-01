// Shared branded shell + helpers for all customer emails (quotes, invoices,
// receipts, and public-action confirmations like quote acceptance). Every
// email has the SAME structure: plain-text `message` content, then a sign-off
// that carries the logo, name/title, and contact details together as one
// signature block — there is no separate top-of-email logo banner. Branding
// and structure can't be broken from the "Review & send" editor because the
// editable part is only the message.

export const WEBSITE = 'https://saltaircleaning.com.au'

export interface EmailShell {
  orgName: string
  orgEmail: string
  orgPhone: string | null
  senderName: string
  logoUrl: string
  // The sending staff member's own Gmail signature, when available. It REPLACES
  // the generic sign-off below — otherwise the client sees two sign-offs.
  // Null when Gmail isn't connected or the settings scope isn't granted.
  signatureHtml?: string | null
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Blank-line-separated plain text → <p> paragraphs (single newlines → <br>).
export function paragraphsHtml(message: string): string {
  return message.trim().split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n    ')
}

// A Gmail signature comes back as a fragment of HTML (its own <p>/<br> markup,
// possibly a logo <img>, etc.) — this collapses it to readable plain text for
// the text/plain half of an email. Shared by every sender that may embed a
// fetched Gmail signature (see also src/lib/org-mailer.ts).
export function htmlSignatureToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function signoffHtml(shell: EmailShell): string {
  if (shell.signatureHtml) return shell.signatureHtml
  // Not expected to run in practice (resolveSenderSignatureHtml almost always
  // builds a real signature — see signature.ts). Kept structurally identical
  // to the built one (logo in the signature, same as every other email).
  const logo = shell.logoUrl
    ? `\n    <p><img src="${esc(shell.logoUrl)}" alt="${esc(shell.orgName)}" height="32" style="display:block;height:32px;width:auto;margin-top:8px;" /></p>`
    : ''
  return `<p>Kind regards,</p>
    <p>${esc(shell.senderName)}<br>${esc(shell.orgName)}<br>${shell.orgPhone ? esc(shell.orgPhone) + '<br>' : ''}${esc(shell.orgEmail)}<br>${WEBSITE}</p>${logo}`
}

export function signoffText(shell: EmailShell): string {
  if (shell.signatureHtml) {
    return htmlSignatureToText(shell.signatureHtml)
  }
  return `Kind regards,\n\n${shell.senderName}\n${shell.orgName}\n${shell.orgPhone ? shell.orgPhone + '\n' : ''}${shell.orgEmail}\n${WEBSITE}`
}

// Wrap inner HTML (message paragraphs + any fixed blocks) in the branded shell.
// No top-of-email header — the logo lives in the signature (see signoffHtml).
export function shellHtml(shell: EmailShell, inner: string): string {
  return `<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
  <div style="padding: 24px;">
    ${inner}
    ${signoffHtml(shell)}
  </div>
</body>
</html>`
}
