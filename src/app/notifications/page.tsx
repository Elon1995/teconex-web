'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { Bell, CheckCheck } from 'lucide-react'

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      loadNotifications(user.id)

      // Realtime
      const channel = supabase.channel('notifs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          payload => setNotifications(prev => [payload.new, ...prev]))
        .subscribe()
      return () => supabase.removeChannel(channel)
    })
  }, [])

  const loadNotifications = async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const ICONS: Record<string, string> = {
    offer_accepted: '🎉',
    new_offer: '💬',
    task_completed: '✅',
    new_message: '📨',
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'ahora'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="bg-white h-16 rounded-xl animate-pulse border border-gray-100" />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <CheckCheck size={15} /> Marcar todas leídas
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin notificaciones</p>
            <p className="text-sm text-gray-400 mt-1">Recibirás alertas de ofertas, mensajes y más</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.map(n => (
              <button key={n.id} onClick={() => {
                markRead(n.id)
                if (n.data?.task_id) router.push(`/tasks/${n.data.task_id}`)
              }}
                className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition-all hover:shadow-sm ${n.read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm flex-shrink-0 border border-gray-100">
                  {ICONS[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                  {!n.read && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
