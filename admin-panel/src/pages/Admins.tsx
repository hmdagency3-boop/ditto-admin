import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured, type Admin, type Agency } from '../lib/supabase'

const emptyForm = { name: '', email: '', phone: '', role: 'admin', agency_id: '', status: 'active' as 'active' | 'inactive' }

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [filtered, setFiltered] = useState<Admin[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: adminsData }, { data: agenciesData }] = await Promise.all([
      supabase.from('admins').select('*, agencies(name)').order('created_at', { ascending: false }),
      supabase.from('agencies').select('id, name').eq('status', 'active'),
    ])
    const mapped = (adminsData ?? []).map((a: any) => ({
      ...a,
      agency_name: a.agencies?.name ?? '',
    }))
    setAdmins(mapped)
    setFiltered(mapped)
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(admins.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    ))
  }, [search, admins])

  const openAdd = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (a: Admin) => {
    setForm({ name: a.name, email: a.email, phone: a.phone, role: a.role, agency_id: a.agency_id ?? '', status: a.status })
    setEditing(a.id)
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, agency_id: form.agency_id || null }
    if (editing) {
      await supabase.from('admins').update(payload).eq('id', editing)
    } else {
      await supabase.from('admins').insert(payload)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشرف؟')) return
    await supabase.from('admins').delete().eq('id', id)
    load()
  }

  const roles: Record<string, string> = { admin: 'مشرف', super_admin: 'مشرف عام', moderator: 'مراقب' }

  return (
    <div>
      {!isSupabaseConfigured && (
        <div className="setup-banner">
          <AlertTriangle />
          <div className="setup-banner-text">
            <h4>يجب ربط Supabase أولاً</h4>
            <p>أضف <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> في إعدادات المشروع</p>
          </div>
        </div>
      )}
      <div className="table-card">
        <div className="table-header">
          <h2>المشرفون ({filtered.length})</h2>
          <div className="table-controls">
            <div className="search-box">
              <Search />
              <input
                type="text"
                placeholder="البحث عن مشرف..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} />
              إضافة مشرف
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck />
            <h3>لا يوجد مشرفون</h3>
            <p>أضف مشرفاً جديداً بالضغط على زر الإضافة</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الهاتف</th>
                <th>الصلاحية</th>
                <th>الوكالة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.email}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.phone}</td>
                  <td>
                    <span className="badge badge-warning">{roles[a.role] ?? a.role}</span>
                  </td>
                  <td>{a.agency_name || '—'}</td>
                  <td>
                    <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {a.status === 'active' ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editing ? 'تعديل المشرف' : 'إضافة مشرف جديد'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>الاسم الكامل *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="أدخل الاسم" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>البريد الإلكتروني</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" />
                </div>
                <div className="form-group">
                  <label>رقم الهاتف</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>الصلاحية</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="admin">مشرف</option>
                    <option value="super_admin">مشرف عام</option>
                    <option value="moderator">مراقب</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>الوكالة</label>
                  <select value={form.agency_id} onChange={e => setForm(f => ({ ...f, agency_id: e.target.value }))}>
                    <option value="">بدون وكالة</option>
                    {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>الحالة</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}>
                  <option value="active">نشط</option>
                  <option value="inactive">معطل</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المشرف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
