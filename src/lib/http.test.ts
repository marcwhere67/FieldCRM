import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseBody, parseParams, formatZodError, friendlyDbError, jsonError } from './http'
import { zPositiveMoney, zRequiredText } from './validation/common'

const schema = z.object({
  amount: zPositiveMoney,
  description: zRequiredText(50),
})

function jsonRequest(body: unknown): Request {
  return new Request('https://example.test/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseBody', () => {
  it('returns typed data for a valid body', async () => {
    const result = await parseBody(jsonRequest({ amount: 250.5, description: 'Deep clean' }), schema)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.amount).toBe(250.5)
      expect(result.data.description).toBe('Deep clean')
    }
  })

  it('rejects a non-JSON body with an actionable 400', async () => {
    const req = new Request('https://example.test/api/x', { method: 'POST', body: 'not json' })
    const result = await parseBody(req, schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Request body must be valid JSON',
      })
    }
  })

  it('reports every invalid field, keyed by name', async () => {
    const result = await parseBody(jsonRequest({ amount: 0, description: '   ' }), schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      const payload = (await result.response.json()) as { error: string; fields: Record<string, string> }
      expect(payload.fields.amount).toBe('Enter an amount greater than zero')
      expect(payload.fields.description).toBe('This field is required')
      expect(payload.error).toContain('amount:')
      expect(payload.error).toContain('description:')
    }
  })

  it('strips unknown keys so they cannot reach an insert', async () => {
    const result = await parseBody(
      jsonRequest({ amount: 10, description: 'x', org_id: 'someone-elses-org', id: 'forced' }),
      schema,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(Object.keys(result.data).sort()).toEqual(['amount', 'description'])
  })

  it('rejects a missing body outright rather than inserting blanks', async () => {
    const result = await parseBody(jsonRequest({}), schema)
    expect(result.ok).toBe(false)
  })
})

describe('parseParams', () => {
  const q = z.object({ page: z.string().regex(/^\d+$/) })

  it('parses valid search params', () => {
    const result = parseParams(new URLSearchParams('page=2'), q)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.page).toBe('2')
  })

  it('rejects invalid search params', () => {
    const result = parseParams(new URLSearchParams('page=abc'), q)
    expect(result.ok).toBe(false)
  })
})

describe('formatZodError', () => {
  it('keeps only the first message per field', () => {
    // 'ab' fails both checks, so Zod reports two issues on the same path.
    const r = z.object({ a: z.string().min(5, 'too short').regex(/^\d+$/, 'digits only') }).safeParse({ a: 'ab' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.length).toBe(2)
      const { fields, message } = formatZodError(r.error)
      expect(fields).toEqual({ a: 'too short' })
      expect(message).toBe('a: too short')
    }
  })

  it('falls back to the raw issue when there is no field path', () => {
    const r = z.string().safeParse(42)
    expect(r.success).toBe(false)
    if (!r.success) {
      const { message, fields } = formatZodError(r.error)
      // No path means no per-field entry; the message is Zod's own text,
      // not our "field: reason" form.
      expect(fields).toEqual({})
      expect(message).toBe('Invalid input: expected string, received number')
    }
  })
})

describe('friendlyDbError', () => {
  it('never leaks the raw driver message', () => {
    const raw = 'duplicate key value violates unique constraint "payments_client_request_id_key"'
    const friendly = friendlyDbError({ code: '23505', message: raw })
    expect(friendly).toBe('That record already exists')
    expect(friendly).not.toContain('constraint')
  })

  it('maps the codes we actually hit', () => {
    expect(friendlyDbError({ code: '23503' })).toContain('still linked')
    expect(friendlyDbError({ code: '23502' })).toContain('required field')
    expect(friendlyDbError({ code: '42501' })).toContain('permission')
  })

  it('has a safe default for unknown and missing codes', () => {
    expect(friendlyDbError({ code: 'XX999', message: 'internal detail' })).toBe(
      'Something went wrong saving that. Please try again.',
    )
    expect(friendlyDbError(null)).toBe('Something went wrong saving that. Please try again.')
  })
})

describe('jsonError', () => {
  it('sets the status and merges extra fields', async () => {
    const res = jsonError('Nope', 403, { fields: { role: 'too low' } })
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Nope', fields: { role: 'too low' } })
  })
})
