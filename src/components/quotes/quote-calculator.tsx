'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Clock, AlertTriangle, CheckCircle, FileText, ChevronDown } from 'lucide-react'

type CleanType = 'regular' | 'deep' | 'airbnb' | 'end_of_lease'
type Frequency = 'oneoff' | 'weekly' | 'fortnightly' | 'monthly'

interface Inputs {
  cleanType: CleanType; frequency: Frequency
  queenBeds: number; twinBeds: number; fullBaths: number; powderRooms: number
  livingRooms: number; diningAreas: number; offices: number; kitchens: number; laundries: number; storeys: number
  linenBeds: number; ovenClean: boolean; interiorFridge: boolean; balcony: boolean; vanityCupboards: boolean; gstRegistered: boolean
}

const DEFAULT: Inputs = {
  cleanType: 'regular', frequency: 'oneoff',
  queenBeds: 0, twinBeds: 0, fullBaths: 0, powderRooms: 0,
  livingRooms: 0, diningAreas: 0, offices: 0, kitchens: 0, laundries: 0, storeys: 1,
  linenBeds: 0, ovenClean: false, interiorFridge: false, balcony: false, vanityCupboards: false, gstRegistered: false,
}

interface Property { id: string; label: string; inp: Inputs }

const CLEAN_LABELS: Record<CleanType, string> = { regular: 'Regular Clean', deep: 'Deep Clean', airbnb: 'Airbnb Turnover', end_of_lease: 'End of Lease Clean' }
const FREQ_LABELS: Record<Frequency, string> = { oneoff: 'One-off', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' }

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const LABOUR_BASE = 45          // employee base wage / hr
const LABOUR_RATE = 50.40       // base + 12% super
const MARGIN_DIVISOR = 0.75     // 25% profit margin (price = cost ÷ 0.75)
const MONTHLY_OVERHEAD = 1884           // Salt Air fixed monthly running costs
const BILLABLE_HOURS_PER_MONTH = 80     // charged hours/month — update as volume grows
const OVERHEAD_RATE = MONTHLY_OVERHEAD / BILLABLE_HOURS_PER_MONTH  // ≈ $23.55/hr recovered per billed hour
const MIN_CHARGE_RATE = (LABOUR_RATE + OVERHEAD_RATE) / MARGIN_DIVISOR  // ≈ $98.60/hr — derived charge rate

let PROP_SEQ = 0
function nextPropId() { return `p${++PROP_SEQ}` }

function roundTo5(n: number) { return Math.round(n / 5) * 5 }

function calcResult(inp: Inputs) {
  // End of Lease is priced identically to Deep for now (explicit business
  // decision, 2026-08-02) — same per-room time multipliers. Likely to get its
  // own pricing model later; when it does, split this back into its own flag.
  const deep = inp.cleanType === 'deep' || inp.cleanType === 'end_of_lease'
  const totalBeds = inp.queenBeds + inp.twinBeds
  const tier = totalBeds <= 2 ? 'S' : totalBeds <= 4 ? 'M' : 'L'
  const roomBreakdown: { label: string; mins: number }[] = []
  if (inp.queenBeds > 0) roomBreakdown.push({ label: `Bedroom ×${inp.queenBeds}`, mins: (deep ? 49 : 15) * inp.queenBeds })
  if (inp.twinBeds > 0)  roomBreakdown.push({ label: `Twin/single bedroom ×${inp.twinBeds}`, mins: (deep ? 70 : 15) * inp.twinBeds })
  if (inp.fullBaths > 0) roomBreakdown.push({ label: `Full bathroom ×${inp.fullBaths}`, mins: (deep ? 90 : 35) * inp.fullBaths })
  if (inp.powderRooms > 0) roomBreakdown.push({ label: `Powder room ×${inp.powderRooms}`, mins: (deep ? 28 : 20) * inp.powderRooms })
  if (inp.livingRooms > 0) roomBreakdown.push({ label: `Living/games room ×${inp.livingRooms}`, mins: (deep ? 28 : 10) * inp.livingRooms })
  if (inp.diningAreas > 0) roomBreakdown.push({ label: `Dining area ×${inp.diningAreas}`, mins: (deep ? 28 : 10) * inp.diningAreas })
  if (inp.offices > 0) roomBreakdown.push({ label: `Office ×${inp.offices}`, mins: (deep ? 28 : 10) * inp.offices })
  const hasAnyRoom = inp.queenBeds > 0 || inp.twinBeds > 0 || inp.fullBaths > 0 || inp.powderRooms > 0 || inp.livingRooms > 0 || inp.diningAreas > 0 || inp.offices > 0 || inp.kitchens > 0 || inp.laundries > 0
  if (hasAnyRoom) roomBreakdown.push({ label: 'Hallways & touch points', mins: deep ? 42 : 30 })
  if (inp.kitchens > 0) roomBreakdown.push({ label: `Kitchen ×${inp.kitchens}`, mins: (deep ? 105 : 45) * inp.kitchens })
  if (inp.laundries > 0) roomBreakdown.push({ label: `Laundry ×${inp.laundries}`, mins: (deep ? 60 : 10) * inp.laundries })

  const addOnBreakdown: { label: string; cost: number; mins: number }[] = []
  if (inp.ovenClean)      addOnBreakdown.push({ label: 'Oven clean', cost: 150, mins: 60 })
  if (inp.interiorFridge) addOnBreakdown.push({ label: 'Interior fridge', cost: 30, mins: 20 })
  if (inp.balcony)        addOnBreakdown.push({ label: 'Balcony / outdoor area', cost: 30, mins: 25 })
  if (inp.vanityCupboards) addOnBreakdown.push({ label: 'Vanity cupboards & drawers', cost: 40, mins: 35 })

  const linenCost   = inp.linenBeds * 25
  const linenMins   = inp.linenBeds * 15
  const extraStoreys = Math.max(0, inp.storeys - 1)   // storeys=1 (single storey) is the free baseline
  const storeyCost  = extraStoreys * 50   // flat fee — not run through labour/overhead/margin/min-job-floor
  const storeyMins  = extraStoreys * 30   // shown in time breakdown only, doesn't re-charge into labour
  const baseJobMins = roomBreakdown.reduce((s, r) => s + r.mins, 0)
  const addOnMins   = addOnBreakdown.reduce((s, a) => s + a.mins, 0)
  const addOnCost   = addOnBreakdown.reduce((s, a) => s + a.cost, 0)
  const bufferMins  = deep ? Math.round(baseJobMins * 0.15) : 0
  const pricingMins = baseJobMins + bufferMins          // room work only — drives the job price
  const totalJobMins = pricingMins + addOnMins + linenMins + storeyMins  // full time (for scheduling + effective rate)
  const totalHours  = totalJobMins / 60
  const labourCost  = (pricingMins / 60) * LABOUR_RATE  // add-ons/linen/storeys are flat fees, not re-charged as labour
  const overheadCost = (pricingMins / 60) * OVERHEAD_RATE  // fixed monthly costs recovered per billed hour
  const jobCosts    = labourCost + overheadCost
  const rawPrice    = hasAnyRoom ? jobCosts / MARGIN_DIVISOR : 0
  const roundedPrice = roundTo5(rawPrice)
  const floorApplied = hasAnyRoom && roundedPrice < 180
  const finalJobPrice = hasAnyRoom ? (floorApplied ? 180 : roundedPrice) : 0
  const profitAmount = finalJobPrice - jobCosts
  const profitMargin = finalJobPrice > 0 ? (profitAmount / finalJobPrice) * 100 : 0
  const grandTotal  = finalJobPrice + linenCost + addOnCost + storeyCost
  const gstAmount   = inp.gstRegistered ? Math.round(grandTotal * 0.1 * 100) / 100 : 0
  const grandTotalIncGst = grandTotal + gstAmount
  const effectiveHourly  = totalHours > 0 ? grandTotal / totalHours : 0
  const warnings: string[] = []
  if (deep && totalHours > 8) warnings.push('Large deep clean — confirm scope and access with client before quoting.')
  if (extraStoreys > 0) warnings.push('Multi-storey property — confirm staircase access.')
  if (floorApplied) warnings.push('Minimum job floor of $180 applied — actual cost was lower.')
  return { tier, totalBeds, deep, roomBreakdown, addOnBreakdown, baseJobMins, bufferMins, pricingMins, totalJobMins, totalHours, labourCost, overheadCost, jobCosts, rawPrice, finalJobPrice, floorApplied, profitAmount, profitMargin, linenCost, linenMins, storeyCost, storeyMins, addOnCost, grandTotal, gstAmount, grandTotalIncGst, effectiveHourly, warnings }
}

// Build the human-readable line-item description for one property's inputs.
// Shared by the calculator's create-quote flow.
function describeProperty(inp: Inputs): string {
  const beds = inp.queenBeds + inp.twinBeds
  const rooms = [
    beds > 0 ? `${beds} bedroom${beds > 1 ? 's' : ''}` : '',
    inp.fullBaths > 0 ? `${inp.fullBaths} bathroom${inp.fullBaths > 1 ? 's' : ''}` : '',
    inp.powderRooms > 0 ? `${inp.powderRooms} powder room${inp.powderRooms > 1 ? 's' : ''}` : '',
    inp.kitchens > 0 ? `${inp.kitchens} kitchen${inp.kitchens > 1 ? 's' : ''}` : '',
    inp.livingRooms > 0 ? `${inp.livingRooms} living/games room${inp.livingRooms > 1 ? 's' : ''}` : '',
    inp.diningAreas > 0 ? `${inp.diningAreas} dining area${inp.diningAreas > 1 ? 's' : ''}` : '',
    inp.offices > 0 ? `${inp.offices} office${inp.offices > 1 ? 's' : ''}` : '',
    inp.laundries > 0 ? `${inp.laundries} laundry${inp.laundries > 1 ? 'ies' : ''}` : '',
  ].filter(Boolean)
  const addOns = [
    inp.linenBeds > 0 ? `linen service (${inp.linenBeds} bed)` : '',
    inp.ovenClean ? 'oven clean' : '',
    inp.interiorFridge ? 'interior fridge' : '',
    inp.balcony ? 'balcony' : '',
    inp.vanityCupboards ? 'vanity cupboards' : '',
  ].filter(Boolean)
  return [
    CLEAN_LABELS[inp.cleanType],
    rooms.length ? rooms.join(', ') : '',
    addOns.length ? `+ ${addOns.join(', ')}` : '',
    inp.frequency !== 'oneoff' ? FREQ_LABELS[inp.frequency] : '',
  ].filter(Boolean).join(' · ')
}

// One line item passed to /quotes/new via the ?items= param.
type CalcLineItem = { description: string; unit_price: number; tax_rate: number }

function pushToQuote(router: ReturnType<typeof useRouter>, items: CalcLineItem[], cleanType?: string) {
  const params = new URLSearchParams({ items: JSON.stringify(items) })
  if (cleanType && cleanType !== 'none') params.set('clean_type', cleanType)
  router.push(`/quotes/new?${params.toString()}`)
}

function Row({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: bold ? C.navy : C.muted, fontSize: 12, fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span style={{ color: green ? C.sage : bold ? C.navy : C.fg, fontSize: 12, fontWeight: bold ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function Stepper({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
      <span style={{ color: C.fg, fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 28, height: 28, backgroundColor: 'rgba(44,62,80,0.06)', color: C.navy, border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">−</button>
        <span style={{ width: 22, textAlign: 'center', fontSize: 13, fontWeight: 600, color: C.navy, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <button onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 28, backgroundColor: 'rgba(44,62,80,0.06)', color: C.navy, border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">+</button>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', width: '100%', textAlign: 'left', border: `1px solid ${value ? 'rgba(118,165,143,0.4)' : C.border}`, borderRadius: 0, backgroundColor: value ? 'rgba(118,165,143,0.07)' : '#fff', cursor: 'pointer', fontSize: 12, color: value ? '#5d8c76' : C.fg }}
      className="hover:opacity-90 transition-opacity">
      <div style={{ width: 14, height: 14, border: value ? '1px solid #76A58F' : `1px solid ${C.muted}`, backgroundColor: value ? C.sage : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {value && <CheckCircle style={{ width: 10, height: 10, color: '#fff' }} />}
      </div>
      {label}
    </button>
  )
}

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
}
const GRID_COLS_SM: Record<number, string> = {
  2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
}

function Segmented<T extends string>({ options, value, onChange, cols, mobileCols }: { options: [T, string][]; value: T; onChange: (v: T) => void; cols: number; mobileCols?: number }) {
  const mCols = mobileCols ?? Math.min(cols, 2)
  return (
    <div className={`grid gap-1.5 ${GRID_COLS[mCols]} ${GRID_COLS_SM[cols]}`}>
      {options.map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)}
          style={{ padding: '8px 4px', fontSize: 11, letterSpacing: '0.03em', borderRadius: 0, border: `1px solid ${value === val ? C.sage : C.border}`, backgroundColor: value === val ? C.sage : '#fff', color: value === val ? '#fff' : C.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}
          className="hover:opacity-90 transition-opacity">
          {label}
        </button>
      ))}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: '16px 18px' }} className="space-y-3">
      <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{title}</p>
      {children}
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 10, marginBottom: 2 }}>{children}</p>
}

// Independent set of properties (add/remove/rename, each with its own Inputs
// and derived calcResult). Used separately by the Calculator and Hourly tabs
// so switching tabs never mixes their room data.
function useProperties() {
  const [properties, setProperties] = useState<Property[]>(() => [{ id: nextPropId(), label: 'Property 1', inp: DEFAULT }])
  const [activeId, setActiveId] = useState<string>(() => properties[0].id)
  const active = properties.find(p => p.id === activeId) ?? properties[0]
  const inp = active.inp
  const set = <K extends keyof Inputs>(key: K, val: Inputs[K]) =>
    setProperties(prev => prev.map(p => p.id === active.id ? { ...p, inp: { ...p.inp, [key]: val } } : p))
  const results = useMemo(() => properties.map(p => calcResult(p.inp)), [properties])
  const activeIndex = Math.max(0, properties.findIndex(p => p.id === active.id))
  const r = results[activeIndex]
  const multi = properties.length > 1

  function addProperty() {
    const id = nextPropId()
    setProperties(prev => [...prev, { id, label: `Property ${prev.length + 1}`, inp: DEFAULT }])
    setActiveId(id)
  }
  function removeProperty(id: string) {
    if (properties.length <= 1) return
    const next = properties.filter(p => p.id !== id)
    setProperties(next)
    if (id === activeId) setActiveId(next[0].id)
  }
  function renameProperty(id: string, label: string) {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, label } : p))
  }

  return { properties, activeId, setActiveId, active, inp, set, results, r, multi, addProperty, removeProperty, renameProperty }
}

function PropertyTabs({ properties, activeId, multi, onSelect, onAdd, onRemove, onRename }: {
  properties: Property[]; activeId: string; multi: boolean
  onSelect: (id: string) => void; onAdd: () => void; onRemove: (id: string) => void; onRename: (id: string, label: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {properties.map(p => {
        const on = p.id === activeId
        return (
          <div key={p.id} onClick={() => onSelect(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', border: `1px solid ${on ? C.sage : C.border}`, backgroundColor: on ? 'rgba(118,165,143,0.10)' : '#fff', cursor: 'pointer' }}>
            {on ? (
              <input value={p.label} onChange={e => onRename(p.id, e.target.value)} onClick={e => e.stopPropagation()}
                style={{ border: 'none', background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 500, width: `${Math.max(8, p.label.length)}ch`, outline: 'none' }} />
            ) : (
              <span style={{ color: C.muted, fontSize: 12 }}>{p.label}</span>
            )}
            {multi && (
              <button onClick={e => { e.stopPropagation(); onRemove(p.id) }}
                style={{ border: 'none', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                className="hover:opacity-70" aria-label={`Remove ${p.label}`}>×</button>
            )}
          </div>
        )
      })}
      <button onClick={onAdd}
        style={{ padding: '5px 10px', border: `1px dashed ${C.sage}`, background: 'none', color: C.sage, fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer' }}
        className="hover:opacity-80">+ Add property</button>
    </div>
  )
}

// The Service / Rooms / Extras input cards — shared by the Calculator and
// Hourly tabs since both need the same room data, just priced differently.
function RoomInputCards({ inp, set }: { inp: Inputs; set: <K extends keyof Inputs>(key: K, val: Inputs[K]) => void }) {
  return (
    <>
      <Card title="Service">
        <Segmented cols={4} value={inp.cleanType} onChange={v => set('cleanType', v)}
          options={[['regular', 'Regular'], ['deep', 'Deep'], ['airbnb', 'Airbnb'], ['end_of_lease', 'End of Lease']]} />
        <SubLabel>Frequency</SubLabel>
        <Segmented cols={4} mobileCols={2} value={inp.frequency} onChange={v => set('frequency', v)}
          options={[['oneoff', 'One-off'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']]} />
        <div style={{ marginTop: 12 }}>
          <Toggle label="GST registered (+10%)" value={inp.gstRegistered} onChange={v => set('gstRegistered', v)} />
        </div>
      </Card>

      <Card title="Rooms">
        <SubLabel>Levels</SubLabel>
        <Stepper label="Storeys" value={inp.storeys} min={1} onChange={v => set('storeys', v)} />
        <p style={{ color: C.muted, fontSize: 10, marginTop: -6, marginBottom: 8 }}>1 = single storey, no extra charge</p>
        <SubLabel>Bedrooms</SubLabel>
        <Stepper label="Bedrooms" value={inp.queenBeds} onChange={v => set('queenBeds', v)} />
        <Stepper label="Twin / single bedrooms" value={inp.twinBeds} onChange={v => set('twinBeds', v)} />
        <SubLabel>Bathrooms</SubLabel>
        <Stepper label="Full bathrooms" value={inp.fullBaths} onChange={v => set('fullBaths', v)} />
        <Stepper label="Powder rooms / WC" value={inp.powderRooms} onChange={v => set('powderRooms', v)} />
        <SubLabel>Living</SubLabel>
        <Stepper label="Living / games rooms" value={inp.livingRooms} onChange={v => set('livingRooms', v)} />
        <Stepper label="Dining areas" value={inp.diningAreas} onChange={v => set('diningAreas', v)} />
        <Stepper label="Offices" value={inp.offices} onChange={v => set('offices', v)} />
        <SubLabel>Kitchen & Laundry</SubLabel>
        <Stepper label="Kitchens" value={inp.kitchens} onChange={v => set('kitchens', v)} />
        <Stepper label="Laundries" value={inp.laundries} onChange={v => set('laundries', v)} />
      </Card>

      <Card title="Extras">
        <Toggle label="Oven clean — $150" value={inp.ovenClean} onChange={v => set('ovenClean', v)} />
        <Toggle label="Interior fridge — $30" value={inp.interiorFridge} onChange={v => set('interiorFridge', v)} />
        <Toggle label="Balcony / outdoor — $30" value={inp.balcony} onChange={v => set('balcony', v)} />
        <Toggle label="Vanity cupboards & drawers — $40" value={inp.vanityCupboards} onChange={v => set('vanityCupboards', v)} />
        <div style={{ marginTop: 4 }}>
          <Stepper label="Linen service — $25 / bed" value={inp.linenBeds} onChange={v => set('linenBeds', v)} />
        </div>
      </Card>
    </>
  )
}

export function QuoteCalculator() {
  const router = useRouter()
  const [tab, setTab] = useState<'calculator' | 'hourly'>('calculator')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showHourlyBreakdown, setShowHourlyBreakdown] = useState(false)

  // Calculator tab: room-based pricing (labour + overhead ÷ margin).
  const calc = useProperties()
  const { properties, activeId, setActiveId, active, inp, set, results, r, multi } = calc

  // Hourly tab: its OWN independent set of properties — same room inputs,
  // but priced as (manual rate × room-derived hours) instead of the formula.
  const hourlySet = useProperties()
  const [hourlyRate, setHourlyRate] = useState(Math.round(MIN_CHARGE_RATE))

  const combinedEx  = results.reduce((s, x) => s + x.grandTotal, 0)
  const combinedGst = results.reduce((s, x) => s + x.gstAmount, 0)
  const combinedInc = combinedEx + combinedGst
  const anyGst = combinedGst > 0

  const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  // rate × room-derived hours, per hourly-tab property.
  function hourlyPriceFor(totalHours: number) {
    const price = Math.round(Math.max(0, hourlyRate) * totalHours * 100) / 100
    return price
  }
  const hourlyPrices = hourlySet.results.map(res => hourlyPriceFor(res.totalHours))
  const hourlyGsts = hourlySet.properties.map((p, i) => p.inp.gstRegistered ? Math.round(hourlyPrices[i] * 0.1 * 100) / 100 : 0)
  const hourlyCombinedEx  = hourlyPrices.reduce((s, x) => s + x, 0)
  const hourlyCombinedGst = hourlyGsts.reduce((s, x) => s + x, 0)
  const hourlyCombinedInc = hourlyCombinedEx + hourlyCombinedGst
  const hourlyAnyGst = hourlyCombinedGst > 0
  const hourlyActiveIndex = Math.max(0, hourlySet.properties.findIndex(p => p.id === hourlySet.active.id))
  const hourlyR = hourlySet.results[hourlyActiveIndex]
  const hourlyActivePrice = hourlyPrices[hourlyActiveIndex]

  function createQuoteFromCalc() {
    const items: CalcLineItem[] = properties
      .map((p, i) => ({
        description: multi ? `${p.label} — ${describeProperty(p.inp)}` : describeProperty(p.inp),
        unit_price: Math.round(results[i].grandTotal * 100) / 100,
        tax_rate: p.inp.gstRegistered ? 10 : 0,
      }))
      .filter(it => it.unit_price > 0)
    if (items.length === 0) return
    // Carry a scope only when every property shares one clean type; a mixed set
    // has no single scope, so the user picks it in the builder.
    const types = new Set(properties.map(p => p.inp.cleanType))
    const sharedType = types.size === 1 ? properties[0].inp.cleanType : undefined
    pushToQuote(router, items, sharedType)
  }

  function createHourlyQuote() {
    const items: CalcLineItem[] = hourlySet.properties
      .map((p, i) => {
        const hrs = hourlySet.results[i].totalHours
        const label = hourlySet.multi ? `${p.label} — ` : ''
        return {
          description: `${label}${describeProperty(p.inp)} (${hrs.toFixed(2)} hrs @ ${fmt(hourlyRate)}/hr)`,
          unit_price: hourlyPrices[i],
          tax_rate: p.inp.gstRegistered ? 10 : 0,
        }
      })
      .filter(it => it.unit_price > 0)
    if (items.length === 0) return
    const types = new Set(hourlySet.properties.map(p => p.inp.cleanType))
    const sharedType = types.size === 1 ? hourlySet.properties[0].inp.cleanType : undefined
    pushToQuote(router, items, sharedType)
  }

  const priceCard = (
    <div style={{ backgroundColor: '#fff', border: `1px solid rgba(118,165,143,0.35)`, borderTop: `3px solid ${C.sage}`, borderRadius: 0, padding: 20 }}>
      <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>{multi ? 'Combined Quote' : 'Final Quoted Price'}</p>
      <div>
        {multi ? (
          properties.map((p, i) => (
            <Row key={p.id} label={`${p.label}${p.inp.gstRegistered ? ' · inc GST' : ''}`} value={fmt(results[i].grandTotal)} />
          ))
        ) : (
          <>
            <Row label="Job price" value={fmt(r.finalJobPrice)} />
            {r.linenCost > 0 && <Row label={`Linen service (${inp.linenBeds} bed)`} value={fmt(r.linenCost)} />}
            {r.storeyCost > 0 && <Row label={`Storeys (${inp.storeys})`} value={fmt(r.storeyCost)} />}
            {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={fmt(a.cost)} />)}
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
        <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total (ex. GST)</span>
        <span style={{ fontFamily: C.serif, color: C.sage, fontSize: 34, fontWeight: 400 }}>{fmt(combinedEx)}</span>
      </div>
      {anyGst && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: C.muted }}>
            <span>GST (10%)</span><span>{fmt(combinedGst)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total inc. GST</span>
            <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 400 }}>{fmt(combinedInc)}</span>
          </div>
        </>
      )}
      <button onClick={createQuoteFromCalc}
        style={{ marginTop: 16, width: '100%', backgroundColor: C.navy, color: '#fff', border: 'none', borderRadius: 0, padding: '12px 16px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        className="uppercase hover:opacity-90 transition-opacity">
        <FileText style={{ width: 14, height: 14 }} />Create quote from this
      </button>
      <button onClick={() => setShowBreakdown(v => !v)}
        style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', color: C.muted, fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        className="hover:text-[#2C3E50] transition-colors">
        <ChevronDown style={{ width: 13, height: 13, transform: showBreakdown ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        {showBreakdown ? 'Hide breakdown' : 'Show breakdown (time, cost, margin)'}
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream }} className="p-4 sm:p-6 pb-28 lg:pb-8">
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, backgroundColor: 'rgba(118,165,143,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calculator style={{ width: 18, height: 18, color: C.sage }} />
          </div>
          <div>
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 24, fontWeight: 400 }}>Quote Calculator</h1>
            <p style={{ color: C.muted, fontSize: 11 }}>Salt Air Cleaning — pricing tool</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
          {([['calculator', 'Calculator'], ['hourly', 'Hourly Rate']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)}
              style={{ padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em', border: 'none', borderBottom: tab === val ? `2px solid ${C.navy}` : '2px solid transparent', color: tab === val ? C.navy : C.muted, background: 'none', cursor: 'pointer', marginBottom: -1 }}
              className="uppercase">
              {label}
            </button>
          ))}
        </div>

        {tab === 'hourly' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
            {/* Inputs */}
            <div className="space-y-3">
              <Card title="Hourly Rate">
                <label style={{ color: C.muted, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Rate ($/hr)</label>
                <input type="number" min={0} step="0.01" value={hourlyRate || ''} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 0, padding: '9px 10px', fontSize: 14, color: C.fg, fontVariantNumeric: 'tabular-nums' }} />
                <p style={{ color: C.muted, fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
                  Applied to every property&apos;s room-derived hours below. Defaults to the derived minimum charge rate ({fmt(MIN_CHARGE_RATE)}/hr) — override with your own.
                </p>
              </Card>

              {/* Property tabs — independent from the Calculator tab's properties */}
              <PropertyTabs
                properties={hourlySet.properties} activeId={hourlySet.activeId} multi={hourlySet.multi}
                onSelect={hourlySet.setActiveId} onAdd={hourlySet.addProperty} onRemove={hourlySet.removeProperty} onRename={hourlySet.renameProperty}
              />

              <RoomInputCards inp={hourlySet.inp} set={hourlySet.set} />
            </div>

            {/* Price + breakdown (sticky on desktop) */}
            <div className="lg:sticky lg:top-6 space-y-4">
              <div style={{ backgroundColor: '#fff', border: `1px solid rgba(118,165,143,0.35)`, borderTop: `3px solid ${C.sage}`, borderRadius: 0, padding: 20 }}>
                <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>{hourlySet.multi ? 'Combined Hourly Quote' : 'Hourly Quote'}</p>
                <div>
                  {hourlySet.properties.map((p, i) => (
                    <Row key={p.id}
                      label={`${p.label} · ${hourlySet.results[i].totalHours.toFixed(2)} hrs${p.inp.gstRegistered ? ' · inc GST' : ''}`}
                      value={fmt(hourlyPrices[i])} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
                  <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total (ex. GST)</span>
                  <span style={{ fontFamily: C.serif, color: C.sage, fontSize: 34, fontWeight: 400 }}>{fmt(hourlyCombinedEx)}</span>
                </div>
                {hourlyAnyGst && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: C.muted }}>
                      <span>GST (10%)</span><span>{fmt(hourlyCombinedGst)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total inc. GST</span>
                      <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 400 }}>{fmt(hourlyCombinedInc)}</span>
                    </div>
                  </>
                )}
                {hourlyRate > 0 && (
                  <p style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Profit ≈ {fmt(hourlyRate - LABOUR_RATE)} / hr over the {fmt(LABOUR_RATE)} labour cost.</p>
                )}
                <button onClick={createHourlyQuote}
                  style={{ marginTop: 16, width: '100%', backgroundColor: C.navy, color: '#fff', border: 'none', borderRadius: 0, padding: '12px 16px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  className="uppercase hover:opacity-90 transition-opacity">
                  <FileText style={{ width: 14, height: 14 }} />Create quote from this
                </button>
                <button onClick={() => setShowHourlyBreakdown(v => !v)}
                  style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', color: C.muted, fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  className="hover:text-[#2C3E50] transition-colors">
                  <ChevronDown style={{ width: 13, height: 13, transform: showHourlyBreakdown ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                  {showHourlyBreakdown ? 'Hide breakdown' : 'Show time breakdown'}
                </button>
              </div>

              {showHourlyBreakdown && (
                <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Clock style={{ width: 14, height: 14, color: C.muted }} />
                    <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Time Breakdown{hourlySet.multi ? ` — ${hourlySet.active.label}` : ''}</p>
                    <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 10 }}>{hourlyR.deep ? 'Deep times' : 'Standard times'}</span>
                  </div>
                  {hourlyR.roomBreakdown.map((row, i) => <Row key={i} label={row.label} value={`${row.mins} min`} />)}
                  {hourlySet.inp.linenBeds > 0 && <Row label={`Linen service ×${hourlySet.inp.linenBeds} bed`} value={`${hourlyR.linenMins} min`} />}
                  {hourlyR.storeyMins > 0 && <Row label={`Storeys ×${hourlySet.inp.storeys}`} value={`${hourlyR.storeyMins} min`} />}
                  {hourlyR.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={`${a.mins} min`} />)}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                    {hourlyR.bufferMins > 0 && <Row label="Unseen property buffer (+15%)" value={`${hourlyR.bufferMins} min`} />}
                    <Row label="Total billed time" value={`${hourlyR.totalJobMins} min (${hourlyR.totalHours.toFixed(2)} hrs)`} bold />
                    <Row label={`${hourlySet.active.label} price`} value={fmt(hourlyActivePrice)} bold green />
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }} className="space-y-1">
                <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Hourly Rate Reference</p>
                <Row label="Base wage" value={`${fmt(LABOUR_BASE)} / hr`} />
                <Row label="Superannuation (12%)" value={`${fmt(LABOUR_BASE * 0.12)} / hr`} />
                <Row label="Total labour rate" value={`${fmt(LABOUR_RATE)} / hr`} bold />
                <Row label={`Overhead recovery (${BILLABLE_HOURS_PER_MONTH} hrs/mo)`} value={`${fmt(OVERHEAD_RATE)} / hr`} />
                <Row label="Total cost rate" value={`${fmt(LABOUR_RATE + OVERHEAD_RATE)} / hr`} bold />
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                  <Row label="Minimum charge rate" value={`${fmt(MIN_CHARGE_RATE)} / hr`} bold green />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
            {/* Inputs */}
            <div className="space-y-3">
              <PropertyTabs
                properties={properties} activeId={activeId} multi={multi}
                onSelect={setActiveId} onAdd={calc.addProperty} onRemove={calc.removeProperty} onRename={calc.renameProperty}
              />

              <RoomInputCards inp={inp} set={set} />
            </div>

            {/* Price + breakdown (sticky on desktop) */}
            <div className="lg:sticky lg:top-6 space-y-4">
              {priceCard}

              {showBreakdown && (
                <>
                  <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Clock style={{ width: 14, height: 14, color: C.muted }} />
                      <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Time Breakdown{multi ? ` — ${active.label}` : ''}</p>
                      <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 10 }}>{r.deep ? 'Deep times' : 'Standard times'}</span>
                    </div>
                    {r.roomBreakdown.map((row, i) => <Row key={i} label={row.label} value={`${row.mins} min`} />)}
                    {inp.linenBeds > 0 && <Row label={`Linen service ×${inp.linenBeds} bed`} value={`${r.linenMins} min`} />}
                    {r.storeyMins > 0 && <Row label={`Storeys ×${inp.storeys}`} value={`${r.storeyMins} min`} />}
                    {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={`${a.mins} min`} />)}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                      {r.bufferMins > 0 && <Row label="Unseen property buffer (+15%)" value={`${r.bufferMins} min`} />}
                      <Row label="Total billed time" value={`${r.totalJobMins} min (${r.totalHours.toFixed(2)} hrs)`} bold />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
                    <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 12 }}>Cost Breakdown{multi ? ` — ${active.label}` : ''}</p>
                    <Row label={`Labour (${(r.pricingMins / 60).toFixed(2)} hrs × ${fmt(LABOUR_RATE)})`} value={fmt(r.labourCost)} />
                    <Row label={`Overhead (${(r.pricingMins / 60).toFixed(2)} hrs × ${fmt(OVERHEAD_RATE)})`} value={fmt(r.overheadCost)} />
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                      <Row label="Total job costs" value={fmt(r.jobCosts)} bold />
                      <Row label="Profit amount" value={fmt(r.profitAmount)} />
                      <Row label="Profit margin" value={`${r.profitMargin.toFixed(1)}%`} green />
                    </div>
                  </div>
                </>
              )}

              {r.warnings.length > 0 && (
                <div style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 0, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: '#b45309' }} />
                    <span style={{ color: '#b45309', fontSize: 12, fontWeight: 500 }}>Warnings</span>
                  </div>
                  {r.warnings.map((w, i) => <p key={i} style={{ color: '#b45309', fontSize: 12, opacity: 0.85, marginBottom: 2 }}>• {w}</p>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile pinned price bar (sits above the bottom nav) */}
      <div className="flex lg:hidden" style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 40, backgroundColor: '#fff', borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 16px rgba(44,62,80,0.08)', padding: '10px 16px', alignItems: 'center', gap: 12 }}>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total{(tab === 'calculator' ? anyGst : hourlyAnyGst) ? ' inc. GST' : ' ex. GST'}</div>
          <div style={{ fontFamily: C.serif, color: C.sage, fontSize: 24, fontWeight: 400 }}>
            {tab === 'calculator' ? fmt(anyGst ? combinedInc : combinedEx) : fmt(hourlyAnyGst ? hourlyCombinedInc : hourlyCombinedEx)}
          </div>
        </div>
        <button onClick={tab === 'calculator' ? createQuoteFromCalc : createHourlyQuote}
          style={{ marginLeft: 'auto', backgroundColor: C.navy, color: '#fff', border: 'none', borderRadius: 0, padding: '11px 16px', fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          className="uppercase">
          <FileText style={{ width: 13, height: 13 }} />Create quote
        </button>
      </div>
    </div>
  )
}
