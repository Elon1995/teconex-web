'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bell, MessageSquare, Menu, X, ChevronDown, User, ListTodo, LogOut, Zap } from 'lucide-react'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('profiles').select('full_name, avatar_url, role').eq('id', data.user.id).single()
          .then(({ data: p }) => setProfile(p))
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase.from('profiles').select('full_name, avatar_url, role').eq('id', session.user.id).single()
          .then(({ data: p }) => setProfile(p))
      } else {
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setDropdownOpen(false)
    router.push('/')
  }

  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const initial = (profile?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ST</span>
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:block">Soluciones Técnicas</span>
          </Link>

          {/* Nav links desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Inicio</Link>
            <Link href="/tasks" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Explorar tareas</Link>
            <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium">¿Cómo funciona?</Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link href="/my-tasks" className="hidden md:block text-sm text-gray-600 hover:text-gray-900 font-medium px-2">
                  Mis tareas
                </Link>
                <Link href="/messages" className="p-2 text-gray-500 hover:text-gray-900">
                  <MessageSquare size={20} />
                </Link>
                <Link href="/notifications" className="p-2 text-gray-500 hover:text-gray-900">
                  <Bell size={20} />
                </Link>
                <Link href="/instant" className="hidden md:flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-full text-sm font-semibold hover:bg-orange-600 transition-colors">
                  <Zap size={14} /> Resuelve
                </Link>
                <Link href="/post-task" className="hidden md:block bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Publicar tarea
                </Link>

                {/* Profile dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-sm">
                      {initial}
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[80px] truncate">{displayName}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 z-50">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name || displayName}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                        <span className="text-xs text-blue-600 font-medium capitalize">{profile?.role === 'tasker' ? 'Técnico' : 'Cliente'}</span>
                      </div>
                      <Link href="/profile" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <User size={15} className="text-gray-400" /> Mi perfil
                      </Link>
                      <Link href="/my-tasks" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <ListTodo size={15} className="text-gray-400" /> Mis tareas
                      </Link>
                      <Link href="/messages" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <MessageSquare size={15} className="text-gray-400" /> Mensajes
                      </Link>
                      <Link href="/instant/incoming" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors">
                        <Zap size={15} className="text-orange-400" /> Solicitudes inmediatas
                      </Link>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <LogOut size={15} /> Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                  Iniciar sesión
                </Link>
                <Link href="/auth?tab=register" className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                  Registrarse
                </Link>
              </>
            )}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 flex flex-col gap-1">
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">Inicio</Link>
            <Link href="/tasks" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">Explorar tareas</Link>
            {user && <>
              <Link href="/my-tasks" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">Mis tareas</Link>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">Mi perfil</Link>
              <Link href="/post-task" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">Publicar tarea</Link>
              <button onClick={handleLogout} className="text-red-600 text-sm px-3 py-2 rounded-lg hover:bg-red-50 text-left">Cerrar sesión</button>
            </>}
            {!user && <Link href="/auth" onClick={() => setMenuOpen(false)} className="text-gray-700 text-sm px-3 py-2">Iniciar sesión / Registrarse</Link>}
          </div>
        )}
      </div>
    </nav>
  )
}
