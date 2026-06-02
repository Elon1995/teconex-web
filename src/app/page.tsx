'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Clock, DollarSign, Star, ArrowRight, CheckCircle, Shield, Zap, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  { name: 'Aire Acondicionado', icon: '❄️', slug: 'aire-acondicionado', img: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&q=80' },
  { name: 'Plomería', icon: '🔧', slug: 'plomeria', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80' },
  { name: 'Electricidad', icon: '⚡', slug: 'electricidad', img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80' },
  { name: 'Limpieza', icon: '🧹', slug: 'limpieza', img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80' },
  { name: 'Mudanzas', icon: '📦', slug: 'mudanzas', img: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400&q=80' },
  { name: 'Pintura', icon: '🖌️', slug: 'pintura', img: 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=400&q=80' },
  { name: 'Construcción', icon: '🏗️', slug: 'construccion', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80' },
  { name: 'Mover Muebles', icon: '🛋️', slug: 'mover-muebles', img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80' },
  { name: 'Jardinería', icon: '🌿', slug: 'jardineria', img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80' },
  { name: 'Ayuda Digital', icon: '💻', slug: 'ayuda-digital', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80' },
  { name: 'Proyectos de Construcción', icon: '🏢', slug: 'proyectos-construccion', img: 'https://images.unsplash.com/photo-1590725140246-20acddc1ec6d?w=400&q=80' },
  { name: 'Asistencia Personal', icon: '🤝', slug: 'asistencia-personal', img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=80' },
]

const QUICK_SEARCHES = [
  'Reparar lavadora', 'Limpieza de hogar', 'Mudanza',
  'Instalar aire acondicionado', 'Ayuda digital', 'Pintura de habitación'
]

const HOW_IT_WORKS = [
  { step: '1', icon: '📝', title: 'Publica tu tarea', desc: 'Describe lo que necesitas en segundos. Es gratis y recibirás ofertas rápido.' },
  { step: '2', icon: '💬', title: 'Recibe ofertas', desc: 'Técnicos verificados en tu zona envían sus precios y mensajes.' },
  { step: '3', icon: '✅', title: 'Elige y listo', desc: 'Selecciona al mejor, coordina por chat y paga de forma segura al completar.' },
]

const TRUST_FEATURES = [
  { icon: <Shield className="text-blue-600" size={28} />, title: 'Pagos seguros', desc: 'El dinero se libera solo cuando el trabajo está completado a tu satisfacción.' },
  { icon: <Star className="text-yellow-500" size={28} />, title: 'Reseñas verificadas', desc: 'Ratings reales de clientes anteriores para que elijas con confianza.' },
  { icon: <Zap className="text-green-500" size={28} />, title: 'Respuesta rápida', desc: 'Recibe hasta 5 ofertas de técnicos disponibles en menos de 30 minutos.' },
]

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*, profiles(full_name, avatar_url), categories(name, icon)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setTasks(data) })
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/post-task?title=${encodeURIComponent(search)}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* HERO */}
      <section className="bg-blue-600 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Publica una tarea.<br />Resuélvela.
          </h1>
          <p className="text-blue-100 text-lg md:text-xl mb-10">
            ¿Qué necesitas resolver hoy? Describe tu tarea y recibe<br className="hidden md:block" /> ofertas de proveedores cercanos en minutos.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mx-auto bg-white rounded-2xl p-2 shadow-xl">
            <div className="flex items-center gap-3 flex-1 px-2">
              <Search className="text-gray-400 flex-shrink-0" size={20} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="En pocas palabras, ¿qué necesitas?"
                className="w-full text-gray-800 outline-none text-base"
              />
            </div>
            <button type="submit" className="bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 whitespace-nowrap">
              Recibir ofertas <ArrowRight size={16} />
            </button>
          </form>

          {/* Botón servicio inmediato */}
          <div className="mt-4">
            <Link href="/instant"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-orange-400/30">
              <Zap size={18} /> ⚡ Resuelve — alguien llega en minutos
            </Link>
          </div>

          {/* Quick searches */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {QUICK_SEARCHES.map(q => (
              <button key={q} onClick={() => router.push(`/post-task?title=${encodeURIComponent(q)}`)}
                className="bg-blue-500 bg-opacity-50 hover:bg-opacity-70 text-white text-sm px-4 py-1.5 rounded-full transition-colors border border-blue-400">
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-white border-b border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: '2,450+', label: 'Proveedores activos' },
            { num: '12,800+', label: 'Solicitudes publicadas' },
            { num: '9,600+', label: 'Trabajos completados' },
            { num: '4.8 ⭐', label: 'Calificación promedio' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">{s.num}</div>
              <div className="text-gray-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Nuestras categorías</h2>
          <p className="text-gray-500 mb-8">Encuentra el servicio que necesitas en Panamá</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {CATEGORIES.map(cat => (
              <Link key={cat.slug} href={`/tasks?category=${cat.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-blue-200">
                <div className="relative h-24 overflow-hidden">
                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-2xl">{cat.icon}</span>
                </div>
                <div className="p-2 text-center">
                  <span className="text-xs font-semibold text-gray-700 leading-tight">{cat.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TAREAS ACTIVAS */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-gray-500 font-medium">Solicitudes activas ahora mismo</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Trabajos disponibles</h2>
            </div>
            <Link href="/tasks" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Skeleton cards */}
              {[1,2,3].map(i => (
                <div key={i} className="bg-gray-50 rounded-2xl p-5 animate-pulse h-40" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <Link key={task.id} href={`/tasks/${task.id}`}
                  className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-blue-200 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {task.categories?.icon || '🔧'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {task.location_zone && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{task.location_zone}</span>
                        )}
                        {task.budget && (
                          <span className="flex items-center gap-1 font-semibold text-gray-700">
                            <DollarSign size={11} />{task.budget.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(task.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      task.offers_count > 0 ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {task.offers_count > 0 ? `${task.offers_count} oferta${task.offers_count > 1 ? 's' : ''}` : 'Abierto'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link href="/post-task"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl">
              Publica tu tarea gratis <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">¿Cómo funciona?</h2>
          <p className="text-gray-500 mb-10">Tres simples pasos para resolver cualquier tarea</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-5xl mb-4">{s.icon}</div>
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">Tu seguridad, nuestra prioridad</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRUST_FEATURES.map(f => (
              <div key={f.title} className="flex gap-4 p-6 bg-gray-50 rounded-2xl">
                <div className="flex-shrink-0">{f.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA TÉCNICO */}
      <section className="py-16 px-4 bg-gray-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">¿Eres técnico o prestador de servicios?</h2>
          <p className="text-gray-400 mb-8">Recibe solicitudes de clientes en tu zona sin pagar suscripción. Tú propones tu precio.</p>
          <Link href="/auth?tab=register&role=tasker"
            className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-colors">
            Empieza a ganar dinero <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">ST</span>
              </div>
              <span className="text-white font-semibold">Soluciones Técnicas</span>
            </div>
            <p className="text-sm">Marketplace de servicios técnicos en Panamá.</p>
          </div>
          <div className="flex gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <span className="text-white font-semibold mb-1">Plataforma</span>
              <Link href="/tasks" className="hover:text-white">Explorar tareas</Link>
              <Link href="/post-task" className="hover:text-white">Publicar tarea</Link>
              <Link href="/how-it-works" className="hover:text-white">Cómo funciona</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-white font-semibold mb-1">Empresa</span>
              <Link href="/about" className="hover:text-white">Sobre nosotros</Link>
              <Link href="/terms" className="hover:text-white">Términos</Link>
              <Link href="/privacy" className="hover:text-white">Privacidad</Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-800 text-xs text-center">
          © 2026 Soluciones Técnicas. Todos los derechos reservados. Panamá.
        </div>
      </footer>
    </div>
  )
}
