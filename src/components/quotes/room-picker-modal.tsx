'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  buildRoomsDescription, defaultRoomSelection, hasRoomSelection, type RoomSelection,
} from '@/lib/quotes/room-description'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

interface Props {
  open: boolean
  onClose: () => void
  /** Called with the generated description; the caller inserts it as one line item. */
  onAdd: (description: string) => void
}

function Stepper({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
      <span style={{ color: C.fg, fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 26, height: 26, backgroundColor: 'rgba(44,62,80,0.06)', color: C.navy, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">−</button>
        <span style={{ width: 20, textAlign: 'center', fontSize: 13, fontWeight: 600, color: C.navy, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 26, height: 26, backgroundColor: 'rgba(44,62,80,0.06)', color: C.navy, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">+</button>
      </div>
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 }}>{children}</p>
}

/**
 * Same room set as the Quote Calculator's steppers, but builds only a text
 * description — pricing stays manual in the quote builder's line-item table.
 */
export function RoomPickerModal({ open, onClose, onAdd }: Props) {
  const [r, setR] = useState<RoomSelection>(defaultRoomSelection())
  if (!open) return null

  const set = <K extends keyof RoomSelection>(key: K, val: RoomSelection[K]) => setR(prev => ({ ...prev, [key]: val }))
  const description = buildRoomsDescription(r)
  const canAdd = hasRoomSelection(r)

  function reset() { setR(defaultRoomSelection()) }
  function handleClose() { reset(); onClose() }
  function handleAdd() {
    if (!canAdd) return
    onAdd(description)
    reset()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
      onClick={handleClose}
    >
      <div
        style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(44,62,80,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h3 style={{ fontFamily: C.serif, color: C.navy, fontSize: 19, fontWeight: 400 }}>Select rooms</h3>
            <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Builds one line item — you set the price</p>
          </div>
          <button onClick={handleClose} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }} className="hover:opacity-70 transition-opacity">
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: '4px 20px 16px' }}>
          <SubLabel>Levels</SubLabel>
          <Stepper label="Storeys" value={r.storeys} min={1} onChange={v => set('storeys', v)} />

          <SubLabel>Bedrooms</SubLabel>
          <Stepper label="Bedrooms" value={r.queenBeds} onChange={v => set('queenBeds', v)} />
          <Stepper label="Twin / single bedrooms" value={r.twinBeds} onChange={v => set('twinBeds', v)} />

          <SubLabel>Bathrooms</SubLabel>
          <Stepper label="Full bathrooms" value={r.fullBaths} onChange={v => set('fullBaths', v)} />
          <Stepper label="Powder rooms / WC" value={r.powderRooms} onChange={v => set('powderRooms', v)} />

          <SubLabel>Living</SubLabel>
          <Stepper label="Living / games rooms" value={r.livingRooms} onChange={v => set('livingRooms', v)} />
          <Stepper label="Dining areas" value={r.diningAreas} onChange={v => set('diningAreas', v)} />
          <Stepper label="Offices" value={r.offices} onChange={v => set('offices', v)} />

          <SubLabel>Kitchen &amp; Laundry</SubLabel>
          <Stepper label="Kitchens" value={r.kitchens} onChange={v => set('kitchens', v)} />
          <Stepper label="Laundries" value={r.laundries} onChange={v => set('laundries', v)} />
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, backgroundColor: C.cream }}>
          <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Line preview</p>
          <p style={{ color: description ? C.navy : C.muted, fontSize: 13, fontStyle: description ? 'normal' : 'italic' }}>
            {description || 'Select rooms above to build a description'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleClose}
            style={{ flex: 1, padding: '9px 0', fontSize: 11, letterSpacing: '0.08em', border: `1px solid ${C.border}`, color: C.muted, background: '#fff', cursor: 'pointer' }}
            className="uppercase hover:opacity-70 transition-opacity">
            Cancel
          </button>
          <button onClick={handleAdd} disabled={!canAdd}
            style={{ flex: 1, padding: '9px 0', fontSize: 11, letterSpacing: '0.08em', border: 'none', backgroundColor: canAdd ? C.navy : 'rgba(44,62,80,0.25)', color: '#fff', cursor: canAdd ? 'pointer' : 'not-allowed' }}
            className="uppercase hover:opacity-90 transition-opacity">
            Add to quote
          </button>
        </div>
      </div>
    </div>
  )
}
