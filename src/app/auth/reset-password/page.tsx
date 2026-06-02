'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else router.push('/')
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
          {!ready ? (
            <div className="text-center">
              <p className="text-gray-500 text-sm">Verificando enlace...</p>
              <Link href="/auth" className="text-blue-600 text-sm mt-4 inline-block">← Volver al login</Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-900">Nueva contraseña</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>
}
