'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle, MapPin, Phone, Send, Star, Clock,
  ArrowLeft, FileText, Zap, AlertCircle, X
} from 'lucide-react'

type ContractStatus = 'confirmed' | 'on_way' | 'arrived' | 'in_progress' | 'completed'

function Stars({ v }: { v: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} className={i <= Math.round(v || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
      ))}
    </div>
  )
}

const STEPS: { key: ContractStatus; label: string; icon: string }[] = [
  { key: 'confirmed',   label: 'Confirmado',   icon: '✅' },
  { key: 'on_way',      label: 'En camino',    icon: '🚗' },
  { key: 'arrived',     label: 'Llegó',        icon: '📍' },
  { key: 'in_progress', label: 'Trabajando',   icon: '🔧' },
  { key: 'completed',   label: 'Completado',   icon: '🎉' },
]

export default function ContratoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contract, setContract] = useState<any>(null)
  const [task, setTask] = useState<any>(null)
  const [taskerProfile, setTaskerProfile] = useState<any>(null)
  const [posterProfile, setPosterProfile] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [workStatus, setWorkStatus] = useState<ContractStatus>('confirmed')
  const [showReview, setShowReview] = useState(false)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadContract()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime mensajes
  useEffect(() => {
    if (!contract) return
    const ch = supabase.channel(`chat-${contract.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `contract_id=eq.${contract.id}`
      }, async (payload) => {
        const { data: sender } = await supabase
          .from('profiles').select('full_name').eq('id', payload.new.sender_id).single()
        setMessages(prev => [...prev, { ...payload.new, profiles: sender }])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [contract])

  const loadContract = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setCurrentUser(user)

    const { data: c } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (!c) { setLoading(false); return }
    setContract(c)

    // Cargar task, tasker, poster en paralelo
    const [{ data: t }, { data: tasker }, { data: poster }, { data: msgs }] = await Promise.all([
      supabase.from('tasks').select('*, categories(name, icon)').eq('id', c.task_id).single(),
      supabase.from('profiles').select('*').eq('id', c.tasker_id).single(),
      supabase.from('profiles').select('*').eq('id', c.poster_id).single(),
      supabase.from('messages').select('*, profiles(full_name)').eq('contract_id', c.id).order('created_at'),
    ])

    setTask(t)
    setTaskerProfile(tasker)
    setPosterProfile(poster)
    setMessages(msgs || [])

    // Estado del trabajo desde la DB
    if (t?.status === 'completed') setWorkStatus('completed')
    else if (t?.status === 'in_progress') setWorkStatus('in_progress')
    else if (c.started_at) setWorkStatus('arrived')
    else setWorkStatus('confirmed')

    setLoading(false)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !contract) return
    const content = newMessage.trim()
    setNewMessage('')
    await supabase.from('messages').insert({
      contract_id: contract.id,
      sender_id: currentUser.id,
      content,
    })
  }

  const updateWorkStatus = async (newStatus: ContractStatus) => {
    setWorkStatus(newStatus)

    if (newStatus === 'on_way') {
      // Tasker notifica que va en camino
      await supabase.from('notifications').insert({
        user_id: contract.poster_id, type: 'fixer_on_way',
        title: '🚗 Tu Fixer está en camino',
        body: `${taskerProfile?.full_name} ya va hacia donde estás.`,
        data: { contract_id: contract.id },
      })
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: currentUser.id,
        content: '🚗 ¡Estoy en camino! Llegaré pronto.',
      })
    }

    if (newStatus === 'arrived') {
      await supabase.from('contracts').update({ started_at: new Date().toISOString() }).eq('id', contract.id)
      await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id)
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: currentUser.id,
        content: '📍 ¡Ya llegué! Listo para comenzar.',
      })
    }

    if (newStatus === 'in_progress') {
      await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id)
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: currentUser.id,
        content: '🔧 Comenzando el trabajo...',
      })
    }

    if (newStatus === 'completed') {
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
      await supabase.from('contracts').update({
        payment_status: 'released',
        completed_at: new Date().toISOString(),
      }).eq('id', contract.id)
      await supabase.from('messages').insert({
        contract_id: contract.id, sender_id: currentUser.id,
        content: '✅ ¡Trabajo completado! Gracias por confiar en mí.',
      })
      setShowReview(true)
    }
  }

  const submitReview = async () => {
    setSubmittingReview(true)
    const revieweeId = isPoster ? contract.tasker_id : contract.poster_id
    await supabase.from('reviews').insert({
      contract_id: contract.id,
      reviewer_id: currentUser.id,
      reviewee_id: revieweeId,
      overall_rating: rating,
      text: reviewText,
      is_published: true,
    })
    // Actualizar avg_rating
    const { data: reviews } = await supabase
      .from('reviews').select('overall_rating').eq('reviewee_id', revieweeId)
    if (reviews?.length) {
      const avg = reviews.reduce((s: number, r: any) => s + r.overall_rating, 0) / reviews.length
      await supabase.from('profiles').update({
        avg_rating: avg,
        total_reviews: reviews.length,
        total_completed: taskerProfile?.total_completed + 1,
      }).eq('id', revieweeId)
    }
    setShowReview(false)
    setSubmittingReview(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Cargando contrato...</p>
      </div>
    </div>
  )

  if (!contract) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={40} className="text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">Contrato no encontrado</p>
        <Link href="/" className="text-orange-500 mt-2 inline-block text-sm">← Inicio</Link>
      </div>
    </div>
  )

  const isPoster = currentUser?.id === contract.poster_id
  const isTasker = currentUser?.id === contract.tasker_id
  const otherPerson = isPoster ? taskerProfile : posterProfile
  const stepIndex = STEPS.findIndex(s => s.key === workStatus)
  const serviceFee = (contract.agreed_price * contract.service_fee_pct) / 100
  const taskerEarns = contract.agreed_price - serviceFee

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-orange-500 text-sm">⚡ Contrato activo</span>
              {workStatus === 'completed' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Completado</span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{task?.title}</p>
          </div>
          <button onClick={() => setShowContract(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50">
            <FileText size={13} /> Ver contrato
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Progress bar */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${
                  i <= stepIndex ? 'bg-orange-500 shadow-lg shadow-orange-200' : 'bg-gray-100'
                }`}>
                  {i <= stepIndex ? step.icon : <span className="text-gray-300 text-sm">{i + 1}</span>}
                </div>
                <span className={`text-xs font-medium ${i === stepIndex ? 'text-orange-600' : i < stepIndex ? 'text-gray-500' : 'text-gray-300'}`}>
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`absolute hidden`} />
                )}
              </div>
            ))}
          </div>
          {/* Línea de progreso */}
          <div className="h-1.5 bg-gray-100 rounded-full mt-1">
            <div
              className="h-1.5 bg-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Persona asignada */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
            {isPoster ? '🔧 Tu Fixer' : '👤 Cliente'}
          </p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600 text-2xl flex-shrink-0">
              {otherPerson?.full_name?.[0] || '?'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-lg">{otherPerson?.full_name}</p>
              <Stars v={otherPerson?.avg_rating || 0} />
              <p className="text-xs text-gray-400 mt-0.5">
                {otherPerson?.total_completed || 0} trabajos completados
                {otherPerson?.zone && ` · ${otherPerson.zone}`}
              </p>
              {otherPerson?.bio && <p className="text-xs text-gray-500 mt-1 italic">"{otherPerson.bio}"</p>}
            </div>
            {otherPerson?.whatsapp && (
              <a
                href={`https://wa.me/507${otherPerson.whatsapp}?text=${encodeURIComponent(`Hola! Te contacto por el trabajo "${task?.title}" en TECONEX.`)}`}
                target="_blank"
                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-green-200 hover:bg-green-600 transition-colors"
              >
                <Phone size={20} className="text-white" />
              </a>
            )}
          </div>
        </div>

        {/* Precio acordado */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Precio acordado</p>
              <p className="text-3xl font-black text-gray-900 mt-1">${contract.agreed_price?.toLocaleString()}</p>
              {isTasker && (
                <p className="text-xs text-gray-400 mt-1">
                  Recibes: <span className="font-semibold text-green-600">${taskerEarns?.toFixed(2)}</span>
                  <span className="text-gray-300 ml-1">({contract.service_fee_pct}% fee plataforma)</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{task?.categories?.name}</p>
              <p className="text-2xl mt-1">{task?.categories?.icon || '🔧'}</p>
            </div>
          </div>
        </div>

        {/* Acciones del Fixer */}
        {isTasker && workStatus !== 'completed' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Actualiza tu estado</p>
            <div className="grid grid-cols-2 gap-3">
              {workStatus === 'confirmed' && (
                <button onClick={() => updateWorkStatus('on_way')}
                  className="col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  🚗 Estoy en camino
                </button>
              )}
              {workStatus === 'on_way' && (
                <button onClick={() => updateWorkStatus('arrived')}
                  className="col-span-2 bg-orange-500 text-white py-4 rounded-2xl font-bold text-base hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                  📍 Ya llegué
                </button>
              )}
              {workStatus === 'arrived' && (
                <button onClick={() => updateWorkStatus('in_progress')}
                  className="col-span-2 bg-purple-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                  🔧 Iniciar trabajo
                </button>
              )}
              {workStatus === 'in_progress' && (
                <button onClick={() => updateWorkStatus('completed')}
                  className="col-span-2 bg-green-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                  ✅ Marcar como completado
                </button>
              )}
            </div>
          </div>
        )}

        {/* Acciones del Cliente */}
        {isPoster && workStatus === 'in_progress' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">¿El trabajo ya terminó?</p>
            <button onClick={() => updateWorkStatus('completed')}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
              ✅ Confirmar trabajo completado
            </button>
          </div>
        )}

        {/* Completado */}
        {workStatus === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-bold text-green-800 text-lg">¡Trabajo completado!</p>
            <p className="text-sm text-green-600 mt-1">
              {isPoster ? 'El pago fue liberado al Fixer.' : `Ganaste $${taskerEarns?.toFixed(2)}.`}
            </p>
            {!showReview && (
              <button onClick={() => setShowReview(true)}
                className="mt-3 text-sm text-green-700 underline font-medium">
                Dejar una reseña →
              </button>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Send size={15} className="text-gray-500" />
            <span className="font-semibold text-gray-800 text-sm">Chat del trabajo</span>
          </div>
          <div className="h-72 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-300 text-3xl mb-2">💬</p>
                <p className="text-gray-400 text-sm">Escribe el primer mensaje</p>
              </div>
            )}
            {messages.map((msg: any) => {
              const isMe = msg.sender_id === currentUser?.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <button type="submit" disabled={!newMessage.trim()}
              className="bg-orange-500 text-white p-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">
              <Send size={16} />
            </button>
          </form>
        </div>

      </div>

      {/* Modal: Ver contrato completo */}
      {showContract && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-orange-500" />
                <span className="font-bold text-gray-900">Contrato de Servicio</span>
              </div>
              <button onClick={() => setShowContract(false)}>
                <X size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">

              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-xs text-orange-600 font-bold uppercase tracking-wide">TECONEX · Acuerdo de Servicio</p>
                <p className="text-xs text-gray-400 mt-1">#{contract.id?.substring(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{new Date(contract.created_at).toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-start py-2 border-b border-gray-100">
                  <span className="text-gray-500">Servicio</span>
                  <span className="font-semibold text-right max-w-48">{task?.title}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Cliente</span>
                  <span className="font-semibold">{posterProfile?.full_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Proveedor (Fixer)</span>
                  <span className="font-semibold">{taskerProfile?.full_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Precio acordado</span>
                  <span className="font-black text-lg text-gray-900">${contract.agreed_price?.toLocaleString()}</span>
                </div>
                {task?.location_zone && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-500">Zona</span>
                    <span className="font-semibold flex items-center gap-1"><MapPin size={12} />{task.location_zone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Estado</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                    workStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {STEPS.find(s => s.key === workStatus)?.icon} {STEPS.find(s => s.key === workStatus)?.label}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
                <p className="font-semibold text-gray-700 mb-2">Términos del servicio</p>
                <p>• El precio acordado de <strong>${contract.agreed_price}</strong> es fijo y no puede modificarse sin acuerdo de ambas partes.</p>
                <p>• El pago se libera al Fixer una vez el cliente confirma la finalización del trabajo.</p>
                <p>• TECONEX cobra un {contract.service_fee_pct}% de comisión al Fixer como fee de plataforma.</p>
                <p>• Cualquier disputa debe reportarse a soporte dentro de las 24h siguientes.</p>
                <p>• Al aceptar la oferta, ambas partes aceptan estos términos.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Cliente</p>
                  <p className="font-semibold text-gray-700 text-sm">{posterProfile?.full_name?.split(' ')[0]}</p>
                  <CheckCircle size={16} className="text-green-500 mx-auto mt-1" />
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Fixer</p>
                  <p className="font-semibold text-gray-700 text-sm">{taskerProfile?.full_name?.split(' ')[0]}</p>
                  <CheckCircle size={16} className="text-green-500 mx-auto mt-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review */}
      {showReview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">⭐</div>
              <h3 className="font-bold text-gray-900 text-lg">¿Cómo estuvo el servicio?</h3>
              <p className="text-sm text-gray-400 mt-1">Tu reseña ayuda a la comunidad</p>
            </div>
            <div className="flex justify-center gap-2 mb-5">
              {[1,2,3,4,5].map(i => (
                <button key={i} onClick={() => setRating(i)}>
                  <Star size={32} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Cuéntanos cómo fue la experiencia... (opcional)"
              rows={3}
              className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-sm outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 text-sm">
                Omitir
              </button>
              <button onClick={submitReview} disabled={submittingReview}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-60 text-sm">
                {submittingReview ? 'Enviando...' : 'Enviar reseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
