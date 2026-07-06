export function getCacheHeaders(type: 'static' | 'revalidate' | 'dynamic' = 'revalidate') {
  const headers = new Headers()

  switch (type) {
    case 'static':
      // Cache images, fonts, static assets for 1 year
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      break
    case 'revalidate':
      // Revalidate every 5 minutes (good for data that changes)
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      break
    case 'dynamic':
      // Don't cache dynamic data, but allow stale
      headers.set('Cache-Control', 'public, max-age=0, stale-while-revalidate=60')
      break
  }

  return headers
}
