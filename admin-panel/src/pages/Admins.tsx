import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, X, ToggleLeft, ToggleRight, Filter, UserSearch, ExternalLink, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured, type Admin, type Agency } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import DbSetup from '../components/DbSetup'

const emptyForm = {
  name: '', email: '', phone: '', role: 'admin', agency_id: '', status: 'active' as 'active' | 'inactive',
  uid: null as number | null, erban_no: null as number | null, avatar: '' , country: '', gender: null as number | null,
  platform_ban: null as number | null, online_status: null as boolean | null,
}

type PlatformData = {
  uid: number; erbanNo: number; nick: string; avatar: string
  country: string | null; gender: number | null
  onLine?: boolean; ban?: number; chatGift?: number; chatRange?: number
}

const roleColors: Record<string, string> = { super_admin: 'badge-danger', admin: 'badge-warning', moderator: 'badge-success' }
const roleLabels: Record<string, string>  = { admin: 'مشرف', super_admin: 'مشرف عام', moderator: 'مراقب' }
const genderLabel = (g: number | null) => g === 1 ? '♂ ذكر' : g === 2 ? '♀ أنثى' : '—'

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
  const [activeTab, setActiveTab]       = useState<'platform' | 'local'>('local')

  // platform search
  const [searchId, setSearchId]         = useState('')
  const [searching, setSearching]       = useState(false)
  const [platformData, setPlatformData] = useState<PlatformData | null>(null)
  const [searchError, setSearchError]   = useState('')
  const [searchStep, setSearchStep]     = useState('')

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
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.phone.includes(q) || String(a.erban_no ?? '').includes(q)
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      const matchRole   = roleFilter === 'all' || a.role === roleFilter
      return matchSearch && matchStatus && matchRole
    }))
  }, [search, statusFilter, roleFilter, admins])

  // ── Platform Search ──────────────────────────────────────────────────
  const searchPlatform = async () => {
    if (!searchId.trim()) return
    setSearching(true); setPlatformData(null); setSearchError(''); setSearchStep('')
    try {
      setSearchStep('جاري جلب بيانات المستخدم...')
      const res1  = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${searchId.trim()}`)
      const json1 = await res1.json()
      if (json1.code !== 200 || !json1.data?.uid) {
        setSearchError('لم يتم العثور على مستخدم بهذا الرقم')
        setSearching(false); setSearchStep(''); return
      }
      let merged: PlatformData = { ...json1.data }

      setSearchStep('جاري جلب البيانات التفصيلية...')
      try {
        const res2  = await fetch(`https://www.dittoparty.com/user/v4/get?uid=${json1.data.uid}`)
        const json2 = await res2.json()
        if (json2.code === 200 && json2.data) {
          merged = { ...merged, onLine: json2.data.onLine, ban: json2.data.ban }
        }
      } catch { /* silent */ }

      setPlatformData(merged)
    } catch {
      setSearchError('تعذّر الاتصال بالخادم، تأكد من الرقم وأعد المحاولة')
    }
    setSearching(false); setSearchStep('')
  }

  const importAsAdmin = (role: string) => {
    if (!platformData) return
    setForm({
      name: platformData.nick || '',
      email: '', phone: '',
      role,
      agency_id: '', status: 'active',
      uid: platformData.uid,
      erban_no: platformData.erbanNo,
      avatar: platformData.avatar || '',
      country: platformData.country || '',
      gender: platformData.gender ?? null,
      platform_ban: platformData.ban ?? null,
      online_status: platformData.onLine ?? null,
    })
    setEditing(null)
    setModal(true)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────
  const openAdd  = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (a: Admin) => {
    setForm({
      name: a.name, email: a.email, phone: a.phone, role: a.role,
      agency_id: a.agency_id ?? '', status: a.status,
      uid: a.uid ?? null, erban_no: a.erban_no ?? null,
      avatar: a.avatar ?? '', country: a.country ?? '',
      gender: a.gender ?? null, platform_ban: a.platform_ban ?? null,
      online_status: a.online_status ?? null,
    })
    setEditing(a.id); setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name, email: form.email, phone: form.phone,
      role: form.role, status: form.status,
      agency_id: form.agency_id || null,
      uid: form.uid, erban_no: form.erban_no,
      avatar: form.avatar || null, country: form.country || null,
      gender: form.gender, platform_ban: form.platform_ban,
      online_status: form.online_status,
    }
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
    toast.success('تم حذف المشرف'); load()
  }

  const toggleStatus = async (a: Admin) => {
    const ns = a.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('admins').update({ status: ns }).eq('id', a.id)
    if (error) { toast.error('فشل تغيير الحالة'); return }
    toast.success(ns === 'active' ? 'تم تفعيل المشرف' : 'تم تعطيل المشرف'); load()
  }

  return (
    <div>
      <ToastContainer toasts={toast.toasts} remove={toast.remove} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'platform' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('platform')}>
          <UserSearch size={16} /> استيراد من المنصة
        </button>
        <button className={`btn ${activeTab === 'local' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('local')}>
          <ShieldCheck size={16} /> المشرفون ({admins.length})
        </button>
      </div>

      {/* ─── Platform Search Tab ─── */}
      {activeTab === 'platform' && (
        <div>
          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-header">
              <h2>البحث عن مستخدم من المنصة</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sayyouditto + Dittoparty</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  type="number"
                  placeholder="أدخل رقم المستخدم (erban) مثال: 6038733"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPlatform()}
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', direction: 'ltr', outline: 'none' }}
                />
                <button className="btn btn-primary" onClick={searchPlatform} disabled={searching || !searchId.trim()}>
                  {searching
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} /> بحث...</>
                    : <><Search size={16} /> بحث</>}
                </button>
              </div>
              {searching && searchStep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
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

          {platformData && (
            <div className="table-card">
              <div className="table-header">
                <h2>بيانات المستخدم</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${platformData.erbanNo}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <ExternalLink size={13} /> Sayyouditto
                  </a>
                  <a href={`https://www.dittoparty.com/user/v4/get?uid=${platformData.uid}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <ExternalLink size={13} /> Dittoparty
                  </a>
                </div>
              </div>

              <div style={{ padding: 24 }}>
                {/* Profile header */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {platformData.avatar
                      ? <img src={platformData.avatar} alt={platformData.nick} style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover', border: '3px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: 80, height: 80, borderRadius: 14, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#7c3aed' }}>{platformData.nick?.[0] ?? '?'}</div>
                    }
                    {platformData.onLine !== undefined && (
                      <div style={{ position: 'absolute', bottom: 4, left: 4, width: 14, height: 14, borderRadius: '50%', background: platformData.onLine ? '#10b981' : '#94a3b8', border: '2px solid white' }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{platformData.nick}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {platformData.onLine !== undefined && (
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: platformData.onLine ? '#d1fae5' : '#f1f5f9', color: platformData.onLine ? '#065f46' : '#64748b' }}>
                          {platformData.onLine ? '🟢 متصل الآن' : '⚫ غير متصل'}
                        </span>
                      )}
                      {platformData.ban !== undefined && (
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: platformData.ban === 1 ? '#fee2e2' : '#d1fae5', color: platformData.ban === 1 ? '#991b1b' : '#065f46' }}>
                          {platformData.ban === 1 ? '🚫 محظور' : '✅ غير محظور'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  {[
                    { label: 'رقم erban', value: String(platformData.erbanNo) },
                    { label: 'الـ UID', value: String(platformData.uid) },
                    { label: 'الجنس', value: genderLabel(platformData.gender) },
                    { label: 'الدولة', value: platformData.country || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', flex: '1 1 120px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Import buttons */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>اختر الصلاحية وأضفه كمشرف في النظام:</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => importAsAdmin('admin')}>
                      <Plus size={15} /> إضافة كـ مشرف
                    </button>
                    <button className="btn btn-outline" onClick={() => importAsAdmin('super_admin')} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                      <Plus size={15} /> إضافة كـ مشرف عام
                    </button>
                    <button className="btn btn-outline" onClick={() => importAsAdmin('moderator')} style={{ borderColor: '#10b981', color: '#10b981' }}>
                      <Plus size={15} /> إضافة كـ مراقب
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!platformData && !searchError && !searching && (
            <div className="empty-state">
              <UserSearch />
              <h3>ابحث عن مستخدم لاستيراده</h3>
              <p>أدخل رقم erban من منصة Sayyouditto لجلب بياناته وإضافته كمشرف</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Local Admins Tab ─── */}
      {activeTab === 'local' && (
        <div>
          <DbSetup show={dbMissing} />

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>الحالة:</span>
            {(['all', 'active', 'inactive'] as const).map(v => (
              <button key={v} onClick={() => setStatusFilter(v)} className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`}>
                {v === 'all' ? 'الكل' : v === 'active' ? 'نشط' : 'معطّل'}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginRight: 8 }}>الصلاحية:</span>
            {(['all', 'super_admin', 'admin', 'moderator'] as const).map(v => (
              <button key={v} onClick={() => setRoleFilter(v)} className={`btn btn-sm ${roleFilter === v ? 'btn-primary' : 'btn-outline'}`}>
                {v === 'all' ? 'الكل' : roleLabels[v]}
              </button>
            ))}
          </div>

          <div className="table-card">
            <div className="table-header">
              <h2>المشرفون ({filtered.length})</h2>
              <div className="table-controls">
                <div className="search-box">
                  <Search />
                  <input type="text" placeholder="بحث بالاسم أو الرقم..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                  <Plus size={16} /> إضافة يدوي
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <ShieldCheck />
                <h3>{search ? 'لا توجد نتائج' : 'لا يوجد مشرفون'}</h3>
                <p>{search ? `لم يتم العثور على "${search}"` : 'أضف مشرفاً يدوياً أو استورده من المنصة'}</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>المشرف</th><th>الرقم / erban</th><th>الصلاحية</th><th>الوكالة</th><th>الدولة</th><th>الحالة</th><th>الإجراءات</th></tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {a.avatar
                            ? <img src={a.avatar} alt={a.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{a.name[0]}</div>
                          }
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                            {a.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {a.erban_no
                          ? <div>
                              <div style={{ fontSize: 12, fontWeight: 700, direction: 'ltr' }}>{a.erban_no}</div>
                              {a.uid && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>uid: {a.uid}</div>}
                            </div>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td><span className={`badge ${roleColors[a.role] ?? 'badge-warning'}`}>{roleLabels[a.role] ?? a.role}</span></td>
                      <td>{a.agency_name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{a.country || '—'}</td>
                      <td>
                        <button
                          onClick={() => toggleStatus(a)}
                          className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                          style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
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
        </div>
      )}

      {/* ─── Modal ─── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>{editing ? 'تعديل المشرف' : form.erban_no ? `إضافة "${form.name}" كمشرف` : 'إضافة مشرف جديد'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">

              {/* Platform preview inside modal */}
              {form.erban_no && !editing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  {form.avatar && <img src={form.avatar} alt={form.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{form.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>erban: {form.erban_no} · uid: {form.uid} · {form.country || '—'}</div>
                  </div>
                  <span style={{ marginRight: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>من المنصة ✓</span>
                </div>
              )}

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
