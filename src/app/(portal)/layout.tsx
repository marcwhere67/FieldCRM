import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Portal',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {children}
    </div>
  )
}
