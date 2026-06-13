# نظام إدارة المشرفين | Admin Management System

## نظرة عامة | Overview
نظام شامل لإدارة المشرفين مبني باستخدام React + Vite للواجهة الأمامية و Supabase للتعامل مع قاعدة البيانات والمصادقة. يتميز النظام بواجهة عربية متوافقة مع RTL وتصميم احترافي مستوحى من لوحات تحكم Linear و Vercel.

A comprehensive admin management system built with React + Vite frontend and Supabase for database and authentication. Features Arabic RTL interface with professional design inspired by Linear and Vercel dashboards.

## المميزات الرئيسية | Key Features

### نظام المصادقة | Authentication
- تسجيل دخول آمن عبر Supabase Auth
- إنشاء حسابات جديدة مع التحقق من البريد الإلكتروني
- جلسات مستمرة مع إعادة التحميل التلقائي

### أدوار المستخدمين | User Roles
1. **المدير الرئيسي (Super Admin)**:
   - إدارة جميع المشرفين
   - عرض سجلات الحضور لجميع المشرفين
   - إنشاء وإدارة جدول الشيفتات
   - إصدار التقييمات والإنذارات

2. **المشرف العادي (Regular Admin)**:
   - تسجيل الحضور والانصراف
   - عرض سجل حضوره الشخصي
   - عرض جدول شيفتاته
   - استعراض تقييماته وإنذاراته

## البنية التقنية | Technical Architecture

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: Wouter
- **State Management**: React Context + TanStack Query
- **Forms**: React Hook Form + Zod validation

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Real-time**: Supabase subscriptions (optional)

## هيكل المشروع | Project Structure

```
client/src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AppSidebar.tsx   # Main navigation sidebar
│   └── ThemeToggle.tsx  # Dark/light mode toggle
├── contexts/
│   ├── AuthContext.tsx  # Authentication state
│   └── ThemeContext.tsx # Theme management
├── lib/
│   ├── supabase.ts      # Supabase client + types
│   ├── queryClient.ts   # TanStack Query setup
│   └── utils.ts         # Utility functions
├── pages/
│   ├── Login.tsx        # Login/signup page
│   ├── Dashboard.tsx    # Route-based dashboard
│   ├── SuperAdminDashboard.tsx
│   ├── AdminDashboard.tsx
│   ├── Admins.tsx       # Manage admins (Super only)
│   ├── Attendance.tsx   # All attendance logs (Super only)
│   ├── Shifts.tsx       # Shift management (Super only)
│   ├── Ratings.tsx      # Ratings management (Super only)
│   ├── Warnings.tsx     # Warnings management (Super only)
│   ├── MyAttendance.tsx # Personal attendance (Admin)
│   └── MyShifts.tsx     # Personal shifts (Admin)
└── App.tsx              # Main app with routing
```

## Database Schema (Supabase)

### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### attendance
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### shifts
```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ratings
```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  rated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### warnings
```sql
CREATE TABLE warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  reason TEXT NOT NULL,
  issued_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

### Running the app
```bash
npm run dev
```

### Port
The application runs on port 5000.

## Design System
See `design_guidelines.md` for complete design specifications including:
- Typography system (Cairo font for Arabic)
- Color palette
- Component patterns
- RTL layout guidelines

## Security - RLS Policies (Must Configure in Supabase Dashboard)

For production deployment, configure these Row Level Security (RLS) policies in Supabase:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Super admins can insert profiles" ON profiles FOR INSERT 
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "Super admins can update profiles" ON profiles FOR UPDATE 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

-- Attendance policies
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT 
  USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "Users can insert own attendance" ON attendance FOR INSERT 
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own attendance" ON attendance FOR UPDATE 
  USING (user_id = auth.uid());

-- Shifts policies
CREATE POLICY "Users can view own shifts" ON shifts FOR SELECT 
  USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "Super admins can manage shifts" ON shifts FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

-- Ratings policies
CREATE POLICY "Users can view own ratings" ON ratings FOR SELECT 
  USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "Super admins can manage ratings" ON ratings FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

-- Warnings policies
CREATE POLICY "Users can view own warnings" ON warnings FOR SELECT 
  USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "Super admins can manage warnings" ON warnings FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
```

## Last Updated
December 2024

## Notes
- All UI text is in Arabic
- RTL layout is applied globally
- Dark/Light theme support
- Role-based access control enforced at route level and should be backed by RLS policies in Supabase
- Duplicate attendance check prevents multiple check-ins per day
