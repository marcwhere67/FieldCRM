'use client'

import { useState } from 'react'

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

export function UnsubscribeForm({
  contactId,
  firstName,
  orgName,
  alreadyUnsubscribed,
}: {
  contactId: string
  firstName: string | null
  orgName: string
  alreadyUnsubscribed: boolean
}) {
  const [done, setDone] = useState(alreadyUnsubscribed)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function unsubscribe() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/unsubscribe/${contactId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Something went wrong. Please try again.')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.cream,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '40px 36px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 30, margin: '0 0 12px' }}>
          {done ? 'You’ve been unsubscribed' : 'Unsubscribe'}
        </h1>

        {done ? (
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            {firstName ? `${firstName}, you` : 'You'} will no longer receive marketing
            messages from {orgName}. You may still receive essential messages about
            services you’ve booked. Changed your mind? Contact us to opt back in.
          </p>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' }}>
              {firstName ? `${firstName}, click` : 'Click'} below to stop receiving marketing
              messages from {orgName}.
            </p>
            {error && (
              <p style={{ color: '#B4453C', fontSize: 14, margin: '0 0 16px' }}>{error}</p>
            )}
            <button
              onClick={unsubscribe}
              disabled={loading}
              style={{
                background: C.navy,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '13px 28px',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
                width: '100%',
              }}
            >
              {loading ? 'Unsubscribing…' : 'Unsubscribe me'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
