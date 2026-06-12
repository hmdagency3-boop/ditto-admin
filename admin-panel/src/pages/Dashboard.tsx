import { useEffect, useState } from 'react'
import { Building2, ShieldCheck, Users, Activity, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const isConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  return url && url !== '' && url !== 'YOUR_SUPABASE_URL'
}

export default function Dashboard() {
  const [stats, setStats] = useState({ agencies: 0, admins: 0, users: 0, active: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return }

    const load = async () => {
      try {
        const [ag, ad, us] = await Promise.all([
          supabase.from('agencies').select('id', { count: 'exact', head: true }),
          supabase.from('admins').select('id', { count: 'exact', head: true }),
          supabase.from('users').select('id', { count: 'exact', head: true }),
        ])
        const activeRes = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active')
        setStats({
          agencies: ag.count ?? 0,
          admins: ad.count ?? 0,
          users: us.count ?? 0,
          active: activeRes.count ?? 0,
        })
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'إجمالي الوكالات', value: stats.agencies, icon: Building2, color: 'blue' },
    { label: 'إجمالي المشرفين', value: stats.admins, icon: ShieldCheck, color: 'purple' },
    { label: 'إجمالي المستخدمين', value: stats.users, icon: Users, color: 'green' },
    { label: 'المستخدمون النشطون', value: stats.active, icon: Activity, color: 'orange' },
  ]

  return (
    <div>
      {!isConfigured() && (
        <div className="setup-banner">
          <AlertTriangle />
          <div className="setup-banner-text">
            <h4>يجب ربط Supabase أولاً</h4>
            <p>
              أضف متغيرات البيئة التالية في إعدادات المشروع:<br />
              <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code>
            </p>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon ${color}`}>
              <Icon size={22} />
            </div>
            <div className="stat-info">
              <h3>{loading ? '...' : value.toLocaleString('ar')}</h3>
              <p>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="recent-grid">
        <div className="table-card">
          <div className="table-header">
            <h2>نشاط النظام</h2>
          </div>
          <div>
            {[
              { text: 'تم إضافة وكالة جديدة', time: 'منذ 5 دقائق', color: 'blue' },
              { text: 'تم تسجيل مستخدم جديد', time: 'منذ 12 دقيقة', color: 'green' },
              { text: 'تم تعديل بيانات مشرف', time: 'منذ ساعة', color: 'orange' },
              { text: 'تم إضافة وكالة جديدة', time: 'منذ 3 ساعات', color: 'blue' },
              { text: 'تم تعطيل حساب مستخدم', time: 'منذ يوم', color: 'orange' },
            ].map((item, i) => (
              <div className="activity-item" key={i}>
                <div className={`activity-dot ${item.color}`} />
                <span className="activity-text">{item.text}</span>
                <span className="activity-time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h2>ملخص سريع</h2>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'الوكالات النشطة', value: `${stats.agencies} وكالة`, color: '#1a56db' },
              { label: 'المشرفون المتاحون', value: `${stats.admins} مشرف`, color: '#7c3aed' },
              { label: 'المستخدمون النشطون', value: `${stats.active} مستخدم`, color: '#10b981' },
              { label: 'معدل النشاط', value: stats.users > 0 ? `${Math.round((stats.active / stats.users) * 100)}%` : '0%', color: '#ea580c' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
