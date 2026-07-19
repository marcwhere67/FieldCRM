// Scope of Work definitions appended to quotes, chosen by the quote's clean type.
// Hard-coded per business spec (Salt Air Cleaning). Deep & Airbnb are presented as a
// SINGLE combined "Includes" list (the Regular scope merged with their extras) so the
// client sees one clean list rather than "regular + plus" sections.

export type CleanType = 'regular' | 'deep' | 'airbnb'

export const CLEAN_TYPE_LABELS: Record<CleanType, string> = {
  regular: 'Regular Clean',
  deep: 'Deep Clean',
  airbnb: 'Airbnb / Short-Stay Turnover Clean',
}

// Base Regular Clean scope — included in every clean type.
const REGULAR_BULLETS = [
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Bathrooms: toilet, shower, sinks and visible surfaces cleaned',
  'Bedrooms and living areas tidied and cleaned',
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards dusted',
]

// Deep Clean = Regular scope (the deep "thoroughly cleaned" skirting line replaces the
// regular "dusted" one) + the deep-specific extras, all in one list.
const DEEP_BULLETS = [
  ...REGULAR_BULLETS.filter(b => b !== 'Skirting boards dusted'),
  'Interior cupboards cleaned (non-food cupboards only)',
  'Interior microwave cleaning',
  'Bathrooms given additional detailed cleaning including grout attention where required',
  'Skirting boards thoroughly cleaned',
  'Window tracks cleaned where accessible',
  'Additional detailed attention to high and hard-to-reach areas',
]

// Airbnb / Short-Stay Turnover = full Regular scope + turnover extras, all in one list.
const AIRBNB_BULLETS = [
  ...REGULAR_BULLETS,
  'Interior check of cupboards and appliances',
  'Washing dishes and returning them to cupboards where required',
  'Linen changed and beds remade',
  'Full property reset and staging for the next guest',
  'Restocking of provided guest amenities',
  'BBQ maintenance between guest stays',
  'Quick post-stay condition check',
  'Photo documentation where required',
  'Reporting of visible guest damages or issues',
]

export interface ScopeDefinition {
  title: string
  intro: string
  includes: string[]
}

export const SCOPE: Record<CleanType, ScopeDefinition> = {
  regular: {
    title: CLEAN_TYPE_LABELS.regular,
    intro: 'A maintenance clean designed to maintain cleanliness and presentation of a regularly serviced property.',
    includes: REGULAR_BULLETS,
  },
  deep: {
    title: CLEAN_TYPE_LABELS.deep,
    intro: 'A detailed service intended for properties requiring a higher level of attention, build-up removal, or periodic intensive cleaning.',
    includes: DEEP_BULLETS,
  },
  airbnb: {
    title: CLEAN_TYPE_LABELS.airbnb,
    intro: 'A presentation-focused service designed specifically for short-term rental properties between guest stays.',
    includes: AIRBNB_BULLETS,
  },
}

export const GENERAL_CONDITIONS = [
  'Cleaning is performed within reasonable reach using standard professional equipment.',
  'Areas blocked by large furniture or excessive clutter may not be cleaned.',
  'Large or heavy furniture will not be moved.',
]

export function isCleanType(v: unknown): v is CleanType {
  return v === 'regular' || v === 'deep' || v === 'airbnb'
}

export function getScope(cleanType: unknown): ScopeDefinition | null {
  return isCleanType(cleanType) ? SCOPE[cleanType] : null
}
