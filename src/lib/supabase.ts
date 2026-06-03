import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://mkhlgcrzuddgfquzmobu.supabase.co'
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1raGxnY3J6dWRkZ2ZxdXptb2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjU5MjQsImV4cCI6MjA5NTc0MTkyNH0.sU6gSrWsD5OT3AEEh9eBlKxaJWpY-1MhSehu-CetwAQ'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
