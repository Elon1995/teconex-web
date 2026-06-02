'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function friendlyError(msg: string) {
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('over_email_send_rate_limit'))
    return 'Límite de correos alcanzado (plan gratuito de Supabase). Espera 1 hora o desactiva "Confirm email" en Supabase → Authentication → Providers → Email.'
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Este correo ya tiene una cuenta. Inicia sesión.'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('Database error')) return 'Error de base de datos. Intenta de nuevo.'
  return msg
}

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  )
  const nextPage = searchParams.get('next') || '/'
  const [role, setRole] = useState<'client' | 'tasker'>(
    searchParams.get('role') === 'tasker' ? 'tasker' : 'client'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', whatsapp: '', zone: '' })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) setError(friendlyError(error.message))
    else router.push(nextPage)
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } }
    })
    if (error) { setError(friendlyError(error.message)); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        whatsapp: form.whatsapp,
        zone: form.zone,
        role: role,
      })
      if (data.session) {
        router.push(nextPage)
      } else {
        setSuccess('¡Cuenta creada! Revisa tu correo para confirmar tu cuenta y luego inicia sesión.')
        setTab('login')
      }
    }
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) setError(friendlyError(error.message))
    else setSuccess('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">ST</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Soluciones Técnicas</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {tab !== 'forgot' && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
              <button onClick={() => { setTab('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                Iniciar sesión
              </button>
              <button onClick={() => { setTab('register'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                Registrarse
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              {success}
            </div>
          )}

          {/* LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-900">Bienvenido de vuelta</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                  <button type="button" onClick={() => { setTab('forgot'); setError(''); setSuccess('') }}
                    className="text-xs text-blue-600 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 mt-2">
                {loading ? 'Entrando...' : 'Iniciar sesión'}
              </button>
            </form>
          )}

          {/* REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-900">Crea tu cuenta</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Qué quieres hacer?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setRole('client')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${role === 'client' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-2xl mb-1">🔍</div>
                    <div className="font-semibold text-sm text-gray-900">Busco servicios</div>
                    <div className="text-xs text-gray-500 mt-0.5">Publicar tareas</div>
                  </button>
                  <button type="button" onClick={() => setRole('tasker')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${role === 'tasker' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-2xl mb-1">💼</div>
                    <div className="font-semibold text-sm text-gray-900">Ofrezco servicios</div>
                    <div className="text-xs text-gray-500 mt-0.5">Ganar dinero</div>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-500">+507</span>
                  <input type="tel" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})}
                    placeholder="6XXX-XXXX"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona / Barrio</label>
                <input type="text" value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                  placeholder="Ej: San Francisco, Miraflores, Bella Vista..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input type="password" required minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 mt-2">
                {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Al registrarte aceptas nuestros <Link href="/terms" className="text-blue-600">Términos</Link> y <Link href="/privacy" className="text-blue-600">Privacidad</Link>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <button type="button" onClick={() => { setTab('login'); setError(''); setSuccess('') }}
                className="text-sm text-gray-400 hover:text-gray-600 text-left mb-1">
                ← Volver
              </button>
              <h2 className="text-xl font-bold text-gray-900">Recuperar contraseña</h2>
              <p className="text-sm text-gray-500">Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>
}
