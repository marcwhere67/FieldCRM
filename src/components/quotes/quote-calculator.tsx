'use client'

import { useState, useMemo } from 'react'
import { Calculator, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

type CleanType = 'standard' | 'deep'

interface Inputs {
  cleanType: CleanType; queenBeds: number; twinBeds: number; fullBaths: number; powderRooms: number
  livingRooms: number; diningAreas: number; doubleStorey: boolean; kitchen: boolean; laundry: boolean
  linenBeds: number; ovenClean: boolean; interiorFridge: boolean; balcony: boolean; gstRegistered: boolean
}

const DEFAULT: Inputs = {
  cleanType: 'standard', queenBeds: 0, twinBeds: 0, fullBaths: 1, powderRooms: 0,
  livingRooms: 1, diningAreas: 1, doubleStorey: false, kitchen: true, laundry: true,
  linenBeds: 0, ovenClean: false, interiorFridge: false, balcony: false, gstRegistered: false,
}

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

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
  const hasAnyRoom = inp.queenBeds > 0 || inp.twinBeds > 0 || inp.fullBaths > 0 || inp.powderRooms > 0 || inp.livingRooms > 0 || inp.diningAreas > 0 || inp.kitchen || inp.laundry
  if (hasAnyRoom) roomBreakdown.push({ label: 'Hallways & touch points', mins: deep ? 42 : 30 })
  if (inp.kitchen) roomBreakdown.push({ label: 'Kitchen', mins: deep ? 105 : 45 })
  if (inp.laundry) roomBreakdown.push({ label: 'Laundry', mins: deep ? 60 : 30 })
  if (inp.doubleStorey) roomBreakdown.push({ label: 'Double storey', mins: deep ? 42 : 30 })

  const addOnBreakdown: { label: string; cost: number; mins: number }[] = []
  if (inp.ovenClean)      addOnBreakdown.push({ label: 'Oven clean', cost: 75, mins: 60 })
  if (inp.interiorFridge) addOnBreakdown.push({ label: 'Interior fridge', cost: 25, mins: 20 })
  if (inp.balcony)        addOnBreakdown.push({ label: 'Balcony / outdoor area', cost: 30, mins: 25 })

  const linenCost   = inp.linenBeds * 25
  const linenMins   = inp.linenBeds * 15
  const baseJobMins = roomBreakdown.reduce((s, r) => s + r.mins, 0)
  const addOnMins   = addOnBreakdown.reduce((s, a) => s + a.mins, 0)
  const addOnCost   = addOnBreakdown.reduce((s, a) => s + a.cost, 0)
  const bufferMins  = deep ? Math.round(baseJobMins * 0.15) : 0
  const totalJobMins = baseJobMins + bufferMins + addOnMins + linenMins
  const totalHours  = totalJobMins / 60
  const labourCost  = totalHours * 44.80
  const nonLabourBase = hasAnyRoom ? (deep ? (tier === 'S' ? 130 : tier === 'M' ? 137 : 145) : (tier === 'S' ? 120 : tier === 'M' ? 125 : 130)) : 0
  const nonLabourMultiplier = deep && hasAnyRoom ? (totalHours >= 15 ? 4 : totalHours >= 10 ? 3 : totalHours >= 5 ? 2 : 1) : 1
  const nonLabourCost = nonLabourBase * nonLabourMultiplier
  const jobCosts    = labourCost + nonLabourCost
  const rawPrice    = hasAnyRoom ? jobCosts / 0.65 : 0
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
  if (inp.doubleStorey) warnings.push('Double storey property — confirm staircase access.')
  if (floorApplied) warnings.push('Minimum job floor of $180 applied — actual cost was lower.')
  if (deep && nonLabourMultiplier > 1) warnings.push(`Non-labour multiplier ×${nonLabourMultiplier} applied (${totalHours.toFixed(1)}h billed).`)
  return { tier, totalBeds, deep, roomBreakdown, addOnBreakdown, baseJobMins, bufferMins, totalJobMins, totalHours, labourCost, nonLabourCost, nonLabourBase, nonLabourMultiplier, jobCosts, rawPrice, finalJobPrice, floorApplied, profitAmount, profitMargin, linenCost, linenMins, addOnCost, grandTotal, gstAmount, grandTotalIncGst, effectiveHourly, warnings }
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: C.fg, fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 26, height: 26, backgroundColor: 'rgba(44,62,80,0.07)', color: C.navy, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">−</button>
        <span style={{ width: 20, textAlign: 'center', fontSize: 13, fontWeight: 600, color: C.navy }}>{value}</span>
        <button onClick={() => onChange(value + 1)}
          style={{ width: 26, height: 26, backgroundColor: 'rgba(44,62,80,0.07)', color: C.navy, border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500 }}
          className="hover:opacity-70 transition-opacity">+</button>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', width: '100%', textAlign: 'left', border: `1px solid ${value ? 'rgba(118,165,143,0.4)' : C.border}`, backgroundColor: value ? 'rgba(118,165,143,0.07)' : '#fff', cursor: 'pointer', fontSize: 12, color: value ? '#5d8c76' : C.fg }}
      className="hover:opacity-90 transition-opacity">
      <div style={{ width: 14, height: 14, border: value ? '1px solid #76A58F' : `1px solid ${C.muted}`, backgroundColor: value ? C.sage : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {value && <CheckCircle style={{ width: 10, height: 10, color: '#fff' }} />}
      </div>
      {label}
    </button>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 16 }} className="space-y-3">
      <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  )
}

export function QuoteCalculator() {
  const [tab, setTab] = useState<'calculator' | 'hourly'>('calculator')
  const [inp, setInp] = useState<Inputs>(DEFAULT)
  const set = <K extends keyof Inputs>(key: K, val: Inputs[K]) => setInp(prev => ({ ...prev, [key]: val }))
  const r = useMemo(() => calcResult(inp), [inp])
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  const TIER_COLORS: Record<string, { bg: string; color: string }> = {
    S: { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
    M: { bg: 'rgba(245,158,11,0.08)',  color: '#b45309' },
    L: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626' },
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.cream, padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, backgroundColor: 'rgba(118,165,143,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calculator style={{ width: 18, height: 18, color: C.sage }} />
          </div>
          <div>
            <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 22, fontWeight: 300 }}>Quote Calculator</h1>
            <p style={{ color: C.muted, fontSize: 11 }}>Salt Air Cleaning — AI Pricing Tool</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {([['calculator', 'Quote Calculator'], ['hourly', 'Hourly Rate']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)}
              style={{ padding: '8px 16px', fontSize: 11, letterSpacing: '0.08em', border: 'none', borderBottom: tab === val ? `2px solid ${C.navy}` : '2px solid transparent', color: tab === val ? C.navy : C.muted, background: 'none', cursor: 'pointer', marginBottom: -1 }}
              className="uppercase">
              {label}
            </button>
          ))}
        </div>

        {tab === 'hourly' && (
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 24, maxWidth: 480 }} className="space-y-4">
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Hourly Rate Reference</p>
            <div className="space-y-1">
              <Row label="Base wage" value="$40.00 / hr" />
              <Row label="Superannuation (12%)" value="$4.80 / hr" />
              <Row label="Total labour rate" value="$44.80 / hr" bold />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="space-y-1">
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>After 35% profit margin (÷ 0.65)</p>
              <Row label="Break-even rate" value="$44.80 / hr" />
              <Row label="Quoted rate (35% margin)" value={`${fmt(44.80 / 0.65)} / hr`} bold green />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }} className="space-y-1">
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>Your current quote effective rate</p>
              <Row label="Total billed hours" value={`${r.totalHours.toFixed(2)} hrs`} />
              <Row label="Grand total (ex. GST)" value={fmt(r.grandTotal)} />
              <Row label="Effective hourly rate" value={r.totalHours > 0 ? `${fmt(r.effectiveHourly)} / hr` : '—'} bold green />
              <Row label="Labour cost / hr" value={`${fmt(44.80)} / hr`} />
              <Row label="Profit per hour" value={r.totalHours > 0 ? `${fmt(r.effectiveHourly - 44.80)} / hr` : '—'} green />
            </div>
          </div>
        )}

        {tab === 'calculator' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Inputs */}
            <div className="space-y-3">
              <Card title="Clean Type">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['standard', 'deep'] as const).map(t => (
                    <button key={t} onClick={() => set('cleanType', t)}
                      style={{ padding: '8px', fontSize: 11, letterSpacing: '0.06em', border: `1px solid ${inp.cleanType === t ? C.sage : C.border}`, backgroundColor: inp.cleanType === t ? C.sage : '#fff', color: inp.cleanType === t ? '#fff' : C.muted, cursor: 'pointer' }}
                      className="uppercase">
                      {t === 'deep' ? 'Deep / Builder' : 'Standard'}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Bedrooms">
                <Stepper label="Queen bedrooms" value={inp.queenBeds} onChange={v => set('queenBeds', v)} />
                <Stepper label="Twin / single bedrooms" value={inp.twinBeds} onChange={v => set('twinBeds', v)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.muted, fontSize: 10 }}>Tier:</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: TIER_COLORS[r.tier].bg, color: TIER_COLORS[r.tier].color }}>
                    {r.tier} — {r.totalBeds} bed{r.totalBeds !== 1 ? 's' : ''}
                  </span>
                </div>
              </Card>

              <Card title="Bathrooms">
                <Stepper label="Full bathrooms" value={inp.fullBaths} min={0} onChange={v => set('fullBaths', v)} />
                <Stepper label="Powder rooms / WC" value={inp.powderRooms} onChange={v => set('powderRooms', v)} />
              </Card>

              <Card title="Living Areas">
                <Stepper label="Living / games rooms" value={inp.livingRooms} min={0} onChange={v => set('livingRooms', v)} />
                <Stepper label="Dining areas" value={inp.diningAreas} min={0} onChange={v => set('diningAreas', v)} />
              </Card>

              <Card title="Property">
                <Toggle label="Kitchen included" value={inp.kitchen} onChange={v => set('kitchen', v)} />
                <Toggle label="Laundry included" value={inp.laundry} onChange={v => set('laundry', v)} />
                <Toggle label="Double storey (+30 / 42 min)" value={inp.doubleStorey} onChange={v => set('doubleStorey', v)} />
              </Card>

              <Card title="Linen Service — $25 / bed">
                <Stepper label="Beds for linen" value={inp.linenBeds} onChange={v => set('linenBeds', v)} />
              </Card>

              <Card title="Add-ons">
                <Toggle label="Oven clean — $75" value={inp.ovenClean} onChange={v => set('ovenClean', v)} />
                <Toggle label="Interior fridge — $25" value={inp.interiorFridge} onChange={v => set('interiorFridge', v)} />
                <Toggle label="Balcony / outdoor — $30" value={inp.balcony} onChange={v => set('balcony', v)} />
              </Card>

              <Card title="GST">
                <Toggle label="GST registered (+10%)" value={inp.gstRegistered} onChange={v => set('gstRegistered', v)} />
              </Card>
            </div>

            {/* Output */}
            <div className="space-y-4">
              {/* Time breakdown */}
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Clock style={{ width: 14, height: 14, color: C.muted }} />
                  <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Time Breakdown</p>
                  <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 10 }}>{inp.cleanType === 'deep' ? 'Deep clean times' : 'Standard times'}</span>
                </div>
                <div className="space-y-0">
                  {r.roomBreakdown.map((row, i) => (
                    <Row key={i} label={row.label} value={`${row.mins} min`} />
                  ))}
                  {inp.linenBeds > 0 && <Row label={`Linen service ×${inp.linenBeds} bed`} value={`${r.linenMins} min`} />}
                  {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={`${a.mins} min`} />)}
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }} className="space-y-1">
                  <Row label="Base job time" value={`${r.baseJobMins} min (${(r.baseJobMins / 60).toFixed(2)} hrs)`} />
                  {r.bufferMins > 0 && <Row label="Unseen property buffer (+15%)" value={`${r.bufferMins} min`} />}
                  <Row label="Total billed time" value={`${r.totalJobMins} min (${r.totalHours.toFixed(2)} hrs)`} bold />
                </div>
              </div>

              {/* Cost breakdown */}
              <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, padding: 20 }}>
                <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 12 }}>Cost Breakdown</p>
                <div className="space-y-0">
                  <Row label={`Labour (${r.totalHours.toFixed(2)} hrs × $44.80)`} value={fmt(r.labourCost)} />
                  <Row label={`Non-labour (Tier ${r.tier}${r.deep && r.nonLabourMultiplier > 1 ? ` ×${r.nonLabourMultiplier}` : ''} — ${inp.cleanType})`} value={fmt(r.nonLabourCost)} />
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }} className="space-y-1">
                  <Row label="Total job costs" value={fmt(r.jobCosts)} bold />
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8 }} className="space-y-1">
                  <Row label="Raw price (costs ÷ 0.65)" value={fmt(r.rawPrice)} />
                  <Row label="Rounded to nearest $5" value={fmt(r.finalJobPrice)} />
                  {r.floorApplied && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <AlertTriangle style={{ width: 12, height: 12, color: '#b45309', flexShrink: 0 }} />
                      <span style={{ color: '#b45309', fontSize: 11 }}>Minimum floor of $180 applied</span>
                    </div>
                  )}
                  <Row label="Profit amount" value={fmt(r.profitAmount)} />
                  <Row label="Profit margin" value={`${r.profitMargin.toFixed(1)}%`} green />
                </div>
              </div>

              {/* Final price */}
              <div style={{ backgroundColor: '#fff', border: `1px solid rgba(118,165,143,0.35)`, borderTop: `3px solid ${C.sage}`, padding: 20 }}>
                <p style={{ color: C.navy, fontSize: 12, fontWeight: 500, marginBottom: 14 }}>Final Quoted Price</p>
                <div className="space-y-0">
                  <Row label="Job price" value={fmt(r.finalJobPrice)} />
                  {r.linenCost > 0 && <Row label={`Linen service (${inp.linenBeds} bed)`} value={fmt(r.linenCost)} />}
                  {r.addOnBreakdown.map((a, i) => <Row key={i} label={a.label} value={fmt(a.cost)} />)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
                  <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total (ex. GST)</span>
                  <span style={{ fontFamily: C.serif, color: C.sage, fontSize: 28, fontWeight: 300 }}>{fmt(r.grandTotal)}</span>
                </div>
                {inp.gstRegistered && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: C.muted }}>
                      <span>GST (10%)</span><span>{fmt(r.gstAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <span style={{ color: C.navy, fontSize: 14, fontWeight: 600 }}>Total inc. GST</span>
                      <span style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{fmt(r.grandTotalIncGst)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Warnings */}
              {r.warnings.length > 0 && (
                <div style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.25)`, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: '#b45309' }} />
                    <span style={{ color: '#b45309', fontSize: 12, fontWeight: 500 }}>Warnings</span>
                  </div>
                  {r.warnings.map((w, i) => <p key={i} style={{ color: '#b45309', fontSize: 12, opacity: 0.85 }}>• {w}</p>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
