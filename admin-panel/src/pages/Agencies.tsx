import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, X, ToggleLeft, ToggleRight, Filter } from 'lucide-react'
import { supabase, isSupabaseConfigured, type Agency } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import DbSetup from '../components/DbSetup'

const empty: Omit<Agency, 'id' | 'created_at'> = {
  name: '', email: '', phone: '', address: '', status: 'active'
}

export default function Agencies() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [filtered, setFiltered]   = useState<Agency[]>([])
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ ...empty })
  const [editing, setEditing]     = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [dbMissing, setDbMissing] = useState(false)
  const toast = useToast()

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('agencies').select('*').order('created_at', { ascending: false })
    if (error?.code === '42P01') { setDbMissing(true); setLoading(false); return }
    setAgencies(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(agencies.filter(a => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.phone.includes(q)
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      return matchSearch && matchStatus
    }))
  }, [search, statusFilter, agencies])

  const openAdd  = () => { setForm({ ...empty }); setEditing(null); setModal(true) }
  const openEdit = (a: Agency) => {
    setForm({ name: a.name, email: a.email, phone: a.phone, address: a.address, status: a.status })
    setEditing(a.id); setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = editing
      ? await supabase.from('agencies').update(form).eq('id', editing)
      : await supabase.from('agencies').insert(form)
    setSaving(false)
    if (error) { toast.error('حدث خطأ، يرجى المحاولة مجدداً'); return }
    toast.success(editing ? 'تم تعديل الوكالة بنجاح' : 'تم إضافة الوكالة بنجاح')
    setModal(false); load()
  }

  const remove = async (a: Agency) => {
    if (!confirm(`هل أنت متأكد من حذف وكالة "${a.name}"؟`)) return
    const { error } = await supabase.from('agencies').delete().eq('id', a.id)
    if (error) { toast.error('فشل الحذف'); return }
    toast.success('تم حذف الوكالة')
    load()
  }

  const toggleStatus = async (a: Agency) => {
    const ns = a.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('agencies').update({ status: ns }).eq('id', a.id)
    if (error) { toast.error('فشل تغيير الحالة'); return }
    toast.success(ns === 'active' ? 'تم تفعيل الوكالة' : 'تم تعطيل الوكالة')
    load()
  }

  const activeCount   = agencies.filter(a => a.status === 'active').length
  const inactiveCount = agencies.filter(a => a.status === 'inactive').length

  return (
    <div>
      <ToastContainer toasts={toast.toasts} remove={toast.remove} />
      <DbSetup show={dbMissing} />

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'الكل', value: agencies.length, key: 'all' },
          { label: 'نشطة', value: activeCount, key: 'active' },
          { label: 'معطّلة', value: inactiveCount, key: 'inactive' },
        ].map(({ label, value, key }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key as any)}
            className={`btn btn-sm ${statusFilter === key ? 'btn-primary' : 'btn-outline'}`}
          >
            <Filter size={13} />{label} ({value})
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2>الوكالات ({filtered.length})</h2>
          <div className="table-controls">
            <div className="search-box">
              <Search />
              <input type="text" placeholder="بحث بالاسم أو البريد..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> إضافة وكالة
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h3>{search ? 'لا توجد نتائج' : 'لا توجد وكالات'}</h3>
            <p>{search ? `لم يتم العثور على "${search}"` : 'أضف وكالتك الأولى بالضغط على زر الإضافة'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الوكالة</th>
                <th>البريد الإلكتروني</th>
                <th>الهاتف</th>
                <th>العنوان</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, background: 'var(--primary-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {a.name[0]}
                      </div>
                      <strong>{a.name}</strong>
                    </div>
                  </td>
                  <td>{a.email || '—'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.phone || '—'}</td>
                  <td>{a.address || '—'}</td>
                  <td>
                    <button
                      onClick={() => toggleStatus(a)}
                      className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                      style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="اضغط لتغيير الحالة"
                    >
                      {a.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {a.status === 'active' ? 'نشطة' : 'معطّلة'}
                    </button>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleDateString('ar-EG')}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)} title="تعديل"><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(a)} title="حذف"><Trash2 size={14} /></button>
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
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">نشطة</option>
                  <option value="inactive">معطّلة</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة الوكالة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
