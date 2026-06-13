import { useState } from 'react'
import { Database, Copy, Check, ExternalLink } from 'lucide-react'

const SQL = `-- جدول الوكالات
create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  address text default '',
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- جدول المشرفين (مع حقول المنصة)
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  role text default 'admin' check (role in ('admin','super_admin','moderator')),
  agency_id uuid references agencies(id) on delete set null,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  uid bigint,
  erban_no bigint,
  avatar text,
  country text,
  gender int,
  platform_ban int,
  online_status boolean
);

-- جدول المستخدمين
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  agency_id uuid references agencies(id) on delete set null,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- تفعيل RLS
alter table agencies enable row level security;
alter table admins enable row level security;
alter table users enable row level security;

create policy if not exists "allow_all_agencies" on agencies for all using (true) with check (true);
create policy if not exists "allow_all_admins"   on admins   for all using (true) with check (true);
create policy if not exists "allow_all_users"    on users    for all using (true) with check (true);

-- لو الجدول موجود مسبقاً أضف الأعمدة الجديدة
alter table admins add column if not exists uid bigint;
alter table admins add column if not exists erban_no bigint;
alter table admins add column if not exists avatar text;
alter table admins add column if not exists country text;
alter table admins add column if not exists gender int;
alter table admins add column if not exists platform_ban int;
alter table admins add column if not exists online_status boolean;`

export default function DbSetup({ show }: { show: boolean }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  if (!show) return null

  const copy = () => {
    navigator.clipboard.writeText(SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: '1px solid #334155', borderRadius: 12,
      padding: '20px 24px', marginBottom: 20, color: 'white',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ background: '#1a56db', borderRadius: 8, padding: 8, display: 'flex' }}>
          <Database size={18} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>قاعدة البيانات غير مُعدَّة</h4>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>شغّل الـ SQL التالي في لوحة Supabase لإنشاء الجداول</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {open ? 'إخفاء' : 'عرض SQL'}
          </button>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
            style={{ background: '#1a56db', border: 'none', color: 'white', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontFamily: 'inherit' }}>
            <ExternalLink size={12} /> فتح Supabase
          </a>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          <pre style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '14px 16px', fontSize: 11, color: '#7dd3fc', overflow: 'auto', maxHeight: 300, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', lineHeight: 1.6 }}>
            {SQL}
          </pre>
          <button onClick={copy} style={{ position: 'absolute', top: 10, right: 10, background: copied ? '#10b981' : '#1e293b', border: '1px solid #334155', color: 'white', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            {copied ? <><Check size={12} />تم النسخ</> : <><Copy size={12} />نسخ</>}
          </button>
        </div>
      )}
    </div>
  )
}
