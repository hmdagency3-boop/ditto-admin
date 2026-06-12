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

type DittoUser = {
  uid: number; erbanNo: number; nick: string; avatar: string
  onLine: boolean; gender: number; ban: number
  usersAvatarStatus: number; chatGift: number; chatRange: number
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
  const [dittoUser, setDittoUser]       = useState<DittoUser | null>(null)
  const [searchError, setSearchError]   = useState('')
  const [searchStep, setSearchStep]     = useState('')

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
    setSearching(true); setPlatformUser(null); setDittoUser(null); setSearchError(''); setSearchStep('')
    try {
      // Step 1: get base info by erbanNo
      setSearchStep('جاري جلب بيانات المستخدم...')
      const res1  = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${searchId.trim()}`)
      const json1 = await res1.json()
      if (json1.code !== 200 || !json1.data?.uid) {
        setSearchError('لم يتم العثور على مستخدم بهذا الرقم')
        setSearching(false); setSearchStep(''); return
      }
      setPlatformUser(json1.data)

      // Step 2: fetch extended info by uid from second API
      setSearchStep('جاري جلب البيانات التفصيلية...')
      try {
        const res2  = await fetch(`https://www.dittoparty.com/user/v4/get?uid=${json1.data.uid}`)
        const json2 = await res2.json()
        if (json2.code === 200 && json2.data) {
          setDittoUser(json2.data)
        }
      } catch {
        // second API failed silently — still show first API data
      }
    } catch {
      setSearchError('تعذّر الاتصال بالخادم، تأكد من الرقم وأعد المحاولة')
    }
    setSearching(false); setSearchStep('')
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

              {/* Step indicator while searching */}
              {searching && searchStep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, margin: 0 }} />
                  {searchStep}
                </div>
              )}

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
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${platformUser.erbanNo}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <ExternalLink size={13} /> Sayyouditto
                  </a>
                  {dittoUser && (
                    <a href={`https://www.dittoparty.com/user/v4/get?uid=${platformUser.uid}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                      <ExternalLink size={13} /> Dittoparty
                    </a>
                  )}
                </div>
              </div>

              <div style={{ padding: 24 }}>
                {/* Header: avatar + name + status badges */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {(dittoUser?.avatar || platformUser.avatar)
                      ? <img
                          src={dittoUser?.avatar || platformUser.avatar}
                          alt={platformUser.nick}
                          style={{ width: 90, height: 90, borderRadius: 14, objectFit: 'cover', border: '3px solid var(--border)' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      : <div style={{ width: 90, height: 90, borderRadius: 14, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--primary)' }}>
                          {platformUser.nick?.[0] ?? '?'}
                        </div>
                    }
                    {/* Online indicator */}
                    {dittoUser && (
                      <div style={{
                        position: 'absolute', bottom: 4, left: 4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: dittoUser.onLine ? '#10b981' : '#94a3b8',
                        border: '2px solid white',
                      }} title={dittoUser.onLine ? 'متصل' : 'غير متصل'} />
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{platformUser.nick || '—'}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {dittoUser && (
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: dittoUser.onLine ? '#d1fae5' : '#f1f5f9', color: dittoUser.onLine ? '#065f46' : '#64748b' }}>
                          {dittoUser.onLine ? '🟢 متصل الآن' : '⚫ غير متصل'}
                        </span>
                      )}
                      {dittoUser && dittoUser.ban === 1 && (
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
                          🚫 محظور
                        </span>
                      )}
                      {dittoUser && dittoUser.ban !== 1 && (
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>
                          ✅ غير محظور
                        </span>
                      )}
                      {platformUser.nobleName && (
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                          👑 {platformUser.nobleName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info sections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Section 1: Basic Info */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                      المعلومات الأساسية
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'رقم erban', value: String(platformUser.erbanNo) },
                        { label: 'الـ UID', value: String(platformUser.uid) },
                        { label: 'الجنس', value: genderLabel(platformUser.gender) },
                        { label: 'الدولة', value: platformUser.country || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Platform Status */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                      حالة المنصة {dittoUser ? '' : <span style={{ color: '#f59e0b', fontSize: 10 }}>(بيانات جزئية)</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'الحالة', value: dittoUser ? (dittoUser.onLine ? 'متصل 🟢' : 'غير متصل ⚫') : '—' },
                        { label: 'الحظر', value: dittoUser ? (dittoUser.ban === 1 ? 'محظور 🚫' : 'غير محظور ✅') : '—' },
                        { label: 'هدايا الدردشة', value: (dittoUser?.chatGift ?? platformUser.chatGift) === 1 ? 'مفعّل ✅' : 'معطّل ❌' },
                        { label: 'نطاق الدردشة', value: (dittoUser?.chatRange ?? platformUser.chatRange) === 1 ? 'عام 🌍' : 'خاص 🔒' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Second API badge */}
                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dittoUser
                    ? <><span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> تم جلب البيانات من كلا المصدرين (Sayyouditto + Dittoparty)</>
                    : <><span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠</span> تم جلب البيانات من Sayyouditto فقط — Dittoparty لم يستجب</>
                  }
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
