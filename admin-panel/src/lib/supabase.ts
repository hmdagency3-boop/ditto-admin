import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

let _supabase: SupabaseClient | null = null

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = _supabase!

export type Agency = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  status: 'active' | 'inactive'
  created_at: string
}

export type Admin = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  agency_id: string | null
  agency_name?: string
  status: 'active' | 'inactive'
  created_at: string
}

export type User = {
  id: string
  name: string
  email: string
  phone: string
  agency_id: string | null
  agency_name?: string
  status: 'active' | 'inactive'
  created_at: string
}
