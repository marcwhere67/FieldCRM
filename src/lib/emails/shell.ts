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

// Brand palette — mirrors the app's C constants (quote/invoice PDFs, portal,
// dashboard) so an emailed quote and its web approval page read as one piece.
const NAVY = '#2C3E50'
const SAGE = '#76A58F'
const CREAM = '#F5F0EB'
const INK = '#1C2A35'
const MUTED = '#8A9BA6'
const BORDER = 'rgba(44,62,80,0.10)'
// Georgia is the closest web-safe stand-in for the app's Cormorant Garamond
// serif — real web fonts aren't reliable across email clients.
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "Arial, Helvetica, sans-serif"

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Blank-line-separated plain text → <p> paragraphs (single newlines → <br>).
// Margins are inline (not class-based) since email clients ignore <style>
// blocks inconsistently — every visual rule here has to travel on the tag.
export function paragraphsHtml(message: string): string {
  return message.trim().split(/\n\s*\n/)
    .map(p => `<p style="margin:0 0 16px;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n    ')
}

// Bulletproof button: a background-coloured <table><td> wrapping the <a>,
// not just a styled anchor — Outlook's Word rendering engine drops padding
// and border-radius on bare <a> tags, but honours table/cell styles.
export function ctaButton(href: string, label: string, opts?: { color?: string }): string {
  const bg = opts?.color ?? SAGE
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
      <tr><td style="background-color:${bg};border-radius:3px;">
        <a href="${href}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${esc(label)}</a>
      </td></tr>
    </table>`
}

// A left-accented panel for a headline figure (quote total, amount due) —
// same visual language as the app's price-card summaries.
export function amountPanel(label: string, value: string, opts?: { color?: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="background-color:${CREAM};border-left:3px solid ${opts?.color ?? SAGE};padding:16px 22px;">
        <p style="margin:0;color:${MUTED};font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${esc(label)}</p>
        <p style="margin:4px 0 0;color:${NAVY};font-family:${SERIF};font-size:30px;font-weight:400;">${esc(value)}</p>
      </td></tr>
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
  // No logo here — the header banner in shellHtml() carries it now, so a
  // second logo in the fallback sign-off would just be a duplicate.
  if (shell.signatureHtml) return shell.signatureHtml
  // Not expected to run in practice (resolveSenderSignatureHtml almost always
  // builds a real signature — see signature.ts).
  return `<p style="margin:0 0 4px;">Kind regards,</p>
    <p style="margin:0;">${esc(shell.senderName)}<br>${esc(shell.orgName)}<br>${shell.orgPhone ? esc(shell.orgPhone) + '<br>' : ''}${esc(shell.orgEmail)}<br>${WEBSITE}</p>`
}

export function signoffText(shell: EmailShell): string {
  if (shell.signatureHtml) {
    return htmlSignatureToText(shell.signatureHtml)
  }
  return `Kind regards,\n\n${shell.senderName}\n${shell.orgName}\n${shell.orgPhone ? shell.orgPhone + '\n' : ''}${shell.orgEmail}\n${WEBSITE}`
}

// Wrap inner HTML (message paragraphs + any fixed blocks) in the branded
// shell: a cream page background behind a white card, a header banner
// carrying the logo, the message + sign-off, and a quiet contact-details
// footer. Every customer email (quotes, invoices, receipts, campaigns,
// generic org mail) shares this one wrapper.
export function shellHtml(shell: EmailShell, inner: string): string {
  const logo = shell.logoUrl
    ? `<img src="${esc(shell.logoUrl)}" alt="${esc(shell.orgName)}" height="40" style="display:block;height:40px;width:auto;margin:0 auto;" />`
    : `<span style="font-family:${SERIF};font-size:22px;color:${NAVY};">${esc(shell.orgName)}</span>`
  const footerLine = [shell.orgPhone, shell.orgEmail].filter((v): v is string => Boolean(v)).map(esc).join(' &nbsp;·&nbsp; ')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:${SANS};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};">
          <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${SAGE};">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:34px 40px 26px;border-bottom:1px solid ${BORDER};">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 8px;color:${INK};font-family:${SANS};font-size:15px;line-height:1.65;">
              ${inner}
              <div style="margin-top:12px;padding-top:20px;border-top:1px solid ${BORDER};color:${INK};font-family:${SANS};font-size:13px;line-height:1.6;">
                ${signoffHtml(shell)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:${CREAM};border-top:1px solid ${BORDER};text-align:center;">
              <p style="margin:0;color:${MUTED};font-family:${SANS};font-size:11px;letter-spacing:0.02em;">${esc(shell.orgName)}${footerLine ? ' &nbsp;·&nbsp; ' + footerLine : ''}</p>
              <p style="margin:6px 0 0;">
                <a href="${WEBSITE}" style="color:${MUTED};font-family:${SANS};font-size:11px;text-decoration:none;letter-spacing:0.02em;">${WEBSITE.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
