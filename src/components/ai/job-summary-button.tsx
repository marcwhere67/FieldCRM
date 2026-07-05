'use client'

import { useState } from 'react'
import { Sparkles, X, Copy, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const C = {
  navy: '#2C3E50', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

export function JobSummaryButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true); setOpen(true); setSummary('')
    try {
      const res = await fetch('/api/ai/job-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummary(data.summary)
    } catch { toast.error('Failed to generate summary'); setOpen(false) }
    finally { setLoading(false) }
  }

  async function copy() {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button onClick={generate}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 11, letterSpacing: '0.06em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
        className="uppercase hover:opacity-70 transition-opacity">
        <Sparkles style={{ width: 12, height: 12, color: '#7c3aed' }} />
        AI Summary
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(44,62,80,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles style={{ width: 14, height: 14, color: '#7c3aed' }} />
                <span style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>AI Job Summary</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 16, minHeight: 100 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted }}>
                  <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                  <span style={{ fontSize: 13 }}>Generating summary…</span>
                </div>
              ) : (
                <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{summary}</p>
              )}
            </div>
            {!loading && summary && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                <button onClick={generate}
                  style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
                  className="uppercase hover:opacity-70 transition-opacity">
                  Regenerate
                </button>
                <button onClick={copy}
                  style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: C.navy, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  className="uppercase">
                  {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
