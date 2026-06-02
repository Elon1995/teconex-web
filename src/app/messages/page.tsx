'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { MessageSquare, Clock } from 'lucide-react'

export default function MessagesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const { data } = await supabase
        .from('contracts')
        .select(`*,
          tasks(id, title, categories(icon)),
          poster:profiles!contracts_poster_id_fkey(full_name),
          tasker:profiles!contracts_tasker_id_fkey(full_name)
        `)
        .or(`poster_id.eq.${user.id},tasker_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      setContracts(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {[1,2,3].map(i => <div key={i} className="bg-white h-20 rounded-2xl animate-pulse border border-gray-100" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Mensajes</h1>
        {contracts.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin conversaciones aún</p>
            <p className="text-sm text-gray-400 mt-1">Cuando aceptes o te acepten una oferta, el chat aparecerá aquí</p>
            <Link href="/tasks" className="mt-4 inline-block text-blue-600 text-sm font-medium">Explorar tareas →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map(c => {
              const isposter = c.poster_id === user?.id
              const other = isposter ? c.tasker : c.poster
              return (
                <Link key={c.id} href={`/tasks/${c.task_id}`}
                  className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:border-blue-200 transition-all group">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-lg flex-shrink-0">
                    {other?.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">{other?.full_name}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{isposter ? 'Fixer' : 'Cliente'}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {c.tasks?.categories?.icon} {c.tasks?.title}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">${c.agreed_price}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.payment_status === 'released' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {c.payment_status === 'released' ? 'Completado' : 'Activo'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
