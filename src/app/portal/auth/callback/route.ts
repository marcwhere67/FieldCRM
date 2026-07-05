import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[portal/auth/callback] code exchange result:', { user: user?.email, error: error?.message, status: error?.status })

    if (!error && user) {
      // Use service role to bypass RLS when linking contact
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: contact } = await admin
        .from('contacts')
        .select('id, portal_auth_id')
        .eq('email', user.email!)
        .is('portal_auth_id', null)
        .maybeSingle()

      if (contact) {
        await admin
          .from('contacts')
          .update({ portal_auth_id: user.id })
          .eq('id', contact.id)
      }

      return NextResponse.redirect(`${origin}/portal/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`)
}
