'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import { MapPin, Star, CheckCircle, Edit2, Save, X } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', whatsapp: '', zone: '', bio: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data)
        setForm({ full_name: data?.full_name || '', whatsapp: data?.whatsapp || '', zone: data?.zone || '', bio: data?.bio || '' })
        setLoading(false)
      })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('profiles').update(form).eq('id', user.id)
    setProfile({ ...profile, ...form })
    setEditing(false)
    setSaving(false)
  }

  const TIER_COLORS: Record<string, string> = {
    bronze: 'text-amber-700 bg-amber-50 border-amber-200',
    silver: 'text-gray-600 bg-gray-50 border-gray-200',
    gold: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    platinum: 'text-blue-600 bg-blue-50 border-blue-200',
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
        <div className="bg-white rounded-2xl h-48 border border-gray-100" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                {editing ? (
                  <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                    className="text-xl font-bold border-2 border-blue-300 rounded-lg px-3 py-1 outline-none" />
                ) : (
                  <h1 className="text-xl font-bold text-gray-900">{profile?.full_name || 'Sin nombre'}</h1>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {profile?.zone && <span className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={13} />{profile.zone}</span>}
                  {profile?.avg_rating > 0 && (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Star size={13} className="fill-yellow-400 text-yellow-400" />{profile.avg_rating?.toFixed(1)}
                    </span>
                  )}
                </div>
                <span className={`mt-2 inline-block text-xs font-semibold px-3 py-1 rounded-full border capitalize ${TIER_COLORS[profile?.tier || 'bronze']}`}>
                  {profile?.tier || 'Bronze'}
                </span>
              </div>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Edit2 size={15} /> Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
                  <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {editing && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" placeholder="+507 6XXX-XXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zona / Barrio</label>
                <input value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" placeholder="San Francisco, Miraflores..." />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Bio / Descripción</label>
                <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 resize-none"
                  placeholder="Cuéntales a los clientes sobre ti y tu experiencia..." />
              </div>
            </div>
          )}

          {!editing && profile?.bio && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Tareas completadas', value: profile?.total_completed || 0 },
            { label: 'Reseñas', value: profile?.total_reviews || 0 },
            { label: 'Tasa de éxito', value: `${profile?.completion_rate || 0}%` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tier progress */}
        {profile?.role === 'tasker' || profile?.role === 'both' ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Tu nivel de comisión</h3>
            <div className="space-y-2">
              {[
                { tier: 'Bronze', fee: '20%', min: 0, max: 880 },
                { tier: 'Silver', fee: '18.5%', min: 880, max: 2650 },
                { tier: 'Gold', fee: '14.9%', min: 2650, max: 5300 },
                { tier: 'Platinum', fee: '12.5%', min: 5300, max: null },
              ].map(t => (
                <div key={t.tier} className={`flex items-center justify-between p-3 rounded-xl ${profile?.tier === t.tier.toLowerCase() ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}>
                  <div>
                    <span className="font-semibold text-sm text-gray-900">{t.tier}</span>
                    {t.max ? <span className="text-xs text-gray-400 ml-2">${t.min}–${t.max}/mes</span> : <span className="text-xs text-gray-400 ml-2">${t.min}+/mes</span>}
                  </div>
                  <span className="text-sm font-bold text-gray-700">{t.fee}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Basado en ganancias de los últimos 30 días</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
