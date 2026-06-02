'use client'
import { useEffect, useRef, useCallback } from 'react'

interface Marker { id: string; lat: number; lng: number; label: string; name?: string }
interface Props {
  center: [number, number]
  zoom?: number
  markers?: Marker[]
  draggable?: boolean
  onCenterChange?: (lat: number, lng: number) => void
}

export default function MapView({ center, zoom = 15, markers = [], draggable = false, onCenterChange }: Props) {
  const divRef        = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<any>(null)
  const offerPinsRef  = useRef<any[]>([])
  const isProgrammaticMove = useRef(false)

  // ── Init once ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !divRef.current || mapRef.current) return

    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const map = L.map(divRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        touchZoom: true,
        doubleClickZoom: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Zoom controls arriba a la derecha
      L.control.zoom({ position: 'topright' }).addTo(map)

      mapRef.current = map

      // Cuando el usuario mueve el mapa → emitir nuevo centro
      if (draggable && onCenterChange) {
        map.on('moveend', () => {
          if (isProgrammaticMove.current) { isProgrammaticMove.current = false; return }
          const c = map.getCenter()
          onCenterChange(c.lat, c.lng)
        })
      }
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  // ── Mover mapa cuando cambia el centro externamente ─────────────
  useEffect(() => {
    if (!mapRef.current) return
    const current = mapRef.current.getCenter()
    const dist = Math.abs(current.lat - center[0]) + Math.abs(current.lng - center[1])
    if (dist < 0.0001) return // ya está ahí
    isProgrammaticMove.current = true
    mapRef.current.setView(center, mapRef.current.getZoom(), { animate: true, duration: 0.6 })
  }, [center[0], center[1]])

  // ── Actualizar markers de ofertas ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      offerPinsRef.current.forEach(m => m.remove())
      offerPinsRef.current = []
      markers.forEach(m => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:white;border:2.5px solid #f97316;border-radius:20px;padding:5px 12px;font-size:13px;font-weight:900;color:#ea580c;box-shadow:0 4px 16px rgba(249,115,22,0.3);white-space:nowrap">${m.label}</div>`,
          iconSize: [80, 32], iconAnchor: [40, 16],
        })
        offerPinsRef.current.push(
          L.marker([m.lat, m.lng], { icon })
            .bindTooltip(m.name || '', { permanent: false })
            .addTo(mapRef.current)
        )
      })
    })
  }, [markers])

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important; border-radius: 12px !important; overflow: hidden; }
        .leaflet-control-zoom a { width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 18px !important; }
      `}</style>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
