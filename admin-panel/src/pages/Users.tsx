import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Users as UsersIcon, X, AlertTriangle, UserSearch, ExternalLink } from 'lucide-react'
import { supabase, isSupabaseConfigured, type User, type Agency } from '../lib/supabase'

const emptyForm = { name: '', email: '', phone: '', agency_id: '', status: 'active' as 'active' | 'inactive' }

type PlatformUser = {
  uid: number
  erbanNo: number
  nick: string
  avatar: string
  country: string | null
  gender: number | null
  age: number | null
  city: string | null
  chatGift: number | null
  chatRange: number | null
}

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

  // API Search state
  const [searchId, setSearchId] = useState('')
  const [searching, setSearching] = useState(false)
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null)
  const [searchError, setSearchError] = useState('')
  const [activeTab, setActiveTab] = useState<'api' | 'local'>('api')

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

  const searchPlatformUser = async () => {
    if (!searchId.trim()) return
    setSearching(true)
    setPlatformUser(null)
    setSearchError('')
    try {
      const res = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${searchId.trim()}`)
      const json = await res.json()
      if (json.code === 200 && json.data) {
        setPlatformUser(json.data)
      } else {
        setSearchError('لم يتم العثور على مستخدم بهذا الرقم')
      }
    } catch {
      setSearchError('تعذّر الاتصال بالخادم. تأكد من الرقم وأعد المحاولة.')
    }
    setSearching(false)
  }

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

  const genderLabel = (g: number | null) => g === 1 ? 'ذكر' : g === 2 ? 'أنثى' : '—'

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'api' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('api')}
        >
          <UserSearch size={16} />
          البحث في المنصة
        </button>
        <button
          className={`btn ${activeTab === 'local' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('local')}
        >
          <UsersIcon size={16} />
          المستخدمون المحليون
        </button>
      </div>

      {/* API Search Tab */}
      {activeTab === 'api' && (
        <div>
          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-header">
              <h2>البحث عن مستخدم بالرقم</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="أدخل رقم المستخدم (مثال: 6038733)"
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPlatformUser()}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      direction: 'ltr',
                      outline: 'none',
                    }}
                  />
                </div>
                <button className="btn btn-primary" onClick={searchPlatformUser} disabled={searching || !searchId.trim()}>
                  {searching ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                      جاري البحث...
                    </span>
                  ) : (
                    <><Search size={16} /> بحث</>
                  )}
                </button>
              </div>

              {searchError && (
                <div style={{
                  background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '12px 16px', color: '#991b1b', fontSize: 13, display: 'flex',
                  alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={16} />
                  {searchError}
                </div>
              )}
            </div>
          </div>

          {platformUser && (
            <div className="table-card" style={{ overflow: 'visible' }}>
              <div className="table-header">
                <h2>نتيجة البحث</h2>
                <a
                  href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${platformUser.erbanNo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <ExternalLink size={14} />
                  API مصدر
                </a>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    {platformUser.avatar ? (
                      <img
                        src={platformUser.avatar}
                        alt={platformUser.nick}
                        style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)' }}
                        onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=?' }}
                      />
                    ) : (
                      <div style={{
                        width: 100, height: 100, borderRadius: 12, background: 'var(--primary-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: 'var(--primary)'
                      }}>
                        {platformUser.nick?.[0] ?? '?'}
                      </div>
                    )}
                  </div>

                  {/* User Info Grid */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                    <InfoRow label="الاسم" value={platformUser.nick || '—'} highlight />
                    <InfoRow label="رقم المستخدم (erban)" value={String(platformUser.erbanNo)} highlight />
                    <InfoRow label="الـ UID" value={String(platformUser.uid)} />
                    <InfoRow label="الجنس" value={genderLabel(platformUser.gender)} />
                    <InfoRow label="العمر" value={platformUser.age ? `${platformUser.age} سنة` : '—'} />
                    <InfoRow label="الدولة" value={platformUser.country || '—'} />
                    <InfoRow label="المدينة" value={platformUser.city || '—'} />
                    <InfoRow label="هدايا الدردشة" value={platformUser.chatGift === 1 ? 'مفعّل' : platformUser.chatGift === 0 ? 'معطّل' : '—'} />
                    <InfoRow label="نطاق الدردشة" value={platformUser.chatRange === 1 ? 'عام' : platformUser.chatRange === 0 ? 'خاص' : '—'} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!platformUser && !searchError && !searching && (
            <div className="empty-state">
              <UserSearch />
              <h3>ابحث عن مستخدم</h3>
              <p>أدخل رقم المستخدم من منصة Sayyouditto للبحث عن بياناته</p>
            </div>
          )}
        </div>
      )}

      {/* Local Users Tab */}
      {activeTab === 'local' && (
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
                <h3>{search ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}</h3>
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
                          style={{ cursor: 'pointer', border: 'none' }}
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

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)'
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: highlight ? 15 : 13, fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--text)' : 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}
