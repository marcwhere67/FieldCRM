import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// One-time setup endpoint: creates the demo org and admin user in Supabase Auth + users table.
// Only works if no users table rows exist yet (safe to call multiple times).
export async function POST() {
  // SECURITY: this endpoint seeds data AND (re)sets known-password admin
  // accounts via the service role. It takes no auth, so it must stay disabled
  // in any live environment. It is off unless ALLOW_SETUP === 'true' is set on
  // the server (only do that on a fresh, unseeded environment, then unset it).
  if (process.env.ALLOW_SETUP !== 'true') {
    return NextResponse.json({ error: 'Setup is disabled.' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    return NextResponse.json(
      { error: 'Supabase not configured. Add real credentials to .env.local first.' },
      { status: 400 }
    )
  }

  try {
    const admin = createClient(supabaseUrl.trim(), serviceRoleKey.trim(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Basic connection test
    const { error: pingError } = await admin.from('organisations').select('id').limit(1)
    if (pingError) return NextResponse.json({ error: `DB connection failed: ${pingError.message}` }, { status: 500 })

    // Check if org already seeded
    const { data: existingOrg } = await admin
      .from('organisations')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    // Insert seed data (org, pipeline stages, services, contacts, etc.)
    // Uses service role to bypass RLS
    if (!existingOrg) {
      // Organisations
      await admin.from('organisations').insert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Salt Air Cleaning',
        abn: '12 345 678 901',
        phone: '+61 3 9000 0000',
        email: 'admin@saltaircleaning.com.au',
        address: '123 Collins St, Melbourne VIC 3000',
        timezone: 'Australia/Melbourne',
        subscription_plan: 'professional',
        logo_url: '/salt-air-logo.png',
      })

      // Pipeline stages
      const stages = [
        { id: '00000000-0000-0000-0001-000000000001', name: 'New Lead', position: 0, color: '#6366f1' },
        { id: '00000000-0000-0000-0001-000000000002', name: 'Contacted', position: 1, color: '#8b5cf6' },
        { id: '00000000-0000-0000-0001-000000000003', name: 'Quote Sent', position: 2, color: '#f59e0b' },
        { id: '00000000-0000-0000-0001-000000000004', name: 'Quote Approved', position: 3, color: '#10b981' },
        { id: '00000000-0000-0000-0001-000000000005', name: 'Job Booked', position: 4, color: '#3b82f6' },
        { id: '00000000-0000-0000-0001-000000000006', name: 'Completed', position: 5, color: '#14b8a6' },
        { id: '00000000-0000-0000-0001-000000000007', name: 'Invoiced', position: 6, color: '#f97316' },
        { id: '00000000-0000-0000-0001-000000000008', name: 'Paid', position: 7, color: '#22c55e' },
      ]
      await admin.from('pipeline_stages').insert(
        stages.map(s => ({ ...s, org_id: '00000000-0000-0000-0000-000000000001', pipeline_type: 'leads' }))
      )

      // Services
      await admin.from('services').insert([
        { org_id: '00000000-0000-0000-0000-000000000001', name: 'Standard House Clean', description: 'Full interior clean — 3 bed 2 bath', category: 'Cleaning', unit_price: 280.00, unit: 'job', tax_rate: 10.0 },
        { org_id: '00000000-0000-0000-0000-000000000001', name: 'Deep Clean', description: 'Intensive clean including oven, fridge, grout', category: 'Cleaning', unit_price: 450.00, unit: 'job', tax_rate: 10.0 },
        { org_id: '00000000-0000-0000-0000-000000000001', name: 'End of Lease Clean', description: 'Bond-back guaranteed clean', category: 'Cleaning', unit_price: 550.00, unit: 'job', tax_rate: 10.0 },
        { org_id: '00000000-0000-0000-0000-000000000001', name: 'Window Clean (Internal)', description: 'All internal windows and tracks', category: 'Windows', unit_price: 150.00, unit: 'job', tax_rate: 10.0 },
        { org_id: '00000000-0000-0000-0000-000000000001', name: 'Carpet Steam Clean', description: 'Per room steam cleaning', category: 'Carpet', unit_price: 80.00, unit: 'room', tax_rate: 10.0 },
      ])
    }

    // Create or retrieve admin auth user
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existingMarc = existingUsers?.users.find(u => u.email === 'marc@saltaircleaning.com.au')

    let marcAuthId: string

    if (existingMarc) {
      marcAuthId = existingMarc.id
      await admin.auth.admin.updateUserById(marcAuthId, { password: 'SaltAir2024!' })
    } else {
      const { data: newUser, error: authError } = await admin.auth.admin.createUser({
        email: 'marc@saltaircleaning.com.au',
        password: 'SaltAir2024!',
        email_confirm: true,
      })
      if (authError || !newUser.user) throw authError
      marcAuthId = newUser.user.id
    }

    // Create tegan auth user
    const existingTegan = existingUsers?.users.find(u => u.email === 'tegan@saltaircleaning.com.au')
    let teganAuthId: string
    if (existingTegan) {
      teganAuthId = existingTegan.id
    } else {
      const { data: newTegan } = await admin.auth.admin.createUser({
        email: 'tegan@saltaircleaning.com.au',
        password: 'SaltAir2024!',
        email_confirm: true,
      })
      teganAuthId = newTegan?.user?.id ?? ''
    }

    // Create technician auth user
    const existingTech = existingUsers?.users.find(u => u.email === 'technician@saltaircleaning.com.au')
    let techAuthId: string
    if (existingTech) {
      techAuthId = existingTech.id
    } else {
      const { data: newTech } = await admin.auth.admin.createUser({
        email: 'technician@saltaircleaning.com.au',
        password: 'SaltAir2024!',
        email_confirm: true,
      })
      techAuthId = newTech?.user?.id ?? ''
    }

    // Create admin@saltaircleaning.com.au auth user
    const existingAdmin = existingUsers?.users.find(u => u.email === 'admin@saltaircleaning.com.au')
    let adminAuthId: string
    if (existingAdmin) {
      adminAuthId = existingAdmin.id
    } else {
      const { data: newAdmin } = await admin.auth.admin.createUser({
        email: 'admin@saltaircleaning.com.au',
        password: 'SaltAir2024!',
        email_confirm: true,
      })
      adminAuthId = newAdmin?.user?.id ?? ''
    }

    // Upsert users table rows
    await admin.from('users').upsert([
      { id: '00000000-0000-0000-0000-000000000010', org_id: '00000000-0000-0000-0000-000000000001', email: 'marc@saltaircleaning.com.au', full_name: 'Marc Hare', role: 'admin', phone: '+61 400 100 001', hourly_rate: 85.00, is_active: true, supabase_auth_id: marcAuthId },
      { id: '00000000-0000-0000-0000-000000000011', org_id: '00000000-0000-0000-0000-000000000001', email: 'tegan@saltaircleaning.com.au', full_name: 'Tegan', role: 'admin', phone: '+61 400 100 002', hourly_rate: 70.00, is_active: true, supabase_auth_id: teganAuthId },
      { id: '00000000-0000-0000-0000-000000000012', org_id: '00000000-0000-0000-0000-000000000001', email: 'technician@saltaircleaning.com.au', full_name: 'Technician', role: 'field', phone: '+61 400 100 003', hourly_rate: 45.00, is_active: true, supabase_auth_id: techAuthId },
      { id: 'a0e418d7-056c-4f09-96e1-2f94808ece85', org_id: '00000000-0000-0000-0000-000000000001', email: 'admin@saltaircleaning.com.au', full_name: 'Admin', role: 'admin', phone: '+61 400 100 004', hourly_rate: 85.00, is_active: true, supabase_auth_id: adminAuthId },
    ], { onConflict: 'id' })

    // Seed contacts if not already present
    const { count } = await admin.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', '00000000-0000-0000-0000-000000000001')
    if (!count || count === 0) {
      await admin.from('contacts').insert([
        { id: '00000000-0000-0000-0003-000000000001', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Emily', last_name: 'Chen', email: 'emily.chen@email.com', phone: '+61 411 111 001', suburb: 'Richmond', state: 'VIC', postcode: '3121', status: 'active', source: 'referral', tags: ['vip', 'repeat'], assigned_to: '00000000-0000-0000-0000-000000000010', pipeline_stage_id: '00000000-0000-0000-0001-000000000008', lifetime_value: 616 },
        { id: '00000000-0000-0000-0003-000000000002', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Marcus', last_name: 'Thompson', email: 'marcus.t@gmail.com', phone: '+61 411 111 002', suburb: 'Fitzroy', state: 'VIC', postcode: '3065', status: 'active', source: 'google_ad', tags: ['end-of-lease'], assigned_to: '00000000-0000-0000-0000-000000000011', pipeline_stage_id: '00000000-0000-0000-0001-000000000007' },
        { id: '00000000-0000-0000-0003-000000000003', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Priya', last_name: 'Sharma', email: 'priya.sharma@work.com', phone: '+61 411 111 003', suburb: 'South Yarra', state: 'VIC', postcode: '3141', status: 'prospect', source: 'facebook_ad', tags: ['lead'], assigned_to: '00000000-0000-0000-0000-000000000010', pipeline_stage_id: '00000000-0000-0000-0001-000000000003' },
        { id: '00000000-0000-0000-0003-000000000004', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Daniel', last_name: 'Walsh', email: 'dan.walsh@hotmail.com', phone: '+61 411 111 004', suburb: 'Collingwood', state: 'VIC', postcode: '3066', status: 'lead', source: 'website_form', tags: ['new'], assigned_to: '00000000-0000-0000-0000-000000000011', pipeline_stage_id: '00000000-0000-0000-0001-000000000001' },
        { id: '00000000-0000-0000-0003-000000000005', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Rachel', last_name: 'Kim', email: 'rachel.kim@email.com', phone: '+61 411 111 005', suburb: 'Hawthorn', state: 'VIC', postcode: '3122', status: 'active', source: 'referral', tags: ['repeat', 'carpet'], assigned_to: '00000000-0000-0000-0000-000000000010', pipeline_stage_id: '00000000-0000-0000-0001-000000000008', lifetime_value: 264 },
        { id: '00000000-0000-0000-0003-000000000006', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Jake', last_name: 'Morrison', email: 'jake.m@company.com.au', phone: '+61 411 111 006', suburb: 'St Kilda', state: 'VIC', postcode: '3182', status: 'prospect', source: 'google_ad', tags: ['commercial'], assigned_to: '00000000-0000-0000-0000-000000000011', pipeline_stage_id: '00000000-0000-0000-0001-000000000002' },
        { id: '00000000-0000-0000-0003-000000000007', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Aisha', last_name: 'Patel', email: 'aisha.p@gmail.com', phone: '+61 411 111 007', suburb: 'Carlton', state: 'VIC', postcode: '3053', status: 'lead', source: 'facebook_ad', tags: ['new', 'deep-clean'], assigned_to: '00000000-0000-0000-0000-000000000010', pipeline_stage_id: '00000000-0000-0000-0001-000000000001' },
        { id: '00000000-0000-0000-0003-000000000008', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Ben', last_name: 'Fletcher', email: 'ben.fletcher@icloud.com', phone: '+61 411 111 008', suburb: 'Northcote', state: 'VIC', postcode: '3070', status: 'active', source: 'referral', tags: ['vip'], assigned_to: '00000000-0000-0000-0000-000000000011', pipeline_stage_id: '00000000-0000-0000-0001-000000000006', lifetime_value: 495 },
        { id: '00000000-0000-0000-0003-000000000009', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Sophie', last_name: 'Laurent', email: 'sophie.l@email.com', phone: '+61 411 111 009', suburb: 'Prahran', state: 'VIC', postcode: '3181', status: 'inactive', source: 'manual', tags: ['inactive'], assigned_to: '00000000-0000-0000-0000-000000000010', pipeline_stage_id: '00000000-0000-0000-0001-000000000006' },
        { id: '00000000-0000-0000-0003-000000000010', org_id: '00000000-0000-0000-0000-000000000001', first_name: 'Connor', last_name: 'Hughes', email: 'c.hughes@techco.com', phone: '+61 411 111 010', suburb: 'Docklands', state: 'VIC', postcode: '3008', status: 'prospect', source: 'google_ad', tags: ['commercial', 'windows'], assigned_to: '00000000-0000-0000-0000-000000000011', pipeline_stage_id: '00000000-0000-0000-0001-000000000003' },
      ])

      // Properties
      await admin.from('properties').insert([
        { id: '00000000-0000-0000-0004-000000000001', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000001', label: 'Home', address_line1: '12 Bridge Rd', suburb: 'Richmond', state: 'VIC', postcode: '3121', lat: -37.8182, lng: 145.0036 },
        { id: '00000000-0000-0000-0004-000000000002', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000002', label: 'Home', address_line1: '45 Smith St', suburb: 'Fitzroy', state: 'VIC', postcode: '3065', lat: -37.7998, lng: 144.9784 },
        { id: '00000000-0000-0000-0004-000000000003', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000005', label: 'Home', address_line1: '88 Glenferrie Rd', suburb: 'Hawthorn', state: 'VIC', postcode: '3122', lat: -37.8225, lng: 145.0325 },
        { id: '00000000-0000-0000-0004-000000000004', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000008', label: 'Home', address_line1: '3 High St', suburb: 'Northcote', state: 'VIC', postcode: '3070', lat: -37.7710, lng: 144.9996 },
      ])

      // Jobs
      const now = new Date()
      const inTwoHours = new Date(now.getTime() + 2 * 3600000).toISOString()
      const inFiveHours = new Date(now.getTime() + 5 * 3600000).toISOString()
      const oneHourAgo = new Date(now.getTime() - 1 * 3600000).toISOString()
      const inThreeHours = new Date(now.getTime() + 3 * 3600000).toISOString()
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString()
      const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString()
      const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString()

      await admin.from('jobs').insert([
        { id: '00000000-0000-0000-0006-000000000001', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000001', property_id: '00000000-0000-0000-0004-000000000001', job_number: 'J-2026-001', title: 'Standard House Clean — Emily Chen', status: 'scheduled', scheduled_start: inTwoHours, scheduled_end: inFiveHours, assigned_users: ['00000000-0000-0000-0000-000000000012'], checklist: [{"label":"Vacuum all rooms","completed":false,"completed_by":null,"completed_at":null},{"label":"Mop hard floors","completed":false,"completed_by":null,"completed_at":null},{"label":"Clean bathrooms","completed":false,"completed_by":null,"completed_at":null}] },
        { id: '00000000-0000-0000-0006-000000000002', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000002', property_id: '00000000-0000-0000-0004-000000000002', job_number: 'J-2026-002', title: 'End of Lease Clean — Marcus Thompson', status: 'in_progress', scheduled_start: oneHourAgo, scheduled_end: inThreeHours, assigned_users: ['00000000-0000-0000-0000-000000000012'], checklist: [{"label":"Clean oven","completed":true,"completed_by":"Tom Bradley","completed_at":"2026-06-27T08:00:00Z"},{"label":"Clean fridge","completed":false,"completed_by":null,"completed_at":null}] },
        { id: '00000000-0000-0000-0006-000000000003', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000005', property_id: '00000000-0000-0000-0004-000000000003', job_number: 'J-2026-003', title: 'Carpet Steam Clean — Rachel Kim', status: 'completed', scheduled_start: twoDaysAgo, scheduled_end: new Date(new Date(twoDaysAgo).getTime() + 3 * 3600000).toISOString(), assigned_users: ['00000000-0000-0000-0000-000000000012'], checklist: [] },
        { id: '00000000-0000-0000-0006-000000000004', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000008', property_id: '00000000-0000-0000-0004-000000000004', job_number: 'J-2026-004', title: 'Deep Clean — Ben Fletcher', status: 'invoiced', scheduled_start: fiveDaysAgo, scheduled_end: new Date(new Date(fiveDaysAgo).getTime() + 4 * 3600000).toISOString(), assigned_users: ['00000000-0000-0000-0000-000000000012'], checklist: [] },
        { id: '00000000-0000-0000-0006-000000000005', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000001', property_id: '00000000-0000-0000-0004-000000000001', job_number: 'J-2026-005', title: 'Standard House Clean — Emily Chen (Jun)', status: 'paid', scheduled_start: tenDaysAgo, scheduled_end: new Date(new Date(tenDaysAgo).getTime() + 3 * 3600000).toISOString(), assigned_users: ['00000000-0000-0000-0000-000000000012'], checklist: [] },
      ])

      // Invoices
      await admin.from('invoices').insert([
        { id: '00000000-0000-0000-0007-000000000001', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000008', job_id: '00000000-0000-0000-0006-000000000004', invoice_number: 'INV-2026-001', status: 'sent', line_items: [{"description":"Deep Clean","quantity":1,"unit_price":450.00,"tax_rate":10.0,"subtotal":450.00}], subtotal: 450.00, tax: 45.00, total: 495.00, amount_paid: 0, due_date: new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0], sent_at: new Date(now.getTime() - 4 * 86400000).toISOString() },
        { id: '00000000-0000-0000-0007-000000000002', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000005', job_id: '00000000-0000-0000-0006-000000000003', invoice_number: 'INV-2026-002', status: 'paid', line_items: [{"description":"Carpet Steam Clean","quantity":3,"unit_price":80.00,"tax_rate":10.0,"subtotal":240.00}], subtotal: 240.00, tax: 24.00, total: 264.00, amount_paid: 264.00, due_date: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0], paid_at: new Date(now.getTime() - 3 * 86400000).toISOString() },
        { id: '00000000-0000-0000-0007-000000000003', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000001', job_id: '00000000-0000-0000-0006-000000000005', invoice_number: 'INV-2026-003', status: 'paid', line_items: [{"description":"Standard House Clean","quantity":1,"unit_price":280.00,"tax_rate":10.0,"subtotal":280.00}], subtotal: 280.00, tax: 28.00, total: 308.00, amount_paid: 308.00, due_date: new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0], paid_at: new Date(now.getTime() - 8 * 86400000).toISOString() },
      ])

      // Quotes
      await admin.from('quotes').insert([
        { id: '00000000-0000-0000-0005-000000000001', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000003', quote_number: 'Q-2026-001', status: 'sent', line_items: [{"description":"Deep Clean","quantity":1,"unit_price":450.00,"tax_rate":10.0,"subtotal":450.00}], subtotal: 450.00, tax: 45.00, total: 495.00, valid_until: new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0], sent_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
        { id: '00000000-0000-0000-0005-000000000002', org_id: '00000000-0000-0000-0000-000000000001', contact_id: '00000000-0000-0000-0003-000000000010', quote_number: 'Q-2026-002', status: 'approved', line_items: [{"description":"Window Clean (Internal)","quantity":1,"unit_price":150.00,"tax_rate":10.0,"subtotal":150.00},{"description":"Standard House Clean","quantity":1,"unit_price":280.00,"tax_rate":10.0,"subtotal":280.00}], subtotal: 430.00, tax: 43.00, total: 473.00, valid_until: new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0], approved_at: new Date(now.getTime() - 1 * 86400000).toISOString(), approved_by: 'Connor Hughes' },
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully.',
      credentials: {
        marc: { email: 'marc@saltaircleaning.com.au', password: 'SaltAir2024!', role: 'admin' },
        tegan: { email: 'tegan@saltaircleaning.com.au', password: 'SaltAir2024!', role: 'admin' },
        admin: { email: 'admin@saltaircleaning.com.au', password: 'SaltAir2024!', role: 'admin' },
        technician: { email: 'technician@saltaircleaning.com.au', password: 'SaltAir2024!', role: 'field' },
      },
    })
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
