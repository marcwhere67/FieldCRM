// Scope of Work definitions appended to quotes, chosen by the quote's clean type.
// Hard-coded per business spec (Salt Air Cleaning). Deep & Airbnb are presented as a
// SINGLE combined "Includes" list (the Regular scope merged with their extras) so the
// client sees one clean list rather than "regular + plus" sections.

export type CleanType = 'regular' | 'deep' | 'airbnb' | 'end_of_lease'

export const CLEAN_TYPE_LABELS: Record<CleanType, string> = {
  regular: 'Regular Clean',
  deep: 'Deep Clean',
  airbnb: 'Airbnb / Short-Stay Turnover Clean',
  end_of_lease: 'End of Lease Clean',
}

// Base Regular Clean scope — included in every clean type.
const REGULAR_BULLETS = [
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Kitchen and bathroom cupboard exteriors and kickboards wiped',
  'Bathrooms: toilet (inside and outside), shower screen/walls and base, sinks and vanity surfaces wiped and cleaned, mirrors cleaned',
  'Laundry: sink, tapware and surfaces wiped',
  'Bedrooms and living areas dusted and surfaces cleaned',
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards dusted',
]

// Deep Clean — one list, ordered by area (kitchen → bathrooms → laundry →
// bedrooms/living → floors & finishing) with the deep-specific extras folded
// into their relevant area.
const DEEP_BULLETS = [
  // Kitchen
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Kitchen and bathroom cupboard exteriors and kickboards wiped',
  'Kitchen cupboards cleaned internally (excluding food storage cupboards), where contents can be easily and safely removed and put back',
  'Interior microwave cleaning',
  'Range hood filter cleaned using standard cleaning products (results may vary depending on level of grease build-up)',
  'Interior and exterior of kitchen and bathroom bins cleaned (does not include removal of embedded stains or odours from prolonged heavy use)',
  // Bathrooms
  'Bathrooms: toilet (inside and outside), shower screen/walls and base, sinks and vanity surfaces wiped and cleaned, mirrors cleaned',
  'Bathrooms given additional detailed cleaning, including grout scrubbing and tap fittings',
  // Laundry
  'Laundry: sink, tapware and surfaces wiped',
  'Laundry given additional detailed clean, including exterior of appliances',
  // Bedrooms & living
  'Bedrooms and living areas dusted and surfaces cleaned',
  // Floors & finishing
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards thoroughly cleaned',
  'Window tracks cleaned where accessible',
  'Light switches, door handles and door frames wiped down',
  'Spot-cleaning of visible marks on walls, where marks can be removed without excessive scrubbing (does not include full wall washing, textured/heavily soiled walls, or marks requiring repainting)',
  'Accessible air conditioning filters removed, cleaned and put back (does not include filters requiring tools to access, servicing, or units showing signs of fault)',
  'Additional detailed attention to reachable high areas (e.g. ceiling fans, light fittings, exhaust fan covers) using standard equipment, up to a two-step ladder height',
]

// Airbnb / Short-Stay Turnover — one list, ordered by area, with the handover/turnover
// tasks grouped together at the end.
const AIRBNB_BULLETS = [
  // Kitchen
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Kitchen and bathroom cupboard exteriors and kickboards wiped',
  'Interior check of cupboards and appliances for cleanliness and guest-left items',
  'Dishes left by guests washed and returned to cupboards (excessive volumes may incur additional time/cost)',
  'Kitchen and bathroom bins emptied, re-lined, and interior and exterior wiped down where required',
  // Bathrooms
  'Bathrooms: toilet (inside and outside), shower screen/walls and base, sinks and vanity surfaces wiped and cleaned, mirrors cleaned',
  // Laundry
  'Laundry: sink, tapware and surfaces wiped',
  // Bedrooms & living
  'Bedrooms and living areas dusted and surfaces cleaned',
  'Linen changed and beds remade with provided linen',
  'High-touch points cleaned (door handles, light switches)',
  // Floors & finishing
  'Floors vacuumed and mopped throughout accessible areas',
  'Skirting boards dusted',
  // Turnover / handover
  'Property reset to standard presentation (surfaces cleared, furniture and objects returned to their standard position within the cleaner’s reasonable ability to move them, general tidiness restored)',
  'Restocking of guest amenities using supplies provided by the client (does not include purchasing or sourcing amenities)',
  'BBQ exterior wiped down and grill plate cleaned where accessible (does not include full degreasing or servicing)',
  'Quick post-stay condition check of the property',
  'After-photos taken of the cleaned property to provide proof of completed work and confirm the property is ready for guest arrival. Photos are sent to the client via message after the clean is complete.',
  'Reporting of visible guest damages or issues to the client',
]

// End of Lease / Bond Clean — for vacating properties, assumed empty of
// furniture/belongings (occupied properties may affect access and incur
// additional cost). Deliberately does NOT include any "bond back guarantee"
// or free re-clean promise — that's a contractual commitment for the
// business to decide on, not a cleaning-scope line item; instead a footnote
// disclaims that bond return is determined by the property manager/landlord.
const END_OF_LEASE_BULLETS = [
  // Kitchen
  'Kitchen bench tops, splashbacks and surfaces cleaned',
  'Sink and cooktop cleaned',
  'Exterior of appliances wiped',
  'Oven cleaned inside and out, including racks and door glass (exterior and interior panel only, excludes between double-glazed door panels, and excessively burnt-on residue requiring specialist treatment)',
  'Interior microwave cleaning',
  'Range hood filter cleaned using standard cleaning products (results may vary depending on level of grease build-up)',
  'Interior and exterior of kitchen and bathroom bins cleaned (does not include removal of embedded stains or odours from prolonged heavy use)',
  'Interior and exterior of all cupboards and drawers cleaned throughout the house — kitchen, bathroom, bedrooms and living areas (excluding food storage cupboards, where contents can be easily and safely removed and put back)',
  'Wardrobes and built-in storage cleaned internally, including shelving and tracks',
  // Bathrooms
  'Bathrooms: toilet (inside and outside), shower screen/walls and base, sinks and vanity surfaces wiped and cleaned, mirrors cleaned',
  'Bathrooms given additional detailed cleaning, including grout scrubbing and tap fittings',
  // Laundry
  'Laundry: sink, tapware and surfaces wiped, including exterior of appliances',
  // Bedrooms & living
  'Bedrooms and living areas dusted and surfaces cleaned',
  // Floors & finishing
  'Floors vacuumed and mopped throughout accessible areas',
  'Carpets vacuumed throughout',
  'Skirting boards, architraves and door frames cleaned throughout',
  'Window tracks cleaned where accessible',
  'Light switches and door handles wiped down',
  'Spot-cleaning of visible marks on walls, where marks can be removed without excessive scrubbing (does not include full wall washing, textured/heavily soiled walls, or marks requiring repainting)',
  'Accessible air conditioning filters removed, cleaned and put back (does not include filters requiring tools to access, servicing, or units showing signs of fault)',
  'All light fittings, exhaust fans and ceiling fans cleaned, up to a two-step ladder height',
]

// Add-ons — informational only (no pricing shown), the SAME list appears under
// every clean type. Clients see what's available and can ask about adding them.
export const ADD_ONS: string[] = [
  'Interior fridge cleaning — interior wiped and cleaned (contents removed by client prior to service)',
  'Interior oven cleaning — interior cleaned using standard products (results may vary depending on build-up; does not include disassembly of oven door or cleaning between door glass panels)',
  'Interior window cleaning (glass only) — does not include tracks, frames, screens or curtains/blinds',
  'Exterior window cleaning (ground floor / accessible only) — does not include upper storey or ladder access beyond two-step height',
  'Balcony/outdoor area clean — surfaces and outdoor furniture wiped down (does not include pressure washing or mould/mildew treatment)',
  'Garage clean/sweep — floor swept and surfaces wiped where accessible (does not include removal of stored items or oil/grease stains)',
  'Wall washing (full walls) — does not include textured/heavily soiled walls or marks requiring repainting',
  'Linen changing — bed linen changed and beds remade using client-provided linen',
  'Floor tile grout scrubbing (bathroom, kitchen, laundry) — results may vary depending on staining; does not include grout sealing, re-grouting, or heavy discolouration treatment',
  'Pressure washing (driveways, decks, exterior areas) — quoted separately on inspection',
]

export interface ScopeDefinition {
  title: string
  intro: string
  includes: string[]
  footnote?: string
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
  end_of_lease: {
    title: CLEAN_TYPE_LABELS.end_of_lease,
    intro: 'A thorough end of lease clean for vacating properties, assuming the property is empty of furniture and belongings (occupied properties may affect access and incur additional cost).',
    includes: END_OF_LEASE_BULLETS,
    footnote: 'This service does not guarantee bond return, as this is determined by the property manager or landlord based on factors outside our control.',
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
  return v === 'regular' || v === 'deep' || v === 'airbnb' || v === 'end_of_lease'
}

export function getScope(cleanType: unknown): ScopeDefinition | null {
  return isCleanType(cleanType) ? SCOPE[cleanType] : null
}
