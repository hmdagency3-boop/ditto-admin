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
  shift_number: number;
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

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to: string;
  assigned_by: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  color: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
