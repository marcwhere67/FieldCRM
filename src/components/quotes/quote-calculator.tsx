'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Clock, AlertTriangle, CheckCircle, FileText, ChevronDown } from 'lucide-react'

type CleanType = 'regular' | 'deep' | 'airbnb'
type Frequency = 'oneoff' | 'weekly' | 'fortnightly' | 'monthly'

interface Inputs {
  cleanType: CleanType; frequency: Frequency
  queenBeds: number; twinBeds: number; fullBaths: number; powderRooms: number
  livingRooms: number; diningAreas: number; kitchens: number; laundries: number; storeys: number
  linenBeds: number; ovenClean: boolean; interiorFridge: boolean; balcony: boolean; vanityCupboards: boolean; gstRegistered: boolean
}

const DEFAULT: Inputs = {
  cleanType: 'regular', frequency: 'oneoff',
  queenBeds: 0, twinBeds: 0, fullBaths: 0, powderRooms: 0,
  livingRooms: 0, diningAreas: 0, kitchens: 0, laundries: 0, storeys: 0,
  linenBeds: 0, ovenClean: false, interiorFridge: false, balcony: false, vanityCupboards: false, gstRegistered: false,
}

const CLEAN_LABELS: Record<CleanType, string> = { regular: 'Regular Clean', deep: 'Deep Clean', airbnb: 'Airbnb Turnover' }
const FREQ_LABELS: Record<Frequency, string> = { oneoff: 'One-off', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' }

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const LABOUR_BASE = 45          // employee base wage / hr
const LABOUR_RATE = 50.40       // base + 12% super
const MARGIN_DIVISOR = 0.75     // 25% profit margin (price = cost ÷ 0.75)

function roundTo5(n: number) { return Math.round(n / 5) * 5 }

function calcResult(inp: Inputs) {
  const deep = inp.cleanType === 'deep'
  const totalBeds = inp.queenBeds + inp.twinBeds
  const tier = totalBeds <= 2 ? 'S' : totalBeds <= 4 ? 'M' : 'L'
  const roomBreakdown: { label: string; mins: number }[] = []
  if (inp.queenBeds > 0) roomBreakdown.push({ label: `Queen bedroom ×${inp.queenBeds}`, mins: (deep ? 49 : 35) * inp.queenBeds })
  if (inp.twinBeds > 0)  roomBreakdown.push({ label: `Twin/single bedroom ×${inp.twinBeds}`, mins: (deep ? 70 : 50) * inp.twinBeds })
  if (inp.fullBaths > 0) roomBreakdown.push({ label: `Full bathroom ×${inp.fullBaths}`, mins: (deep ? 90 : 35) * inp.fullBaths })
  if (inp.powderRooms > 0) roomBreakdown.push({ label: `Powder room ×${inp.powderRooms}`, mins: (deep ? 28 : 20) * inp.powderRooms })
  if (inp.livingRooms > 0) roomBreakdown.push({ label: `Living/games room ×${inp.livingRooms}`, mins: (deep ? 28 : 20) * inp.livingRooms })
  if (inp.diningAreas > 0) roomBreakdown.push({ label: `Dining area ×${inp.diningAreas}`, mins: (deep ? 28 : 20) * inp.diningAreas })
  const hasAnyRoom = inp.queenBeds > 0 || inp.twinBeds > 0 || inp.fullBaths > 0 || inp.powderRooms > 0 || inp.livingRooms > 0 || inp.diningAreas > 0 || inp.kitchens > 0 || inp.laundries > 0
  if (hasAnyRoom) roomBreakdown.push({ label: 'Hallways & touch points', mins: deep ? 42 : 30 })
  if (inp.kitchens > 0) roomBreakdown.push({ label: `Kitchen ×${inp.kitchens}`, mins: (deep ? 105 : 45) * inp.kitchens })
  if (inp.laundries > 0) roomBreakdown.push({ label: `Laundry ×${inp.laundries}`, mins: (deep ? 60 : 30) * inp.laundries })
  const extraStoreys = Math.max(0, inp.storeys - 1)
  if (extraStoreys > 0) roomBreakdown.push({ label: `Additional storey ×${extraStoreys}`, mins: (deep ? 42 : 30) * extraStoreys })

  const addOnBreakdown: { label: string; cost: number; mins: number }[] = []
  if (inp.ovenClean)      addOnBreakdown.push({ label: 'Oven clean', cost: 150, mins: 60 })
  if (inp.interiorFridge) addOnBreakdown.push({ label: 'Interior fridge', cost: 30, mins: 20 })
  if (inp.balcony)        addOnBreakdown.push({ label: 'Balcony / outdoor area', cost: 30, mins: 25 })
  if (inp.vanityCupboards) addOnBreakdown.push({ label: 'Vanity cupboards & drawers', cost: 40, mins: 35 })

  const linenCost   = inp.linenBeds * 25
  const linenMins   = inp.linenBeds * 15
  const baseJobMins = roomBreakdown.reduce((s, r) => s + r.mins, 0)
  const addOnMins   = addOnBreakdown.reduce((s, a) => s + a.mins, 0)
  const addOnCost   = addOnBreakdown.reduce((s, a) => s + a.cost, 0)
  const bufferMins  = deep ? Math.round(baseJobMins * 0.15) : 0
  const pricingMins = baseJobMins + bufferMins          // room work only — drives the job price
  const totalJobMins = pricingMins + addOnMins + linenMins  // full time (for scheduling + effective rate)
  const totalHours  = totalJobMins / 60
  const labourCost  = (pricingMins / 60) * LABOUR_RATE  // add-ons/linen are flat fees, not re-charged as labour
  const nonLabourBase = hasAnyRoom ? (deep ? (tier === 'S' ? 130 : tier === 'M' ? 137 : 145) : (tier === 'S' ? 120 : tier === 'M' ? 125 : 130)) : 0
  const nonLabourMultiplier = deep && hasAnyRoom ? (totalHours >= 15 ? 4 : totalHours >= 10 ? 3 : totalHours >= 5 ? 2 : 1) : 1
  const nonLabourCost = nonLabourBase * nonLabourMultiplier
  const jobCosts    = labourCost + nonLabourCost
  const rawPrice    = hasAnyRoom ? jobCosts / MARGIN_DIVISOR : 0
  const roundedPrice = roundTo5(rawPrice)
  const floorApplied = hasAnyRoom && roundedPrice < 180
  const finalJobPrice = hasAnyRoom ? (floorApplied ? 180 : roundedPrice) : 0
  const profitAmount = finalJobPrice - jobCosts
  const profitMargin = finalJobPrice > 0 ? (profitAmount / finalJobPrice) * 100 : 0
  const grandTotal  = finalJobPrice + linenCost + addOnCost
  const gstAmount   = inp.gstRegistered ? Math.round(grandTotal * 0.1 * 100) / 100 : 0
  const grandTotalIncGst = grandTotal + gstAmount
  const effectiveHourly  = totalHours > 0 ? grandTotal / totalHours : 0
  const warnings: string[] = []
  if (deep && totalHours > 8) warnings.push('Large deep clean — confirm scope and access with client before quoting.')
  if (extraStoreys > 0) warnings.push('Multi-storey property — confirm staircase access.')
  if (floorApplied) warnings.push('Minimum job floor of $180 applied — actual cost was lower.')
  if (deep && nonLabourMultiplier > 1) warnings.push(`Non-labour multiplier ×${nonLabourMultiplier} applied (${totalHours.toFixed(1)}h billed).`)
  return { tier, totalBeds, deep, roomBreakdown, addOnBreakdown, baseJobMins, bufferMins, pricingMins, totalJobMins, totalHours, labourCost, nonLabourCost, nonLabourBase, nonLabourMultiplier, jobCosts, rawPrice, finalJobPrice, floorApplied, profitAmount, profitMargin, linenCost, linenMins, addOnCost, grandTotal, gstAmount, grandTotalIncGst, effectiveHourly, warnings }
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

function Segmented<T extends string>({ options, value, onChange, cols }: { options: [T, string][]; value: T; onChange: (v: T) => void; cols: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {options.map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)}
          style={{ padding: '8px 4px', fontSize: 11, letterSpacing: '0.03em', borderRadius: 0, border: `1px solid ${value === val ? C.sage : C.border}`, backgroundColor: value === val ? C.sage : '#fff', color: value === val ? '#fff' : C.muted, cursor: 'pointer' }}
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

export function QuoteCalculator() {
  const router = useRouter()
  const [tab, setTab] = useState<'calculator' | 'hourly'>('calculator')
  const [inp, setInp] = useState<Inputs>(DEFAULT)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const set = <K extends keyof Inputs>(key: K, val: Inputs[K]) => setInp(prev => ({ ...prev, [key]: val }))
  const r = useMemo(() => calcResult(inp), [inp])
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  function createQuoteFromCalc() {
    const beds = inp.queenBeds + inp.twinBeds
    const parts = [
      CLEAN_LABELS[inp.cleanType],
      beds > 0 ? `${beds} bed` : '',
      inp.fullBaths > 0 ? `${inp.fullBaths} bath` : '',
      inp.frequency !== 'oneoff' ? FREQ_LABELS[inp.frequency] : '',
    ].filter(Boolean)
    const params = new URLSearchParams({
      description: parts.join(' · '),
      amount: r.grandTotal.toFixed(2),
      gst: inp.gstRegistered ? '1' : '0',
      clean_type: inp.cleanType,
    })
    router.push(`/quotes/new?${params.toString()}`)
  }

  const TIER_COLORS: Record<string, { bg: string; color: string }> = {
    S: { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
    M: { bg: 'rgba(245,158,11,0.08)',  color: '#b45309' },
    L: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626' },
  }

  const priceCard = (
    <div style={{ backgroundColor: '#fff', border: `1px solid rgba(118,165,143,0.35)`, borderTop: `3px solid ${C.sage}`, borderRadius: 0, padding: 20 }}>
      <p style={{ color: C.muted, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Final Quoted Price</p>
      <div>
        <Row label="Job price" value={fmt(r.finalJobPrice)} />
        {r.linenCost > 0 && <Row label={`Linen service (${inp.linenBeds} bed)`} value={fmt(r.linenCost)} />}
        {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={fmt(a.cost)} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
        <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total (ex. GST)</span>
        <span style={{ fontFamily: C.serif, color: C.sage, fontSize: 34, fontWeight: 400 }}>{fmt(r.grandTotal)}</span>
      </div>
      {inp.gstRegistered && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: C.muted }}>
            <span>GST (10%)</span><span>{fmt(r.gstAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total inc. GST</span>
            <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 400 }}>{fmt(r.grandTotalIncGst)}</span>
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
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 24, maxWidth: 480 }} className="space-y-4">
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Hourly Rate Reference</p>
            <div className="space-y-1">
              <Row label="Base wage" value={`${fmt(LABOUR_BASE)} / hr`} />
              <Row label="Superannuation (12%)" value={`${fmt(LABOUR_BASE * 0.12)} / hr`} />
              <Row label="Total labour rate" value={`${fmt(LABOUR_RATE)} / hr`} bold />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="space-y-1">
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>After 25% profit margin (÷ 0.75)</p>
              <Row label="Quoted rate (25% margin)" value={`${fmt(LABOUR_RATE / MARGIN_DIVISOR)} / hr`} bold green />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="space-y-1">
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>Your current quote effective rate</p>
              <Row label="Total billed hours" value={`${r.totalHours.toFixed(2)} hrs`} />
              <Row label="Grand total (ex. GST)" value={fmt(r.grandTotal)} />
              <Row label="Effective hourly rate" value={r.totalHours > 0 ? `${fmt(r.effectiveHourly)} / hr` : '—'} bold green />
              <Row label="Profit per hour" value={r.totalHours > 0 ? `${fmt(r.effectiveHourly - LABOUR_RATE)} / hr` : '—'} green />
            </div>
          </div>
        )}

        {tab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
            {/* Inputs */}
            <div className="space-y-3">
              <Card title="Service">
                <Segmented cols={3} value={inp.cleanType} onChange={v => set('cleanType', v)}
                  options={[['regular', 'Regular'], ['deep', 'Deep'], ['airbnb', 'Airbnb']]} />
                <SubLabel>Frequency</SubLabel>
                <Segmented cols={4} value={inp.frequency} onChange={v => set('frequency', v)}
                  options={[['oneoff', 'One-off'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']]} />
                <div style={{ marginTop: 12 }}>
                  <Toggle label="GST registered (+10%)" value={inp.gstRegistered} onChange={v => set('gstRegistered', v)} />
                </div>
              </Card>

              <Card title="Rooms">
                <SubLabel>Levels</SubLabel>
                <Stepper label="Storeys" value={inp.storeys} onChange={v => set('storeys', v)} />
                <SubLabel>Bedrooms</SubLabel>
                <Stepper label="Queen bedrooms" value={inp.queenBeds} onChange={v => set('queenBeds', v)} />
                <Stepper label="Twin / single bedrooms" value={inp.twinBeds} onChange={v => set('twinBeds', v)} />
                <SubLabel>Bathrooms</SubLabel>
                <Stepper label="Full bathrooms" value={inp.fullBaths} onChange={v => set('fullBaths', v)} />
                <Stepper label="Powder rooms / WC" value={inp.powderRooms} onChange={v => set('powderRooms', v)} />
                <SubLabel>Living</SubLabel>
                <Stepper label="Living / games rooms" value={inp.livingRooms} onChange={v => set('livingRooms', v)} />
                <Stepper label="Dining areas" value={inp.diningAreas} onChange={v => set('diningAreas', v)} />
                <SubLabel>Kitchen & Laundry</SubLabel>
                <Stepper label="Kitchens" value={inp.kitchens} onChange={v => set('kitchens', v)} />
                <Stepper label="Laundries" value={inp.laundries} onChange={v => set('laundries', v)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <span style={{ color: C.muted, fontSize: 10 }}>Tier:</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: TIER_COLORS[r.tier].bg, color: TIER_COLORS[r.tier].color }}>
                    {r.tier} — {r.totalBeds} bed{r.totalBeds !== 1 ? 's' : ''}
                  </span>
                </div>
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
            </div>

            {/* Price + breakdown (sticky on desktop) */}
            <div className="lg:sticky lg:top-6 space-y-4">
              {priceCard}

              {showBreakdown && (
                <>
                  <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Clock style={{ width: 14, height: 14, color: C.muted }} />
                      <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Time Breakdown</p>
                      <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 10 }}>{r.deep ? 'Deep times' : 'Standard times'}</span>
                    </div>
                    {r.roomBreakdown.map((row, i) => <Row key={i} label={row.label} value={`${row.mins} min`} />)}
                    {inp.linenBeds > 0 && <Row label={`Linen service ×${inp.linenBeds} bed`} value={`${r.linenMins} min`} />}
                    {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={`${a.mins} min`} />)}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                      {r.bufferMins > 0 && <Row label="Unseen property buffer (+15%)" value={`${r.bufferMins} min`} />}
                      <Row label="Total billed time" value={`${r.totalJobMins} min (${r.totalHours.toFixed(2)} hrs)`} bold />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
                    <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 12 }}>Cost Breakdown</p>
                    <Row label={`Labour (${(r.pricingMins / 60).toFixed(2)} hrs × ${fmt(LABOUR_RATE)})`} value={fmt(r.labourCost)} />
                    <Row label={`Non-labour (Tier ${r.tier}${r.deep && r.nonLabourMultiplier > 1 ? ` ×${r.nonLabourMultiplier}` : ''})`} value={fmt(r.nonLabourCost)} />
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
      {tab === 'calculator' && (
        <div className="flex lg:hidden" style={{ position: 'fixed', left: 0, right: 0, bottom: 64, zIndex: 40, backgroundColor: '#fff', borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 16px rgba(44,62,80,0.08)', padding: '10px 16px', alignItems: 'center', gap: 12 }}>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total{inp.gstRegistered ? ' inc. GST' : ' ex. GST'}</div>
            <div style={{ fontFamily: C.serif, color: C.sage, fontSize: 24, fontWeight: 400 }}>{fmt(inp.gstRegistered ? r.grandTotalIncGst : r.grandTotal)}</div>
          </div>
          <button onClick={createQuoteFromCalc}
            style={{ marginLeft: 'auto', backgroundColor: C.navy, color: '#fff', border: 'none', borderRadius: 0, padding: '11px 16px', fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            className="uppercase">
            <FileText style={{ width: 13, height: 13 }} />Create quote
          </button>
        </div>
      )}
    </div>
  )
}
