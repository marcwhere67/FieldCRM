// Stored photo references are Supabase public-object URLs from when the
// bucket was public. The bucket is now private, so rewrite them to the
// authenticated signed-URL gateway. Non-bucket URLs pass through untouched.
const MARKER = '/storage/v1/object/public/job-photos/'

export function jobPhotoSrc(url: string): string {
  const i = url.indexOf(MARKER)
  if (i === -1) return url
  return `/api/storage/job-photos/${url.slice(i + MARKER.length)}`
}
