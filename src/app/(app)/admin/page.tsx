import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AdminView } from '@/components/admin/admin-view'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [
    { data: sops },
    { data: documents },
    { data: clientDocuments },
    { data: contracts },
    { data: notices },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('sops').select('*, users!sops_created_by_fkey(full_name)').order('category').order('title'),
    supabase.from('admin_documents').select('*, users!admin_documents_created_by_fkey(full_name)').order('category').order('title'),
    supabase.from('client_documents').select('*, users:uploaded_by(full_name), contact:contact_id(first_name, last_name)').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
    supabase.from('employee_contracts').select('*, users!employee_contracts_user_id_fkey(full_name, email, role)').order('created_at', { ascending: false }),
    supabase.from('notices').select('*, users!notices_created_by_fkey(full_name)').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('users').select('id, full_name, email, role').eq('org_id', profile.org_id).eq('is_active', true).order('full_name'),
  ])

  return (
    <AdminView
      sops={sops ?? []}
      documents={documents ?? []}
      clientDocuments={clientDocuments ?? []}
      contracts={contracts ?? []}
      notices={notices ?? []}
      teamMembers={teamMembers ?? []}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
