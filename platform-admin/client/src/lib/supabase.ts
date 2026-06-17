import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wrtehkrbsewgcdbloddk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydGVoa3Jic2V3Z2NkYmxvZGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjg2NjEsImV4cCI6MjA4MDcwNDY2MX0.jdgD0s0jcm-NqfI3LleQpn3WDKDaxzEQWQstHs6qmvM';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type UserRole = 'super_admin' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  check_in: string;
  check_out?: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  notes?: string;
  created_at: string;
}

export interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  date: string;
  shift_type: 'morning' | 'afternoon' | 'night';
  created_by: string;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  score: number;
  comment?: string;
  rated_by: string;
  created_at: string;
}

export interface Warning {
  id: string;
  user_id: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  issued_by: string;
  created_at: string;
}
