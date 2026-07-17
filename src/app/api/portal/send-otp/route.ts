import { NextResponse } from 'next/server'

// The customer portal is disabled (see src/proxy.ts — all /portal/* redirect to
// /login). This endpoint would email a login link to any address with no rate
// limit, so it stays disabled while the portal is off. To revive the portal,
// restore the signInWithOtp implementation here AND add a rate limit
// (see src/lib/rate-limit.ts), then re-enable the portal routes/paths.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
