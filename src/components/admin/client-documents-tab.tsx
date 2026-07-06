'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, FileText, FileSignature, Image as ImageIcon, ClipboardList, File, Search } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType }> = {
  contract:  { label: 'Contract',  icon: FileSignature },
  document:  { label: 'Document',  icon: FileText },
  photo:     { label: 'Photo',     icon: ImageIcon },
  report:    { label: 'Report',    icon: ClipboardList },
  other:     { label: 'Other',     icon: File },
}

interface ClientDoc {
  id: string; contact_id: string; category: string; title: string
  file_size: number | null; created_at: string
  users: { full_name: string } | null
  contact: { first_name: string; last_name: string } | null
}

interface Props { initialDocs: ClientDoc[]; canManage: boolean }

export function ClientDocumentsTab({ initialDocs, canManage }: Props) {
  const [docs, setDocs] = useState<ClientDoc[]>(initialDocs)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  function formatBytes(n: number | null): string {
    if (!n) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || d.category === catFilter
    return matchSearch && matchCat
  })

  const byContact = filtered.reduce<Record<string, ClientDoc[]>>((acc, d) => {
    const key = d.contact ? `${d.contact.first_name} ${d.contact.last_name}` : 'Unknown'
    acc[key] = [...(acc[key] ?? []), d]
    return acc
  }, {})

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setDocs(d => d.filter(x => x.id !== id))
      toast.success('Document deleted')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ color: C.muted, fontSize: 13 }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex gap-3">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ width: 13, height: 13, color: C.muted, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title…"
            style={{ width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px 8px 30px', outline: 'none' }}
            className="focus:border-[#76A58F]" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ width: 144, height: 36, borderRadius: 0, backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, color: C.fg, fontSize: 12, padding: '0 8px' }}>
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
        </select>
      </div>

      {Object.keys(byContact).length === 0 ? (
        <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <FileText style={{ width: 32, height: 32, color: 'rgba(44,62,80,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>No documents yet</p>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 4, opacity: 0.7 }}>Client documents are uploaded per contact</p>
        </div>
      ) : (
        Object.entries(byContact).map(([contactName, items]) => {
          const grouped = items.reduce<Record<string, ClientDoc[]>>((acc, d) => {
            acc[d.category] = [...(acc[d.category] ?? []), d]
            return acc
          }, {})
          return (
            <div key={contactName} className="space-y-2">
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                {contactName} ({items.length})
              </p>
              {Object.entries(grouped).map(([cat, catItems]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other
                const Icon = meta.icon
                return (
                  <div key={cat} className="ml-2 space-y-1">
                    <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
                      <Icon style={{ width: 11, height: 11, color: C.muted }} />
                      <p style={{ color: C.muted, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{meta.label}</p>
                    </div>
                    {catItems.map(doc => (
                      <div key={doc.id} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{doc.title}</p>
                          <p style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>
                            {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                            {doc.users?.full_name ? ` · ${doc.users.full_name}` : ''}
                          </p>
                        </div>
                        <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer"
                          style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors shrink-0" title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {canManage && (
                          <button onClick={() => handleDelete(doc.id, doc.title)}
                            style={{ color: C.muted, width: 28, height: 28 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors shrink-0" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
