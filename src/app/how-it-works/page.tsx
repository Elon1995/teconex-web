import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

const STEPS_CLIENT = [
  { n: '1', icon: '📝', title: 'Publica tu tarea', desc: 'Describe lo que necesitas en menos de 2 minutos. Es gratis.' },
  { n: '2', icon: '💬', title: 'Recibe ofertas', desc: 'Técnicos verificados en tu zona envían sus precios y mensajes.' },
  { n: '3', icon: '✅', title: 'Acepta la mejor', desc: 'Elige al técnico ideal, chatea para coordinar y paga al completar.' },
]

const STEPS_TASKER = [
  { n: '1', icon: '🔍', title: 'Explora tareas', desc: 'Navega tareas disponibles en tu zona y categoría.' },
  { n: '2', icon: '💰', title: 'Haz tu oferta', desc: 'Envía tu precio y un mensaje explicando por qué eres el ideal.' },
  { n: '3', icon: '🚀', title: 'Trabaja y cobra', desc: 'Acepta, coordina por chat, completa el trabajo y recibe tu pago.' },
]

const FEES = [
  { tier: 'Bronze', color: 'bg-amber-100 text-amber-800', fee: '20%', range: '$0 – $880/mes' },
  { tier: 'Silver', color: 'bg-gray-100 text-gray-700', fee: '18.5%', range: '$880 – $2,650/mes' },
  { tier: 'Gold', color: 'bg-yellow-100 text-yellow-800', fee: '14.9%', range: '$2,650 – $5,300/mes' },
  { tier: 'Platinum', color: 'bg-blue-100 text-blue-800', fee: '12.5%', range: '$5,300+/mes' },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">¿Cómo funciona?</h1>
          <p className="text-gray-500 text-lg">La forma más simple de conectar con técnicos en Panamá</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Para clientes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🔍</span>
              <h2 className="text-lg font-bold text-gray-900">Para clientes</h2>
            </div>
            <div className="space-y-5">
              {STEPS_CLIENT.map(s => (
                <div key={s.n} className="flex gap-4">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{s.n}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.icon} {s.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/post-task" className="mt-6 block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors">
              Publicar una tarea gratis
            </Link>
          </div>

          {/* Para técnicos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">💼</span>
              <h2 className="text-lg font-bold text-gray-900">Para técnicos</h2>
            </div>
            <div className="space-y-5">
              {STEPS_TASKER.map(s => (
                <div key={s.n} className="flex gap-4">
                  <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{s.n}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{s.icon} {s.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/auth?tab=register&role=tasker" className="mt-6 block w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-green-700 transition-colors">
              Registrarme como técnico
            </Link>
          </div>
        </div>

        {/* Comisiones */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Comisiones transparentes</h2>
          <p className="text-sm text-gray-500 mb-5">Mientras más trabajas, menos pagas. Las comisiones bajan según tus ganancias del último mes.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FEES.map(f => (
              <div key={f.tier} className={`rounded-xl p-4 text-center ${f.color}`}>
                <p className="font-bold text-lg">{f.fee}</p>
                <p className="font-semibold text-sm">{f.tier}</p>
                <p className="text-xs mt-1 opacity-70">{f.range}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {[
              { q: '¿Es gratis publicar una tarea?', a: 'Sí, publicar tareas es completamente gratis. Solo pagamos cuando asignas un técnico.' },
              { q: '¿Cómo sé que el técnico es confiable?', a: 'Todos los técnicos tienen reseñas verificadas de trabajos anteriores y calificaciones de estrellas.' },
              { q: '¿Cómo funciona el pago?', a: 'El dinero se reserva al asignar. Solo se libera cuando confirmas que el trabajo está completado.' },
              { q: '¿Puedo cancelar una tarea?', a: 'Sí, puedes cancelar una tarea abierta en cualquier momento sin costo.' },
            ].map(f => (
              <div key={f.q} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <p className="font-semibold text-gray-900 text-sm">{f.q}</p>
                <p className="text-sm text-gray-500 mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
