'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Zap, MapPin, Star, CheckCircle, Phone, X, Clock, Send, ArrowLeft, Loader2, AlertCircle, Navigation } from 'lucide-react'

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

const ZONES = [
  'Marbella','Punta Pacífica','Obarrio','El Cangrejo','San Francisco',
  'Bella Vista','Albrook','Clayton','Costa del Este','Santa María',
  'Coco del Mar','Bethania','Las Cumbres','Arraiján','La Chorrera',
  'Colón','David','Santiago','Chitré','Penonomé',
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

export default function InstantPage() {
  const router = useRouter()
  const [user, setUser]               = useState<any>(null)
  const [phase, setPhase]             = useState<Phase>('form')
  const [coords, setCoords]           = useState<[number,number]>([8.994,-79.519])
  const [locationName, setLocationName] = useState('')
  const [geoLoading, setGeoLoading]   = useState(false)
  const [showZones, setShowZones]     = useState(false)
  const [zoneFilter, setZoneFilter]   = useState('')
  const [form, setForm]               = useState({ title:'', category:'otro', budget:'' })
  const [taskId, setTaskId]           = useState<string|null>(null)
  const [offers, setOffers]           = useState<any[]>([])
  const [accepting, setAccepting]     = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [timeLeft, setTimeLeft]       = useState(900)
  const [submitting, setSubmitting]   = useState(false)
  const [postError, setPostError]     = useState('')
  const [done, setDone]               = useState<any>(null)
  const channelRef = useRef<any>(null)
  const timerRef   = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth?next=/instant'); return }
      setUser(user)
    })
    detectLocation()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'waiting') return
    timerRef.current = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  const detectLocation = () => {
    setGeoLoading(true)
    if (!navigator.geolocation) { setGeoLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setCoords([lat, lng])
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`)
          const d = await r.json()
          const a = d.address
          const zone = a.neighbourhood || a.suburb || a.city_district || a.town || a.city || 'Panamá'
          setLocationName(zone)
        } catch { setLocationName('Panamá') }
        setGeoLoading(false)
      },
      () => { setGeoLoading(false) },
      { timeout: 8000 }
    )
  }

  const subscribeOffers = (tId: string) => {
    channelRef.current = supabase.channel(`instant-offers-${tId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'offers', filter:`task_id=eq.${tId}` },
        async payload => {
          const { data: p } = await supabase.from('profiles')
            .select('full_name,avg_rating,total_completed,zone,whatsapp,bio')
            .eq('id', payload.new.tasker_id).single()
          setOffers(prev => prev.find(o => o.id === payload.new.id) ? prev : [...prev, { ...payload.new, profiles: p }])
          if ('vibrate' in navigator) navigator.vibrate([100,50,100])
        })
      .subscribe()
  }

  const handlePost = async () => {
    if (!form.title.trim() || submitting || !user) return
    if (!locationName) { setPostError('Selecciona una ubicación primero'); return }
    setPostError(''); setSubmitting(true)

    // Garantizar que el perfil existe (por si el trigger no lo creó)
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
    if (task) { setTaskId(task.id); subscribeOffers(task.id); setPhase('waiting') }
    setSubmitting(false)
  }

  const handleAccept = async (offer: any) => {
    if (!taskId || !user) return
    setAccepting(true); setSelectedOffer(offer)
    await supabase.from('tasks').update({ status:'assigned', assigned_tasker_id: offer.tasker_id }).eq('id', taskId)
    await supabase.from('offers').update({ status:'accepted' }).eq('id', offer.id)
    await supabase.from('offers').update({ status:'rejected' }).eq('task_id', taskId).neq('id', offer.id)
    const { data: contract } = await supabase.from('contracts').insert({
      task_id: taskId, offer_id: offer.id, poster_id: user.id, tasker_id: offer.tasker_id,
      agreed_price: offer.price, service_fee_pct: 20,
    }).select().single()
    if (contract) {
      await supabase.from('messages').insert({ contract_id: contract.id, sender_id: user.id,
        content: `👋 ¡Hola ${offer.profiles?.full_name?.split(' ')[0]||''}! Acepté tu oferta de $${offer.price}. ¿En cuánto tiempo llegas a ${locationName}?` })
      await supabase.from('notifications').insert({ user_id: offer.tasker_id, type:'offer_accepted',
        title:'🚀 ¡Te seleccionaron como Fixer!',
        body:`Tu oferta de $${offer.price} fue aceptada. Dirígete a ${locationName}.`,
        data:{ task_id: taskId, contract_id: contract.id } })
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    clearInterval(timerRef.current)
    setAccepting(false)
    if (contract) router.push(`/contrato/${contract.id}`)
    else { setDone({ offer, contract }); setPhase('done') }
  }

  const mins = String(Math.floor(timeLeft/60)).padStart(2,'0')
  const secs = String(timeLeft%60).padStart(2,'0')
  const filteredZones = zoneFilter ? ZONES.filter(z => z.toLowerCase().includes(zoneFilter.toLowerCase())) : ZONES

  const geocodeZone = async (zone: string) => {
    setLocationName(zone)
    setShowZones(false)
    setZoneFilter('')
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zone+' Panama')}&format=json&limit=1&countrycodes=pa`)
      const d = await r.json()
      if (d[0]) setCoords([parseFloat(d[0].lat), parseFloat(d[0].lon)])
    } catch { /* usa coords actuales */ }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 z-20 flex-shrink-0">
        <button onClick={() => router.push('/')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="font-black text-lg text-orange-500">⚡ Resuelve</span>
          <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">Fixer ahora</span>
        </div>
        {phase === 'waiting' && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-bold text-sm ${timeLeft < 120 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
            <Clock size={13} /> {mins}:{secs}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="relative flex-shrink-0" style={{ height:'35vh' }}>
        <MapView center={coords} zoom={13} userCoords={coords}
          markers={offers.map((o,i) => ({
            id: o.id,
            lat: coords[0] + Math.sin(i*2.1)*0.010,
            lng: coords[1] + Math.cos(i*1.8)*0.010,
            label: `$${o.price}`, name: o.profiles?.full_name,
          }))}
        />
        {phase === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-28 h-28 bg-orange-400 rounded-full opacity-10 animate-ping" />
              <div className="absolute w-18 h-18 bg-orange-400 rounded-full opacity-20 animate-ping" style={{animationDelay:'0.5s'}} />
              <div className="w-12 h-12 bg-orange-500 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </div>
            </div>
          </div>
        )}
        {phase === 'form' && locationName && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-1.5 shadow-lg flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <MapPin size={13} className="text-orange-500" /> {locationName}
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 shadow-2xl overflow-hidden flex flex-col z-10"
        style={{boxShadow:'0 -6px 30px rgba(0,0,0,0.10)'}}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto px-5 pb-6">

          {/* ── FORMULARIO ── */}
          {phase === 'form' && (
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-gray-900 text-lg">¿Qué necesitas resolver?</h2>
                <p className="text-xs text-gray-400">Un <span className="font-bold text-orange-500">Fixer</span> llegará rápido</p>
              </div>

              {/* UBICACIÓN — simple y directo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">📍 ¿Dónde necesitas el servicio?</label>
                  <button
                    onClick={detectLocation}
                    disabled={geoLoading}
                    className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-600 disabled:opacity-60"
                  >
                    {geoLoading
                      ? <><Loader2 size={12} className="animate-spin" /> Detectando...</>
                      : <><Navigation size={12} /> Detectar</>
                    }
                  </button>
                </div>

                {/* Zona seleccionada */}
                {locationName ? (
                  <div className="flex items-center gap-2 bg-orange-50 border-2 border-orange-400 rounded-xl px-4 py-3 mb-3">
                    <MapPin size={15} className="text-orange-500 flex-shrink-0" />
                    <span className="font-bold text-orange-700 flex-1">{locationName}</span>
                    <button onClick={() => { setLocationName(''); setShowZones(true) }} className="text-orange-400 hover:text-orange-600">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowZones(v => !v)}
                    className="w-full flex items-center gap-2 border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-xl px-4 py-3 mb-3 text-gray-400 hover:text-orange-500 transition-colors text-sm"
                  >
                    <MapPin size={15} /> Seleccionar zona o barrio...
                  </button>
                )}

                {/* Panel de zonas */}
                {(showZones || !locationName) && (
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                    <input
                      value={zoneFilter}
                      onChange={e => setZoneFilter(e.target.value)}
                      placeholder="Buscar zona..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white mb-3"
                      autoFocus={showZones}
                    />
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                      {filteredZones.map(zone => (
                        <button
                          key={zone}
                          onMouseDown={e => { e.preventDefault(); geocodeZone(zone) }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            locationName === zone
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                          }`}
                        >
                          {zone}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">¿No está tu zona? Activa "Detectar" arriba</p>
                  </div>
                )}
              </div>

              {/* Categorías */}
              <div className="grid grid-cols-4 gap-2">
                {QUICK_CATEGORIES.map(c => (
                  <button key={c.slug} onClick={() => setForm({...form, category:c.slug})}
                    className={`py-2 px-1 rounded-xl border-2 text-center transition-all ${
                      form.category===c.slug ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-orange-200'
                    }`}>
                    <div className="text-xl">{c.icon}</div>
                    <div className="text-xs text-gray-600 mt-0.5 leading-tight">{c.name}</div>
                  </button>
                ))}
              </div>

              {/* Descripción */}
              <input value={form.title} onChange={e => setForm({...form, title:e.target.value})}
                placeholder="Describe lo que necesitas..."
                className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl px-4 py-3 text-sm outline-none bg-gray-50" />

              {/* Presupuesto */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input type="number" value={form.budget} onChange={e => setForm({...form, budget:e.target.value})}
                  placeholder="Presupuesto (opcional — el Fixer propone precio)"
                  className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl pl-8 pr-4 py-3 text-sm outline-none bg-gray-50" />
              </div>

              {postError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={14} /> {postError}
                </div>
              )}

              <button onClick={handlePost} disabled={!form.title.trim() || !locationName || submitting}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-200">
                {submitting
                  ? <><Loader2 size={20} className="animate-spin" /> Publicando...</>
                  : <><Zap size={20} /> Buscar Fixer en {locationName || '...'}</>
                }
              </button>

              {!locationName && (
                <p className="text-center text-xs text-orange-400 font-medium">⬆️ Selecciona primero tu ubicación</p>
              )}
            </div>
          )}

          {/* ── ESPERANDO ── */}
          {phase === 'waiting' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-black text-gray-900">Buscando Fixers...</h2>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="text-orange-400" /> {locationName} · {form.title}
                  </p>
                </div>
              </div>

              {offers.length === 0 ? (
                <div>
                  {timeLeft > 0 ? (
                    <div className="text-center py-6">
                      <div className="flex justify-center gap-3 mb-4">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center animate-bounce"
                            style={{animationDelay:`${i*0.15}s`}}>
                            <span className="text-xl">🔧</span>
                          </div>
                        ))}
                      </div>
                      <p className="font-semibold text-gray-700">Notificando Fixers disponibles</p>
                      <p className="text-sm text-gray-400 mt-1">en <strong>{locationName}</strong>...</p>
                      <p className="text-xs text-gray-300 mt-3">Expira en {mins}:{secs}</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-orange-50 rounded-2xl p-5">
                      <div className="text-4xl mb-3">😕</div>
                      <p className="font-bold text-gray-800">No hay Fixers disponibles ahora</p>
                      <p className="text-sm text-gray-500 mt-1 mb-4">Publica como tarea normal y recibirás ofertas pronto.</p>
                      <button onClick={() => router.push('/post-task')}
                        className="w-full bg-orange-500 text-white py-3.5 rounded-2xl font-bold hover:bg-orange-600 mb-2">
                        Publicar como tarea normal →
                      </button>
                      <button onClick={() => { setPhase('form'); setTimeLeft(900); setOffers([]); setTaskId(null) }}
                        className="w-full text-gray-400 text-sm py-2">
                        Intentar de nuevo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    🎉 {offers.length} Fixer{offers.length>1?'s':''} disponible{offers.length>1?'s':''}
                  </p>
                  {offers.map((offer, idx) => (
                    <div key={offer.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border-2 border-transparent hover:border-orange-200 transition-all">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-lg flex-shrink-0">
                        {offer.profiles?.full_name?.[0]||'?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-gray-900 text-sm">{offer.profiles?.full_name}</p>
                          {idx===0 && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Primero</span>}
                        </div>
                        <Stars v={offer.profiles?.avg_rating||0} />
                        <p className="text-xs text-gray-400">{offer.profiles?.total_completed||0} trabajos · {offer.profiles?.zone||'Panamá'}</p>
                        {offer.message && <p className="text-xs text-gray-500 mt-0.5 italic truncate">"{offer.message}"</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black text-gray-900">${offer.price}</p>
                        <button onClick={() => handleAccept(offer)} disabled={accepting}
                          className="mt-1 bg-orange-500 text-white px-3 py-1.5 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-60">
                          {accepting && selectedOffer?.id===offer.id ? '...' : 'Aceptar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {taskId && (
                <button onClick={() => router.push(`/tasks/${taskId}`)} className="mt-4 w-full text-gray-400 text-sm py-2 text-center hover:text-gray-600">
                  Ver tarea completa →
                </button>
              )}
            </div>
          )}

          {/* ── DONE fallback ── */}
          {phase === 'done' && done && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-1">¡Fixer en camino!</h2>
              <p className="text-gray-400 text-sm mb-5">Coordina los detalles</p>
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 mb-4 text-left">
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-xl flex-shrink-0">
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
                    className="flex items-center justify-center gap-2 bg-green-500 text-white py-3.5 rounded-2xl font-bold hover:bg-green-600">
                    <Phone size={16} /> WhatsApp
                  </a>
                )}
                {taskId && (
                  <button onClick={() => router.push(`/tasks/${taskId}`)}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl font-bold hover:bg-blue-700">
                    <Send size={16} /> Chat
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
