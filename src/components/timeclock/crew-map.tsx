'use client'

import { useEffect, useRef } from 'react'

interface Pin {
  lat: number
  lng: number
  label: string
  color: 'green' | 'grey'
}

interface Props {
  pins: Pin[]
}

export function CrewMap({ pins }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    async function init() {
      await import('leaflet/dist/leaflet.css')
      const L = (await import('leaflet')).default
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!containerRef.current) return

      // Clean up any existing map on this container (React StrictMode runs effects twice in dev)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapRef.current as any)?.remove()
        mapRef.current = null
      }

      const defaultCenter: [number, number] = pins.length > 0
        ? [pins[0].lat, pins[0].lng]
        : [-37.8136, 144.9631] // Melbourne fallback

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: pins.length > 1 ? 11 : 14,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      pins.forEach(pin => {
        const html = `
          <div style="
            width:32px;height:32px;border-radius:50%;
            background:${pin.color === 'green' ? '#10b981' : '#64748b'};
            border:3px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:11px;font-weight:700;font-family:sans-serif;
          ">${pin.label}</div>`

        const icon = L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] })
        L.marker([pin.lat, pin.lng], { icon }).addTo(map)
      })

      // Fit bounds if multiple pins
      if (pins.length > 1) {
        const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      mapRef.current = map
    }

    init()

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`.leaflet-container { background: #0f172a; } .leaflet-tile { filter: brightness(0.85) saturate(0.7); }`}</style>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: 340 }} />
    </>
  )
}
