import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('supabase_auth_id', user.id)
      .single()

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, contacts!invoices_contact_id_fkey(first_name, last_name, email)')
      .eq('id', invoiceId)
      .eq('org_id', profile!.org_id)
      .single()

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    // If we already have a link, just return it
    if (invoice.stripe_payment_link) {
      return NextResponse.json({ url: invoice.stripe_payment_link })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe not configured — add STRIPE_SECRET_KEY to .env.local' }, { status: 503 })
    }

    // Dynamically import Stripe only when needed
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' })

    const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
    const balanceDue = invoice.total - (invoice.deposit_credit ?? 0)

    // Create a Stripe Payment Link via a price
    const price = await stripe.prices.create({
      currency: 'aud',
      unit_amount: Math.round(balanceDue * 100),
      product_data: {
        name: `Invoice ${invoice.invoice_number}${contact ? ` — ${contact.first_name} ${contact.last_name}` : ''}`,
      },
    })

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoice_id: invoiceId, org_id: profile!.org_id },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${req.nextUrl.origin}/invoices/${invoiceId}?paid=1` },
      },
    })

    // Save the link to the invoice
    await supabase
      .from('invoices')
      .update({ stripe_payment_link: paymentLink.url })
      .eq('id', invoiceId)

    return NextResponse.json({ url: paymentLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
