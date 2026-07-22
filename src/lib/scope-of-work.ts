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

// Deep Clean — one list, ordered by area (kitchen → bathrooms → bedrooms/living →
// floors & finishing) with the deep-specific extras folded into their relevant area.
const DEEP_BULLETS = [
  // Kitchen
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Interior microwave cleaning',
  'Interior cupboards cleaned (non-food cupboards only)',
  // Bathrooms
  'Bathrooms: toilet, shower, sinks and visible surfaces cleaned',
  'Bathrooms given additional detailed cleaning including grout attention where required',
  // Bedrooms & living
  'Bedrooms and living areas tidied and cleaned',
  // Floors & finishing
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards thoroughly cleaned',
  'Window tracks cleaned where accessible',
  'Additional detailed attention to high and hard-to-reach areas',
]

// Airbnb / Short-Stay Turnover — one list, ordered by area, with the handover/turnover
// tasks grouped together at the end.
const AIRBNB_BULLETS = [
  // Kitchen
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Interior check of cupboards and appliances',
  'Washing dishes and returning them to cupboards where required',
  // Bathrooms
  'Bathrooms: toilet, shower, sinks and visible surfaces cleaned',
  // Bedrooms & living
  'Bedrooms and living areas tidied and cleaned',
  'Linen changed and beds remade',
  // Floors & finishing
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards dusted',
  // Turnover / handover
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

// Quote Terms & Conditions — rendered as a dedicated page at the end of every
// quote PDF. Each section = a heading plus an ordered list of blocks, where a
// block is either a paragraph ({ text }) or a bulleted list ({ bullets }).
// The legacy 3 "General Conditions" bullets are folded into section 5 below.
export type TermsBlock = { text: string } | { bullets: string[] }
export interface TermsSection {
  heading: string
  blocks: TermsBlock[]
}

export const QUOTE_TERMS: TermsSection[] = [
  {
    heading: '1. Quote Validity',
    blocks: [
      { text: 'This quotation is based on the information provided and the agreed scope of works at the time of booking. Pricing assumes the property is in reasonable and well-maintained condition.' },
      { text: 'If the condition, level of build-up, or scope of work differs significantly from what was described, Salt Air Cleaning reserves the right to revise the quotation prior to proceeding. Any adjustments will be discussed and approved before work continues.' },
      { text: 'Quotes are valid for 14 days from the date issued.' },
    ],
  },
  {
    heading: '2. Payment Terms',
    blocks: [
      { text: 'For Deep Cleans, End of Lease Cleans, or first-time / one-off clients, a 50% deposit is required to secure the booking date.' },
      { text: 'The remaining balance is due within 24 hours of service completion unless otherwise agreed. Payments received after 24 hours may incur:' },
      { bullets: [
        '$25 late fee, plus',
        '5% of the total invoice per week overdue',
      ] },
      { text: 'Salt Air Cleaning reserves the right to refuse future services until outstanding balances are paid in full.' },
    ],
  },
  {
    heading: '3. Access & Utilities',
    blocks: [
      { text: 'Clients must provide safe and uninterrupted access to the property at the scheduled service time, including electricity and running water.' },
      { text: 'If access is delayed, unavailable, or unsafe, the full quoted fee remains payable. Additional fees may apply for time lost, extended service duration, or return visits.' },
    ],
  },
  {
    heading: '4. Cancellations & Rescheduling',
    blocks: [
      { text: 'Cancellations or rescheduling must be made at least 48 hours prior to the scheduled service.' },
      { text: 'If cancellation occurs within 48 hours of the booking, or if access cannot be provided at the scheduled time, 50% of the agreed service fee will be charged.' },
      { text: 'Rescheduling requests are subject to availability.' },
    ],
  },
  {
    heading: '5. Service Limitations',
    blocks: [
      { text: 'Salt Air Cleaning performs services within the agreed scope only. The following conditions apply:' },
      { bullets: [
        'Large or heavy furniture will not be moved',
        'Cleaning is limited to accessible areas within safe reach; areas blocked by furniture or excessive clutter may not be cleaned',
        'Services are performed using standard professional cleaning equipment and products',
      ] },
    ],
  },
  {
    heading: '6. Waste & Rubbish Disposal',
    blocks: [
      { text: "All rubbish and waste generated during the cleaning service will be disposed of on-site using the property's allocated waste and recycling bins." },
      { text: 'Salt Air Cleaning does not remove rubbish from the property or transport waste off-site. Clients are responsible for ensuring appropriate bins are available and accessible.' },
      { text: 'If bins are full or unavailable, rubbish will be securely bagged and left within the property or near the designated bin area for client disposal.' },
    ],
  },
  {
    heading: '7. Quality Assurance',
    blocks: [
      { text: 'Salt Air Cleaning is committed to maintaining high presentation standards.' },
      { text: 'Any concerns must be reported within 24 hours of service completion. Where the issue falls within the agreed scope of work, we will return to rectify the concern.' },
      { text: 'Refunds are not provided.' },
    ],
  },
  {
    heading: '8. Liability',
    blocks: [
      { text: 'While every care is taken during service delivery, Salt Air Cleaning is not liable for pre-existing damage, wear and tear, faulty fixtures, or unsecured valuables.' },
      { text: 'Clients are responsible for securing fragile items, valuables, documents, and pets prior to service.' },
      { text: 'Salt Air Cleaning is not responsible for damage caused by faulty fittings, aged surfaces, or normal wear of materials.' },
    ],
  },
  {
    heading: '9. Acceptance',
    blocks: [
      { text: 'Acceptance of this quotation confirms agreement to the Scope of Work and Quote Terms & Conditions outlined above.' },
    ],
  },
]

export function isCleanType(v: unknown): v is CleanType {
  return v === 'regular' || v === 'deep' || v === 'airbnb'
}

export function getScope(cleanType: unknown): ScopeDefinition | null {
  return isCleanType(cleanType) ? SCOPE[cleanType] : null
}
