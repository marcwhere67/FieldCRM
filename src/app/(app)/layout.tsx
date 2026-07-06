import { createClient, getAppProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Toaster } from '@/components/ui/sonner'
import { headers } from 'next/headers'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getAppProfile(user.id)

  // Derive page title from path
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/contacts': 'Contacts',
    '/pipeline': 'Pipeline',
    '/schedule': 'Schedule',
    '/jobs': 'Jobs',
    '/quotes': 'Quotes',
    '/invoices': 'Invoices',
    '/inbox': 'Inbox',
    '/automations': 'Automations',
    '/clock': 'Clock In / Out',
    '/field-map': 'Field Map',
    '/timesheets': 'Timesheets',
    '/marketing': 'Marketing',
    '/reputation': 'Reputation',
    '/admin': 'Admin Hub',
    '/finances': 'Finances',
    '/reports': 'Reports & Analytics',
    '/catalogue': 'Products & Services',
    '/assets': 'Assets & Equipment',
    '/team': 'Team',
    '/suppliers': 'Suppliers & Purchase Orders',
    '/payroll': 'Payroll Export',
    '/settings': 'Settings',
  }

  const segment = '/' + pathname.split('/')[1]
  const title = titleMap[segment] ?? 'FieldCRM'

  return (
    <div className="flex h-screen bg-[#F5F0EB] overflow-hidden">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          userName={profile?.full_name ?? user.email ?? 'User'}
          userRole={profile?.role ?? 'admin'}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <Toaster theme="light" />
    </div>
  )
}
