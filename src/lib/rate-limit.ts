// Lightweight in-memory sliding-window rate limiter for public endpoints.
// Serverless caveat: each lambda instance keeps its own window, so the real
// ceiling is (limit × warm instances) — still enough to blunt scripted abuse.

const windows = new Map<string, number[]>()
const MAX_KEYS = 5000

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  // Opportunistic cleanup so the map can't grow unbounded
  if (windows.size > MAX_KEYS) {
    for (const [k, hits] of windows) {
      if (hits.length === 0 || hits[hits.length - 1] < cutoff) windows.delete(k)
    }
  }

  const hits = (windows.get(key) ?? []).filter(t => t > cutoff)
  if (hits.length >= limit) {
    windows.set(key, hits)
    return false
  }
  hits.push(now)
  windows.set(key, hits)
  return true
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'unknown'
}
