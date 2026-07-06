'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, Download, Trash2, FileSignature, Image as ImageIcon, ClipboardList, File } from 'lucide-react'
import { formatDate } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  inputBorder: 'rgba(44,62,80,0.15)',
}

export interface ClientDocument {
  id: string
  category: string
  title: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  created_at: string
  users: { full_name: string } | null
}

const CATEGORIES = [
  { id: 'contract', label: 'Contract', icon: FileSignature },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'photo',    label: 'Photo',    icon: ImageIcon },
  { id: 'report',   label: 'Report',   icon: ClipboardList },
  { id: 'other',    label: 'Other',    icon: File },
]
const catMeta = (id: string) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[1]

function formatBytes(n: number | null): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const inputStyle = { backgroundColor: '#fff', border: `1px solid ${C.inputBorder}`, borderRadius: 0, color: C.fg, fontSize: 13, height: 36, width: '100%', padding: '0 10px', outline: 'none' } as React.CSSProperties
const labelStyle = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

export function ContactDocuments({ contactId, initialDocs }: { contactId: string; initialDocs: ClientDocument[] }) {
  const [docs, setDocs] = useState<ClientDocument[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('contract')
  const [title, setTitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.size > 25 * 1024 * 1024) { toast.error('File exceeds 25 MB limit'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim() || file.name)
      fd.append('category', category)
      const res = await fetch(`/api/contacts/${contactId}/documents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDocs(d => [data, ...d])
      setTitle('')
      toast.success('Document uploaded')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setDocs(d => d.filter(x => x.id !== id))
      toast.success('Document deleted')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Documents ({docs.length})</p>
      </div>

      {/* Upload row */}
      <div style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} className="focus:border-[#76A58F]">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Title <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Defaults to file name" style={inputStyle} className="focus:border-[#76A58F]" />
          </div>
        </div>
        <input ref={fileRef} type="file" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ backgroundColor: C.navy, color: '#fff', padding: '9px 16px', fontSize: 11, letterSpacing: '0.1em', width: '100%', justifyContent: 'center' }}
          className="inline-flex items-center gap-2 uppercase hover:opacity-80 transition-opacity disabled:opacity-40">
          <Upload className="w-3.5 h-3.5" />{uploading ? 'Uploading…' : 'Upload File'}
        </button>
        <p style={{ color: C.muted, fontSize: 10 }}>PDF, images, or documents up to 25 MB. Only admins & managers can see these.</p>
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 13, padding: '1.5rem 0', textAlign: 'center' }}>No documents yet</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}` }} className="divide-y divide-[rgba(44,62,80,0.07)]">
          {docs.map(doc => {
            const meta = catMeta(doc.category)
            const Icon = meta.icon
            return (
              <div key={doc.id} style={{ padding: '12px 14px' }} className="flex items-center gap-3">
                <div style={{ color: C.sage, flexShrink: 0 }}><Icon className="w-4 h-4" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }} className="truncate">{doc.title}</p>
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 1 }} className="truncate">
                    {meta.label} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                    {doc.users?.full_name ? ` · ${doc.users.full_name}` : ''}
                  </p>
                </div>
                <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.muted, width: 30, height: 30 }} className="flex items-center justify-center hover:text-[#2C3E50] transition-colors shrink-0" title="Download">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => handleDelete(doc.id, doc.title)}
                  style={{ color: C.muted, width: 30, height: 30 }} className="flex items-center justify-center hover:text-[#dc2626] transition-colors shrink-0" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
