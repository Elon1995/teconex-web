'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { ArrowLeft, ArrowRight, MapPin, Calendar, Image, DollarSign, Check } from 'lucide-react'

const CATEGORIES = [
  { name: 'Aire Acondicionado', icon: '❄️', slug: 'aire-acondicionado' },
  { name: 'Plomería', icon: '🔧', slug: 'plomeria' },
  { name: 'Electricidad', icon: '⚡', slug: 'electricidad' },
  { name: 'Limpieza', icon: '🧹', slug: 'limpieza' },
  { name: 'Mudanzas', icon: '📦', slug: 'mudanzas' },
  { name: 'Pintura', icon: '🖌️', slug: 'pintura' },
  { name: 'Construcción', icon: '🏗️', slug: 'construccion' },
  { name: 'Mover Muebles', icon: '🛋️', slug: 'mover-muebles' },
  { name: 'Jardinería', icon: '🌿', slug: 'jardineria' },
  { name: 'Ayuda Digital', icon: '💻', slug: 'ayuda-digital' },
  { name: 'Asistencia Personal', icon: '🤝', slug: 'asistencia-personal' },
  { name: 'Otro', icon: '⚙️', slug: 'otro' },
]

const STEPS = ['Qué necesitas', 'Ubicación', 'Detalles', 'Presupuesto']

function PostTaskForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: searchParams.get('title') || '',
    category: '',
    date_type: 'flexible' as 'specific' | 'before' | 'flexible',
    task_date: '',
    is_remote: false,
    location_text: '',
    location_zone: '',
    description: '',
    budget: '',
  })

  const next = () => setStep(s => Math.min(s + 1, 3))
  const back = () => setStep(s => Math.max(s - 1, 0))

  const canNext = () => {
    if (step === 0) return form.title.length > 3
    if (step === 1) return form.is_remote || form.location_zone.length > 2
    if (step === 2) return form.description.length > 10
    return true
  }

  const publishTask = async (userId: string) => {
    const { data, error } = await supabase.from('tasks').insert({
      poster_id: userId,
      title: form.title,
      description: form.description,
      budget: form.budget ? parseFloat(form.budget) : null,
      location_text: form.location_text,
      location_zone: form.location_zone,
      is_remote: form.is_remote,
      date_type: form.date_type,
      task_date: form.task_date || null,
      status: 'open',
    }).select().single()
    if (!error && data) router.push(`/tasks/${data.id}`)
    return { data, error }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Guardar tarea en localStorage y redirigir a auth
      localStorage.setItem('pending_task', JSON.stringify(form))
      router.push('/auth?tab=register&next=post-task')
      return
    }
    await publishTask(user.id)
    setLoading(false)
  }

  // Al cargar, verificar si hay una tarea pendiente y el usuario acaba de autenticarse
  useEffect(() => {
    const checkPendingTask = async () => {
      const pending = localStorage.getItem('pending_task')
      if (!pending) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const savedForm = JSON.parse(pending)
      localStorage.removeItem('pending_task')
      setForm(savedForm)
      // Publicar automáticamente
      const { data, error } = await supabase.from('tasks').insert({
        poster_id: user.id,
        title: savedForm.title,
        description: savedForm.description,
        budget: savedForm.budget ? parseFloat(savedForm.budget) : null,
        location_text: savedForm.location_text,
        location_zone: savedForm.location_zone,
        is_remote: savedForm.is_remote,
        date_type: savedForm.date_type,
        task_date: savedForm.task_date || null,
        status: 'open',
      }).select().single()
      if (!error && data) router.push(`/tasks/${data.id}`)
    }
    checkPendingTask()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{s}</span>
                {i < 3 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {/* STEP 0: Qué necesitas */}
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Comencemos por lo básico</h2>
              <p className="text-gray-500 mb-6">¿En pocas palabras, qué necesitas que se haga?</p>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Ej: Instalar aire acondicionado de 18,000 BTU"
                className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-4 text-base outline-none transition-colors" />

              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Categoría (opcional)</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.slug} type="button" onClick={() => setForm({...form, category: c.slug})}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${form.category === c.slug ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-xl">{c.icon}</div>
                      <div className="text-xs text-gray-700 mt-1 leading-tight">{c.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-3">¿Cuándo necesitas esto?</p>
                <div className="flex gap-2">
                  {([['specific','En fecha específica'],['before','Antes de una fecha'],['flexible','Soy flexible']] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setForm({...form, date_type: val})}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${form.date_type === val ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.date_type !== 'flexible' && (
                  <input type="date" value={form.task_date} onChange={e => setForm({...form, task_date: e.target.value})}
                    className="mt-3 w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none" />
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Ubicación */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Dinos dónde</h2>
              <p className="text-gray-500 mb-6">¿El técnico necesita estar físicamente presente?</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button type="button" onClick={() => setForm({...form, is_remote: false})}
                  className={`p-5 rounded-xl border-2 text-center transition-all ${!form.is_remote ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 hover:border-gray-300'}`}>
                  <MapPin className="mx-auto mb-2" size={24} />
                  <div className="font-semibold text-sm">En persona</div>
                  <div className={`text-xs mt-1 ${!form.is_remote ? 'text-blue-100' : 'text-gray-400'}`}>El técnico va a tu lugar</div>
                </button>
                <button type="button" onClick={() => setForm({...form, is_remote: true})}
                  className={`p-5 rounded-xl border-2 text-center transition-all ${form.is_remote ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-2xl block mb-2">💻</span>
                  <div className="font-semibold text-sm">En línea</div>
                  <div className={`text-xs mt-1 ${form.is_remote ? 'text-blue-100' : 'text-gray-400'}`}>Puede hacerse de forma remota</div>
                </button>
              </div>
              {!form.is_remote && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barrio o zona *</label>
                    <input type="text" value={form.location_zone} onChange={e => setForm({...form, location_zone: e.target.value})}
                      placeholder="Ej: San Francisco, Miraflores, Bella Vista..."
                      className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección exacta (opcional)</label>
                    <input type="text" value={form.location_text} onChange={e => setForm({...form, location_text: e.target.value})}
                      placeholder="Se compartirá solo cuando se asigne el técnico"
                      className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: Detalles */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Proporciona más detalles</h2>
              <p className="text-gray-500 mb-6">Más detalles = mejores ofertas más rápido</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Cuáles son los detalles? *</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Ej: Tengo un mini split LG de 18,000 BTU que necesito instalar en un cuarto de 4x4. El cuarto está en el segundo piso..."
                  rows={5}
                  className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none resize-none" />
                <div className="text-xs text-gray-400 mt-1 text-right">{form.description.length} caracteres</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agregar imágenes (opcional)</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer">
                  <span className="text-3xl">📷</span>
                  <p className="text-sm text-gray-500 mt-2">Arrastra fotos aquí o haz click para seleccionar</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG hasta 5MB c/u</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Presupuesto */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¿Cuál es tu presupuesto?</h2>
              <p className="text-gray-500 mb-6">Los técnicos verán esto y harán sus ofertas. Puedes negociar después.</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">$</span>
                <input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl pl-10 pr-4 py-4 text-2xl font-bold outline-none" />
              </div>
              <p className="text-xs text-gray-400 mt-2">Deja en $0 si no sabes cuánto cuesta — los técnicos te harán sus propuestas</p>

              <div className="mt-6 bg-blue-50 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Resumen de tu tarea</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tarea</span>
                    <span className="font-medium text-gray-900">{form.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ubicación</span>
                    <span className="font-medium text-gray-900">{form.is_remote ? 'En línea' : form.location_zone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha</span>
                    <span className="font-medium text-gray-900">
                      {form.date_type === 'flexible' ? 'Flexible' : form.task_date || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            <button onClick={back} disabled={step === 0}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 disabled:opacity-0 font-medium">
              <ArrowLeft size={16} /> Atrás
            </button>
            {step < 3 ? (
              <button onClick={next} disabled={!canNext()}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                Siguiente <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {loading ? 'Publicando...' : '🚀 Publicar tarea'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostTaskPage() {
  return <Suspense><PostTaskForm /></Suspense>
}
