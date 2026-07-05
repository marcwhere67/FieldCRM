import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { SuppliersView } from '@/components/suppliers/suppliers-view'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const [{ data: suppliers }, { data: pos }, { data: jobs }, { count: poCount }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('org_id', profile!.org_id).order('name'),
    supabase.from('purchase_orders')
      .select('*, suppliers!purchase_orders_supplier_id_fkey(id, name)')
      .eq('org_id', profile!.org_id)
      .order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, title').eq('org_id', profile!.org_id)
      .in('status', ['pending', 'scheduled', 'in_progress']).order('title'),
    supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('org_id', profile!.org_id),
  ])

  const nextPoNumber = `PO-${new Date().getFullYear()}-${String((poCount ?? 0) + 1).padStart(3, '0')}`
  const canManage = ['admin', 'manager'].includes(profile!.role)

  // Flatten supplier join
  const normalisedPos = (pos ?? []).map(p => ({
    ...p,
    suppliers: Array.isArray(p.suppliers) ? (p.suppliers[0] ?? null) : p.suppliers,
  }))

  return (
    <SuppliersView
      initialSuppliers={suppliers ?? []}
      initialPOs={normalisedPos}
      jobs={jobs ?? []}
      canManage={canManage}
      nextPoNumber={nextPoNumber}
    />
  )
}
