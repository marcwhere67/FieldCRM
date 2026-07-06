'use client'

import { useState } from 'react'
import { SopsTab } from './sops-tab'
import { DocumentsTab } from './documents-tab'
import { ContractsTab } from './contracts-tab'
import { NoticesTab } from './notices-tab'
import { ClientDocumentsTab } from './client-documents-tab'
import { FileText, FolderOpen, Users, Megaphone, Folder } from 'lucide-react'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const TABS = [
  { id: 'notices', label: 'Notice Board', icon: Megaphone },
  { id: 'sops', label: 'SOPs', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'client-documents', label: 'Client Documents', icon: Folder },
  { id: 'contracts', label: 'Contracts', icon: Users },
]

interface SOP { id: string; title: string; category: string; content: string; status: string; created_at: string; users: { full_name: string } | null }
interface Doc { id: string; title: string; category: string; description: string | null; url: string; file_type: string; created_at: string; users: { full_name: string } | null }
interface Contract { id: string; title: string; description: string | null; url: string; signed: boolean; signed_at: string | null; expires_at: string | null; created_at: string; user_id: string; users: { full_name: string; email: string; role: string } | null }
interface Notice { id: string; title: string; content: string; pinned: boolean; created_at: string; users: { full_name: string } | null }
interface ClientDoc { id: string; contact_id: string; category: string; title: string; file_size: number | null; created_at: string; users: { full_name: string } | null; contact: { first_name: string; last_name: string } | null }
interface TeamMember { id: string; full_name: string; email: string; role: string }

interface Props {
  sops: SOP[]
  documents: Doc[]
  clientDocuments: ClientDoc[]
  contracts: Contract[]
  notices: Notice[]
  teamMembers: TeamMember[]
  canManage: boolean
}

export function AdminView({ sops, documents, clientDocuments, contracts, notices, teamMembers, canManage }: Props) {
  const [activeTab, setActiveTab] = useState('notices')

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }}>
        <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Operations</p>
        <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Admin Hub</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>SOPs, company documents, employee contracts and team notices</p>
      </div>

      <div className="px-6 space-y-6">
        <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: activeTab === tab.id ? C.navy : C.muted,
                borderBottom: `2px solid ${activeTab === tab.id ? C.sage : 'transparent'}`,
                marginBottom: -1, background: 'none', cursor: 'pointer',
              }}
            >
              <tab.icon style={{ width: 13, height: 13 }} />
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === 'sops' && <SopsTab initialSops={sops} canManage={canManage} />}
          {activeTab === 'documents' && <DocumentsTab initialDocs={documents} canManage={canManage} />}
          {activeTab === 'client-documents' && <ClientDocumentsTab initialDocs={clientDocuments} canManage={canManage} />}
          {activeTab === 'contracts' && <ContractsTab initialContracts={contracts} teamMembers={teamMembers} canManage={canManage} />}
          {activeTab === 'notices' && <NoticesTab initialNotices={notices} canManage={canManage} />}
        </div>
      </div>
    </div>
  )
}
