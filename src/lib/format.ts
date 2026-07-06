export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function toMelbourne(date: string | Date): Date {
  // Convert to Melbourne time by offsetting UTC
  const d = new Date(typeof date === 'string' ? date : date.toISOString())
  // Melbourne is UTC+10 (AEST) or UTC+11 (AEDT) — use fixed +10 for SSR consistency
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  return new Date(utc + 10 * 3600000)
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
