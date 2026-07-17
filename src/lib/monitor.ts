// Central error capture for the money/auth-critical paths.
//
// Three sinks, in order of reliability:
//   1. console.error  — always; shows up in Vercel logs.
//   2. error_events   — durable Postgres log (service client, best-effort,
//                       never throws back into the caller).
//   3. Sentry         — forwarded only when SENTRY_DSN is set AND
//                       @sentry/nextjs is installed (see forwardToSentry).
// On level 'critical' it also fires a best-effort email to the org owner.
//
// captureError is intentionally fire-and-forget-safe: awaiting it never throws,
// so instrumenting a route can't create a new failure mode.

import { createServiceClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'

export type ErrorLevel = 'warning' | 'error' | 'critical'

export interface CaptureContext {
  source: string // e.g. 'api/invoices/[id]/payment'
  level?: ErrorLevel
  orgId?: string | null
  userId?: string | null // app users.id (profile.id), for the owner alert
  context?: Record<string, unknown>
}

export async function captureError(error: unknown, ctx: CaptureContext): Promise<void> {
  const level = ctx.level ?? 'error'
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack ?? null) : null

  // 1. Server logs — always.
  console.error(`[${level.toUpperCase()}] ${ctx.source}: ${message}`, ctx.context ?? '')

  // 2. Durable Postgres log — best-effort, must never throw.
  try {
    const supabase = createServiceClient()
    await supabase.from('error_events').insert({
      level,
      source: ctx.source,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      org_id: ctx.orgId ?? null,
      user_id: ctx.userId ?? null,
      context: ctx.context ?? {},
    })
  } catch (logErr) {
    console.error('[MONITOR] failed to persist error_event:', logErr)
  }

  // 3. Sentry — no-op until configured.
  await forwardToSentry(error, level, ctx.source, ctx.context)

  // Critical failures also alert the owner by email (best-effort).
  if (level === 'critical' && ctx.orgId) {
    await alertOwner(ctx.orgId, ctx.userId ?? null, ctx.source, message).catch(() => {})
  }
}

// Sentry-ready hook. To turn Sentry on later:
//   1. npm i @sentry/nextjs && npx @sentry/wizard@latest -i nextjs
//   2. set SENTRY_DSN in the environment
// This dynamically imports Sentry ONLY when the DSN is present, via a
// non-literal specifier so the build doesn't require the package to exist yet.
async function forwardToSentry(
  error: unknown,
  level: ErrorLevel,
  source: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const specifier = '@sentry/nextjs'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry: any = await import(/* webpackIgnore: true */ specifier)
    Sentry.captureException(error, {
      level: level === 'critical' ? 'fatal' : level,
      tags: { source },
      extra: context,
    })
  } catch {
    // Sentry not installed yet — durable log already has it.
  }
}

// Best-effort owner alert via the org's connected Gmail. Silently skips if the
// org has no email or no usable Gmail token — the durable log still has it.
async function alertOwner(
  orgId: string,
  userId: string | null,
  source: string,
  message: string,
): Promise<void> {
  const supabase = createServiceClient()
  const { data: org } = await supabase
    .from('organisations').select('name, email').eq('id', orgId).single()
  if (!org?.email) return

  // Prefer the acting user's Gmail token; fall back to any admin who connected one.
  let token: string | null = null
  if (userId) token = await getGmailAccessToken(orgId, userId).catch(() => null)
  if (!token) {
    const { data: connected } = await supabase
      .from('gmail_sync_state').select('user_id').eq('org_id', orgId).limit(1).maybeSingle()
    if (connected?.user_id) token = await getGmailAccessToken(orgId, connected.user_id).catch(() => null)
  }
  if (!token) return

  const from = `"${org.name?.replace(/"/g, '') ?? 'FieldCRM'}" <${org.email}>`
  const subject = `[FieldCRM] Critical error in ${source}`
  const body = `A critical error occurred and was logged.\n\nWhere: ${source}\nWhat: ${message}\n\nCheck Settings → System Health for details.`
  await sendEmailViaGmail(token, from, org.email, subject, `<pre>${body}</pre>`, body)
}
