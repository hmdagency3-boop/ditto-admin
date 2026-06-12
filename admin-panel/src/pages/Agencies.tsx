import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, X, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured, type Agency } from '../lib/supabase'

const empty: Omit<Agency, 'id' | 'created_at'> = {
  name: '', email: '', phone: '', address: '', status: 'active'
}

export default function Agencies() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [filtered, setFiltered] = useState<Agency[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('agencies').select('*').order('created_at', { ascending: false })
    setAgencies(data ?? [])
    setFiltered(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(agencies.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.phone.includes(q)
    ))
  }, [search, agencies])

  const openAdd = () => { setForm({ ...empty }); setEditing(null); setModal(true) }
  const openEdit = (a: Agency) => {
    setForm({ name: a.name, email: a.email, phone: a.phone, address: a.address, status: a.status })
    setEditing(a.id)
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from('agencies').update(form).eq('id', editing)
    } else {
      await supabase.from('agencies').insert(form)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوكالة؟')) return
    await supabase.from('agencies').delete().eq('id', id)
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
          <h2>الوكالات ({filtered.length})</h2>
          <div className="table-controls">
            <div className="search-box">
              <Search />
              <input
                type="text"
                placeholder="البحث عن وكالة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} />
              إضافة وكالة
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h3>لا توجد وكالات</h3>
            <p>أضف وكالتك الأولى بالضغط على زر الإضافة</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم الوكالة</th>
                <th>البريد الإلكتروني</th>
                <th>رقم الهاتف</th>
                <th>العنوان</th>
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
                  <td>{a.address}</td>
                  <td>
                    <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {a.status === 'active' ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
                        <Trash2 size={14} />
                      </button>
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
              <h3>{editing ? 'تعديل الوكالة' : 'إضافة وكالة جديدة'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>اسم الوكالة *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="أدخل اسم الوكالة" />
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
              <div className="form-group">
                <label>العنوان</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="أدخل العنوان" />
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
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة الوكالة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
