'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { MapPin, Clock, DollarSign, ChevronRight } from 'lucide-react'

const TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Publicadas' },
  { key: 'assigned', label: 'Asignadas' },
  { key: 'offers', label: 'Ofertas enviadas' },
  { key: 'completed', label: 'Completadas' },
]

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-green-50 text-green-700',
  assigned: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta',
  assigned: 'Asignada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export default function MyTasksPage() {
  const router = useRouter()
  const [tab, setTab] = useState('all')
  const [tasks, setTasks] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      loadData(user.id)
    })
  }, [])

  const loadData = async (userId: string) => {
    setLoading(true)
    const [{ data: myTasks }, { data: myOffers }] = await Promise.all([
      supabase.from('tasks').select('*, categories(name, icon)').eq('poster_id', userId).order('created_at', { ascending: false }),
      supabase.from('offers').select('*, tasks(id, title, status, location_zone, budget, categories(name,icon))').eq('tasker_id', userId).order('created_at', { ascending: false }),
    ])
    setTasks(myTasks || [])
    setOffers(myOffers || [])
    setLoading(false)
  }

  const filteredTasks = tab === 'all' ? tasks
    : tab === 'open' ? tasks.filter(t => t.status === 'open')
    : tab === 'assigned' ? tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress')
    : tab === 'completed' ? tasks.filter(t => t.status === 'completed')
    : tasks

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis tareas</h1>
          <Link href="/post-task" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">
            + Publicar tarea
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar mb-6 bg-white border border-gray-200 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
              {t.key === 'open' && tasks.filter(t => t.status === 'open').length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === 'open' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {tasks.filter(t => t.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}
          </div>
        ) : tab === 'offers' ? (
          /* Ofertas enviadas */
          offers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500">No has enviado ofertas aún</p>
              <Link href="/tasks" className="mt-4 inline-block text-blue-600 text-sm font-medium">Explorar tareas disponibles →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map(offer => (
                <Link key={offer.id} href={`/tasks/${offer.tasks?.id}`}
                  className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                      {offer.tasks?.categories?.icon || '🔧'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600">{offer.tasks?.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tu oferta: <span className="font-semibold text-gray-700">${offer.price?.toLocaleString()}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          offer.status === 'accepted' ? 'bg-green-50 text-green-700' :
                          offer.status === 'declined' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {offer.status === 'accepted' ? '✓ Aceptada' : offer.status === 'declined' ? 'Rechazada' : 'Pendiente'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400" />
                </Link>
              ))}
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 mb-4">No tienes tareas en esta categoría</p>
            <Link href="/post-task" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 inline-block">
              Publicar una tarea
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <Link key={task.id} href={`/tasks/${task.id}`}
                className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group block">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {task.categories?.icon || '🔧'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">{task.title}</p>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[task.status] || task.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {task.location_zone && <span className="flex items-center gap-1"><MapPin size={10} />{task.location_zone}</span>}
                      {task.budget > 0 && <span className="flex items-center gap-1"><DollarSign size={10} />{task.budget?.toLocaleString()}</span>}
                      {task.offers_count > 0 && (
                        <span className="text-blue-600 font-medium">{task.offers_count} oferta{task.offers_count > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
