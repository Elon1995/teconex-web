'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Clock, Map, List } from 'lucide-react'

const CATEGORIES = [
  { name: 'Todos', slug: '' },
  { name: '❄️ Aire AC', slug: 'aire-acondicionado' },
  { name: '🔧 Plomería', slug: 'plomeria' },
  { name: '⚡ Electricidad', slug: 'electricidad' },
  { name: '🧹 Limpieza', slug: 'limpieza' },
  { name: '📦 Mudanzas', slug: 'mudanzas' },
  { name: '🖌️ Pintura', slug: 'pintura' },
  { name: '🏗️ Construcción', slug: 'construccion' },
  { name: '💻 Digital', slug: 'ayuda-digital' },
]

function TaskCard({ task }: { task: any }) {
  return (
    <Link href={`/tasks/${task.id}`}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all group block">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 text-sm leading-snug">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
            {task.location_zone && <span className="flex items-center gap-1"><MapPin size={10} />{task.location_zone}</span>}
            {task.is_remote && <span>💻 En línea</span>}
            {task.task_date && <span className="flex items-center gap-1"><Clock size={10} />{new Date(task.task_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>}
            {task.date_type === 'flexible' && <span>Flexible</span>}
          </div>
        </div>
        {task.budget > 0 && <p className="text-base font-bold text-gray-900 flex-shrink-0">${task.budget?.toLocaleString()}</p>}
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
            {task.profiles?.full_name?.[0] || '?'}
          </div>
          <span className="text-xs text-gray-400">{task.profiles?.full_name?.split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${task.offers_count > 0 ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
            {task.offers_count > 0 ? `${task.offers_count} oferta${task.offers_count > 1 ? 's' : ''}` : 'Nuevo'}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Abierta</span>
        </div>
      </div>
    </Link>
  )
}

function TasksFeed() {
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [sortBy, setSortBy] = useState('newest')
  const [view, setView] = useState<'list' | 'split'>('split')

  useEffect(() => { loadTasks() }, [category, sortBy])

  const loadTasks = async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*, profiles(full_name, avg_rating), categories(name, icon, slug)')
      .eq('status', 'open')
    if (category) query = query.eq('categories.slug', category)
    if (search) query = query.ilike('title', `%${search}%`)
    if (sortBy === 'newest') query = query.order('created_at', { ascending: false })
    if (sortBy === 'budget_high') query = query.order('budget', { ascending: false })
    if (sortBy === 'budget_low') query = query.order('budget', { ascending: true })
    const { data } = await query.limit(50)
    setTasks(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 py-3 px-4 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto">
          <form onSubmit={e => { e.preventDefault(); loadTasks() }} className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={15} className="text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tareas..." className="flex-1 bg-transparent text-sm outline-none text-gray-700" />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none text-gray-700 hidden sm:block">
              <option value="newest">Más recientes</option>
              <option value="budget_high">Mayor presupuesto</option>
              <option value="budget_low">Menor presupuesto</option>
            </select>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setView('list')} title="Lista"
                className={`px-3 py-2 transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                <List size={16} />
              </button>
              <button type="button" onClick={() => setView('split')} title="Mapa"
                className={`px-3 py-2 transition-colors ${view === 'split' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                <Map size={16} />
              </button>
            </div>
            <Link href="/post-task" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 whitespace-nowrap hidden sm:block">
              + Publicar
            </Link>
          </form>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map(c => (
              <button key={c.slug} onClick={() => setCategory(c.slug)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-all ${category === c.slug ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'split' ? (
        <div className="flex" style={{ height: 'calc(100vh - 130px)' }}>
          {/* Lista */}
          <div className="w-full md:w-96 lg:w-[440px] overflow-y-auto flex-shrink-0 border-r border-gray-200 bg-white">
            <div className="p-3 space-y-2">
              <p className="text-xs text-gray-400 px-1 py-1">{loading ? 'Buscando...' : `${tasks.length} tareas disponibles`}</p>
              {loading ? [1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />) :
               tasks.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-gray-500 text-sm mb-4">No hay tareas disponibles</p>
                  <Link href="/post-task" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Publicar tarea</Link>
                </div>
               ) : tasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          </div>

          {/* Mapa */}
          <div className="hidden md:block flex-1 relative bg-gray-100 overflow-hidden">
            {/* Fondo del mapa — OpenStreetMap estático de Panamá */}
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=-80.1,-9.2,-77.1,9.6&layer=mapnik"
              className="w-full h-full border-0 opacity-80"
              title="Mapa Panamá"
            />
            {/* Pins sobre el mapa */}
            <div className="absolute inset-0 pointer-events-none">
              {tasks.slice(0, 12).map((task, i) => (
                <Link key={task.id} href={`/tasks/${task.id}`}
                  style={{ position: 'absolute', left: `${15 + (i * 41 % 68)}%`, top: `${10 + (i * 37 % 72)}%`, pointerEvents: 'auto' }}
                  className="transform -translate-x-1/2 -translate-y-1/2 hover:z-10 group">
                  <div className="bg-white rounded-lg shadow-md px-2.5 py-1 border-2 border-blue-600 group-hover:bg-blue-600 transition-colors whitespace-nowrap">
                    <span className="text-xs font-bold text-blue-600 group-hover:text-white">
                      {task.budget > 0 ? `$${task.budget}` : '💬'}
                    </span>
                  </div>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-600 mx-auto group-hover:border-t-blue-600" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-5">
          <p className="text-sm text-gray-400 mb-4">{loading ? 'Buscando...' : `${tasks.length} tareas disponibles`}</p>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white rounded-xl h-36 animate-pulse border border-gray-100" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-semibold text-gray-700 mb-4">No hay tareas disponibles</p>
              <Link href="/post-task" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 inline-block">Publicar tarea</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  return <Suspense><TasksFeed /></Suspense>
}
