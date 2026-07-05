'use client'

import { useState } from 'react'

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6',
  border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

export function PortalLogin({ orgName, error }: { orgName?: string; error?: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(error ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErr('')
    const res = await fetch('/api/portal/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), redirectTo: `${window.location.origin}/portal/auth/callback` }),
    })
    const data = await res.json()
    if (!res.ok) {
      setErr(res.status === 429 ? 'Email rate limit reached. Please wait a few minutes and try again.' : data.error || 'Something went wrong. Please try again.')
    } else { setSent(true) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360 }} className="space-y-8">
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#fff', padding: '12px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(44,62,80,0.08)', border: `1px solid ${C.border}` }}>
            <img src="/salt-air-logo.png" alt="Salt Air Cleaning" style={{ height: 56, width: 'auto' }} />
          </div>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 22, fontWeight: 300 }}>{orgName ?? 'Customer Portal'}</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Sign in to view your jobs, quotes and invoices</p>
        </div>

        {sent ? (
          <div style={{ backgroundColor: '#fff', border: `1px solid rgba(118,165,143,0.3)`, padding: '20px 24px', textAlign: 'center' }}>
            <p style={{ color: C.sage, fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Check your email</p>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
              We sent a magic link to <strong style={{ color: C.navy }}>{email}</strong>. Click the link to sign in.
            </p>
            <button onClick={() => setSent(false)} style={{ color: C.muted, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', marginTop: 12 }}
              className="hover:opacity-70 transition-opacity">
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={{ width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0, color: C.navy, fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {err && <p style={{ color: '#dc2626', fontSize: 12 }}>{err}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', backgroundColor: C.sage, color: '#fff', padding: '10px', fontSize: 12, letterSpacing: '0.1em', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              className="uppercase">
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            <p style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>
              No password needed — we'll email you a secure sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
