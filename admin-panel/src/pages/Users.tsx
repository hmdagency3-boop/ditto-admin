import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Users as UsersIcon, X, UserSearch,
         ExternalLink, ToggleLeft, ToggleRight, Filter, AlertTriangle,
         List, LayoutGrid, Loader2 } from 'lucide-react'
import { supabase, isSupabaseConfigured, type User, type Agency } from '../lib/supabase'
import { ToastContainer, useToast } from '../components/Toast'
import DbSetup from '../components/DbSetup'

const emptyForm = { name: '', email: '', phone: '', agency_id: '', status: 'active' as 'active' | 'inactive' }

type PlatformUser = {
  uid: number; erbanNo: number; nick: string; avatar: string
  country: string | null; gender: number | null
  chatGift: number | null; chatRange: number | null
  nobleId: number | null; nobleName: string | null
}
type DittoExtra = { onLine: boolean; ban: number }
type MergedUser = PlatformUser & { ditto?: DittoExtra; error?: string }

// ── helpers ─────────────────────────────────────────────────────────────────
const genderLabel = (g: number | null) => g === 1 ? '♂ ذكر' : g === 2 ? '♀ أنثى' : '—'

async function fetchOne(erban: number): Promise<MergedUser> {
  const res1 = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${erban}`)
  const j1   = await res1.json()
  if (j1.code !== 200 || !j1.data?.uid) return { uid: 0, erbanNo: erban, nick: '—', avatar: '', country: null, gender: null, chatGift: null, chatRange: null, nobleId: null, nobleName: null, error: 'غير موجود' }
  const base: PlatformUser = j1.data
  try {
    const res2 = await fetch(`https://www.dittoparty.com/user/v4/get?uid=${base.uid}`)
    const j2   = await res2.json()
    if (j2.code === 200 && j2.data) return { ...base, ditto: { onLine: j2.data.onLine, ban: j2.data.ban } }
  } catch { /* silent */ }
  return base
}

// concurrency limiter: run at most `limit` at a time
async function fetchBatch(ids: number[], onProgress: (done: number) => void): Promise<MergedUser[]> {
  const results: MergedUser[] = new Array(ids.length)
  let done = 0
  const limit = 5
  const queue = [...ids.entries()]
  const workers = Array.from({ length: Math.min(limit, ids.length) }, async () => {
    while (queue.length) {
      const entry = queue.shift()
      if (!entry) break
      const [i, id] = entry
      results[i] = await fetchOne(id)
      done++; onProgress(done)
    }
  })
  await Promise.all(workers)
  return results
}

// ── component ────────────────────────────────────────────────────────────────
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

  // single search
  const [searchId, setSearchId]           = useState('')
  const [singleUser, setSingleUser]       = useState<MergedUser | null>(null)
  const [singleError, setSingleError]     = useState('')
  const [singleSearching, setSingleSearching] = useState(false)
  const [singleStep, setSingleStep]       = useState('')

  // batch search
  const [batchMode, setBatchMode]         = useState(false)
  const [batchInput, setBatchInput]       = useState('')
  const [batchResults, setBatchResults]   = useState<MergedUser[]>([])
  const [batchSearching, setBatchSearching] = useState(false)
  const [batchDone, setBatchDone]         = useState(0)
  const [batchTotal, setBatchTotal]       = useState(0)
  const [batchView, setBatchView]         = useState<'grid' | 'table'>('grid')

  const toast = useToast()

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: usersData, error }, { data: agenciesData }] = await Promise.all([
      supabase.from('users').select('*, agencies(name)').order('created_at', { ascending: false }),
      supabase.from('agencies').select('id, name').eq('status', 'active'),
    ])
    if (error?.code === '42P01') { setDbMissing(true); setLoading(false); return }
    setUsers((usersData ?? []).map((u: any) => ({ ...u, agency_name: u.agencies?.name ?? '' })))
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(users.filter(u => {
      const ms = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q) || (u.agency_name ?? '').toLowerCase().includes(q)
      const mst = statusFilter === 'all' || u.status === statusFilter
      return ms && mst
    }))
  }, [search, statusFilter, users])

  // ── single search ──────────────────────────────────────────────
  const doSingleSearch = async () => {
    if (!searchId.trim()) return
    setSingleSearching(true); setSingleUser(null); setSingleError(''); setSingleStep('')
    setSingleStep('جاري جلب بيانات المستخدم...')
    try {
      const res1 = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${searchId.trim()}`)
      const j1   = await res1.json()
      if (j1.code !== 200 || !j1.data?.uid) { setSingleError('لم يتم العثور على مستخدم بهذا الرقم'); setSingleSearching(false); setSingleStep(''); return }
      let merged: MergedUser = j1.data
      setSingleStep('جاري جلب البيانات التفصيلية...')
      try {
        const res2 = await fetch(`https://www.dittoparty.com/user/v4/get?uid=${j1.data.uid}`)
        const j2   = await res2.json()
        if (j2.code === 200 && j2.data) merged = { ...merged, ditto: { onLine: j2.data.onLine, ban: j2.data.ban } }
      } catch { /* silent */ }
      setSingleUser(merged)
    } catch { setSingleError('تعذّر الاتصال بالخادم') }
    setSingleSearching(false); setSingleStep('')
  }

  // ── batch search ───────────────────────────────────────────────
  const doBatchSearch = useCallback(async () => {
    const ids = batchInput.split(/[\n,\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
    if (!ids.length) return
    setBatchSearching(true); setBatchResults([]); setBatchDone(0); setBatchTotal(ids.length)
    const results = await fetchBatch(ids, done => setBatchDone(done))
    setBatchResults(results)
    setBatchSearching(false)
  }, [batchInput])

  // ── local CRUD ─────────────────────────────────────────────────
  const openAdd  = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true) }
  const openEdit = (u: User) => { setForm({ name: u.name, email: u.email, phone: u.phone, agency_id: u.agency_id ?? '', status: u.status }); setEditing(u.id); setModal(true) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, agency_id: form.agency_id || null }
    const { error } = editing ? await supabase.from('users').update(payload).eq('id', editing) : await supabase.from('users').insert(payload)
    setSaving(false)
    if (error) { toast.error('حدث خطأ، يرجى المحاولة مجدداً'); return }
    toast.success(editing ? 'تم تعديل المستخدم' : 'تم إضافة المستخدم')
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
    toast.success(ns === 'active' ? 'تم التفعيل' : 'تم التعطيل'); load()
  }

  return (
    <div>
      <ToastContainer toasts={toast.toasts} remove={toast.remove} />

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'api' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('api')}>
          <UserSearch size={16} /> البحث في المنصة
        </button>
        <button className={`btn ${activeTab === 'local' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('local')}>
          <UsersIcon size={16} /> المستخدمون المحليون ({users.length})
        </button>
      </div>

      {/* ══════════════ API TAB ══════════════ */}
      {activeTab === 'api' && (
        <div>
          {/* Search card */}
          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-header">
              <h2>البحث عن مستخدم</h2>
              {/* Single / Batch toggle */}
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setBatchMode(false)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: !batchMode ? 'var(--primary)' : 'transparent', color: !batchMode ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Search size={13} /> بحث فردي
                </button>
                <button
                  onClick={() => setBatchMode(true)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: batchMode ? 'var(--primary)' : 'transparent', color: batchMode ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <List size={13} /> بحث جماعي
                </button>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {/* ── Single ── */}
              {!batchMode && (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <input
                      type="number"
                      placeholder="أدخل رقم المستخدم (erban) مثال: 6038733"
                      value={searchId}
                      onChange={e => setSearchId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doSingleSearch()}
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', direction: 'ltr', outline: 'none' }}
                    />
                    <button className="btn btn-primary" onClick={doSingleSearch} disabled={singleSearching || !searchId.trim()}>
                      {singleSearching ? <><Loader2 size={15} className="spin" /> بحث...</> : <><Search size={15} /> بحث</>}
                    </button>
                  </div>
                  {singleSearching && singleStep && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="spinner" style={{ width: 11, height: 11, borderWidth: 2, margin: 0 }} />{singleStep}
                    </div>
                  )}
                  {singleError && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={15} />{singleError}
                    </div>
                  )}
                </>
              )}

              {/* ── Batch ── */}
              {batchMode && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    أدخل الأرقام بالسطر أو الفاصلة أو المسافة — يقبل حتى 100 رقم في المرة
                  </p>
                  <textarea
                    placeholder={'6504715\n5263413\n6038733\n4107782\n...'}
                    value={batchInput}
                    onChange={e => setBatchInput(e.target.value)}
                    rows={5}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', direction: 'ltr', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={doBatchSearch} disabled={batchSearching || !batchInput.trim()}>
                      {batchSearching
                        ? <><Loader2 size={15} className="spin" /> جاري البحث ({batchDone}/{batchTotal})...</>
                        : <><Search size={15} /> بحث عن الكل</>}
                    </button>
                    {batchResults.length > 0 && !batchSearching && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {batchResults.filter(r => !r.error).length} نتيجة ناجحة من {batchResults.length}
                        </span>
                        {/* Grid / Table toggle */}
                        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginRight: 'auto' }}>
                          <button onClick={() => setBatchView('grid')} style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', background: batchView === 'grid' ? 'var(--primary)' : 'transparent', color: batchView === 'grid' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <LayoutGrid size={14} />
                          </button>
                          <button onClick={() => setBatchView('table')} style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', background: batchView === 'table' ? 'var(--primary)' : 'transparent', color: batchView === 'table' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <List size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Progress bar */}
                  {batchSearching && batchTotal > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((batchDone / batchTotal) * 100)}%`, background: 'linear-gradient(90deg,#1a56db,#7c3aed)', borderRadius: 4, transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{batchDone} / {batchTotal}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Single result ── */}
          {!batchMode && singleUser && <SingleResult user={singleUser} />}

          {/* ── Batch results ── */}
          {batchMode && batchResults.length > 0 && !batchSearching && (
            batchView === 'grid'
              ? <BatchGrid results={batchResults} />
              : <BatchTable results={batchResults} />
          )}

          {/* Empty state */}
          {!batchMode && !singleUser && !singleError && !singleSearching && (
            <div className="empty-state"><UserSearch /><h3>ابحث عن مستخدم</h3><p>أدخل رقم erban من منصة Sayyouditto</p></div>
          )}
          {batchMode && batchResults.length === 0 && !batchSearching && (
            <div className="empty-state"><List /><h3>البحث الجماعي</h3><p>الصق الأرقام في الخانة أعلاه ثم اضغط بحث</p></div>
          )}
        </div>
      )}

      {/* ══════════════ LOCAL TAB ══════════════ */}
      {activeTab === 'local' && (
        <div>
          <DbSetup show={dbMissing} />
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
                <div className="search-box"><Search /><input type="text" placeholder="بحث بالاسم أو البريد..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> إضافة مستخدم</button>
              </div>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><p>جاري التحميل...</p></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><UsersIcon /><h3>{search ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}</h3><p>{search ? `لم يتم العثور على "${search}"` : 'أضف مستخدماً جديداً'}</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الوكالة</th><th>الحالة</th><th>التاريخ</th><th>الإجراءات</th></tr></thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{u.name[0]}</div>
                          <strong>{u.name}</strong>
                        </div>
                      </td>
                      <td>{u.email || '—'}</td>
                      <td style={{ direction: 'ltr', textAlign: 'right' }}>{u.phone || '—'}</td>
                      <td>{u.agency_name || '—'}</td>
                      <td>
                        <button onClick={() => toggleStatus(u)} className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
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

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editing ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>الاسم الكامل *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="أدخل الاسم" /></div>
              <div className="form-row">
                <div className="form-group"><label>البريد الإلكتروني</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" /></div>
                <div className="form-group"><label>رقم الهاتف</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" /></div>
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
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single Result card ────────────────────────────────────────────────────────
function SingleResult({ user }: { user: MergedUser }) {
  return (
    <div className="table-card">
      <div className="table-header">
        <h2>بيانات المستخدم</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${user.erbanNo}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><ExternalLink size={13} /> Sayyouditto</a>
          {user.ditto && <a href={`https://www.dittoparty.com/user/v4/get?uid=${user.uid}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><ExternalLink size={13} /> Dittoparty</a>}
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user.avatar
              ? <img src={user.avatar} alt={user.nick} style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover', border: '3px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              : <div style={{ width: 88, height: 88, borderRadius: 14, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--primary)' }}>{user.nick?.[0] ?? '?'}</div>
            }
            {user.ditto && <div style={{ position: 'absolute', bottom: 4, left: 4, width: 14, height: 14, borderRadius: '50%', background: user.ditto.onLine ? '#10b981' : '#94a3b8', border: '2px solid white' }} />}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{user.nick}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {user.ditto && <StatusBadge online={user.ditto.onLine} />}
              {user.ditto && <BanBadge ban={user.ditto.ban} />}
              {user.nobleName && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>👑 {user.nobleName}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InfoSection title="المعلومات الأساسية" rows={[
            { label: 'رقم erban', value: String(user.erbanNo) },
            { label: 'الـ UID', value: String(user.uid) },
            { label: 'الجنس', value: genderLabel(user.gender) },
            { label: 'الدولة', value: user.country || '—' },
          ]} />
          <InfoSection title="حالة المنصة" rows={[
            { label: 'الحالة', value: user.ditto ? (user.ditto.onLine ? 'متصل 🟢' : 'غير متصل ⚫') : '—' },
            { label: 'الحظر', value: user.ditto ? (user.ditto.ban === 1 ? 'محظور 🚫' : 'غير محظور ✅') : '—' },
            { label: 'هدايا الدردشة', value: user.chatGift === 1 ? 'مفعّل ✅' : 'معطّل ❌' },
            { label: 'نطاق الدردشة', value: user.chatRange === 1 ? 'عام 🌍' : 'خاص 🔒' },
          ]} />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          {user.ditto ? '✓ تم جلب البيانات من كلا المصدرين' : '⚠ Dittoparty لم يستجب — بيانات جزئية'}
        </div>
      </div>
    </div>
  )
}

// ── Batch Grid ───────────────────────────────────────────────────────────────
function BatchGrid({ results }: { results: MergedUser[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {results.map((u, i) => (
        <div key={i} style={{
          background: 'white', border: `1px solid ${u.error ? '#fecaca' : 'var(--border)'}`,
          borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
          opacity: u.error ? 0.7 : 1,
        }}>
          {u.error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>?</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b' }}>{u.erbanNo}</div>
                <div style={{ fontSize: 11, color: '#ef4444' }}>{u.error}</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {u.avatar
                    ? <img src={u.avatar} alt={u.nick} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--primary)', fontWeight: 700 }}>{u.nick?.[0] ?? '?'}</div>
                  }
                  {u.ditto && <div style={{ position: 'absolute', bottom: -2, left: -2, width: 12, height: 12, borderRadius: '50%', background: u.ditto.onLine ? '#10b981' : '#94a3b8', border: '2px solid white' }} />}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nick}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', direction: 'ltr' }}>{u.erbanNo}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {u.country && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>{u.country}</span>}
                {u.ditto && <StatusBadge online={u.ditto.onLine} small />}
                {u.ditto && <BanBadge ban={u.ditto.ban} small />}
                {u.nobleName && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>👑</span>}
              </div>

              <div style={{ display: 'flex', gap: 5, marginTop: 'auto' }}>
                <a href={`https://www.sayyouditto.com/pay/payermax/getInfo?no=${u.erbanNo}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ExternalLink size={10} /> API
                </a>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Batch Table ──────────────────────────────────────────────────────────────
function BatchTable({ results }: { results: MergedUser[] }) {
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr><th>#</th><th>المستخدم</th><th>رقم erban</th><th>الـ UID</th><th>الجنس</th><th>الدولة</th><th>الحالة</th><th>الحظر</th></tr>
        </thead>
        <tbody>
          {results.map((u, i) => (
            <tr key={i} style={{ opacity: u.error ? 0.5 : 1 }}>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
              <td>
                {u.error ? (
                  <span style={{ color: '#ef4444', fontSize: 12 }}>غير موجود</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {u.avatar
                        ? <img src={u.avatar} alt={u.nick} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        : <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{u.nick?.[0] ?? '?'}</div>
                      }
                      {u.ditto && <div style={{ position: 'absolute', bottom: -1, left: -1, width: 10, height: 10, borderRadius: '50%', background: u.ditto.onLine ? '#10b981' : '#94a3b8', border: '2px solid white' }} />}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{u.nick}</span>
                  </div>
                )}
              </td>
              <td style={{ direction: 'ltr', fontWeight: 600, fontSize: 12 }}>{u.erbanNo}</td>
              <td style={{ direction: 'ltr', fontSize: 12, color: 'var(--text-muted)' }}>{u.uid || '—'}</td>
              <td style={{ fontSize: 12 }}>{genderLabel(u.gender)}</td>
              <td style={{ fontSize: 12 }}>{u.country || '—'}</td>
              <td>{u.ditto ? <StatusBadge online={u.ditto.onLine} small /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
              <td>{u.ditto ? <BanBadge ban={u.ditto.ban} small /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Small reusable badges ─────────────────────────────────────────────────────
function StatusBadge({ online, small }: { online: boolean; small?: boolean }) {
  const s = small ? { fontSize: 10, padding: '1px 7px' } : { fontSize: 12, padding: '2px 10px' }
  return <span style={{ ...s, borderRadius: 20, fontWeight: 600, background: online ? '#d1fae5' : '#f1f5f9', color: online ? '#065f46' : '#64748b' }}>{online ? '🟢 متصل' : '⚫ غير متصل'}</span>
}

function BanBadge({ ban, small }: { ban: number; small?: boolean }) {
  const s = small ? { fontSize: 10, padding: '1px 7px' } : { fontSize: 12, padding: '2px 10px' }
  return <span style={{ ...s, borderRadius: 20, fontWeight: 600, background: ban === 1 ? '#fee2e2' : '#d1fae5', color: ban === 1 ? '#991b1b' : '#065f46' }}>{ban === 1 ? '🚫 محظور' : '✅ سليم'}</span>
}

function InfoSection({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
