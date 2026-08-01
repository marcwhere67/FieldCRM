// Shared branded shell + helpers for all customer emails (quotes, invoices,
// receipts). The editable part of every email is a plain-text `message`; this
// module wraps it in the fixed logo header + sign-off so branding and structure
// can't be broken from the "Review & send" editor.

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

function headerHtml(shell: EmailShell): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #2C3E50; padding: 16px 24px;">
    <tr><td><img src="${shell.logoUrl}" alt="${esc(shell.orgName)}" height="40" style="display: block;" /></td></tr>
  </table>`
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
  return `<p>Kind regards,</p>
    <p>${esc(shell.senderName)}<br>${esc(shell.orgName)}<br>${shell.orgPhone ? esc(shell.orgPhone) + '<br>' : ''}${esc(shell.orgEmail)}<br>${WEBSITE}</p>`
}

export function signoffText(shell: EmailShell): string {
  if (shell.signatureHtml) {
    return htmlSignatureToText(shell.signatureHtml)
  }
  return `Kind regards,\n\n${shell.senderName}\n${shell.orgName}\n${shell.orgPhone ? shell.orgPhone + '\n' : ''}${shell.orgEmail}\n${WEBSITE}`
}

// Wrap inner HTML (message paragraphs + any fixed blocks) in the branded shell.
export function shellHtml(shell: EmailShell, inner: string): string {
  return `<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
  ${headerHtml(shell)}
  <div style="padding: 24px;">
    ${inner}
    ${signoffHtml(shell)}
  </div>
</body>
</html>`
}
