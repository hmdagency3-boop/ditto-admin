import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Users as UsersIcon, X, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured, type User, type Agency } from '../lib/supabase'

const emptyForm = { name: '', email: '', phone: '', agency_id: '', status: 'active' as 'active' | 'inactive' }

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [filtered, setFiltered] = useState<User[]>([])
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
    const [{ data: usersData }, { data: agenciesData }] = await Promise.all([
      supabase.from('users').select('*, agencies(name)').order('created_at', { ascending: false }),
      supabase.from('agencies').select('id, name').eq('status', 'active'),
    ])
    const mapped = (usersData ?? []).map((u: any) => ({
      ...u,
      agency_name: u.agencies?.name ?? '',
    }))
    setUsers(mapped)
    setFiltered(mapped)
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.agency_name ?? '').toLowerCase().includes(q)
    ))
  }, [search, users])

  const openAdd = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, phone: u.phone, agency_id: u.agency_id ?? '', status: u.status })
    setEditing(u.id)
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, agency_id: form.agency_id || null }
    if (editing) {
      await supabase.from('users').update(payload).eq('id', editing)
    } else {
      await supabase.from('users').insert(payload)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return
    await supabase.from('users').delete().eq('id', id)
    load()
  }

  const toggleStatus = async (u: User) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    await supabase.from('users').update({ status: newStatus }).eq('id', u.id)
    load()
  }

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
          <h2>المستخدمون ({filtered.length})</h2>
          <div className="table-controls">
            <div className="search-box">
              <Search />
              <input
                type="text"
                placeholder="البحث بالاسم أو البريد أو الهاتف..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} />
              إضافة مستخدم
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UsersIcon />
            <h3>{search ? 'لا توجد نتائج للبحث' : 'لا يوجد مستخدمون'}</h3>
            <p>{search ? `لم يتم العثور على نتائج لـ "${search}"` : 'أضف مستخدماً جديداً بالضغط على زر الإضافة'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الهاتف</th>
                <th>الوكالة</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{u.phone}</td>
                  <td>{u.agency_name || '—'}</td>
                  <td>
                    <button
                      className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                      style={{ cursor: 'pointer', border: 'none', background: undefined }}
                      onClick={() => toggleStatus(u)}
                      title="اضغط لتغيير الحالة"
                    >
                      {u.status === 'active' ? 'نشط' : 'معطل'}
                    </button>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(u.id)}><Trash2 size={14} /></button>
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
              <h3>{editing ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</h3>
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
                  <label>الوكالة</label>
                  <select value={form.agency_id} onChange={e => setForm(f => ({ ...f, agency_id: e.target.value }))}>
                    <option value="">بدون وكالة</option>
                    {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}>
                    <option value="active">نشط</option>
                    <option value="inactive">معطل</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
