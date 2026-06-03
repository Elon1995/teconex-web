'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import {
  Zap, MapPin, Star, CheckCircle, Phone, X, Clock,
  Send, ArrowLeft, Loader2, AlertCircle, Navigation, ChevronUp, ChevronDown
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

type Phase = 'form' | 'waiting' | 'done'
const DEFAULT_PANAMA: [number,number] = [8.994, -79.519]

export default function InstantPage() {
  const router = useRouter()
  const [user, setUser]                 = useState<any>(null)
  const [coords, setCoords]             = useState<[number,number]>(DEFAULT_PANAMA)
  const [locationName, setLocationName] = useState('Detectando ubicación...')
  const [geoLoading, setGeoLoading]     = useState(true)
  const [adjustingMap, setAdjustingMap] = useState(false)
  const [phase, setPhase]               = useState<Phase>('form')
  const [form, setForm]                 = useState({ title: '', category: 'aire-acondicionado', budget: '' })
  const [sheetExpanded, setSheetExpanded] = useState(true)
  const [showSearch, setShowSearch]       = useState(false)
  const [searchText, setSearchText]       = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching]         = useState(false)
  const searchTimer = useRef<any>(null)
  const [taskId, setTaskId]             = useState<string|null>(null)
  const [offers, setOffers]             = useState<any[]>([])
  const [accepting, setAccepting]       = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [timeLeft, setTimeLeft]         = useState(900)
  const [submitting, setSubmitting]     = useState(false)
  const [postError, setPostError]       = useState('')
  const [done, setDone]                 = useState<any>(null)
  const channelRef   = useRef<any>(null)
  const timerRef     = useRef<any>(null)
  const geocodeTimer = useRef<any>(null)

  // ── Init: detecta GPS y va directo al formulario ──────────────
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

  const detectGPS = () => {
    setGeoLoading(true)
    if (!navigator.geolocation) {
      setLocationName('Panamá')
      setGeoLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setCoords([lat, lng])
        reverseGeocode(lat, lng)
      },
      () => {
        setLocationName('Panamá')
        setGeoLoading(false)
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
    )
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
      )
      const d = await r.json()
      const a = d.address
      const name = a.road
        ? `${a.road}${a.neighbourhood ? ', ' + a.neighbourhood : ''}`
        : a.neighbourhood || a.suburb || a.city_district || a.city || 'Panamá'
      setLocationName(name)
    } catch {
      setLocationName('Panamá')
    }
    setGeoLoading(false)
  }

  // Cuando el usuario arrastra el mapa
  const handleMapDrag = useCallback((lat: number, lng: number) => {
    setCoords([lat, lng])
    setAdjustingMap(true)
    setLocationName('Ajustando...')
    clearTimeout(geocodeTimer.current)
    geocodeTimer.current = setTimeout(async () => {
      await reverseGeocode(lat, lng)
      setAdjustingMap(false)
    }, 600)
  }, [])

  const searchAddress = async (q: string) => {
    if (q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' Panama')}&format=json&limit=6&countrycodes=pa&accept-language=es`
      )
      const results = await r.json()
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const selectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat), lng = parseFloat(item.lon)
    const name = item.display_name.split(',').slice(0,2).join(',').trim()
    setCoords([lat, lng])
    setLocationName(name)
    setShowSearch(false)
    setSearchText('')
    setSearchResults([])
  }

  const subscribeOffers = (tId: string) => {
    channelRef.current = supabase.channel(`instant-${tId}`)
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

  const handlePost = async () => {
    if (!form.title.trim() || submitting || !user) return
    setPostError(''); setSubmitting(true)

    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    if (!existing) {
      await supabase.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        role: 'client',
      })
    }

    const { data: task, error } = await supabase.from('tasks').insert({
      poster_id: user.id,
      title: form.title.trim(),
      location_zone: locationName,
      lat: coords[0], lng: coords[1],
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
      setSheetExpanded(true)
    }
    setSubmitting(false)
  }

  const handleAccept = async (offer: any) => {
    if (!taskId || !user) return
    setAccepting(true); setSelectedOffer(offer)
    await supabase.from('tasks').update({ status: 'assigned', assigned_tasker_id: offer.tasker_id }).eq('id', taskId)
    await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id)
    await supabase.from('offers').update({ status: 'rejected' }).eq('task_id', taskId).neq('id', offer.id)
    const { data: contract } = await supabase.from('contracts').insert({
      task_id: taskId, offer_id: offer.id,
      poster_id: user.id, tasker_id: offer.tasker_id,
      agreed_price: offer.price, service_fee_pct: 20,
    }).select().single()
    if (contract) {
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: user.id,
        content: `👋 Hola ${offer.profiles?.full_name?.split(' ')[0]||''}! Acepte tu oferta de $${offer.price}. Cuentame en cuanto tiempo llegas a ${locationName}.`,
      })
      await supabase.from('notifications').insert({
        user_id: offer.tasker_id, type: 'offer_accepted',
        title: 'Te seleccionaron como Fixer!',
        body: `Tu oferta de $${offer.price} fue aceptada. Dirigete a ${locationName}.`,
        data: { task_id: taskId, contract_id: contract.id },
      })
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    clearInterval(timerRef.current)
    setAccepting(false)
    if (contract) router.push(`/contrato/${contract.id}`)
    else { setDone({ offer }); setPhase('done') }
  }

  const mins = String(Math.floor(timeLeft/60)).padStart(2,'0')
  const secs = String(timeLeft%60).padStart(2,'0')

  return (
    <div className="h-screen w-full overflow-hidden relative bg-gray-100">

      {/* MAPA — ocupa toda la pantalla */}
      <div className="absolute inset-0 z-0">
        <MapView
          center={coords}
          zoom={16}
          markers={offers.map((o,i) => ({
            id: o.id,
            lat: coords[0] + Math.sin(i*2.1)*0.006,
            lng: coords[1] + Math.cos(i*1.8)*0.006,
            label: `$${o.price}`,
            name: o.profiles?.full_name,
          }))}
          draggable={phase === 'form'}
          onCenterChange={handleMapDrag}
        />
      </div>

      {/* PIN CENTRAL — solo en fase form */}
      {phase === 'form' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
          style={{ paddingBottom: sheetExpanded ? '360px' : '120px' }}>
          <div className="flex flex-col items-center drop-shadow-2xl">
            <svg width="36" height="48" viewBox="0 0 36 48">
              <circle cx="18" cy="18" r="18" fill="#f97316"/>
              <circle cx="18" cy="18" r="7" fill="white"/>
              <path d="M18 36 L10 48 L18 42 L26 48 Z" fill="#f97316"/>
            </svg>
            <div style={{
              width:10, height:5, background:'rgba(0,0,0,0.18)',
              borderRadius:'50%', filter:'blur(2px)', marginTop:1
            }} />
          </div>
        </div>
      )}

      {/* RADAR — fase waiting */}
      {phase === 'waiting' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
          style={{ paddingBottom: sheetExpanded ? '320px' : '100px' }}>
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 bg-orange-400 rounded-full opacity-10 animate-ping"/>
            <div className="absolute w-18 h-18 bg-orange-400 rounded-full opacity-20 animate-ping" style={{animationDelay:'0.6s'}}/>
            <div className="w-13 h-13 bg-orange-500 rounded-full border-4 border-white shadow-2xl flex items-center justify-center w-14 h-14">
              <Zap size={22} className="text-white"/>
            </div>
          </div>
        </div>
      )}

      {/* HEADER FLOTANTE */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-4">
        <button onClick={() => router.push('/')}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700"/>
        </button>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-lg">
          <Zap size={15} className="text-orange-500"/>
          <span className="font-black text-gray-900 text-sm">Resuelve ahora</span>
        </div>
        {phase === 'waiting' && (
          <div className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full font-mono font-bold text-sm shadow-lg ${
            timeLeft < 120 ? 'bg-red-500 text-white' : 'bg-white text-orange-600'
          }`}>
            <Clock size={13}/> {mins}:{secs}
          </div>
        )}
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">

        {/* Pill de ubicación — toca para buscar */}
        <div className="mx-4 mb-2">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 text-left"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              geoLoading || adjustingMap ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              {geoLoading || adjustingMap
                ? <Loader2 size={15} className="text-orange-500 animate-spin"/>
                : <MapPin size={15} className="text-green-600"/>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-medium leading-none mb-0.5">
                ¿Dónde necesitas el servicio? — toca para cambiar
              </p>
              <p className="font-bold text-gray-900 text-sm truncate">{locationName}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); detectGPS() }}
              disabled={geoLoading}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold bg-orange-50 px-3 py-1.5 rounded-full disabled:opacity-50 flex-shrink-0"
            >
              <Navigation size={11}/> GPS
            </button>
          </button>
        </div>

        {/* Sheet principal */}
        <div className="bg-white rounded-t-3xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}>

          {/* Handle — tap para expandir/colapsar */}
          <button onClick={() => setSheetExpanded(v => !v)}
            className="w-full flex flex-col items-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full"/>
            {sheetExpanded
              ? <ChevronDown size={14} className="text-gray-300 mt-1"/>
              : <ChevronUp size={14} className="text-gray-300 mt-1"/>
            }
          </button>

          <div className={`overflow-y-auto transition-all duration-300 ${
            sheetExpanded ? 'max-h-[60vh]' : 'max-h-0'
          }`}>
            <div className="px-5 pb-8 space-y-4">

              {/* ── FASE FORM ── */}
              {phase === 'form' && (
                <>
                  <div>
                    <p className="font-black text-gray-900 text-xl">¿Qué necesitas?</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Un Fixer llegará rápido a <span className="font-semibold text-orange-500">{locationName}</span>
                    </p>
                  </div>

                  {/* Categorías */}
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_CATEGORIES.map(c => (
                      <button key={c.slug} onClick={() => setForm({...form, category: c.slug})}
                        className={`py-2.5 px-1 rounded-xl border-2 text-center transition-all ${
                          form.category === c.slug
                            ? 'border-orange-400 bg-orange-50 shadow-sm'
                            : 'border-gray-100 bg-white hover:border-orange-200'
                        }`}>
                        <div className="text-2xl">{c.icon}</div>
                        <div className="text-xs text-gray-600 mt-0.5 leading-tight font-medium">{c.name}</div>
                      </button>
                    ))}
                  </div>

                  <input
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="Ej: Instalar aire acondicionado split..."
                    className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl px-4 py-3.5 text-sm outline-none bg-gray-50 font-medium"
                  />

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                    <input type="number" value={form.budget}
                      onChange={e => setForm({...form, budget: e.target.value})}
                      placeholder="Presupuesto (opcional)"
                      className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl pl-8 pr-4 py-3.5 text-sm outline-none bg-gray-50"
                    />
                  </div>

                  {postError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                      <AlertCircle size={14}/> {postError}
                    </div>
                  )}

                  <button onClick={handlePost}
                    disabled={!form.title.trim() || geoLoading || submitting}
                    className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-200">
                    {submitting
                      ? <><Loader2 size={20} className="animate-spin"/> Publicando...</>
                      : <><Zap size={20}/> Buscar Fixer ahora</>
                    }
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    Mueve el mapa para ajustar tu ubicación exacta
                  </p>
                </>
              )}

              {/* ── FASE WAITING ── */}
              {phase === 'waiting' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-black text-gray-900 text-lg">Buscando Fixers...</h2>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-orange-400"/> {locationName}
                      </p>
                    </div>
                  </div>

                  {offers.length === 0 ? (
                    timeLeft > 0 ? (
                      <div className="flex items-center gap-4 py-3">
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
                      <div className="text-center py-4 bg-orange-50 rounded-2xl p-4">
                        <p className="font-bold text-gray-700 mb-3">Sin Fixers disponibles ahora</p>
                        <button onClick={() => router.push('/post-task')}
                          className="w-full bg-orange-500 text-white py-3.5 rounded-2xl font-bold hover:bg-orange-600">
                          Publicar como tarea normal →
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {offers.length} Fixer{offers.length>1?'s':''} disponible{offers.length>1?'s':''}
                      </p>
                      {offers.map((offer, idx) => (
                        <div key={offer.id}
                          className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border-2 border-transparent hover:border-orange-200 transition-all">
                          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-xl flex-shrink-0">
                            {offer.profiles?.full_name?.[0]||'?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-gray-900 text-sm">{offer.profiles?.full_name}</p>
                              {idx===0 && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Primero</span>}
                            </div>
                            <Stars v={offer.profiles?.avg_rating||0}/>
                            <p className="text-xs text-gray-400">{offer.profiles?.total_completed||0} trabajos</p>
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
                </>
              )}

              {/* ── FASE DONE ── */}
              {phase === 'done' && done && (
                <div className="text-center py-2">
                  <CheckCircle size={40} className="text-green-500 mx-auto mb-2"/>
                  <h2 className="font-black text-gray-900 text-xl mb-1">Fixer en camino</h2>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 mb-4 text-left">
                    <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-xl">
                      {done.offer.profiles?.full_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{done.offer.profiles?.full_name}</p>
                      <Stars v={done.offer.profiles?.avg_rating||0}/>
                    </div>
                    <p className="text-2xl font-black text-gray-900">${done.offer.price}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL BÚSQUEDA DE DIRECCIÓN */}
      {showSearch && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-100">
            <button onClick={() => { setShowSearch(false); setSearchText(''); setSearchResults([]) }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
              <ArrowLeft size={20} className="text-gray-700"/>
            </button>
            <div className="flex-1 relative">
              <input
                autoFocus
                value={searchText}
                onChange={e => {
                  setSearchText(e.target.value)
                  clearTimeout(searchTimer.current)
                  searchTimer.current = setTimeout(() => searchAddress(e.target.value), 400)
                }}
                placeholder="Busca tu dirección, barrio o edificio..."
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none font-medium"
              />
              {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"/>}
            </div>
          </div>

          <button onClick={() => { detectGPS(); setShowSearch(false) }}
            className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Navigation size={18} className="text-blue-600"/>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Usar mi ubicación actual (GPS)</p>
              <p className="text-xs text-gray-400">Detectar automáticamente con tu dispositivo</p>
            </div>
          </button>

          <div className="flex-1 overflow-y-auto">
            {searchText.length < 3 && (
              <div className="px-5 py-4">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Zonas populares en Panamá</p>
                {['Marbella','San Francisco','Obarrio','El Cangrejo','Costa del Este','Punta Pacifica','Bella Vista','Clayton','Albrook','Las Cumbres','Arraijan','La Chorrera'].map(z => (
                  <button key={z} onClick={() => { setSearchText(z); searchAddress(z) }}
                    className="flex items-center gap-3 w-full py-3 hover:bg-gray-50 rounded-xl px-2">
                    <MapPin size={15} className="text-gray-300 flex-shrink-0"/>
                    <span className="text-sm text-gray-700 font-medium">{z}, Panamá</span>
                  </button>
                ))}
              </div>
            )}
            {searchText.length >= 3 && !searching && searchResults.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <MapPin size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Sin resultados — intenta con otro nombre</p>
              </div>
            )}
            {searchResults.map((item, i) => (
              <button key={i} onClick={() => selectSearchResult(item)}
                className="flex items-center gap-4 w-full px-5 py-4 hover:bg-gray-50 border-b border-gray-50 text-left">
                <div className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin size={15} className="text-orange-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{item.display_name.split(',')[0]}</p>
                  <p className="text-xs text-gray-400 truncate">{item.display_name.split(',').slice(1,3).join(',')}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
