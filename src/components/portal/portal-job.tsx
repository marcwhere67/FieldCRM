'use client'

import Link from 'next/link'
import { ChevronLeft, Calendar, Clock, FileText } from 'lucide-react'
import { formatDateTime } from '@/lib/format'

interface Job { id: string; job_number: string | null; title: string; description: string | null; status: string; scheduled_start: string | null; scheduled_end: string | null; instructions: string | null }
interface Props { job: Job; orgName: string }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(245,158,11,0.08)', color: '#b45309' },
  scheduled:   { label: 'Scheduled',   bg: 'rgba(37,99,235,0.07)',  color: '#2563eb' },
  in_progress: { label: 'In progress', bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  completed:   { label: 'Completed',   bg: 'rgba(118,165,143,0.1)', color: '#5d8c76' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(44,62,80,0.06)',   color: '#8A9BA6' },
}

export function PortalJob({ job, orgName }: Props) {
  const ss = STATUS[job.status] ?? { label: job.status, bg: 'rgba(44,62,80,0.06)', color: C.muted }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <img src="/salt-air-logo.png" alt="Salt Air Cleaning" style={{ height: 32, width: 'auto' }} />
        </div>
      </header>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }} className="space-y-6">
        <Link href="/portal/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 12, textDecoration: 'none' }}
          className="hover:opacity-70 transition-opacity">
          <ChevronLeft style={{ width: 14, height: 14 }} />Back to dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 300 }}>{job.title}</h1>
            {job.job_number && <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{job.job_number}</p>}
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', backgroundColor: ss.bg, color: ss.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ss.label}
          </span>
        </div>

        {/* Schedule */}
        <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
          <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Schedule</p>
          <div className="space-y-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Calendar style={{ width: 16, height: 16, color: C.sage, flexShrink: 0 }} />
              <div>
                <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Start</p>
                <p style={{ color: C.fg, fontSize: 13 }}>{job.scheduled_start ? formatDateTime(job.scheduled_start) : 'Not yet scheduled'}</p>
              </div>
            </div>
            {job.scheduled_end && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock style={{ width: 16, height: 16, color: C.sage, flexShrink: 0 }} />
                <div>
                  <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Estimated finish</p>
                  <p style={{ color: C.fg, fontSize: 13 }}>{formatDateTime(job.scheduled_end)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {job.description && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }} className="space-y-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FileText style={{ width: 14, height: 14, color: C.muted }} />
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Job details</p>
            </div>
            <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{job.description}</p>
          </div>
        )}

        {job.instructions && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
            <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Notes for you</p>
            <p style={{ color: '#4A5A65', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{job.instructions}</p>
          </div>
        )}
      </main>
    </div>
  )
}
