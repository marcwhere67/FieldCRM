export function getCacheHeaders(type: 'static' | 'revalidate' | 'dynamic' = 'revalidate') {
  const headers = new Headers()

  switch (type) {
    case 'static':
      // Public, immutable assets only — never use for authenticated data
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      break
    case 'revalidate':
      // Authenticated org data: browser-only cache, never shared/CDN caches
      headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
      break
    case 'dynamic':
      headers.set('Cache-Control', 'private, max-age=0, stale-while-revalidate=60')
      break
  }

  return headers
}
