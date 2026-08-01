import { describe, it, expect } from 'vitest'
import { buildRoomsDescription, defaultRoomSelection, hasRoomSelection, type RoomSelection } from './room-description'

function sel(overrides: Partial<RoomSelection>): RoomSelection {
  return { ...defaultRoomSelection(), ...overrides }
}

describe('defaultRoomSelection', () => {
  it('starts at zero rooms, one storey', () => {
    const d = defaultRoomSelection()
    expect(d.storeys).toBe(1)
    expect(hasRoomSelection(d)).toBe(false)
  })
})

describe('hasRoomSelection', () => {
  it('is false with nothing selected, even with extra storeys', () => {
    expect(hasRoomSelection(sel({ storeys: 3 }))).toBe(false)
  })

  it('is true once any single room is selected', () => {
    expect(hasRoomSelection(sel({ kitchens: 1 }))).toBe(true)
    expect(hasRoomSelection(sel({ laundries: 1 }))).toBe(true)
  })
})

describe('buildRoomsDescription', () => {
  it('returns empty string for no selection', () => {
    expect(buildRoomsDescription(defaultRoomSelection())).toBe('')
  })

  it('singularises a count of one', () => {
    expect(buildRoomsDescription(sel({ queenBeds: 1 }))).toBe('1 Queen bedroom')
    expect(buildRoomsDescription(sel({ fullBaths: 1 }))).toBe('1 Bathroom')
  })

  it('pluralises counts above one', () => {
    expect(buildRoomsDescription(sel({ queenBeds: 2 }))).toBe('2 Queen bedrooms')
    expect(buildRoomsDescription(sel({ fullBaths: 3 }))).toBe('3 Bathrooms')
  })

  it('uses the irregular plural for laundries', () => {
    expect(buildRoomsDescription(sel({ laundries: 1 }))).toBe('1 Laundry')
    expect(buildRoomsDescription(sel({ laundries: 2 }))).toBe('2 Laundries')
  })

  it('joins multiple room types in a fixed, readable order', () => {
    const desc = buildRoomsDescription(sel({
      queenBeds: 2, twinBeds: 1, fullBaths: 2, powderRooms: 1,
      kitchens: 1, livingRooms: 1, diningAreas: 1, offices: 1, laundries: 1,
    }))
    expect(desc).toBe(
      '2 Queen bedrooms, 1 Twin/single bedroom, 2 Bathrooms, 1 Powder room, ' +
      '1 Kitchen, 1 Living/games room, 1 Dining area, 1 Office, 1 Laundry',
    )
  })

  it('appends a storey note only when rooms are selected AND storeys > 1', () => {
    expect(buildRoomsDescription(sel({ kitchens: 1, storeys: 2 }))).toBe('1 Kitchen, 2-storey property')
    // storeys alone (no rooms) must not produce a dangling description
    expect(buildRoomsDescription(sel({ storeys: 2 }))).toBe('')
  })

  it('omits the storey note at the default single storey', () => {
    expect(buildRoomsDescription(sel({ kitchens: 1, storeys: 1 }))).toBe('1 Kitchen')
  })
})
