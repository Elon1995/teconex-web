import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Fetch personalizado: garantiza que todos los headers sean ASCII puro (ISO-8859-1)
// Necesario por un bug en supabase-js 2.100+ con X-Client-Info en ciertos browsers
const asciiFetch: typeof fetch = (input, init?) => {
  if (init?.headers) {
    const clean: Record<string, string> = {}
    const h = new Headers(init.headers as HeadersInit)
    h.forEach((value, key) => {
      // Eliminar cualquier caracter fuera de ASCII (0-127)
      clean[key] = value.replace(/[^\x00-\x7F]/g, '')
    })
    init = { ...init, headers: clean }
  }
  return fetch(input, init)
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: asciiFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
