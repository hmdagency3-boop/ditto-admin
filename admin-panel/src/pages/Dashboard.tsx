import { useEffect, useState } from 'react'
import { Building2, ShieldCheck, Users, Activity, TrendingUp, RefreshCw } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import DbSetup from '../components/DbSetup'

export default function Dashboard() {
  const [stats, setStats] = useState({ agencies: 0, admins: 0, users: 0, active: 0, inactive: 0, activeAgencies: 0 })
  const [recentAgencies, setRecentAgencies] = useState<any[]>([])
  const [recentAdmins, setRecentAdmins]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dbMissing, setDbMissing] = useState(false)

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    try {
      const [ag, ad, us, usActive, usInactive, agActive, recAg, recAd] = await Promise.all([
        supabase.from('agencies').select('id', { count: 'exact', head: true }),
        supabase.from('admins').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('agencies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('agencies').select('id, name, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('admins').select('id, name, role, status, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      if (ag.error?.code === '42P01') { setDbMissing(true); setLoading(false); return }

      setStats({
        agencies: ag.count ?? 0,
        admins: ad.count ?? 0,
        users: us.count ?? 0,
        active: usActive.count ?? 0,
        inactive: usInactive.count ?? 0,
        activeAgencies: agActive.count ?? 0,
      })
      setRecentAgencies(recAg.data ?? [])
      setRecentAdmins(recAd.data ?? [])
      setDbMissing(false)
    } catch {
      setDbMissing(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const cards = [
    { label: 'إجمالي الوكالات', value: stats.agencies, sub: `${stats.activeAgencies} نشطة`, icon: Building2, color: 'blue' },
    { label: 'إجمالي المشرفين', value: stats.admins, sub: 'مشرف في النظام', icon: ShieldCheck, color: 'purple' },
    { label: 'إجمالي المستخدمين', value: stats.users, sub: `${stats.inactive} معطّل`, icon: Users, color: 'green' },
    { label: 'المستخدمون النشطون', value: stats.active, sub: stats.users > 0 ? `${Math.round((stats.active / stats.users) * 100)}% من الكل` : '—', icon: Activity, color: 'orange' },
  ]

  const roleLabel: Record<string, string> = { admin: 'مشرف', super_admin: 'مشرف عام', moderator: 'مراقب' }

  return (
    <div>
      <DbSetup show={dbMissing} />

      {/* Stats */}
      <div className="stats-grid">
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon ${color}`}><Icon size={22} /></div>
            <div className="stat-info">
              <h3>{loading ? '...' : value.toLocaleString('ar')}</h3>
              <p>{label}</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Activity rate bar */}
      {!loading && stats.users > 0 && (
        <div className="table-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>معدل نشاط المستخدمين</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              {Math.round((stats.active / stats.users) * 100)}%
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((stats.active / stats.users) * 100)}%`,
              background: 'linear-gradient(90deg, #1a56db, #7c3aed)',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{stats.active} نشط</span>
            <span>{stats.inactive} معطّل</span>
          </div>
        </div>
      )}

      <div className="recent-grid">
        {/* Recent Agencies */}
        <div className="table-card">
          <div className="table-header">
            <h2>آخر الوكالات المضافة</h2>
            <button onClick={load} className="btn btn-outline btn-sm" title="تحديث">
              <RefreshCw size={14} />
            </button>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : recentAgencies.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <Building2 /><p>لا توجد وكالات بعد</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>الوكالة</th><th>الحالة</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {recentAgencies.map((a: any) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td><span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{a.status === 'active' ? 'نشطة' : 'معطّلة'}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Admins */}
        <div className="table-card">
          <div className="table-header">
            <h2>آخر المشرفين المضافين</h2>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : recentAdmins.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <ShieldCheck /><p>لا يوجد مشرفون بعد</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>المشرف</th><th>الصلاحية</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {recentAdmins.map((a: any) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td><span className="badge badge-warning">{roleLabel[a.role] ?? a.role}</span></td>
                    <td><span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{a.status === 'active' ? 'نشط' : 'معطّل'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
