'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { MapPin, Clock, DollarSign, ArrowLeft, Star, CheckCircle, Send, X, MessageSquare, Phone } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'open', label: 'Abierta' },
  { key: 'assigned', label: 'Asignada' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'completed', label: 'Completada' },
]

function StarRating({ value, onChange }: { value: number, onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star size={20} className={i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [offers, setOffers] = useState<any[]>([])
  const [contract, setContract] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [offerForm, setOfferForm] = useState({ price: '', message: '' })
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: '' })
  const [newMessage, setNewMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [myOffer, setMyOffer] = useState<any>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadAll() }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime messages
  useEffect(() => {
    if (!contract) return
    const channel = supabase.channel(`messages-${contract.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contract_id=eq.${contract.id}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contract])

  const loadAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const [{ data: taskData }, { data: offersData }] = await Promise.all([
      supabase.from('tasks').select('*, profiles(id, full_name, avg_rating, avatar_url, zone, whatsapp), categories(name, icon, slug)').eq('id', id).single(),
      supabase.from('offers').select('*, profiles(id, full_name, avg_rating, avatar_url, zone, total_completed, total_reviews, bio)').eq('task_id', id).order('created_at', { ascending: true }),
    ])
    setTask(taskData)
    setOffers(offersData || [])
    if (user && offersData) setMyOffer(offersData.find((o: any) => o.tasker_id === user.id) || null)

    // Buscar contrato activo
    if (taskData?.status !== 'open') {
      const { data: contractData } = await supabase.from('contracts').select('*').eq('task_id', id).single()
      if (contractData) {
        setContract(contractData)
        const { data: msgs } = await supabase.from('messages').select('*, profiles(full_name)').eq('contract_id', contractData.id).order('created_at')
        setMessages(msgs || [])
      }
    }
    setLoading(false)
  }

  const handleOffer = async () => {
    if (!currentUser) { router.push('/auth'); return }
    setSubmitting(true)
    await supabase.from('offers').insert({
      task_id: id, tasker_id: currentUser.id,
      price: parseFloat(offerForm.price), message: offerForm.message,
    })
    setShowOfferModal(false)
    setOfferForm({ price: '', message: '' })
    loadAll()
    setSubmitting(false)
  }

  const handleAcceptOffer = async (offer: any) => {
    setAcceptingId(offer.id)

    // 1. Actualizar task
    const { error: taskErr } = await supabase.from('tasks')
      .update({ status: 'assigned', assigned_tasker_id: offer.tasker_id })
      .eq('id', id)
    if (taskErr) console.error('task update error:', taskErr)

    // 2. Actualizar ofertas
    await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id)
    await supabase.from('offers').update({ status: 'rejected' }).eq('task_id', id).neq('id', offer.id)

    // 3. Crear contrato
    const { data: newContract, error: contractErr } = await supabase.from('contracts').insert({
      task_id: id, offer_id: offer.id,
      poster_id: currentUser.id, tasker_id: offer.tasker_id,
      agreed_price: offer.price, service_fee_pct: 20,
    }).select().single()
    if (contractErr) console.error('contract error:', contractErr)

    // 4. Notificaciones + mensaje inicial
    if (newContract) {
      const taskerName = offer.profiles?.full_name?.split(' ')[0] || 'técnico'
      await Promise.all([
        supabase.from('notifications').insert({
          user_id: offer.tasker_id, type: 'offer_accepted',
          title: '🎉 ¡Tu oferta fue aceptada!',
          body: `Tu oferta de $${offer.price} para "${task.title}" fue aceptada.`,
          data: { task_id: id, contract_id: newContract.id },
        }),
        supabase.from('notifications').insert({
          user_id: currentUser.id, type: 'offer_accepted',
          title: '✅ Técnico asignado',
          body: `Has asignado a ${offer.profiles?.full_name} para "${task.title}".`,
          data: { task_id: id, contract_id: newContract.id },
        }),
        supabase.from('messages').insert({
          contract_id: newContract.id, sender_id: currentUser.id,
          content: `👋 ¡Hola ${taskerName}! Acepté tu oferta de $${offer.price}. ¿Cuándo puedes comenzar?`,
        }),
      ])
      // Actualizar estado local directamente sin esperar reload
      setContract(newContract)
      const { data: msgs } = await supabase.from('messages')
        .select('*, profiles(full_name)').eq('contract_id', newContract.id).order('created_at')
      setMessages(msgs || [])
    }

    setAcceptingId(null)
    if (newContract) {
      router.push(`/contrato/${newContract.id}`)
    } else {
      setSuccessMsg(`🎉 ¡${offer.profiles?.full_name?.split(' ')[0]} asignado! Coordina por el chat de abajo.`)
      setTimeout(() => setSuccessMsg(''), 6000)
      await loadAll()
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !contract) return
    const msg = newMessage.trim()
    setNewMessage('')
    await supabase.from('messages').insert({ contract_id: contract.id, sender_id: currentUser.id, content: msg })
  }

  const handleCompleteTask = async () => {
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', id)
    await supabase.from('contracts').update({ payment_status: 'released', completed_at: new Date().toISOString() }).eq('id', contract?.id)
    setShowReviewModal(true)
    loadAll()
  }

  const handleSubmitReview = async () => {
    const revieweeId = isPoster ? contract?.tasker_id : contract?.poster_id
    await supabase.from('reviews').insert({
      contract_id: contract?.id, reviewer_id: currentUser.id,
      reviewee_id: revieweeId, overall_rating: reviewForm.rating,
      text: reviewForm.text, is_published: true,
    })
    // Actualizar avg_rating del perfil
    const { data: reviews } = await supabase.from('reviews').select('overall_rating').eq('reviewee_id', revieweeId)
    if (reviews?.length) {
      const avg = reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length
      await supabase.from('profiles').update({ avg_rating: avg, total_reviews: reviews.length }).eq('id', revieweeId)
    }
    setShowReviewModal(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="bg-white rounded-2xl h-64 border border-gray-100" />
      </div>
    </div>
  )

  if (!task) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Tarea no encontrada</p>
        <Link href="/tasks" className="text-blue-600 mt-4 inline-block">← Ver todas las tareas</Link>
      </div>
    </div>
  )

  const isPoster = currentUser?.id === task.poster_id
  const isTasker = currentUser && !isPoster
  const canOffer = isTasker && task.status === 'open' && !myOffer
  const isAssigned = task.status === 'assigned' || task.status === 'in_progress'
  const statusIndex = STATUS_STEPS.findIndex(s => s.key === task.status)
  const assignedOffer = offers.find(o => o.status === 'accepted')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/tasks" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4 w-fit">
          <ArrowLeft size={16} /> Volver
        </Link>

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 font-medium flex items-center gap-2">
            <CheckCircle size={18} /> {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Task info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                  {task.categories?.icon || '🔧'}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{task.categories?.name}</span>
                  <h1 className="text-xl font-bold text-gray-900 mt-2">{task.title}</h1>
                  {/* Status bar */}
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {STATUS_STEPS.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${i <= statusIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        <span className={`text-xs ${i === statusIndex ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{s.label}</span>
                        {i < STATUS_STEPS.length - 1 && <div className={`w-5 h-0.5 ${i < statusIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                {task.location_zone && <span className="flex items-center gap-1.5"><MapPin size={14} />{task.location_zone}</span>}
                {task.is_remote && <span>💻 En línea</span>}
                {task.task_date && <span className="flex items-center gap-1.5"><Clock size={14} />{new Date(task.task_date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
                {task.date_type === 'flexible' && <span className="flex items-center gap-1.5"><Clock size={14} />Fecha flexible</span>}
              </div>
              {task.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
                </div>
              )}
            </div>

            {/* Chat (solo cuando hay contrato) */}
            {contract && (currentUser?.id === contract.poster_id || currentUser?.id === contract.tasker_id) && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-blue-50">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-600" />
                    <span className="font-semibold text-gray-900 text-sm">Chat del trabajo</span>
                  </div>
                  {assignedOffer?.profiles?.whatsapp && (
                    <a href={`https://wa.me/507${assignedOffer.profiles.whatsapp}`} target="_blank"
                      className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100">
                      <Phone size={12} /> WhatsApp
                    </a>
                  )}
                </div>
                <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-8">Ningún mensaje aún. ¡Di hola! 👋</p>
                  )}
                  {messages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${msg.sender_id === currentUser?.id ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
                  <button type="submit" disabled={!newMessage.trim()}
                    className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* Ofertas */}
            {(!contract || isPoster) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-bold text-gray-900 mb-4">
                  Ofertas <span className="text-gray-400 font-normal text-sm">({offers.length})</span>
                </h2>
                {offers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-gray-500 text-sm">Aún no hay ofertas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {offers.map(offer => (
                      <div key={offer.id} className={`p-4 rounded-xl border-2 transition-all ${offer.status === 'accepted' ? 'border-green-400 bg-green-50' : offer.status === 'rejected' ? 'border-gray-100 opacity-50' : 'border-gray-100 hover:border-blue-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 flex-shrink-0 text-lg">
                              {offer.profiles?.full_name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{offer.profiles?.full_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StarRating value={Math.round(offer.profiles?.avg_rating || 0)} />
                                <span className="text-xs text-gray-400">
                                  {offer.profiles?.total_reviews > 0 ? `${offer.profiles.total_reviews} reseñas` : 'Nuevo'}
                                </span>
                                {offer.profiles?.total_completed > 0 && (
                                  <span className="text-xs text-gray-400">· {offer.profiles.total_completed} trabajos</span>
                                )}
                              </div>
                              {offer.profiles?.zone && <p className="text-xs text-gray-400 mt-0.5"><MapPin size={9} className="inline mr-0.5" />{offer.profiles.zone}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xl font-bold text-gray-900">${offer.price?.toLocaleString()}</p>
                            {offer.status === 'accepted' && (
                              <span className="text-xs text-green-600 font-semibold flex items-center gap-1 justify-end">
                                <CheckCircle size={11} /> Aceptada
                              </span>
                            )}
                          </div>
                        </div>
                        {offer.profiles?.bio && <p className="text-xs text-gray-500 mt-2 italic">"{offer.profiles.bio}"</p>}
                        {offer.message && <p className="text-sm text-gray-600 mt-2 leading-relaxed bg-gray-50 p-3 rounded-xl">{offer.message}</p>}

                        {isPoster && task.status === 'open' && offer.status === 'pending' && (
                          <button onClick={() => handleAcceptOffer(offer)} disabled={acceptingId === offer.id}
                            className="mt-3 w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                            {acceptingId === offer.id ? 'Asignando...' : `✅ Aceptar oferta de ${offer.profiles?.full_name?.split(' ')[0]}`}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botón completar trabajo */}
            {isPoster && isAssigned && contract && (
              <button onClick={handleCompleteTask}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 transition-colors">
                ✅ Marcar trabajo como completado
              </button>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Presupuesto</p>
              {task.budget > 0 ? (
                <p className="text-3xl font-bold text-gray-900">${task.budget?.toLocaleString()}</p>
              ) : (
                <p className="text-gray-500 text-sm">A convenir</p>
              )}
            </div>

            {/* CTA oferta */}
            {!currentUser ? (
              <Link href="/auth?tab=register&role=tasker"
                className="block w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-center hover:bg-blue-700">
                Regístrate para ofertar
              </Link>
            ) : canOffer ? (
              <button onClick={() => setShowOfferModal(true)}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700">
                Hacer una oferta
              </button>
            ) : myOffer && myOffer.status === 'pending' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <CheckCircle className="mx-auto text-blue-600 mb-1" size={20} />
                <p className="text-sm font-semibold text-blue-700">Tu oferta: ${myOffer.price?.toLocaleString()}</p>
                <p className="text-xs text-blue-500 mt-0.5">Esperando respuesta del cliente</p>
              </div>
            ) : myOffer?.status === 'accepted' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle className="mx-auto text-green-600 mb-1" size={20} />
                <p className="text-sm font-semibold text-green-700">¡Tu oferta fue aceptada!</p>
                <p className="text-xs text-green-500 mt-0.5">Coordina por el chat</p>
              </div>
            ) : null}

            {/* Poster info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Publicado por</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                  {task.profiles?.full_name?.[0] || '?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{task.profiles?.full_name}</p>
                  {task.profiles?.zone && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{task.profiles.zone}</p>}
                  {task.profiles?.avg_rating > 0 && <StarRating value={Math.round(task.profiles.avg_rating)} />}
                </div>
              </div>
            </div>

            {/* Técnico asignado */}
            {assignedOffer && (
              <div className="bg-white rounded-2xl border border-green-200 p-5">
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-3">Técnico asignado</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-600">
                    {assignedOffer.profiles?.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{assignedOffer.profiles?.full_name}</p>
                    <StarRating value={Math.round(assignedOffer.profiles?.avg_rating || 0)} />
                    <p className="text-xs text-gray-400">{assignedOffer.profiles?.total_completed || 0} trabajos completados</p>
                  </div>
                </div>
                {assignedOffer.profiles?.whatsapp && (
                  <a href={`https://wa.me/507${assignedOffer.profiles.whatsapp}`} target="_blank"
                    className="mt-3 flex items-center justify-center gap-2 w-full bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600">
                    <Phone size={15} /> Contactar por WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal hacer oferta */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Hacer una oferta</h3>
              <button onClick={() => setShowOfferModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tu precio</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input type="number" value={offerForm.price} onChange={e => setOfferForm({...offerForm, price: e.target.value})}
                  placeholder="0.00" className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl pl-8 pr-4 py-3 text-xl font-bold outline-none" />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje al cliente</label>
              <textarea value={offerForm.message} onChange={e => setOfferForm({...offerForm, message: e.target.value})}
                placeholder="Preséntate y explica tu experiencia con este tipo de trabajo..." rows={4}
                className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none resize-none" />
            </div>
            <button onClick={handleOffer} disabled={!offerForm.price || submitting}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar oferta'}
            </button>
          </div>
        </div>
      )}

      {/* Modal review */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2">¿Cómo fue el trabajo?</h3>
            <p className="text-sm text-gray-500 mb-5">Tu reseña ayuda a otros clientes a elegir con confianza.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Calificación</label>
              <StarRating value={reviewForm.rating} onChange={v => setReviewForm({...reviewForm, rating: v})} />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentario (opcional)</label>
              <textarea value={reviewForm.text} onChange={e => setReviewForm({...reviewForm, text: e.target.value})}
                placeholder="¿Cómo fue la experiencia? ¿Lo recomendarías?" rows={3}
                className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50">
                Después
              </button>
              <button onClick={handleSubmitReview} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700">
                Enviar reseña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
