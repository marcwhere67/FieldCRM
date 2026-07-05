'use client'

import { useState } from 'react'
import { ReviewCard } from './review-card'
import { AddReviewModal } from './add-review-modal'
import { Plus, Search, Star, MessageSquare, TrendingUp, CheckCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface Review {
  id: string
  platform: string
  rating: number | null
  content: string | null
  author_name: string | null
  response: string | null
  responded_at: string | null
  ai_response_draft: string | null
  received_at: string
  contact_id: string | null
  job_id: string | null
  contacts: { first_name: string; last_name: string } | null
}

interface Props {
  initialReviews: Review[]
  canManage: boolean
}

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const inp: React.CSSProperties = {
  width: '100%', backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`,
  borderRadius: 0, color: C.fg, fontSize: 13, padding: '8px 10px', outline: 'none',
}

const PLATFORMS = ['All', 'Google', 'Facebook', 'Yelp', 'Trustpilot', 'Hipages', 'Other']

const PLATFORM_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Google:     { bg: 'rgba(37,99,235,0.07)',   color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  Facebook:   { bg: 'rgba(79,70,229,0.07)',   color: '#6366f1', border: 'rgba(79,70,229,0.2)' },
  Yelp:       { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  Trustpilot: { bg: 'rgba(5,150,105,0.07)',   color: '#059669', border: 'rgba(5,150,105,0.2)' },
  Hipages:    { bg: 'rgba(234,88,12,0.07)',   color: '#ea580c', border: 'rgba(234,88,12,0.2)' },
  Other:      { bg: 'rgba(44,62,80,0.06)',    color: '#4A5A65', border: 'rgba(44,62,80,0.15)' },
}

export function ReputationView({ initialReviews, canManage }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [respondedFilter, setRespondedFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = reviews.filter(r => {
    const matchSearch = (r.author_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.content ?? '').toLowerCase().includes(search.toLowerCase())
    const matchPlatform = platformFilter === 'All' || r.platform === platformFilter
    const matchRating = ratingFilter === 'all' || r.rating === Number(ratingFilter)
    const matchResponded = respondedFilter === 'all' ||
      (respondedFilter === 'yes' && !!r.responded_at) ||
      (respondedFilter === 'no' && !r.responded_at)
    return matchSearch && matchPlatform && matchRating && matchResponded
  })

  const totalReviews = reviews.length
  const avgRating = totalReviews ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews : 0
  const respondedCount = reviews.filter(r => r.responded_at).length
  const responseRate = totalReviews ? Math.round((respondedCount / totalReviews) * 100) : 0
  const fiveStars = reviews.filter(r => r.rating === 5).length
  const byPlatform = PLATFORMS.slice(1).reduce<Record<string, number>>((acc, p) => {
    acc[p] = reviews.filter(r => r.platform === p).length
    return acc
  }, {})

  function handleUpdate(updated: Review) { setReviews(prev => prev.map(r => r.id === updated.id ? updated : r)) }
  function handleDelete(id: string) { setReviews(prev => prev.filter(r => r.id !== id)) }
  function handleSaved(review: Review) { setReviews(prev => [review, ...prev]) }

  function copyReviewLink(platform: string) {
    const links: Record<string, string> = {
      Google: 'https://g.page/r/YOUR_PLACE_ID/review',
      Facebook: 'https://facebook.com/YOUR_PAGE/reviews',
      Yelp: 'https://yelp.com/writeareview/biz/YOUR_BIZ_ID',
    }
    navigator.clipboard.writeText(links[platform] ?? '#')
    toast.success(`${platform} review link copied — update the URL in Settings`)
  }

  const labelSt: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div className="space-y-6 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Social</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Reputation</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Monitor and respond to customer reviews</p>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)}
            style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
            className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />Log Review
          </button>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Star, label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) : '—', sub: null, accent: '#f59e0b' },
            { icon: MessageSquare, label: 'Total Reviews', value: String(totalReviews), sub: null, accent: C.navy },
            { icon: TrendingUp, label: '5-Star Reviews', value: String(fiveStars), sub: totalReviews > 0 ? `${Math.round((fiveStars / totalReviews) * 100)}% of total` : null, accent: C.sage },
            { icon: CheckCircle, label: 'Response Rate', value: `${responseRate}%`, sub: `${respondedCount} of ${totalReviews} responded`, accent: C.navy },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.accent}`, padding: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon style={{ width: 14, height: 14, color: card.accent }} />
                <span style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{card.label}</span>
              </div>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 24 }}>{card.value}</p>
              {card.sub && <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{card.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews…"
                  style={{ ...inp, paddingLeft: 32 }} />
              </div>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                style={{ ...inp, width: 140 }}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}
                style={{ ...inp, width: 120 }}>
                <option value="all">All ratings</option>
                {[5,4,3,2,1].map(n => <option key={n} value={String(n)}>{'★'.repeat(n)}</option>)}
              </select>
              <select value={respondedFilter} onChange={e => setRespondedFilter(e.target.value)}
                style={{ ...inp, width: 140 }}>
                <option value="all">All</option>
                <option value="no">Needs response</option>
                <option value="yes">Responded</option>
              </select>
            </div>

            {/* Reviews list */}
            {filtered.length === 0 ? (
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: '48px 16px', textAlign: 'center' }}>
                <Star style={{ width: 32, height: 32, color: C.muted, margin: '0 auto 12px' }} />
                <p style={{ color: C.navy, fontSize: 14 }}>No reviews found</p>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  {reviews.length === 0 ? 'Log your first review to get started' : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => (
                  <ReviewCard key={r.id} review={r} canManage={canManage} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Platform breakdown */}
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={labelSt}>By Platform</p>
              <div className="space-y-2">
                {PLATFORMS.slice(1).filter(p => byPlatform[p] > 0).length === 0 ? (
                  <p style={{ color: C.muted, fontSize: 13 }}>No reviews yet</p>
                ) : (
                  PLATFORMS.slice(1).map(p => byPlatform[p] > 0 && (
                    <div key={p} className="flex items-center justify-between">
                      <span style={{ color: C.fg, fontSize: 12 }}>{p}</span>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 72, height: 4, backgroundColor: 'rgba(44,62,80,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(byPlatform[p] / totalReviews) * 100}%`, backgroundColor: C.sage }} />
                        </div>
                        <span style={{ color: C.muted, fontSize: 11, width: 16, textAlign: 'right' }}>{byPlatform[p]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Review request links */}
            <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={labelSt}>Request Reviews</p>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>Copy a link to send after a job</p>
              <div className="space-y-2">
                {['Google', 'Facebook', 'Yelp'].map(p => (
                  <button key={p} onClick={() => copyReviewLink(p)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: `1px solid ${C.border}`, backgroundColor: '#fff', color: C.fg, fontSize: 12 }}
                    className="hover:opacity-70 transition-opacity">
                    <span>{p} Review Link</span>
                    <Copy style={{ width: 12, height: 12 }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Rating distribution */}
            {totalReviews > 0 && (
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }}>
                <p style={labelSt}>Rating Distribution</p>
                <div className="space-y-2">
                  {[5,4,3,2,1].map(n => {
                    const count = reviews.filter(r => r.rating === n).length
                    const pct = (count / totalReviews) * 100
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span style={{ color: '#f59e0b', fontSize: 11, width: 10 }}>{n}</span>
                        <Star style={{ width: 11, height: 11, color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                        <div style={{ flex: 1, height: 4, backgroundColor: 'rgba(44,62,80,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#f59e0b' }} />
                        </div>
                        <span style={{ color: C.muted, fontSize: 11, width: 16, textAlign: 'right' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddReviewModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={handleSaved} />
    </div>
  )
}
