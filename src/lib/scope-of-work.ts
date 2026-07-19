// Scope of Work definitions appended to quotes, chosen by the quote's clean type.
// Hard-coded per business spec (Salt Air Cleaning). Deep & Airbnb show the FULL
// Regular Clean bullet list plus their own extras, so the client sees everything included.

export type CleanType = 'regular' | 'deep' | 'airbnb'

export const CLEAN_TYPE_LABELS: Record<CleanType, string> = {
  regular: 'Regular Clean',
  deep: 'Deep Clean',
  airbnb: 'Airbnb / Short-Stay Turnover Clean',
}

// Shared base — every clean includes the Regular Clean scope.
const REGULAR_BULLETS = [
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Bathrooms: toilet, shower, sinks and visible surfaces cleaned',
  'Bedrooms and living areas tidied and cleaned',
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards dusted',
]

export interface ScopeDefinition {
  title: string
  intro: string
  baseBullets: string[]
  extrasLabel?: string
  extras?: string[]
}

export const SCOPE: Record<CleanType, ScopeDefinition> = {
  regular: {
    title: CLEAN_TYPE_LABELS.regular,
    intro: 'A maintenance clean designed to maintain cleanliness and presentation of a regularly serviced property.',
    baseBullets: REGULAR_BULLETS,
  },
  deep: {
    title: CLEAN_TYPE_LABELS.deep,
    intro: 'A detailed service intended for properties requiring a higher level of attention, build-up removal, or periodic intensive cleaning.',
    baseBullets: REGULAR_BULLETS,
    extrasLabel: 'Plus, for a Deep Clean:',
    extras: [
      'Interior cupboards cleaned (non-food cupboards only)',
      'Interior microwave cleaning',
      'Bathrooms given additional detailed cleaning including grout attention where required',
      'Skirting boards thoroughly cleaned',
      'Window tracks cleaned where accessible',
      'Additional detailed attention to high and hard-to-reach areas',
    ],
  },
  airbnb: {
    title: CLEAN_TYPE_LABELS.airbnb,
    intro: 'A presentation-focused service designed specifically for short-term rental properties between guest stays.',
    baseBullets: REGULAR_BULLETS,
    extrasLabel: 'Plus, for an Airbnb / Short-Stay Turnover Clean:',
    extras: [
      'Interior check of cupboards and appliances',
      'Washing dishes and returning them to cupboards where required',
      'Linen changed and beds remade',
      'Full property reset and staging for the next guest',
      'Restocking of provided guest amenities',
      'BBQ maintenance between guest stays',
      'Quick post-stay condition check',
      'Photo documentation where required',
      'Reporting of visible guest damages or issues',
    ],
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
