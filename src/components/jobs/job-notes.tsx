'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'
import { Plus, Image as ImageIcon, FileText, Trash2, Download } from 'lucide-react'

const C = {
  card: { backgroundColor: '#fff', border: '1px solid rgba(44,62,80,0.09)' } as React.CSSProperties,
  label: { color: '#8A9BA6', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const },
  text: { color: '#1C2A35', fontSize: 13 },
  muted: { color: '#8A9BA6', fontSize: 12 },
  divider: { borderTop: '1px solid rgba(44,62,80,0.08)' },
}

interface Note {
  id: string
  content: string
  note_type: 'text' | 'photo' | 'signature'
  created_by_name: string | null
  created_at: string
}

interface Props {
  jobId: string
  notes: Note[]
  onNoteAdded: (note: Note) => void
  canEdit: boolean
}

export function JobNotes({ jobId, notes, onNoteAdded, canEdit }: Props) {
  const [newNote, setNewNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function addNote() {
    if (!newNote.trim()) return
    setUploading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote, note_type: 'text' }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      const note = await res.json()
      onNoteAdded(note)
      setNewNote('')
      toast.success('Note added')
    } catch (err) {
      toast.error('Failed to add note')
    } finally {
      setUploading(false)
    }
  }

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/jobs/${jobId}/notes/photo`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to upload photo')
      const note = await res.json()
      onNoteAdded(note)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Photo added')
    } catch (err) {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return
    setDeleting(noteId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Note deleted')
      window.location.reload()
    } catch {
      toast.error('Failed to delete note')
    } finally {
      setDeleting(null)
    }
  }

  async function generatePdf() {
    setGeneratingPdf(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/completion-report`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to generate PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `job-${jobId}-completion.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div style={C.card} className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p style={C.label}>Job Notes & Photos</p>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <button
              onClick={generatePdf}
              disabled={generatingPdf}
              style={{ color: '#76A58F', fontSize: 10, letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '4px 10px' }}
              className="uppercase hover:opacity-70 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
              title="Generate completion report PDF"
            >
              <Download className="w-3 h-3" />
              {generatingPdf ? 'Generating...' : 'Report'}
            </button>
          )}
        </div>
      </div>

      {/* Add note section */}
      {canEdit && (
        <div className="mb-4 p-3 bg-[#F5F0EB] rounded border border-[rgba(44,62,80,0.08)]">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNote()}
              placeholder="Add a note..."
              style={{ ...C.text, padding: '8px 10px', border: '1px solid rgba(44,62,80,0.15)', width: '100%' }}
              className="rounded text-sm"
            />
            <button
              onClick={addNote}
              disabled={!newNote.trim() || uploading}
              style={{ color: '#fff', backgroundColor: '#76A58F', padding: '8px 14px', fontSize: 11 }}
              className="uppercase hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ color: '#76A58F', fontSize: 10, letterSpacing: '0.1em', border: '1px solid rgba(118,165,143,0.3)', padding: '4px 10px' }}
              className="uppercase hover:opacity-70 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
            >
              <ImageIcon className="w-3 h-3" />
              Upload Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <p style={C.muted}>No notes or photos yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} style={{ borderBottom: '1px solid rgba(44,62,80,0.06)', paddingBottom: 12 }} className="last:border-b-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {note.note_type === 'photo' && <ImageIcon className="w-3.5 h-3.5" style={{ color: '#76A58F' }} />}
                  {note.note_type === 'text' && <FileText className="w-3.5 h-3.5" style={{ color: '#76A58F' }} />}
                  <span style={C.text} className="font-medium text-sm">
                    {note.note_type === 'photo' ? 'Photo' : 'Note'}
                  </span>
                  {note.created_by_name && <span style={{ ...C.muted, fontSize: 10 }}>by {note.created_by_name}</span>}
                </div>
                {canEdit && (
                  <button
                    onClick={() => deleteNote(note.id)}
                    disabled={deleting === note.id}
                    style={{ color: '#dc2626' }}
                    className="hover:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p style={{ ...C.muted, fontSize: 10, marginBottom: 8 }}>{formatDateTime(note.created_at)}</p>
              {note.note_type === 'text' && (
                <p style={{ ...C.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.content}</p>
              )}
              {note.note_type === 'photo' && (
                <div className="relative w-full rounded overflow-hidden border border-[rgba(44,62,80,0.1)]" style={{ maxHeight: 200, height: 200 }}>
                  <Image
                    src={note.content}
                    alt="Job note"
                    fill
                    className="object-contain"
                    sizes="100vw"
                    quality={75}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
