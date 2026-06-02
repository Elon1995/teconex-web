'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Zap, MapPin, Clock, Bell, BellOff, Send, Star, X, RefreshCw } from 'lucide-react'

const MapView = dynamic(() => import('@/components/instant/MapView'), { ssr: false })

function Stars({ v }: { v: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11} className={i <= Math.round(v || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
      ))}
    </div>
  )
}

export default function IncomingPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [coords, setCoords] = useState<[number, number]>([8.994, -79.519])
  const [available, setAvailable] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMsg, setOfferMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sentIds, setSentIds] = useState<string[]>([])
  const [newAlert, setNewAlert] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const channelRef = useRef<any>(null)
  const userRef = useRef<any>(null)
  const profileRef = useRef<any>(null)

  useEffect(() => {
    init()
    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCoords([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      )
    }
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    userRef.current = user

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    profileRef.current = p
    setAvailable(p?.is_available ?? true)

    await loadTasks()
    subscribeRealtime(user.id)
    setLoading(false)
  }

  const loadTasks = async () => {
    setLastRefresh(new Date())
    const { data, error } = await supabase
      .from('tasks')
      .select('*, profiles(full_name, avg_rating, zone)')
      .eq('is_instant', true)
      .eq('status', 'open')
      .gt('instant_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) console.error('Error loading tasks:', error)
    setTasks(data || [])
  }

  const subscribeRealtime = (uid: string) => {
    // Canal para nuevas tareas instant
    const ch = supabase.channel('fixer-incoming-feed', {
      config: { broadcast: { self: false } }
    })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
        },
        async (payload) => {
          const newTask = payload.new as any
          // Solo tareas instant abiertas que no sean del mismo user
          if (!newTask.is_instant || newTask.poster_id === uid) return
          if (newTask.status !== 'open') return

          const { data: poster } = await supabase
            .from('profiles')
            .select('full_name, zone')
            .eq('id', newTask.poster_id)
            .single()

          const task = { ...newTask, profiles: poster }
          setTasks(prev => [task, ...prev.filter(t => t.id !== task.id)])

          // Alerta visual
          setNewAlert(task)
          if ('vibrate' in navigator) navigator.vibrate([300, 100, 300])
          setTimeout(() => setNewAlert(null), 8000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          // Quitar tareas que ya no están abiertas
          if (payload.new.status !== 'open') {
            setTasks(prev => prev.filter(t => t.id !== payload.new.id))
            setSelectedTask((prev: any) => prev?.id === payload.new.id ? null : prev)
          }
        }
      )
      .subscribe((status) => {
        console.log('Fixer feed subscription:', status)
      })

    channelRef.current = ch
  }

  const toggleAvailable = async () => {
    if (!user) return
    const v = !available
    setAvailable(v)
    await supabase.from('profiles').update({
      is_available: v,
      last_seen_at: new Date().toISOString()
    }).eq('id', user.id)
  }

  const sendOffer = async () => {
    if (!offerPrice || !selectedTask || !user) return
    setSending(true)

    const { error } = await supabase.from('offers').insert({
      task_id: selectedTask.id,
      tasker_id: user.id,
      price: parseFloat(offerPrice),
      message: offerMsg || `Hola, puedo atenderte. Estoy disponible ahora mismo en ${profile?.zone || 'tu zona'}.`,
    })

    if (error) {
      console.error('Error sending offer:', error)
      setSending(false)
      return
    }

    // Notificar al cliente
    await supabase.from('notifications').insert({
      user_id: selectedTask.poster_id,
      type: 'new_offer',
      title: `💬 ${profileRef.current?.full_name || 'Un Fixer'} quiere ayudarte`,
      body: `Oferta de $${offerPrice} — ${profileRef.current?.zone || 'disponible ahora'}`,
      data: { task_id: selectedTask.id },
    })

    setSentIds(prev => [...prev, selectedTask.id])
    setSelectedTask(null)
    setOfferPrice('')
    setOfferMsg('')
    setSending(false)
  }

  const timeLeft = (t: any) => {
    if (!t?.instant_expires_at) return ''
    const diff = new Date(t.instant_expires_at).getTime() - Date.now()
    if (diff <= 0) return 'Expirada'
    const m = Math.floor(diff / 60000)
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
    return `${m}:${s}`
  }

  const mapMarkers = tasks.map((t, i) => ({
    id: t.id,
    lat: (t.lat || coords[0]) + (Math.sin(i * 2.3) * 0.012),
    lng: (t.lng || coords[1]) + (Math.cos(i * 1.7) * 0.012),
    label: t.budget > 0 ? `$${t.budget}` : '💬',
    name: t.title,
  }))

  if (loading) return (
    <div className="h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <Zap size={32} className="text-orange-400 mx-auto mb-3 animate-bounce" />
        <p className="text-sm text-gray-400">Cargando solicitudes...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden relative bg-gray-900">

      {/* Mapa fondo */}
      <div className="absolute inset-0">
        <MapView center={coords} zoom={13} userCoords={coords} markers={mapMarkers} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <div className="bg-white rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${available ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-sm font-semibold text-gray-700">
            {available ? 'Disponible' : 'Inactivo'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className="bg-white rounded-2xl shadow-lg px-3 py-2.5 text-gray-500 hover:text-gray-700"
            title="Actualizar solicitudes"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={toggleAvailable}
            className={`rounded-2xl shadow-lg px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-all ${
              available ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'
            }`}
          >
            {available ? <><Bell size={15} /> Conectado</> : <><BellOff size={15} /> Activar</>}
          </button>
        </div>
      </div>

      {/* Alerta nueva tarea */}
      {newAlert && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="bg-orange-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 animate-bounce">
              <Zap size={20} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">⚡ ¡Nueva solicitud!</p>
              <p className="text-orange-100 text-xs truncate">{newAlert.title}</p>
              <p className="text-orange-200 text-xs flex items-center gap-1">
                <MapPin size={9} /> {newAlert.location_zone || newAlert.profiles?.zone || 'Panamá'}
              </p>
            </div>
            <button
              onClick={() => { setSelectedTask(newAlert); setNewAlert(null); setOfferPrice(''); setOfferMsg('') }}
              className="bg-white text-orange-500 font-black text-sm px-3 py-1.5 rounded-xl flex-shrink-0 hover:bg-orange-50"
            >
              Ofertar
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: '55vh' }}>
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-0" />
          <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-black text-gray-900">
                Solicitudes activas
                {tasks.length > 0 && (
                  <span className="ml-2 text-orange-500">{tasks.length}</span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                {tasks.length === 0
                  ? 'Sin solicitudes — actualiza o espera'
                  : `${tasks.length} tarea${tasks.length > 1 ? 's' : ''} cerca de ti`
                }
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-orange-600">En vivo</span>
            </div>
          </div>

          <div className="overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: 'calc(55vh - 80px)' }}>
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <Zap size={28} className="text-orange-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">Sin solicitudes activas ahora</p>
                <p className="text-xs text-gray-400 mt-1">Cuando alguien busque un Fixer, aparecerá aquí</p>
                <button
                  onClick={loadTasks}
                  className="mt-3 text-xs text-orange-500 font-semibold flex items-center gap-1 mx-auto"
                >
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>
            ) : (
              tasks.map(task => {
                const tl = timeLeft(task)
                const sent = sentIds.includes(task.id)
                return (
                  <button
                    key={task.id}
                    onClick={() => { setSelectedTask(task); setOfferPrice(''); setOfferMsg('') }}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      sent ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      sent ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      <Zap size={16} className={sent ? 'text-green-500' : 'text-orange-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin size={9} /> {task.location_zone || 'Sin zona'}
                        {' · '}
                        <Clock size={9} /> {tl || '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {task.budget > 0
                        ? <p className="font-black text-gray-900 text-sm">${task.budget}</p>
                        : <p className="text-xs text-gray-400">A convenir</p>
                      }
                      {sent
                        ? <p className="text-xs text-green-600 font-semibold">✓ Enviada</p>
                        : <p className="text-xs text-orange-500 font-semibold">Ofertar →</p>
                      }
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal hacer oferta */}
      {selectedTask && (
        <div
          className="absolute inset-0 z-40 flex items-end bg-black/50"
          onClick={e => e.target === e.currentTarget && setSelectedTask(null)}
        >
          <div className="bg-white rounded-t-3xl w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 pr-3">
                <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
                  ⚡ INMEDIATO
                </span>
                <h3 className="font-black text-gray-900 mt-2 text-base">{selectedTask.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {selectedTask.location_zone || 'Zona no especificada'}
                  </span>
                  {selectedTask.budget > 0 && (
                    <span className="font-semibold text-gray-700">
                      Presupuesto: ${selectedTask.budget}
                    </span>
                  )}
                </div>
                {selectedTask.profiles?.full_name && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Cliente: {selectedTask.profiles.full_name}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-300 hover:text-gray-500">
                <X size={22} />
              </button>
            </div>

            {sentIds.includes(selectedTask.id) ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-green-700 font-bold">Oferta enviada</p>
                <p className="text-sm text-green-600 mt-1">Esperando respuesta del cliente</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Tu precio para este trabajo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={offerPrice}
                      onChange={e => setOfferPrice(e.target.value)}
                      className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl pl-8 pr-4 py-3.5 text-xl font-black outline-none"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Mensaje rápido al cliente (opcional)
                  </label>
                  <input
                    placeholder="Hola, puedo atenderte en 20 minutos..."
                    value={offerMsg}
                    onChange={e => setOfferMsg(e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={sendOffer}
                  disabled={!offerPrice || sending}
                  className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    <><Send size={18} /> Enviar oferta — ${offerPrice || '0'}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
