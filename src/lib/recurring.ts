import { SupabaseClient } from '@supabase/supabase-js'
import { melbourneDateOnly } from '@/lib/format'

export type Frequency = 'weekly' | 'fortnightly' | 'four_weekly' | 'monthly'

const STEP_DAYS: Record<Exclude<Frequency, 'monthly'>, number> = {
  weekly: 7, fortnightly: 14, four_weekly: 28,
}

// ---- pure date helpers (work in date-only, UTC-noon to dodge DST edges) ----
function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}
function fmt(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}
function addMonths(dt: Date, n: number): Date {
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth(), d = dt.getUTCDate()
  const target = new Date(Date.UTC(y, m + n, 1))
  const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, daysInMonth)) // clamp (e.g. 31st → 30th/28th)
  return target
}

// Occurrence dates (YYYY-MM-DD) strictly after `fromExclusive`, up to and
// including `toInclusive`, stepping from `anchor` by frequency, never past
// `endDate`. Pure + deterministic — unit tested.
export function occurrencesBetween(
  anchor: string,
  frequency: Frequency,
  fromExclusive: string,
  toInclusive: string,
  endDate?: string | null,
): string[] {
  const anchorD = parse(anchor)
  const from = parse(fromExclusive)
  const to = parse(toInclusive)
  const end = endDate ? parse(endDate) : null
  const cap = end && end < to ? end : to
  const out: string[] = []

  if (frequency === 'monthly') {
    // jump-start near `from` by month difference, then walk.
    const monthsDiff = (from.getUTCFullYear() - anchorD.getUTCFullYear()) * 12 + (from.getUTCMonth() - anchorD.getUTCMonth())
    for (let i = Math.max(0, monthsDiff); i < monthsDiff + 500; i++) {
      const occ = addMonths(anchorD, i)
      if (occ > cap) break
      if (occ > from) out.push(fmt(occ))
    }
    return out
  }

  const step = STEP_DAYS[frequency]
  const dayMs = 86400000
  const diff = Math.floor((from.getTime() - anchorD.getTime()) / (step * dayMs))
  for (let i = Math.max(0, diff); i < diff + 5000; i++) {
    const occ = new Date(anchorD.getTime() + i * step * dayMs)
    if (occ > cap) break
    if (occ > from) out.push(fmt(occ))
  }
  return out
}

// Melbourne offset (minutes east of UTC) at a given UTC instant — DST-aware.
function melbourneOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value)
  let h = g('hour'); if (h === 24) h = 0
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second'))
  return (asUtc - utcMs) / 60000
}

// Convert a Melbourne wall-clock (date + "HH:MM") to a UTC ISO instant, DST-aware.
export function melbourneToUtcISO(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = (timeStr || '09:00').split(':').map(Number)
  const naive = Date.UTC(y, mo - 1, d, h, mi)
  let inst = naive - melbourneOffsetMinutes(naive) * 60000
  // refine once for the rare DST-transition day
  const off2 = melbourneOffsetMinutes(inst)
  inst = naive - off2 * 60000
  return new Date(inst).toISOString()
}

interface Agreement {
  id: string; org_id: string; contact_id: string; property_id: string | null
  title: string; frequency: Frequency; anchor_date: string; start_time: string
  duration_minutes: number; end_date: string | null; line_items: unknown
  assigned_users: string[] | null; instructions: string | null; last_generated_date: string | null
  first_visit_date: string | null
}

// Generate scheduled jobs for every active agreement, rolling `horizonDays`
// ahead. Idempotent: skips occurrences that already have a job. Each job flows
// through the normal lifecycle (job_number assigned by the DB trigger).
export async function generateRecurringJobs(supabase: SupabaseClient, horizonDays = 21): Promise<{ created: number }> {
  const todayStr = melbourneDateOnly()
  const horizonStr = melbourneDateOnly(new Date(Date.now() + horizonDays * 86400000))

  const { data: agreements } = await supabase
    .from('service_agreements').select('*').eq('active', true)

  let created = 0

  // Insert one recurring job for `date` (Melbourne wall-clock). Returns true on success.
  async function insertJob(a: Agreement, date: string): Promise<boolean> {
    const startISO = melbourneToUtcISO(date, a.start_time)
    const endISO = new Date(new Date(startISO).getTime() + (a.duration_minutes || 120) * 60000).toISOString()
    const { error } = await supabase.from('jobs').insert({
      org_id: a.org_id,
      contact_id: a.contact_id,
      property_id: a.property_id,
      job_number: '', // assigned by BEFORE INSERT trigger (Track A)
      title: a.title,
      job_type: 'recurring',
      service_agreement_id: a.id,
      status: 'scheduled',
      scheduled_start: startISO,
      scheduled_end: endISO,
      assigned_users: a.assigned_users ?? [],
      instructions: a.instructions,
      line_items: a.line_items ?? [],
    })
    return !error
  }

  for (const a of (agreements ?? []) as Agreement[]) {
    // Include the anchor itself on first run by starting the day before it.
    const fromExclusive = a.last_generated_date ?? fmt(new Date(parse(a.anchor_date).getTime() - 86400000))
    const dates = occurrencesBetween(a.anchor_date, a.frequency, fromExclusive, horizonStr, a.end_date)

    // Idempotency guard: which occurrences already have a job?
    const { data: existing } = await supabase
      .from('jobs').select('scheduled_start')
      .eq('service_agreement_id', a.id)
      .gte('scheduled_start', melbourneToUtcISO(todayStr, '00:00'))
    const existingDates = new Set((existing ?? []).map(j => melbourneDateOnly(j.scheduled_start as string)))

    // Optional one-off first visit on a different day than the ongoing cadence
    // (e.g. first clean on a Tuesday, then the regular Thursday schedule). Added
    // additively; the cursor below is unaffected so the cadence rolls normally.
    if (a.first_visit_date && a.first_visit_date >= todayStr && a.first_visit_date <= horizonStr && !existingDates.has(a.first_visit_date)) {
      if (await insertJob(a, a.first_visit_date)) {
        created++
        existingDates.add(a.first_visit_date)
      }
    }

    if (dates.length === 0) continue

    let lastGen = a.last_generated_date
    for (const date of dates) {
      lastGen = date
      if (existingDates.has(date)) continue
      if (await insertJob(a, date)) created++
    }

    if (lastGen && lastGen !== a.last_generated_date) {
      await supabase.from('service_agreements').update({ last_generated_date: lastGen }).eq('id', a.id)
    }
  }

  return { created }
}
