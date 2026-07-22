export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Strip the legacy year segment from a document number for display, e.g.
// "Q-2026-0001" -> "Q-0001", "INV-2026-031" -> "INV-031". New-format numbers
// like "Q-0128" (no year) pass through unchanged. Cosmetic only — the stored
// number is never altered, so existing documents keep their real identifiers.
export function stripDocYear(docNumber: string | null | undefined): string {
  if (!docNumber) return ''
  return docNumber.replace(/^([A-Za-z]+)-(?:19|20)\d{2}-(\d+)$/, '$1-$2')
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function toMelbourne(date: string | Date): Date {
  // Return a Date whose LOCAL getters (getFullYear/getMonth/getDate/getDay/
  // getHours/getMinutes) read out the Melbourne wall-clock for this instant.
  // Uses the IANA zone via Intl so it's daylight-saving-aware (AEST +10 /
  // AEDT +11) AND identical on server and client — no hydration mismatch.
  const d = new Date(typeof date === 'string' ? date : date.toISOString())
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  let hour = get('hour')
  if (hour === 24) hour = 0 // some engines emit '24' for midnight
  return new Date(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
}

export function getMelbourneHour(date: string | Date = new Date()): number {
  return toMelbourne(date).getHours()
}

export function formatFullDate(date: string | Date = new Date()): string {
  const d = toMelbourne(date)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function melbourneDateOnly(date: string | Date = new Date()): string {
  const d = toMelbourne(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = toMelbourne(date)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = toMelbourne(date)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${m}`
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = toMelbourne(date)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return '0h 0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}
