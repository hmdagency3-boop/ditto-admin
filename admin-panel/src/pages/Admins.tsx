import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, X, ToggleLeft, ToggleRight, Filter } from 'lucide-react'
import { supabase, isSupabaseConfigured, type Admin, type Agency } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import DbSetup from '../components/DbSetup'

const emptyForm = { name: '', email: '', phone: '', role: 'admin', agency_id: '', status: 'active' as 'active' | 'inactive' }

const roleColors: Record<string, string> = { super_admin: 'badge-danger', admin: 'badge-warning', moderator: 'badge-success' }
const roleLabels: Record<string, string>  = { admin: 'مشرف', super_admin: 'مشرف عام', moderator: 'مراقب' }

export default function Admins() {
  const [admins, setAdmins]             = useState<Admin[]>([])
  const [filtered, setFiltered]         = useState<Admin[]>([])
  const [agencies, setAgencies]         = useState<Agency[]>([])
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter]     = useState<'all' | 'admin' | 'super_admin' | 'moderator'>('all')
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [form, setForm]                 = useState({ ...emptyForm })
  const [editing, setEditing]           = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [dbMissing, setDbMissing]       = useState(false)
  const toast = useToast()

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: adminsData, error }, { data: agenciesData }] = await Promise.all([
      supabase.from('admins').select('*, agencies(name)').order('created_at', { ascending: false }),
      supabase.from('agencies').select('id, name').eq('status', 'active'),
    ])
    if (error?.code === '42P01') { setDbMissing(true); setLoading(false); return }
    const mapped = (adminsData ?? []).map((a: any) => ({ ...a, agency_name: a.agencies?.name ?? '' }))
    setAdmins(mapped)
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(admins.filter(a => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.phone.includes(q)
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      const matchRole   = roleFilter === 'all' || a.role === roleFilter
      return matchSearch && matchStatus && matchRole
    }))
  }, [search, statusFilter, roleFilter, admins])

  const openAdd  = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (a: Admin) => {
    setForm({ name: a.name, email: a.email, phone: a.phone, role: a.role, agency_id: a.agency_id ?? '', status: a.status })
    setEditing(a.id); setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, agency_id: form.agency_id || null }
    const { error } = editing
      ? await supabase.from('admins').update(payload).eq('id', editing)
      : await supabase.from('admins').insert(payload)
    setSaving(false)
    if (error) { toast.error('حدث خطأ، يرجى المحاولة مجدداً'); return }
    toast.success(editing ? 'تم تعديل المشرف بنجاح' : 'تم إضافة المشرف بنجاح')
    setModal(false); load()
  }

  const remove = async (a: Admin) => {
    if (!confirm(`هل أنت متأكد من حذف المشرف "${a.name}"؟`)) return
    const { error } = await supabase.from('admins').delete().eq('id', a.id)
    if (error) { toast.error('فشل الحذف'); return }
    toast.success('تم حذف المشرف')
    load()
  }

  const toggleStatus = async (a: Admin) => {
    const ns = a.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('admins').update({ status: ns }).eq('id', a.id)
    if (error) { toast.error('فشل تغيير الحالة'); return }
    toast.success(ns === 'active' ? 'تم تفعيل المشرف' : 'تم تعطيل المشرف')
    load()
  }

  return (
    <div>
      <ToastContainer toasts={toast.toasts} remove={toast.remove} />
      <DbSetup show={dbMissing} />

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>الحالة:</span>
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setStatusFilter(v)} className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`}>
              {v === 'all' ? 'الكل' : v === 'active' ? 'نشط' : 'معطّل'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>الصلاحية:</span>
          {(['all', 'super_admin', 'admin', 'moderator'] as const).map(v => (
            <button key={v} onClick={() => setRoleFilter(v)} className={`btn btn-sm ${roleFilter === v ? 'btn-primary' : 'btn-outline'}`}>
              {v === 'all' ? 'الكل' : roleLabels[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2>المشرفون ({filtered.length})</h2>
          <div className="table-controls">
            <div className="search-box">
              <Search />
              <input type="text" placeholder="بحث بالاسم أو البريد..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> إضافة مشرف
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck />
            <h3>{search ? 'لا توجد نتائج' : 'لا يوجد مشرفون'}</h3>
            <p>{search ? `لم يتم العثور على "${search}"` : 'أضف مشرفاً جديداً بالضغط على زر الإضافة'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>الاسم</th><th>البريد</th><th>الهاتف</th>
                <th>الصلاحية</th><th>الوكالة</th><th>الحالة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, background: '#ede9fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {a.name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                      </div>
                    </div>
                  </td>
                  <td>{a.email || '—'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.phone || '—'}</td>
                  <td><span className={`badge ${roleColors[a.role] ?? 'badge-warning'}`}>{roleLabels[a.role] ?? a.role}</span></td>
                  <td>{a.agency_name || '—'}</td>
                  <td>
                    <button
                      onClick={() => toggleStatus(a)}
                      className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                      style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="اضغط لتغيير الحالة"
                    >
                      {a.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {a.status === 'active' ? 'نشط' : 'معطّل'}
                    </button>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(a)}><Trash2 size={14} /></button>
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
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">نشط</option>
                  <option value="inactive">معطّل</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المشرف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
