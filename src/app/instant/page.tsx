'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import {
  Zap, MapPin, Star, CheckCircle, Phone, X, Clock,
  Send, ArrowLeft, Loader2, AlertCircle, Navigation,
  ChevronRight, ChevronDown
} from 'lucide-react'

const MapView = dynamic(() => import('@/components/instant/MapView'), { ssr: false })

const QUICK_CATEGORIES = [
  { icon: '❄️', name: 'Aire AC',    slug: 'aire-acondicionado' },
  { icon: '🔧', name: 'Técnico',    slug: 'plomeria' },
  { icon: '⚡', name: 'Eléctrico',  slug: 'electricidad' },
  { icon: '🧹', name: 'Limpieza',   slug: 'limpieza' },
  { icon: '📦', name: 'Mudanza',    slug: 'mudanzas' },
  { icon: '🚗', name: 'Transporte', slug: 'transporte' },
  { icon: '🤝', name: 'Asistencia', slug: 'asistencia-personal' },
  { icon: '⚙️', name: 'Otro',       slug: 'otro' },
]

function Stars({ v }: { v: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11} className={i <= Math.round(v||0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
      ))}
    </div>
  )
}

type Phase = 'location' | 'form' | 'waiting' | 'done'

const DEFAULT_PANAMA: [number,number] = [8.994, -79.519]

export default function InstantPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  // Ubicación
  const [coords, setCoords]           = useState<[number,number]>(DEFAULT_PANAMA)
  const [locationName, setLocationName] = useState('')
  const [geoLoading, setGeoLoading]   = useState(false)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [geocodingMap, setGeocodingMap] = useState(false)

  // Fase y form
  const [phase, setPhase] = useState<Phase>('location')
  const [form, setForm]   = useState({ title: '', category: 'aire-acondicionado', budget: '' })
  const [sheetOpen, setSheetOpen] = useState(false)

  // Task / ofertas
  const [taskId, setTaskId]     = useState<string|null>(null)
  const [offers, setOffers]     = useState<any[]>([])
  const [accepting, setAccepting] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(900)
  const [submitting, setSubmitting] = useState(false)
  const [postError, setPostError]   = useState('')
  const [done, setDone]             = useState<any>(null)

  const channelRef  = useRef<any>(null)
  const timerRef    = useRef<any>(null)
  const geocodeTimer = useRef<any>(null)

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth?next=/instant'); return }
      setUser(user)
    })
    detectGPS()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      clearInterval(timerRef.current)
      clearTimeout(geocodeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'waiting') return
    timerRef.current = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // ── GPS ───────────────────────────────────────────────────────
  const detectGPS = () => {
    setGeoLoading(true)
    if (!navigator.geolocation) { setGeoLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setCoords([lat, lng])
        reverseGeocode(lat, lng)
        setGeoLoading(false)
      },
      () => {
        setGeoLoading(false)
        reverseGeocode(DEFAULT_PANAMA[0], DEFAULT_PANAMA[1])
      },
      { timeout: 8000, maximumAge: 30000 }
    )
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocodingMap(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
        {}
      )
      const d = await r.json()
      const a = d.address
      const name = a.road || a.neighbourhood || a.suburb || a.city_district || a.town || a.city || 'Panamá'
      const full = a.neighbourhood || a.suburb
        ? `${a.road ? a.road + ', ' : ''}${a.neighbourhood || a.suburb}`
        : name
      setLocationName(full || 'Panamá')
    } catch {
      setLocationName('Panamá')
    }
    setGeocodingMap(false)
  }

  // Cuando el usuario arrastra el mapa → reverseGeocode con debounce
  const handleMapCenterChange = useCallback((lat: number, lng: number) => {
    setCoords([lat, lng])
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(() => reverseGeocode(lat, lng), 600)
  }, [])

  const confirmLocation = () => {
    setLocationConfirmed(true)
    setPhase('form')
    setSheetOpen(true)
  }

  // ── Realtime ofertas ─────────────────────────────────────────
  const subscribeOffers = (tId: string) => {
    channelRef.current = supabase.channel(`instant-offers-${tId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'offers', filter: `task_id=eq.${tId}` },
        async payload => {
          const { data: p } = await supabase.from('profiles')
            .select('full_name,avg_rating,total_completed,zone,whatsapp,bio')
            .eq('id', payload.new.tasker_id).single()
          setOffers(prev =>
            prev.find(o => o.id === payload.new.id) ? prev : [...prev, { ...payload.new, profiles: p }]
          )
          if ('vibrate' in navigator) navigator.vibrate([100,50,100])
        })
      .subscribe()
  }

  // ── Publicar tarea ───────────────────────────────────────────
  const handlePost = async () => {
    if (!form.title.trim() || submitting || !user) return
    setPostError(''); setSubmitting(true)

    // Garantizar perfil
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        role: 'client',
      })
    }

    const { data: task, error } = await supabase.from('tasks').insert({
      poster_id: user.id, title: form.title.trim(),
      location_zone: locationName, lat: coords[0], lng: coords[1],
      budget: form.budget ? parseFloat(form.budget) : null,
      status: 'open', is_instant: true,
      instant_expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      date_type: 'flexible',
    }).select().single()

    if (error) { setPostError(`Error: ${error.message}`); setSubmitting(false); return }
    if (task) {
      setTaskId(task.id)
      subscribeOffers(task.id)
      setPhase('waiting')
      setTimeLeft(900)
      setSheetOpen(true)
    }
    setSubmitting(false)
  }

  // ── Aceptar oferta ───────────────────────────────────────────
  const handleAccept = async (offer: any) => {
    if (!taskId || !user) return
    setAccepting(true); setSelectedOffer(offer)
    await supabase.from('tasks').update({ status:'assigned', assigned_tasker_id: offer.tasker_id }).eq('id', taskId)
    await supabase.from('offers').update({ status:'accepted' }).eq('id', offer.id)
    await supabase.from('offers').update({ status:'rejected' }).eq('task_id', taskId).neq('id', offer.id)
    const { data: contract } = await supabase.from('contracts').insert({
      task_id: taskId, offer_id: offer.id,
      poster_id: user.id, tasker_id: offer.tasker_id,
      agreed_price: offer.price, service_fee_pct: 20,
    }).select().single()
    if (contract) {
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: user.id,
        content: `👋 ¡Hola ${offer.profiles?.full_name?.split(' ')[0]||''}! Acepté tu oferta de $${offer.price}. ¿En cuánto tiempo llegas a ${locationName}?`,
      })
      await supabase.from('notifications').insert({
        user_id: offer.tasker_id, type: 'offer_accepted',
        title: '🚀 ¡Te seleccionaron como Fixer!',
        body: `Tu oferta de $${offer.price} fue aceptada. Dirígete a ${locationName}.`,
        data: { task_id: taskId, contract_id: contract.id },
      })
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    clearInterval(timerRef.current)
    setAccepting(false)
    if (contract) router.push(`/contrato/${contract.id}`)
    else { setDone({ offer, contract }); setPhase('done') }
  }

  const mins = String(Math.floor(timeLeft/60)).padStart(2,'0')
  const secs = String(timeLeft%60).padStart(2,'0')

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-black relative">

      {/* ── MAPA FULLSCREEN ── */}
      <div className="absolute inset-0 z-0">
        <MapView
          center={coords}
          zoom={15}
          markers={offers.map((o, i) => ({
            id: o.id,
            lat: coords[0] + Math.sin(i*2.1)*0.008,
            lng: coords[1] + Math.cos(i*1.8)*0.008,
            label: `$${o.price}`,
            name: o.profiles?.full_name,
          }))}
          draggable={phase === 'location'}
          onCenterChange={handleMapCenterChange}
        />
      </div>

      {/* ── PIN CENTRAL FIJO (solo en fase location) ── */}
      {phase === 'location' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
          style={{ paddingBottom: '160px' }}>
          <div className="flex flex-col items-center" style={{ transform: 'translateY(-50%)' }}>
            {/* Sombra del pin en el suelo */}
            <div style={{
              width: 12, height: 6, background: 'rgba(0,0,0,0.2)',
              borderRadius: '50%', marginTop: 2,
              filter: 'blur(2px)', order: 2
            }} />
            {/* Pin */}
            <div style={{ order: 1 }}>
              <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
                <circle cx="20" cy="20" r="20" fill="#f97316"/>
                <circle cx="20" cy="20" r="8" fill="white"/>
                <path d="M20 40 L20 52" stroke="#f97316" strokeWidth="3" strokeLinecap="round"/>
                <path d="M12 38 Q20 52 28 38" fill="#f97316"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── RADAR (fase waiting) ── */}
      {phase === 'waiting' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
          style={{ paddingBottom: '300px' }}>
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 bg-orange-400 rounded-full opacity-10 animate-ping" />
            <div className="absolute w-20 h-20 bg-orange-400 rounded-full opacity-20 animate-ping" style={{animationDelay:'0.5s'}} />
            <div className="w-14 h-14 bg-orange-500 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
              <Zap size={22} className="text-white" />
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER FLOTANTE ── */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-3">
        <button onClick={() => phase === 'form' || phase === 'location' ? router.push('/') : setPhase('form')}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg flex-1 max-w-xs">
          <Zap size={15} className="text-orange-500" />
          <span className="font-black text-gray-900 text-sm">⚡ Resuelve ahora</span>
        </div>
        {phase === 'waiting' && (
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-mono font-bold text-sm shadow-lg ${
            timeLeft < 120 ? 'bg-red-500 text-white' : 'bg-white text-orange-600'
          }`}>
            <Clock size={13} /> {mins}:{secs}
          </div>
        )}
      </div>

      {/* ── BARRA UBICACION FLOTANTE (fase location) ── */}
      {phase === 'location' && (
        <div className="absolute left-4 right-4 z-20 flex flex-col items-center"
          style={{ bottom: '200px' }}>
          {/* Pill de dirección */}
          <div className="bg-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3 w-full mb-3">
            <MapPin size={18} className="text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {geocodingMap || geoLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-orange-400" />
                  <span className="text-sm text-gray-400">Obteniendo ubicación...</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-medium">Tu ubicación</p>
                  <p className="font-bold text-gray-900 text-sm truncate">{locationName || 'Mueve el mapa para ajustar'}</p>
                </>
              )}
            </div>
            <button onClick={detectGPS} disabled={geoLoading}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 disabled:opacity-60 flex-shrink-0">
              <Navigation size={12} />
              GPS
            </button>
          </div>

          {/* Botón confirmar */}
          <button
            onClick={confirmLocation}
            disabled={!locationName || geocodingMap}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
          >
            <CheckCircle size={20} />
            Confirmar esta ubicación
          </button>
        </div>
      )}

      {/* ── INSTRUCCIÓN (fase location) ── */}
      {phase === 'location' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-gray-900 bg-opacity-80 text-white text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap backdrop-blur-sm">
            Mueve el mapa para ajustar tu ubicación exacta
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET (form + waiting + done) ── */}
      {(phase === 'form' || phase === 'waiting' || phase === 'done') && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Pill para expandir/colapsar */}
          <button
            onClick={() => setSheetOpen(v => !v)}
            className="w-full flex justify-center pt-2"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </button>

          <div className={`bg-white rounded-t-3xl shadow-2xl transition-all duration-300 overflow-hidden ${
            sheetOpen ? 'max-h-screen' : 'max-h-24'
          }`} style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            {/* ── Handle + preview cuando cerrado ── */}
            {!sheetOpen && phase === 'form' && (
              <button onClick={() => setSheetOpen(true)}
                className="w-full px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Zap size={18} className="text-orange-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-gray-900 text-sm">¿Qué necesitas?</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={10} className="text-orange-400" /> {locationName}
                  </p>
                </div>
                <ChevronDown size={18} className="text-gray-400" />
              </button>
            )}

            {/* ── FASE FORM ── */}
            {phase === 'form' && sheetOpen && (
              <div className="px-5 pb-8 pt-3 space-y-4">
                {/* Ubicación seleccionada */}
                <button onClick={() => { setPhase('location'); setLocationConfirmed(false); setSheetOpen(false) }}
                  className="w-full flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <MapPin size={16} className="text-orange-500 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-xs text-orange-500 font-semibold">Ubicación</p>
                    <p className="font-bold text-gray-900 text-sm truncate">{locationName}</p>
                  </div>
                  <span className="text-xs text-orange-400 font-medium">Cambiar</span>
                </button>

                <div>
                  <p className="font-black text-gray-900 text-lg">¿Qué necesitas?</p>
                  <p className="text-xs text-gray-400">Un Fixer llegará en minutos</p>
                </div>

                {/* Categorías */}
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_CATEGORIES.map(c => (
                    <button key={c.slug} onClick={() => setForm({...form, category: c.slug})}
                      className={`py-2.5 px-1 rounded-xl border-2 text-center transition-all ${
                        form.category === c.slug
                          ? 'border-orange-400 bg-orange-50 shadow-sm shadow-orange-100'
                          : 'border-gray-100 hover:border-orange-200 bg-white'
                      }`}>
                      <div className="text-2xl">{c.icon}</div>
                      <div className="text-xs text-gray-600 mt-0.5 leading-tight font-medium">{c.name}</div>
                    </button>
                  ))}
                </div>

                {/* Descripción */}
                <input
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ej: Instalar aire acondicionado split..."
                  className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl px-4 py-3.5 text-sm outline-none bg-gray-50 font-medium"
                />

                {/* Presupuesto */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input type="number" value={form.budget}
                    onChange={e => setForm({...form, budget: e.target.value})}
                    placeholder="Presupuesto (opcional)"
                    className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl pl-8 pr-4 py-3.5 text-sm outline-none bg-gray-50" />
                </div>

                {postError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    <AlertCircle size={14} /> {postError}
                  </div>
                )}

                <button onClick={handlePost}
                  disabled={!form.title.trim() || submitting}
                  className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-200">
                  {submitting
                    ? <><Loader2 size={20} className="animate-spin" /> Publicando...</>
                    : <><Zap size={20} /> Buscar Fixer ahora</>
                  }
                </button>
              </div>
            )}

            {/* ── FASE WAITING ── */}
            {phase === 'waiting' && (
              <div className="px-5 pb-8 pt-3">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-black text-gray-900 text-lg">Buscando Fixers...</h2>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={11} className="text-orange-400" /> {locationName} · {form.title}
                    </p>
                  </div>
                </div>

                {offers.length === 0 ? (
                  timeLeft > 0 ? (
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex gap-2">
                        {[0,1,2].map(i => (
                          <div key={i}
                            className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center animate-bounce"
                            style={{animationDelay:`${i*0.15}s`}}>
                            <span className="text-lg">🔧</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">Notificando Fixers cercanos</p>
                        <p className="text-xs text-gray-400">en {locationName}...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="font-bold text-gray-700 mb-1">Sin Fixers disponibles ahora</p>
                      <button onClick={() => router.push('/post-task')}
                        className="w-full bg-orange-500 text-white py-3.5 rounded-2xl font-bold mt-3 hover:bg-orange-600">
                        Publicar como tarea normal →
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      🎉 {offers.length} Fixer{offers.length>1?'s':''} disponible{offers.length>1?'s':''}
                    </p>
                    {offers.map((offer, idx) => (
                      <div key={offer.id}
                        className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border-2 border-transparent hover:border-orange-200">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-lg flex-shrink-0">
                          {offer.profiles?.full_name?.[0]||'?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-gray-900 text-sm">{offer.profiles?.full_name}</p>
                            {idx===0 && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">⭐ Primero</span>}
                          </div>
                          <Stars v={offer.profiles?.avg_rating||0} />
                          <p className="text-xs text-gray-400">{offer.profiles?.total_completed||0} trabajos</p>
                          {offer.message && <p className="text-xs text-gray-500 italic truncate mt-0.5">"{offer.message}"</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-black text-gray-900">${offer.price}</p>
                          <button onClick={() => handleAccept(offer)} disabled={accepting}
                            className="mt-1 bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-60">
                            {accepting && selectedOffer?.id===offer.id ? '...' : 'Aceptar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FASE DONE ── */}
            {phase === 'done' && done && (
              <div className="px-5 pb-8 pt-3 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1">¡Fixer en camino!</h2>
                <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 mb-4 text-left mt-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-xl">
                    {done.offer.profiles?.full_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{done.offer.profiles?.full_name}</p>
                    <Stars v={done.offer.profiles?.avg_rating||0} />
                  </div>
                  <p className="text-2xl font-black text-gray-900">${done.offer.price}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {done.offer.profiles?.whatsapp && (
                    <a href={`https://wa.me/507${done.offer.profiles.whatsapp}`} target="_blank"
                      className="flex items-center justify-center gap-2 bg-green-500 text-white py-3.5 rounded-2xl font-bold">
                      <Phone size={16} /> WhatsApp
                    </a>
                  )}
                  {taskId && (
                    <button onClick={() => router.push(`/tasks/${taskId}`)}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl font-bold">
                      <Send size={16} /> Chat
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
