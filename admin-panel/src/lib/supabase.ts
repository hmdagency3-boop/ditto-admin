import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hijmdaiwxhcrvxqmgxsy.supabase.co'
const supabaseAnonKey = 'sb_publishable_np8rx4Ve9Rs0NN9Q6MbiEg_vUCVxlAe'

export const isSupabaseConfigured = true

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
