'use client'
import { useEffect, useRef } from 'react'

interface Marker { id: string; lat: number; lng: number; label: string; name?: string }
interface Props { center: [number, number]; zoom?: number; userCoords?: [number, number]; markers?: Marker[] }

export default function MapView({ center, zoom = 14, userCoords, markers = [] }: Props) {
  const divRef     = useRef<HTMLDivElement>(null)
  const mapRef     = useRef<any>(null)
  const userPinRef = useRef<any>(null)
  const offerPinsRef = useRef<any[]>([])

  // Init map once
  useEffect(() => {
    if (typeof window === 'undefined' || !divRef.current || mapRef.current) return
    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      const map = L.map(divRef.current!, {
        center, zoom,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
      mapRef.current = map

      // User pin inicial
      if (userCoords) {
        userPinRef.current = L.marker(userCoords, { icon: userIcon(L), zIndexOffset: 1000 }).addTo(map)
      }
    })
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  // Actualizar centro y pin de usuario cuando cambian coords
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      mapRef.current.setView(center, zoom, { animate: true, duration: 0.8 })
      if (userPinRef.current) {
        userPinRef.current.setLatLng(center)
      } else {
        userPinRef.current = L.marker(center, { icon: userIcon(L), zIndexOffset: 1000 }).addTo(mapRef.current)
      }
    })
  }, [center[0], center[1]])

  // Actualizar pins de ofertas
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      offerPinsRef.current.forEach(m => m.remove())
      offerPinsRef.current = []
      markers.forEach(marker => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:white;border:2.5px solid #f97316;border-radius:20px;padding:5px 12px;font-size:14px;font-weight:900;color:#ea580c;box-shadow:0 4px 16px rgba(249,115,22,0.25);white-space:nowrap">${marker.label}</div>`,
          iconSize: [80, 32], iconAnchor: [40, 16],
        })
        offerPinsRef.current.push(
          L.marker([marker.lat, marker.lng], { icon }).bindTooltip(marker.name || '', { permanent: false }).addTo(mapRef.current)
        )
      })
    })
  }, [markers])

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        @keyframes ripple { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.8);opacity:0} }
        .user-pin-ring { animation: ripple 1.8s ease-out infinite; }
      `}</style>
      <div ref={divRef} style={{ width:'100%', height:'100%' }} />
    </>
  )
}

function userIcon(L: any) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center">
        <div class="user-pin-ring" style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(249,115,22,0.25);top:-8px;left:-8px"></div>
        <div style="width:20px;height:20px;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(249,115,22,0.7);position:relative;z-index:2"></div>
      </div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  })
}
