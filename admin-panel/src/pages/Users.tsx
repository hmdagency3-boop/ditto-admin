import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Users as UsersIcon, X, UserSearch, ExternalLink, ToggleLeft, ToggleRight, Filter, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured, type User, type Agency } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import DbSetup from '../components/DbSetup'

const emptyForm = { name: '', email: '', phone: '', agency_id: '', status: 'active' as 'active' | 'inactive' }

type PlatformUser = {
  uid: number; erbanNo: number; nick: string; avatar: string
  country: string | null; gender: number | null; age: number | null
  city: string | null; chatGift: number | null; chatRange: number | null
  nobleId: number | null; nobleName: string | null
  charmLevel: number | null; experLevel: number | null
}

export default function Users() {
  const [users, setUsers]               = useState<User[]>([])
  const [filtered, setFiltered]         = useState<User[]>([])
  const [agencies, setAgencies]         = useState<Agency[]>([])
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [form, setForm]                 = useState({ ...emptyForm })
  const [editing, setEditing]           = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [dbMissing, setDbMissing]       = useState(false)
  const [activeTab, setActiveTab]       = useState<'api' | 'local'>('api')

  // API search
  const [searchId, setSearchId]         = useState('')
  const [searching, setSearching]       = useState(false)
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null)
  const [searchError, setSearchError]   = useState('')

  const toast = useToast()

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: usersData, error }, { data: agenciesData }] = await Promise.all([
      supabase.from('users').select('*, agencies(name)').order('created_at', { ascending: false }),
      supabase.from('agencies').select('id, name').eq('status', 'active'),
    ])
    if (error?.code === '42P01') { setDbMissing(true); setLoading(false); return }
    const mapped = (usersData ?? []).map((u: any) => ({ ...u, agency_name: u.agencies?.name ?? '' }))
    setUsers(mapped)
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(users.filter(u => {
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q) || (u.agency_name ?? '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      return matchSearch && matchStatus
    }))
  }, [search, statusFilter, users])

  const searchPlatformUser = async () => {
    if (!searchId.trim()) return
    setSearching(true); setPlatformUser(null); setSearchError('')
    try {
      const res  = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${searchId.trim()}`)
      const json = await res.json()
      if (json.code === 200 && json.data?.uid) {
        setPlatformUser(json.data)
      } else {
        setSearchError('لم يتم العثور على مستخدم بهذا الرقم')
      }
    } catch {
      setSearchError('تعذّر الاتصال بالخادم، تأكد من الرقم وأعد المحاولة')
    }
    setSearching(false)
  }

  const openAdd  = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, phone: u.phone, agency_id: u.agency_id ?? '', status: u.status })
    setEditing(u.id); setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, agency_id: form.agency_id || null }
    const { error } = editing
      ? await supabase.from('users').update(payload).eq('id', editing)
      : await supabase.from('users').insert(payload)
    setSaving(false)
    if (error) { toast.error('حدث خطأ، يرجى المحاولة مجدداً'); return }
    toast.success(editing ? 'تم تعديل المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح')
    setModal(false); load()
  }

  const remove = async (u: User) => {
    if (!confirm(`هل أنت متأكد من حذف "${u.name}"؟`)) return
    const { error } = await supabase.from('users').delete().eq('id', u.id)
    if (error) { toast.error('فشل الحذف'); return }
    toast.success('تم حذف المستخدم'); load()
  }

  const toggleStatus = async (u: User) => {
    const ns = u.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('users').update({ status: ns }).eq('id', u.id)
    if (error) { toast.error('فشل تغيير الحالة'); return }
    toast.success(ns === 'active' ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم'); load()
  }

  const genderLabel = (g: number | null) => g === 1 ? '♂ ذكر' : g === 2 ? '♀ أنثى' : '—'

  return (
    <div>
      <ToastContainer toasts={toast.toasts} remove={toast.remove} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'api' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('api')}>
          <UserSearch size={16} /> البحث في المنصة
        </button>
        <button className={`btn ${activeTab === 'local' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('local')}>
          <UsersIcon size={16} /> المستخدمون المحليون ({users.length})
        </button>
      </div>

      {/* ─── API Search Tab ─── */}
      {activeTab === 'api' && (
        <div>
          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-header">
              <h2>البحث عن مستخدم بالرقم</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>منصة Sayyouditto</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  type="number"
                  placeholder="أدخل رقم المستخدم (erban) مثال: 6038733"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPlatformUser()}
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', direction: 'ltr', outline: 'none' }}
                />
                <button className="btn btn-primary" onClick={searchPlatformUser} disabled={searching || !searchId.trim()}>
                  {searching
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} /> جاري البحث...</>
                    : <><Search size={16} /> بحث</>}
                </button>
              </div>

              {searchError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={15} />{searchError}
                </div>
              )}
            </div>
          </div>

          {platformUser && (
            <div className="table-card">
              <div className="table-header">
                <h2>بيانات المستخدم</h2>
                <a href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${platformUser.erbanNo}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  <ExternalLink size={13} /> مصدر API
                </a>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  {platformUser.avatar
                    ? <img src={platformUser.avatar} alt={platformUser.nick} style={{ width: 90, height: 90, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <div style={{ width: 90, height: 90, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--primary)', flexShrink: 0 }}>{platformUser.nick?.[0] ?? '?'}</div>
                  }

                  {/* Info Grid */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                    {[
                      { label: 'الاسم', value: platformUser.nick || '—', bold: true },
                      { label: 'رقم المستخدم', value: String(platformUser.erbanNo), bold: true },
                      { label: 'الـ UID', value: String(platformUser.uid) },
                      { label: 'الجنس', value: genderLabel(platformUser.gender) },
                      { label: 'العمر', value: platformUser.age ? `${platformUser.age} سنة` : '—' },
                      { label: 'الدولة', value: platformUser.country || '—' },
                      { label: 'المدينة', value: platformUser.city || '—' },
                      { label: 'النبيل', value: platformUser.nobleName || '—' },
                      { label: 'مستوى السحر', value: platformUser.charmLevel ? String(platformUser.charmLevel) : '—' },
                      { label: 'مستوى التجربة', value: platformUser.experLevel ? String(platformUser.experLevel) : '—' },
                      { label: 'هدايا الدردشة', value: platformUser.chatGift === 1 ? 'مفعّل' : 'معطّل' },
                      { label: 'نطاق الدردشة', value: platformUser.chatRange === 1 ? 'عام' : 'خاص' },
                    ].map(({ label, value, bold }) => (
                      <div key={label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: 'var(--text)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!platformUser && !searchError && !searching && (
            <div className="empty-state">
              <UserSearch />
              <h3>ابحث عن مستخدم</h3>
              <p>أدخل رقم المستخدم (erban) من منصة Sayyouditto</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Local Users Tab ─── */}
      {activeTab === 'local' && (
        <div>
          <DbSetup show={dbMissing} />

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>الحالة:</span>
            {(['all', 'active', 'inactive'] as const).map(v => (
              <button key={v} onClick={() => setStatusFilter(v)} className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`}>
                {v === 'all' ? `الكل (${users.length})` : v === 'active' ? `نشط (${users.filter(u => u.status === 'active').length})` : `معطّل (${users.filter(u => u.status === 'inactive').length})`}
              </button>
            ))}
          </div>

          <div className="table-card">
            <div className="table-header">
              <h2>المستخدمون ({filtered.length})</h2>
              <div className="table-controls">
                <div className="search-box">
                  <Search />
                  <input type="text" placeholder="بحث بالاسم أو البريد أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> إضافة مستخدم</button>
              </div>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <UsersIcon />
                <h3>{search ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}</h3>
                <p>{search ? `لم يتم العثور على "${search}"` : 'أضف مستخدماً جديداً بالضغط على زر الإضافة'}</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الوكالة</th><th>الحالة</th><th>التاريخ</th><th>الإجراءات</th></tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, background: '#d1fae5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {u.name[0]}
                          </div>
                          <strong>{u.name}</strong>
                        </div>
                      </td>
                      <td>{u.email || '—'}</td>
                      <td style={{ direction: 'ltr', textAlign: 'right' }}>{u.phone || '—'}</td>
                      <td>{u.agency_name || '—'}</td>
                      <td>
                        <button
                          onClick={() => toggleStatus(u)}
                          className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                          style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          title="اضغط لتغيير الحالة"
                        >
                          {u.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {u.status === 'active' ? 'نشط' : 'معطّل'}
                        </button>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('ar-EG')}</td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(u)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="active">نشط</option>
                    <option value="inactive">معطّل</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
