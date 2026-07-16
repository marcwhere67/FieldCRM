// Token storage uses the service client exclusively: gmail_sync_state has no
// client-facing RLS policies, so OAuth tokens are never readable from the browser.
import { createServiceClient } from './supabase/server'

interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailEmail {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  internalDate: string
  payload?: GmailPart & {
    headers: Array<{ name: string; value: string }>
  }
}

export async function getGmailAccessToken(orgId: string, userId: string) {
  const supabase = createServiceClient()
  const { data: syncState, error } = await supabase
    .from('gmail_sync_state')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single()

  if (error || !syncState) throw new Error('Gmail not connected')

  // Check if token expired
  if (syncState.token_expires_at && new Date(syncState.token_expires_at) < new Date()) {
    if (!syncState.refresh_token) throw new Error('No refresh token available')
    return await refreshGmailToken(orgId, userId, syncState.refresh_token)
  }

  return syncState.access_token
}

async function refreshGmailToken(orgId: string, userId: string, refreshToken: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  const tokens = await response.json()
  if (!response.ok) throw new Error(tokens.error_description)

  const supabase = createServiceClient()
  await supabase
    .from('gmail_sync_state')
    .update({
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq('org_id', orgId)
    .eq('user_id', userId)

  return tokens.access_token
}

async function gmailApiError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return new Error(data?.error?.message || `${fallback} (HTTP ${response.status})`)
  } catch {
    return new Error(`${fallback} (HTTP ${response.status})`)
  }
}

export async function fetchGmailEmails(accessToken: string, maxResults = 10) {
  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) throw await gmailApiError(response, 'Failed to fetch emails')
  const data = await response.json()
  return data.messages || []
}

export async function getGmailEmail(accessToken: string, messageId: string) {
  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) throw await gmailApiError(response, 'Failed to fetch email details')
  return await response.json()
}

export function parseEmailHeaders(headers: Array<{ name: string; value: string }>) {
  const headerMap: Record<string, string> = {}
  headers.forEach(h => {
    headerMap[h.name.toLowerCase()] = h.value
  })
  return {
    from: headerMap.from || '',
    to: headerMap.to || '',
    subject: headerMap.subject || '(no subject)',
    date: headerMap.date || new Date().toISOString(),
  }
}

// Gmail nests MIME parts (multipart/mixed > multipart/alternative > content),
// so search the whole tree for the wanted content type.
function findPart(parts: GmailPart[], mime: string): GmailPart | null {
  for (const p of parts) {
    if (p.mimeType === mime && p.body?.data) return p
    if (p.parts) {
      const found = findPart(p.parts, mime)
      if (found) return found
    }
  }
  return null
}

function decodeB64(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8')
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function decodeGmailBody(payload: GmailEmail['payload']): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }

  let text = ''
  let html = ''

  if (payload.parts) {
    const textPart = findPart(payload.parts, 'text/plain')
    const htmlPart = findPart(payload.parts, 'text/html')
    if (textPart?.body?.data) text = decodeB64(textPart.body.data)
    if (htmlPart?.body?.data) html = decodeB64(htmlPart.body.data)
  } else if (payload.body?.data) {
    const decoded = decodeB64(payload.body.data)
    if (payload.mimeType === 'text/html') html = decoded
    else text = decoded
  }

  // HTML-only email: derive readable text so the CRM always has something to show
  if (!text && html) text = htmlToText(html)

  return { text, html }
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  mimeType: string
}

export async function sendEmailViaGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
  attachments?: EmailAttachment[],
) {
  const textContent = textBody || htmlBody.replace(/<[^>]*>/g, '')
  const rand = () => Math.random().toString(36).slice(2, 11)
  const altBoundary = 'alt_' + rand()

  // The message body is always multipart/alternative (plain + html).
  const altPart =
`Content-Type: multipart/alternative; boundary="${altBoundary}"

--${altBoundary}
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 7bit

${textContent}

--${altBoundary}
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: 7bit

${htmlBody}

--${altBoundary}--`

  let mimeMessage: string
  if (attachments && attachments.length > 0) {
    // Wrap body + attachments in multipart/mixed.
    const mixedBoundary = 'mixed_' + rand()
    const attachmentParts = attachments.map(a => {
      const b64 = a.content.toString('base64').replace(/(.{76})/g, '$1\n')
      return `--${mixedBoundary}
Content-Type: ${a.mimeType}; name="${a.filename}"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="${a.filename}"

${b64}`
    }).join('\n')

    mimeMessage = `From: ${from}
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${mixedBoundary}"

--${mixedBoundary}
${altPart}

${attachmentParts}
--${mixedBoundary}--`
  } else {
    mimeMessage = `From: ${from}
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
${altPart}`
  }

  const encodedMessage = Buffer.from(mimeMessage).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  })

  const responseData = await response.json()
  if (!response.ok) {
    throw new Error(`Gmail API error: ${responseData.error?.message || 'Unknown error'}`)
  }
  return responseData
}
