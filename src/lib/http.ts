// Request boundary for route handlers (SPEC.md §1 rules 2 and 7).
//
// Three jobs:
//   1. Parse and validate the body with Zod before it reaches Supabase.
//   2. Resolve the caller's app profile and role once, consistently.
//   3. Turn failures into actionable messages — never a raw exception string.
//
// Handlers use the `Failure` union rather than throwing, so the control flow
// stays visible at the call site.
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'admin' | 'manager' | 'field'

export interface AppProfile {
  id: string
  org_id: string
  role: AppRole
  full_name: string | null
  email: string | null
}

/** Roles allowed to touch money, catalogue pricing and other org-wide settings. */
export const MANAGER_ROLES: readonly AppRole[] = ['admin', 'manager']

export type Result<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/**
 * Flattens Zod issues into one sentence a user can act on, e.g.
 * "amount: Enter an amount greater than zero; method: Invalid option".
 * Field paths are kept because the client maps them back onto form inputs.
 */
export function formatZodError(error: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !(path in fields)) fields[path] = issue.message
  }
  const parts = Object.entries(fields).map(([k, v]) => `${k}: ${v}`)
  const message = parts.length > 0 ? parts.join('; ') : (error.issues[0]?.message ?? 'Invalid request')
  return { message, fields }
}

/**
 * Reads the JSON body and validates it. Returns a 400 with per-field messages
 * on failure. Unknown keys are stripped by Zod's default object behaviour,
 * which is what closes the mass-assignment hole in `insert({ ...body })`.
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<Result<z.infer<S>>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, response: jsonError('Request body must be valid JSON', 400) }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const { message, fields } = formatZodError(parsed.error)
    return { ok: false, response: jsonError(message, 400, { fields }) }
  }
  return { ok: true, data: parsed.data }
}

/** Validates query/search params (already string-typed) against a schema. */
export function parseParams<S extends z.ZodType>(
  params: URLSearchParams,
  schema: S,
): Result<z.infer<S>> {
  const parsed = schema.safeParse(Object.fromEntries(params.entries()))
  if (!parsed.success) {
    const { message, fields } = formatZodError(parsed.error)
    return { ok: false, response: jsonError(message, 400, { fields }) }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Authenticates the request and loads the *app* profile.
 *
 * Note the two-ID trap this deliberately hides: `user.id` is the Supabase auth
 * id, `profile.id` is the `users` row id. Every FK keyed to a person wants
 * `profile.id`. Handlers should never reach for `user.id` again after this.
 */
export async function requireProfile(): Promise<
  Result<{ profile: AppProfile; supabase: Awaited<ReturnType<typeof createClient>>; authUserId: string }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: jsonError('Please sign in to continue', 401) }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, role, full_name, email')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!profile) {
    return {
      ok: false,
      response: jsonError('Your account is not linked to an organisation. Ask an admin to re-invite you.', 403),
    }
  }

  return { ok: true, data: { profile: profile as AppProfile, supabase, authUserId: user.id } }
}

/** As `requireProfile`, but also enforces a role allowlist. */
export async function requireRole(
  allowed: readonly AppRole[],
): Promise<Result<{ profile: AppProfile; supabase: Awaited<ReturnType<typeof createClient>>; authUserId: string }>> {
  const auth = await requireProfile()
  if (!auth.ok) return auth
  if (!allowed.includes(auth.data.profile.role)) {
    return {
      ok: false,
      response: jsonError(
        allowed === MANAGER_ROLES
          ? 'Only managers and admins can do this'
          : `This action requires one of these roles: ${allowed.join(', ')}`,
        403,
      ),
    }
  }
  return auth
}

/**
 * Maps a Postgres/PostgREST error to something a user can act on.
 * Raw driver text (constraint names, SQL fragments) never reaches the UI.
 */
export function friendlyDbError(err: { code?: string; message?: string } | null | undefined): string {
  switch (err?.code) {
    case '23505':
      return 'That record already exists'
    case '23503':
      return 'This is still linked to other records, so it cannot be changed or removed'
    case '23502':
      return 'A required field was missing'
    case '22P02':
      return 'One of the values was the wrong type'
    case '42501':
    case 'PGRST301':
      return 'You do not have permission to do that'
    default:
      return 'Something went wrong saving that. Please try again.'
  }
}
