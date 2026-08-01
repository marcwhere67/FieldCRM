// Builds a professional line-item description from a room selection — the
// same room set as the Quote Calculator (src/components/quotes/quote-calculator.tsx),
// but used to generate TEXT only. No pricing here: the quote builder's manual
// line items are priced by the user, not this calculator's cost engine.
export interface RoomSelection {
  queenBeds: number
  twinBeds: number
  fullBaths: number
  powderRooms: number
  livingRooms: number
  diningAreas: number
  offices: number
  kitchens: number
  laundries: number
  storeys: number
}

export function defaultRoomSelection(): RoomSelection {
  return {
    queenBeds: 0, twinBeds: 0, fullBaths: 0, powderRooms: 0,
    livingRooms: 0, diningAreas: 0, offices: 0, kitchens: 0, laundries: 0, storeys: 1,
  }
}

/** True once at least one room is selected. Storeys alone don't count — a storey count with no rooms describes nothing. */
export function hasRoomSelection(r: RoomSelection): boolean {
  return (
    r.queenBeds + r.twinBeds + r.fullBaths + r.powderRooms +
    r.livingRooms + r.diningAreas + r.offices + r.kitchens + r.laundries
  ) > 0
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/**
 * Builds a comma-joined description, e.g.
 * "2 Queen bedrooms, 1 Bathroom, Kitchen, Laundry, 2-storey property".
 * Returns '' when nothing is selected.
 */
export function buildRoomsDescription(r: RoomSelection): string {
  const parts: string[] = []
  if (r.queenBeds > 0) parts.push(plural(r.queenBeds, 'Queen bedroom'))
  if (r.twinBeds > 0) parts.push(plural(r.twinBeds, 'Twin/single bedroom'))
  if (r.fullBaths > 0) parts.push(plural(r.fullBaths, 'Bathroom'))
  if (r.powderRooms > 0) parts.push(plural(r.powderRooms, 'Powder room'))
  if (r.kitchens > 0) parts.push(plural(r.kitchens, 'Kitchen'))
  if (r.livingRooms > 0) parts.push(plural(r.livingRooms, 'Living/games room'))
  if (r.diningAreas > 0) parts.push(plural(r.diningAreas, 'Dining area'))
  if (r.offices > 0) parts.push(plural(r.offices, 'Office'))
  if (r.laundries > 0) parts.push(plural(r.laundries, 'Laundry', 'Laundries'))
  if (hasRoomSelection(r) && r.storeys > 1) parts.push(`${r.storeys}-storey property`)
  return parts.join(', ')
}
