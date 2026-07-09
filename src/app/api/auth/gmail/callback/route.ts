import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAppProfile } from '@/lib/supabase/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function siteOrigin(req: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
}

export async function GET(req: NextRequest) {
  const origin = siteOrigin(req)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/settings?gmail_error=${encodeURIComponent(error)}`)
  }

  if (!code || state !== user.id) {
    return NextResponse.redirect(`${origin}/settings?gmail_error=invalid_state`)
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/gmail/callback`

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text()
      console.error('Gmail token exchange failed:', detail)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    const profile = await getAppProfile(user.id)

    if (!profile) {
      throw new Error('User profile not found')
    }

    const { error: insertError } = await supabase
      .from('gmail_sync_state')
      .upsert(
        {
          org_id: profile.org_id,
          user_id: profile.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        { onConflict: 'org_id,user_id' }
      )

    if (insertError) throw insertError

    return NextResponse.redirect(`${origin}/settings?gmail_connected=true`)
  } catch (err) {
    console.error('Gmail auth error:', err)
    return NextResponse.redirect(`${origin}/settings?gmail_error=connection_failed`)
  }
}
