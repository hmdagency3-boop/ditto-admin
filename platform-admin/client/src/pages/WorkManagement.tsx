import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, FileText, Plus, Trash2,
  Copy, Check, Pencil, ClipboardPaste, Wand2, UserPlus, EyeOff, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Admin {
  id: string;
  username: string;
  full_name: string;
  platform_id?: string;
}

interface Agency {
  id: string;
  admin_id: string;
  agent_id: string;
  agency_name?: string;
  country?: string;
  agent_whatsapp?: string;
  source_platform?: string;
  creation_date?: string;
  opening_date?: string;
  status: 'activated' | 'opened';
  notes?: string;
  created_at: string;
}

interface Supporter {
  id: string;
  admin_id: string;
  supporter_id: string;
  source_platform?: string;
  level?: string;
  management?: string;
  notes?: string;
  created_at: string;
}

interface ReportData {
  agencies_activated: Agency[];
  agencies_opened: Agency[];
  supporters: Supporter[];
  admin: Admin | null;
}

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function getPeriodLabel(p: number) {
  if (p === 1) return 'الفترة الأولى (1 – 10)';
  if (p === 2) return 'الفترة الثانية (11 – 20)';
  return 'الفترة الثالثة (21 – نهاية الشهر)';
}
function getCurrentPeriod() { const d = new Date().getDate(); return d <= 10 ? 1 : d <= 20 ? 2 : 3; }

const EMPTY_AGENCY = { agent_id:'', agency_name:'', admin_id:'', country:'', agent_whatsapp:'', source_platform:'', creation_date:'', opening_date:'', notes:'' };
const EMPTY_SUPPORTER = { supporter_id:'', source_platform:'', level:'', management:'', admin_id:'', notes:'' };

// ══════════════════════════════════════════════════════════
// Smart Parsers
// ══════════════════════════════════════════════════════════

function extractField(text: string, ...keys: string[]): string {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = text.match(new RegExp(`${escaped}\\s*[:\\-：]?\\s*([^\\n]+)`, 'i'));
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

function parseDate(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[،,]/g, '-').trim();
  const ymd = cleaned.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
  const dmy = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  return '';
}

function findAdmin(admins: Admin[], platformId: string, name: string): string {
  if (platformId) {
    const a = admins.find(x => x.platform_id === platformId || x.username === platformId);
    if (a) return a.id;
  }
  if (name) {
    const n = name.trim().toLowerCase();
    const a = admins.find(x =>
      (x.full_name || '').toLowerCase().includes(n) ||
      (x.username || '').toLowerCase().includes(n)
    );
    if (a) return a.id;
  }
  return '';
}

function parseAgencyText(text: string, admins: Admin[]): typeof EMPTY_AGENCY & { _warn?: string; _adminPid?: string; _adminName?: string } {
  const adminPid  = extractField(text, 'ايدي الادمن', 'ايدي الادمين', 'ID الادمن', 'id الادمن');
  const adminName = extractField(text, 'اسم الادمن', 'اسم المشرف');
  const admin_id  = findAdmin(admins, adminPid, adminName);

  return {
    agent_id:        extractField(text, 'ايدي الوكيل', 'id الوكيل', 'كود الوكالة'),
    agency_name:     extractField(text, 'اسم الوكالة'),
    country:         extractField(text, 'البلد', 'الدولة'),
    agent_whatsapp:  extractField(text, 'واتس الوكيل', 'واتساب الوكيل', 'الواتس'),
    source_platform: extractField(text, 'برامج جاء منها', 'المنصة', 'البرنامج القادم', 'البرنامج'),
    creation_date:   parseDate(extractField(text, 'تاريخ الانشاء', 'تاريخ الإنشاء')),
    opening_date:    parseDate(extractField(text, 'تاريخ الافتتاح')),
    admin_id,
    notes: '',
    _warn:      !admin_id && (adminPid || adminName) ? `لم يُعثر على مشرف: ${adminPid || adminName}` : undefined,
    _adminPid:  adminPid  || undefined,
    _adminName: adminName || undefined,
  };
}

function parseSupporterText(text: string, admins: Admin[]): typeof EMPTY_SUPPORTER & { _warn?: string; _adminPid?: string; _adminName?: string } {
  const adminPid  = extractField(text, 'ايدي الادمين', 'ايدي الادمن', 'ID الادمن', 'id الادمن');
  const adminName = extractField(text, 'اسم الادمن', 'اسم المشرف');
  const admin_id  = findAdmin(admins, adminPid, adminName);

  const mgmtLine  = text.split('\n').find(l => /^[\-\s]*إدار[ةه]/u.test(l.trim()));
  const management = mgmtLine ? mgmtLine.replace(/^[\-\s]+/, '').trim() : '';

  return {
    supporter_id:    extractField(text, 'ايدي الداعم', 'id الداعم', 'ID الداعم'),
    source_platform: extractField(text, 'البرنامج القادم', 'البرنامج', 'المنصة'),
    level:           extractField(text, 'ليفل', 'المستوى', 'level'),
    management,
    admin_id,
    notes: '',
    _warn:      !admin_id && (adminPid || adminName) ? `لم يُعثر على مشرف: ${adminPid || adminName}` : undefined,
    _adminPid:  adminPid  || undefined,
    _adminName: adminName || undefined,
  };
}

// ══════════════════════════════════════════════════════════
export default function WorkManagement() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins]         = useState<Admin[]>([]);
  const [agencies, setAgencies]     = useState<Agency[]>([]);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterAdmin, setFilterAdmin] = useState('all');

  const [agencyDlg, setAgencyDlg]         = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [agencyForm, setAgencyForm]       = useState(EMPTY_AGENCY);
  const [savingAgency, setSavingAgency]   = useState(false);
  const [agencyPaste, setAgencyPaste]     = useState(false);
  const [agencyPasteText, setAgencyPasteText] = useState('');

  const [supporterDlg, setSupporterDlg]         = useState(false);
  const [editingSupporter, setEditingSupporter] = useState<Supporter | null>(null);
  const [supporterForm, setSupporterForm]       = useState(EMPTY_SUPPORTER);
  const [savingSupporter, setSavingSupporter]   = useState(false);
  const [supporterPaste, setSupporterPaste]     = useState(false);
  const [supporterPasteText, setSupporterPasteText] = useState('');

  const EMPTY_NEW_ADMIN = { full_name: '', username: '', password: '', platform_id: '' };
  const [showNewAdminAgency, setShowNewAdminAgency]       = useState(false);
  const [showNewAdminSupporter, setShowNewAdminSupporter] = useState(false);
  const [newAdminForm, setNewAdminForm]   = useState(EMPTY_NEW_ADMIN);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showNewAdminPwd, setShowNewAdminPwd] = useState(false);

  const now = new Date();
  const [reportAdmin, setReportAdmin]     = useState('');
  const [reportYear, setReportYear]       = useState(now.getFullYear());
  const [reportMonth, setReportMonth]     = useState(now.getMonth() + 1);
  const [reportPeriod, setReportPeriod]   = useState<1|2|3>(getCurrentPeriod() as 1|2|3);
  const [reportData, setReportData]       = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportDlg, setReportDlg]         = useState(false);
  const [copied, setCopied]               = useState(false);

  const h = useCallback((url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers||{}) } }),
  [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, agenciesRes, supportersRes] = await Promise.all([
        h('/api/users'), h('/api/agencies'), h('/api/supporters'),
      ]);
      const safeJson = async (r: Response, fallback: any[] = []) => {
        try { return r.ok ? await r.json() : fallback; } catch { return fallback; }
      };
      setAdmins((await safeJson(adminsRes)).filter((x:any) => x.id));
      setAgencies(await safeJson(agenciesRes));
      setSupporters(await safeJson(supportersRes));
    } catch { } finally { setLoading(false); }
  }, [h]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const adminName = (id: string) => { const a = admins.find(x => x.id === id); return a ? (a.full_name || a.username) : '—'; };
  const setAF = (k: keyof typeof EMPTY_AGENCY, v: string) => setAgencyForm(f => ({ ...f, [k]: v }));
  const setSF = (k: keyof typeof EMPTY_SUPPORTER, v: string) => setSupporterForm(f => ({ ...f, [k]: v }));

  // ── Auto admin helpers ──────────────────────────────────
  function genUsername(pid?: string, name?: string): string {
    if (pid && /^\d+$/.test(pid)) return `admin_${pid}`;
    if (pid) return pid.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || `admin_${Date.now()}`;
    if (name) return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '').slice(0, 20) || `admin_${Date.now()}`;
    return `admin_${Date.now()}`;
  }
  function genPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async function autoCreateAdmin(
    adminPid: string | undefined,
    adminName: string | undefined,
    onCreated: (id: string) => void
  ) {
    const fullName = adminName || adminPid || 'مشرف جديد';
    const username = genUsername(adminPid, adminName);
    const password = genPassword();

    toast({ title: '⏳ يتم إنشاء المشرف تلقائياً...' });
    try {
      const r = await h('/api/users', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, username, password, platform_id: adminPid || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setAdmins(prev => [...prev, { id: d.id, username: d.username, full_name: d.full_name, platform_id: d.platform_id }]);
      onCreated(d.id);
      toast({
        title: `✅ تم إنشاء المشرف "${fullName}" تلقائياً`,
        description: `اسم الدخول: ${username}   |   كلمة المرور: ${password}`,
        duration: 12000,
      });
    } catch (e: any) {
      toast({ title: '⚠️ فشل إنشاء المشرف تلقائياً', description: e.message + ' — أنشئه يدوياً', variant: 'destructive' });
      setNewAdminForm({ full_name: fullName, username, password, platform_id: adminPid || '' });
    }
  }

  // ── Parse handlers ─────────────────────────────────────
  async function applyAgencyPaste() {
    const { _warn, _adminPid, _adminName, ...parsed } = parseAgencyText(agencyPasteText, admins);
    setAgencyForm(f => ({ ...f, ...Object.fromEntries(Object.entries(parsed).filter(([,v]) => v !== '')) }));
    setAgencyPaste(false);
    setAgencyPasteText('');
    if (_warn) {
      await autoCreateAdmin(_adminPid, _adminName, (id) => {
        setAF('admin_id', id);
        setShowNewAdminAgency(false);
      });
    } else {
      toast({ title: '✅ تم تحليل البيانات', description: 'راجع الحقول وتأكد منها قبل الحفظ' });
    }
  }

  async function applySupporterPaste() {
    const { _warn, _adminPid, _adminName, ...parsed } = parseSupporterText(supporterPasteText, admins);
    setSupporterForm(f => ({ ...f, ...Object.fromEntries(Object.entries(parsed).filter(([,v]) => v !== '')) }));
    setSupporterPaste(false);
    setSupporterPasteText('');
    if (_warn) {
      await autoCreateAdmin(_adminPid, _adminName, (id) => {
        setSF('admin_id', id);
        setShowNewAdminSupporter(false);
      });
    } else {
      toast({ title: '✅ تم تحليل البيانات', description: 'راجع الحقول وتأكد منها قبل الحفظ' });
    }
  }

  // ── Inline admin creation ──────────────────────────────
  const setNA = (k: keyof typeof EMPTY_NEW_ADMIN, v: string) => setNewAdminForm(f => ({ ...f, [k]: v }));

  async function createAdminInline(target: 'agency' | 'supporter') {
    const { full_name, username, password, platform_id } = newAdminForm;
    if (!full_name.trim() || !username.trim() || !password.trim()) {
      toast({ title: 'الاسم الكامل واسم المستخدم وكلمة المرور مطلوبة', variant: 'destructive' }); return;
    }
    setCreatingAdmin(true);
    try {
      const r = await h('/api/users', {
        method: 'POST',
        body: JSON.stringify({ full_name: full_name.trim(), username: username.trim(), password, platform_id: platform_id.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      const newAdmin: Admin = { id: d.id, username: d.username, full_name: d.full_name, platform_id: d.platform_id };
      setAdmins(prev => [...prev, newAdmin]);
      if (target === 'agency')    { setAF('admin_id', d.id); setShowNewAdminAgency(false); }
      if (target === 'supporter') { setSF('admin_id', d.id); setShowNewAdminSupporter(false); }
      setNewAdminForm(EMPTY_NEW_ADMIN);
      toast({ title: `✅ تم إنشاء المشرف "${d.full_name}" بنجاح` });
    } catch (e: any) {
      toast({ title: 'خطأ في إنشاء المشرف', description: e.message, variant: 'destructive' });
    } finally { setCreatingAdmin(false); }
  }

  // ── Agency CRUD ────────────────────────────────────────
  function openAddAgency() {
    setEditingAgency(null); setAgencyForm(EMPTY_AGENCY); setAgencyPaste(false); setAgencyPasteText('');
    setShowNewAdminAgency(false); setNewAdminForm(EMPTY_NEW_ADMIN);
    setAgencyDlg(true);
  }
  function openEditAgency(ag: Agency) {
    setEditingAgency(ag);
    setAgencyPaste(false); setAgencyPasteText('');
    setAgencyForm({
      agent_id: ag.agent_id||'', agency_name: ag.agency_name||'', admin_id: ag.admin_id||'',
      country: ag.country||'', agent_whatsapp: ag.agent_whatsapp||'',
      source_platform: ag.source_platform||'',
      creation_date: ag.creation_date ? ag.creation_date.split('T')[0] : '',
      opening_date: ag.opening_date ? ag.opening_date.split('T')[0] : '',
      notes: ag.notes||'',
    });
    setAgencyDlg(true);
  }
  async function saveAgency() {
    if (!agencyForm.agent_id.trim() || !agencyForm.admin_id) { toast({ title: 'أيدي الوكيل والمشرف مطلوبان', variant: 'destructive' }); return; }
    setSavingAgency(true);
    try {
      const url = editingAgency ? `/api/agencies/${editingAgency.id}` : '/api/agencies';
      const r = await h(url, { method: editingAgency ? 'PATCH' : 'POST', body: JSON.stringify(agencyForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      toast({ title: editingAgency ? 'تم التحديث' : 'تم إضافة الوكالة' });
      setAgencyDlg(false); fetchAll();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSavingAgency(false); }
  }
  async function toggleAgencyStatus(ag: Agency) {
    const newStatus = ag.status === 'activated' ? 'opened' : 'activated';
    const r = await h(`/api/agencies/${ag.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (r.ok) { toast({ title: newStatus === 'opened' ? 'تم تسجيل الافتتاح ✅' : 'تم التراجع للتفعيل' }); fetchAll(); }
  }
  async function deleteAgency(id: string) {
    const r = await h(`/api/agencies/${id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchAll(); }
  }

  // ── Supporter CRUD ─────────────────────────────────────
  function openAddSupporter() {
    setEditingSupporter(null); setSupporterForm(EMPTY_SUPPORTER); setSupporterPaste(false); setSupporterPasteText('');
    setShowNewAdminSupporter(false); setNewAdminForm(EMPTY_NEW_ADMIN);
    setSupporterDlg(true);
  }
  function openEditSupporter(s: Supporter) {
    setEditingSupporter(s);
    setSupporterPaste(false); setSupporterPasteText('');
    setSupporterForm({ supporter_id: s.supporter_id||'', source_platform: s.source_platform||'', level: s.level||'', management: s.management||'', admin_id: s.admin_id||'', notes: s.notes||'' });
    setSupporterDlg(true);
  }
  async function saveSupporter() {
    if (!supporterForm.supporter_id.trim() || !supporterForm.admin_id) { toast({ title: 'أيدي الداعم والمشرف مطلوبان', variant: 'destructive' }); return; }
    setSavingSupporter(true);
    try {
      const url = editingSupporter ? `/api/supporters/${editingSupporter.id}` : '/api/supporters';
      const r = await h(url, { method: editingSupporter ? 'PATCH' : 'POST', body: JSON.stringify(supporterForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      toast({ title: editingSupporter ? 'تم التحديث' : 'تم إضافة الداعم' });
      setSupporterDlg(false); fetchAll();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSavingSupporter(false); }
  }
  async function deleteSupporter(id: string) {
    const r = await h(`/api/supporters/${id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchAll(); }
  }

  // ── Report ─────────────────────────────────────────────
  async function generateReport() {
    if (!reportAdmin) { toast({ title: 'اختر مشرفاً أولاً', variant: 'destructive' }); return; }
    setLoadingReport(true);
    try {
      const r = await h(`/api/work-report?admin_id=${reportAdmin}&year=${reportYear}&month=${reportMonth}&period=${reportPeriod}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setReportData(d); setReportDlg(true);
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setLoadingReport(false); }
  }
  function buildReportText(rd: ReportData) {
    const a = rd.admin;
    return [
      '══════════════════════════════',
      '   📊 تقرير 10 ايام عمل الادمن',
      '══════════════════════════════',
      `اسم الادمن: ${a?.full_name||'—'}`,
      `أيدي الادمن: ${a?.platform_id||a?.username||'—'}`,
      '',
      `📋 عدد الوكالات التي تم تفعيلها  ${rd.agencies_activated.length}`,
      ...rd.agencies_activated.map((ag,i)=>`${i+1}: ${ag.agent_id}${ag.agency_name?` (${ag.agency_name})`:''}`),
      '',
      `🎉 عدد الوكالات التي تم افتتاحها  ${rd.agencies_opened.length}`,
      ...rd.agencies_opened.map((ag,i)=>`${i+1}: ${ag.agent_id}${ag.agency_name?` (${ag.agency_name})`:''}`),
      '',
      `👥 عدد الداعمين التي تم جلبهم  ${rd.supporters.length}`,
      ...rd.supporters.map((s,i)=>`${i+1}: ${s.supporter_id}${s.level?` | ليفل: ${s.level}`:''}`),
      '══════════════════════════════',
    ].join('\n');
  }
  async function copyReport() {
    if (!reportData) return;
    await navigator.clipboard.writeText(buildReportText(reportData));
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  const filteredAgencies  = filterAdmin==='all' ? agencies  : agencies.filter(a=>a.admin_id===filterAdmin);
  const filteredSupporters = filterAdmin==='all' ? supporters : supporters.filter(s=>s.admin_id===filterAdmin);
  const years = Array.from({length:3},(_,i)=>now.getFullYear()-i);

  if (loading) return (
    <div className="page-wrapper">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[1,2,3].map(i=><Skeleton key={i} className="h-32"/>)}</div>
    </div>
  );

  // ── New Admin inline box ────────────────────────────────
  function NewAdminBox({ target, onClose }: { target: 'agency' | 'supporter'; onClose: () => void }) {
    return (
      <div className="rounded-lg border border-dashed border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          إنشاء مشرف جديد وإضافته مباشرةً
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">الاسم الكامل *</label>
            <Input placeholder="مثال: أحمد محمد" value={newAdminForm.full_name} onChange={e => setNA('full_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">اسم المستخدم (للدخول) *</label>
            <Input placeholder="مثال: ahmed123" value={newAdminForm.username} onChange={e => setNA('username', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">كلمة المرور *</label>
            <div className="relative">
              <Input
                type={showNewAdminPwd ? 'text' : 'password'}
                placeholder="6 أحرف على الأقل"
                value={newAdminForm.password}
                onChange={e => setNA('password', e.target.value)}
                dir="ltr"
                className="pl-9"
              />
              <button
                type="button"
                onClick={() => setShowNewAdminPwd(v => !v)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewAdminPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">أيدي المنصة <span className="text-muted-foreground">(اختياري)</span></label>
            <Input placeholder="مثال: 1234567" value={newAdminForm.platform_id} onChange={e => setNA('platform_id', e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => createAdminInline(target)}
            disabled={creatingAdmin || !newAdminForm.full_name.trim() || !newAdminForm.username.trim() || !newAdminForm.password.trim()}
            className="gap-2 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <UserPlus className="h-4 w-4" />
            {creatingAdmin ? 'جاري الإنشاء...' : 'إنشاء المشرف وإضافته'}
          </Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    );
  }

  // ── Paste Box component (reusable) ─────────────────────
  function PasteBox({ value, onChange, onApply, onCancel }: { value:string; onChange:(v:string)=>void; onApply:()=>void; onCancel:()=>void }) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" />
          الصق الاستمارة كاملة هنا
        </p>
        <Textarea
          placeholder="مثال:&#10;ايدي الادمن: 123456&#10;اسم الوكالة: وكالة النجوم&#10;البلد: مصر&#10;..."
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={7}
          className="font-mono text-sm resize-none"
          dir="rtl"
        />
        <div className="flex gap-2">
          <Button onClick={onApply} disabled={!value.trim()} className="gap-2 flex-1">
            <Wand2 className="h-4 w-4" />تحليل وتعبئة الحقول
          </Button>
          <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-6 w-6 text-primary"/></div>
        <div>
          <h1 className="text-2xl font-bold">إدارة العمل</h1>
          <p className="text-sm text-muted-foreground">تسجيل الوكالات والداعمين وتوليد تقارير الـ 10 أيام</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {label:'إجمالي الوكالات', value:agencies.length, color:'text-blue-600'},
          {label:'مفعّلة',           value:agencies.filter(a=>a.status==='activated').length, color:'text-green-600'},
          {label:'تم افتتاحها',     value:agencies.filter(a=>a.status==='opened').length, color:'text-purple-600'},
          {label:'إجمالي الداعمين', value:supporters.length, color:'text-orange-600'},
        ].map(s=>(
          <Card key={s.label}><CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="agencies">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agencies"   className="gap-1"><Building2 className="h-4 w-4"/>الوكالات</TabsTrigger>
          <TabsTrigger value="supporters" className="gap-1"><Users     className="h-4 w-4"/>الداعمون</TabsTrigger>
          <TabsTrigger value="reports"    className="gap-1"><FileText  className="h-4 w-4"/>التقارير</TabsTrigger>
        </TabsList>

        {/* ══ AGENCIES ══ */}
        <TabsContent value="agencies" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filterAdmin} onValueChange={setFilterAdmin}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="فلتر بالمشرف"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشرفين</SelectItem>
                {admins.map(a=><SelectItem key={a.id} value={a.id}>{a.full_name||a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openAddAgency} className="gap-2 mr-auto"><Plus className="h-4 w-4"/>إضافة وكالة</Button>
          </div>
          {filteredAgencies.length===0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30"/>
              <p>لا توجد وكالات مسجلة</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredAgencies.map(ag=>(
                <Card key={ag.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-base">{ag.agent_id}</span>
                          {ag.agency_name && <span className="text-sm text-muted-foreground">— {ag.agency_name}</span>}
                          <Badge className={ag.status==='opened'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}>
                            {ag.status==='opened' ? '🎉 تم الافتتاح' : '✅ مفعّلة'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">المشرف: {adminName(ag.admin_id)}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {ag.country         && <span>🌍 {ag.country}</span>}
                          {ag.source_platform && <span>📱 {ag.source_platform}</span>}
                          {ag.agent_whatsapp  && <span>📞 {ag.agent_whatsapp}</span>}
                          {ag.creation_date   && <span>📅 إنشاء: {ag.creation_date}</span>}
                          {ag.opening_date    && <span>🎉 افتتاح: {ag.opening_date}</span>}
                        </div>
                        {ag.notes && <p className="text-xs text-muted-foreground border-t pt-1">{ag.notes}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={()=>openEditAgency(ag)}><Pencil className="h-4 w-4"/></Button>
                        <Button variant="outline" size="sm" onClick={()=>toggleAgencyStatus(ag)} className="text-xs px-2">
                          {ag.status==='activated' ? '🎉 افتتاح' : '↩ تفعيل'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الوكالة؟</AlertDialogTitle>
                              <AlertDialogDescription>سيتم حذف وكالة <strong>{ag.agent_id}</strong> نهائياً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={()=>deleteAgency(ag.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ SUPPORTERS ══ */}
        <TabsContent value="supporters" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filterAdmin} onValueChange={setFilterAdmin}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="فلتر بالمشرف"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشرفين</SelectItem>
                {admins.map(a=><SelectItem key={a.id} value={a.id}>{a.full_name||a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openAddSupporter} className="gap-2 mr-auto"><Plus className="h-4 w-4"/>إضافة داعم</Button>
          </div>
          {filteredSupporters.length===0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30"/>
              <p>لا يوجد داعمون مسجلون</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredSupporters.map(s=>(
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-base">{s.supporter_id}</span>
                          {s.level && <Badge variant="secondary">ليفل: {s.level}</Badge>}
                        </div>
                        <p className="text-sm font-medium">المشرف: {adminName(s.admin_id)}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {s.source_platform && <span>📱 {s.source_platform}</span>}
                          {s.management      && <span>🏢 {s.management}</span>}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground border-t pt-1">{s.notes}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={()=>openEditSupporter(s)}><Pencil className="h-4 w-4"/></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الداعم؟</AlertDialogTitle>
                              <AlertDialogDescription>سيتم حذف الداعم <strong>{s.supporter_id}</strong> نهائياً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={()=>deleteSupporter(s.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ REPORTS ══ */}
        <TabsContent value="reports" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>توليد تقرير 10 أيام</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">المشرف</label>
                  <Select value={reportAdmin} onValueChange={setReportAdmin}>
                    <SelectTrigger><SelectValue placeholder="اختر المشرف"/></SelectTrigger>
                    <SelectContent>{admins.map(a=><SelectItem key={a.id} value={a.id}>{a.full_name||a.username}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">السنة</label>
                  <Select value={String(reportYear)} onValueChange={v=>setReportYear(Number(v))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الشهر</label>
                  <Select value={String(reportMonth)} onValueChange={v=>setReportMonth(Number(v))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{MONTHS.map((m,i)=><SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الفترة</label>
                  <Select value={String(reportPeriod)} onValueChange={v=>setReportPeriod(Number(v) as 1|2|3)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{[1,2,3].map(p=><SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateReport} disabled={loadingReport||!reportAdmin} className="gap-2">
                <FileText className="h-4 w-4"/>{loadingReport ? 'جاري التوليد...' : 'توليد التقرير'}
              </Button>
            </CardContent>
          </Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map(a=>{
              const aA = agencies.filter(ag=>ag.admin_id===a.id);
              const aS = supporters.filter(s=>s.admin_id===a.id);
              return (
                <Card key={a.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={()=>setReportAdmin(a.id)}>
                  <CardContent className="p-4">
                    <p className="font-semibold">{a.full_name||a.username}</p>
                    <p className="text-xs text-muted-foreground mb-3">{a.platform_id||a.username}</p>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center"><p className="font-bold text-green-600">{aA.filter(ag=>ag.status==='activated').length}</p><p className="text-xs text-muted-foreground">مفعّلة</p></div>
                      <div className="text-center"><p className="font-bold text-purple-600">{aA.filter(ag=>ag.status==='opened').length}</p><p className="text-xs text-muted-foreground">افتُتحت</p></div>
                      <div className="text-center"><p className="font-bold text-orange-600">{aS.length}</p><p className="text-xs text-muted-foreground">داعم</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ AGENCY DIALOG ══ */}
      <Dialog open={agencyDlg} onOpenChange={setAgencyDlg}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgency ? 'تعديل بيانات الوكالة' : 'إضافة وكالة جديدة'}</DialogTitle>
          </DialogHeader>

          {/* Paste toggle */}
          {!editingAgency && (
            <div className="flex gap-2">
              <Button
                variant={agencyPaste ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => { setAgencyPaste(!agencyPaste); setAgencyPasteText(''); }}
              >
                <ClipboardPaste className="h-4 w-4"/>
                {agencyPaste ? 'إخفاء اللصق' : '📋 لصق الاستمارة تلقائياً'}
              </Button>
            </div>
          )}

          {agencyPaste && (
            <PasteBox
              value={agencyPasteText}
              onChange={setAgencyPasteText}
              onApply={applyAgencyPaste}
              onCancel={() => { setAgencyPaste(false); setAgencyPasteText(''); }}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">أيدي الوكيل *</label>
              <Input placeholder="أيدي الوكيل على المنصة" value={agencyForm.agent_id} onChange={e=>setAF('agent_id',e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم الوكالة</label>
              <Input placeholder="اسم الوكالة" value={agencyForm.agency_name} onChange={e=>setAF('agency_name',e.target.value)}/>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={agencyForm.admin_id} onValueChange={v => { setAF('admin_id', v); setShowNewAdminAgency(false); }}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف"/></SelectTrigger>
                <SelectContent>{admins.map(a=><SelectItem key={a.id} value={a.id}>{a.full_name||a.username}{a.platform_id ? ` — ${a.platform_id}`:''}</SelectItem>)}</SelectContent>
              </Select>
              {!agencyForm.admin_id && !showNewAdminAgency && (
                <Button
                  type="button" variant="outline" size="sm"
                  className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  onClick={() => { setShowNewAdminAgency(true); setNewAdminForm(EMPTY_NEW_ADMIN); }}
                >
                  <UserPlus className="h-4 w-4" /> المشرف غير موجود؟ أنشئه الآن
                </Button>
              )}
              {showNewAdminAgency && (
                <NewAdminBox target="agency" onClose={() => setShowNewAdminAgency(false)} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">البلد</label>
              <Input placeholder="بلد الوكالة" value={agencyForm.country} onChange={e=>setAF('country',e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">واتس الوكيل</label>
              <Input placeholder="رقم الواتساب" value={agencyForm.agent_whatsapp} onChange={e=>setAF('agent_whatsapp',e.target.value)}/>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">البرنامج القادم منه</label>
              <Input placeholder="مثال: تيليجرام، واتساب، انستجرام..." value={agencyForm.source_platform} onChange={e=>setAF('source_platform',e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">تاريخ الإنشاء</label>
              <Input type="date" value={agencyForm.creation_date} onChange={e=>setAF('creation_date',e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">تاريخ الافتتاح <span className="text-xs text-muted-foreground">(إذا تم)</span></label>
              <Input type="date" value={agencyForm.opening_date} onChange={e=>setAF('opening_date',e.target.value)}/>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea placeholder="أي ملاحظات إضافية..." value={agencyForm.notes} onChange={e=>setAF('notes',e.target.value)} rows={2}/>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveAgency} disabled={savingAgency||!agencyForm.agent_id.trim()||!agencyForm.admin_id} className="flex-1">
              {savingAgency ? 'جاري الحفظ...' : editingAgency ? 'حفظ التعديلات' : 'إضافة الوكالة'}
            </Button>
            <Button variant="outline" onClick={()=>setAgencyDlg(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ SUPPORTER DIALOG ══ */}
      <Dialog open={supporterDlg} onOpenChange={setSupporterDlg}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupporter ? 'تعديل بيانات الداعم' : 'إضافة داعم جديد'}</DialogTitle>
          </DialogHeader>

          {!editingSupporter && (
            <div className="flex gap-2">
              <Button
                variant={supporterPaste ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => { setSupporterPaste(!supporterPaste); setSupporterPasteText(''); }}
              >
                <ClipboardPaste className="h-4 w-4"/>
                {supporterPaste ? 'إخفاء اللصق' : '📋 لصق الاستمارة تلقائياً'}
              </Button>
            </div>
          )}

          {supporterPaste && (
            <PasteBox
              value={supporterPasteText}
              onChange={setSupporterPasteText}
              onApply={applySupporterPaste}
              onCancel={() => { setSupporterPaste(false); setSupporterPasteText(''); }}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">أيدي الداعم *</label>
              <Input placeholder="أيدي الداعم على المنصة" value={supporterForm.supporter_id} onChange={e=>setSF('supporter_id',e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ليفل</label>
              <Input placeholder="مثال: ليفل 5" value={supporterForm.level} onChange={e=>setSF('level',e.target.value)}/>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={supporterForm.admin_id} onValueChange={v => { setSF('admin_id', v); setShowNewAdminSupporter(false); }}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف"/></SelectTrigger>
                <SelectContent>{admins.map(a=><SelectItem key={a.id} value={a.id}>{a.full_name||a.username}{a.platform_id ? ` — ${a.platform_id}`:''}</SelectItem>)}</SelectContent>
              </Select>
              {!supporterForm.admin_id && !showNewAdminSupporter && (
                <Button
                  type="button" variant="outline" size="sm"
                  className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  onClick={() => { setShowNewAdminSupporter(true); setNewAdminForm(EMPTY_NEW_ADMIN); }}
                >
                  <UserPlus className="h-4 w-4" /> المشرف غير موجود؟ أنشئه الآن
                </Button>
              )}
              {showNewAdminSupporter && (
                <NewAdminBox target="supporter" onClose={() => setShowNewAdminSupporter(false)} />
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">البرنامج القادم منه</label>
              <Input placeholder="مثال: تيليجرام، واتساب..." value={supporterForm.source_platform} onChange={e=>setSF('source_platform',e.target.value)}/>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">الإدارة</label>
              <Input placeholder="مثال: إدارة أميرة 10005" value={supporterForm.management} onChange={e=>setSF('management',e.target.value)}/>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea placeholder="أي ملاحظات إضافية..." value={supporterForm.notes} onChange={e=>setSF('notes',e.target.value)} rows={2}/>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveSupporter} disabled={savingSupporter||!supporterForm.supporter_id.trim()||!supporterForm.admin_id} className="flex-1">
              {savingSupporter ? 'جاري الحفظ...' : editingSupporter ? 'حفظ التعديلات' : 'إضافة الداعم'}
            </Button>
            <Button variant="outline" onClick={()=>setSupporterDlg(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ REPORT DIALOG ══ */}
      <Dialog open={reportDlg} onOpenChange={setReportDlg}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>تقرير 10 أيام عمل</DialogTitle>
          </DialogHeader>
          {reportData && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-5 font-mono text-sm space-y-4 border">
                <div className="text-center border-b pb-3">
                  <p className="font-bold text-base">📊 تقرير 10 ايام عمل الادمن</p>
                  <p className="text-xs text-muted-foreground mt-1">{getPeriodLabel(reportPeriod)} — {MONTHS[reportMonth-1]} {reportYear}</p>
                </div>
                <div className="space-y-1">
                  <p><span className="text-muted-foreground">اسم الادمن:</span> <strong>{reportData.admin?.full_name||'—'}</strong></p>
                  <p><span className="text-muted-foreground">أيدي الادمن:</span> <strong>{reportData.admin?.platform_id||reportData.admin?.username||'—'}</strong></p>
                </div>
                <div>
                  <p className="font-bold mb-2">📋 عدد الوكالات التي تم تفعيلها  {reportData.agencies_activated.length}</p>
                  {reportData.agencies_activated.length===0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_activated.map((ag,i)=><p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name?` (${ag.agency_name})`:''}</p>)}
                </div>
                <div>
                  <p className="font-bold mb-2">🎉 عدد الوكالات التي تم افتتاحها  {reportData.agencies_opened.length}</p>
                  {reportData.agencies_opened.length===0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_opened.map((ag,i)=><p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name?` (${ag.agency_name})`:''}</p>)}
                </div>
                <div>
                  <p className="font-bold mb-2">👥 عدد الداعمين التي تم جلبهم  {reportData.supporters.length}</p>
                  {reportData.supporters.length===0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.supporters.map((s,i)=><p key={s.id}>{i+1}: {s.supporter_id}{s.level?` | ليفل: ${s.level}`:''}</p>)}
                </div>
              </div>
              <Button onClick={copyReport} variant="outline" className="w-full gap-2">
                {copied ? <><Check className="h-4 w-4 text-green-600"/>تم النسخ!</> : <><Copy className="h-4 w-4"/>نسخ التقرير</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
