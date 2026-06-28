import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, FileText, Plus, Trash2,
  Copy, Check, Pencil, ClipboardPaste, Wand2, UserPlus, EyeOff, Eye, DownloadCloud, ChevronDown, ChevronUp
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
  phone?: string;
}

interface Agency {
  id: string;
  admin_id: string;
  agent_id: string;
  agency_name?: string;
  agency_code?: string;
  country?: string;
  agent_whatsapp?: string;
  source_platform?: string;
  creation_date?: string;
  opening_date?: string;
  status: 'activated' | 'opened';
  notes?: string;
  period?: number;
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
  period?: number;
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

const EMPTY_AGENCY = { agent_id:'', agency_name:'', agency_code:'', admin_id:'', country:'', agent_whatsapp:'', source_platform:'', creation_date:'', opening_date:'', notes:'', period: String(getCurrentPeriod()) };
const EMPTY_SUPPORTER = { supporter_id:'', source_platform:'', level:'', management:'', admin_id:'', notes:'', period: String(getCurrentPeriod()) };

// ══════════════════════════════════════════════════════════
// Smart Parsers
// ══════════════════════════════════════════════════════════

// ── نظّف كل سطر: اشطب الرموز البادئة (-، •، *، →، ...)
function cleanLines(text: string): string {
  return text.split('\n')
    .map(l => l.replace(/^[\s\u200b\-\*•◦◆▪▸➤→＊]+/, '').trim())
    .join('\n');
}

// ── استخراج ذكي: يدعم فواصل متعددة (: / | -) وتنظيف القيمة
function extractField(rawText: string, ...keys: string[]): string {
  const text = cleanLines(rawText);
  const lines = text.split('\n');

  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // بحث سطر بسطر أولاً (أدق)
    const lineRx = new RegExp(`^${esc}\\s*[:\\-：/|]\\s*(.*)$`, 'i');
    for (const line of lines) {
      const m = line.match(lineRx);
      if (m !== null) {
        // نظّف القيمة: ابتر الفاصل المتبقي إن وُجد
        const val = m[1].trim().replace(/^[:\-\/|]\s*/, '').trim();
        if (val) return val;
      }
    }
    // بحث في النص الكامل (احتياطي لقيم متعددة الكلمات)
    const fullRx = new RegExp(`${esc}\\s*[:\\-：/|]\\s*([^\\n]+)`, 'i');
    const m2 = text.match(fullRx);
    if (m2) {
      const val = m2[1].trim().replace(/^[:\-\/|]\s*/, '').trim();
      if (val) return val;
    }
  }
  return '';
}

// ── تحليل التاريخ: يدعم صيغ متعددة
function parseDate(raw: string): string {
  if (!raw) return '';
  // ابتر أي نص بعد رقم السنة (مثل "2026 تسجيل...")
  const trimmed = raw.replace(/[،,]/g, '/').trim();
  // YYYY/MM/DD أو YYYY-MM-DD
  const ymd = trimmed.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
  // DD/MM/YYYY أو D/M/YYYY
  const dmy = trimmed.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // DD/MM/YY
  const dmy2 = trimmed.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmy2) return `20${dmy2[3]}-${dmy2[2].padStart(2,'0')}-${dmy2[1].padStart(2,'0')}`;
  return '';
}

// ── تطابق ذكي للأرقام (أيدي) مع التسامح مع الأحرف الزائدة
function normalizeId(s: string): string {
  return s.replace(/\D/g, '');
}

// ── بحث عن الأدمن بمرونة: رقم أو اسم كامل أو جزء
function findAdmin(admins: Admin[], platformId: string, name: string): string {
  if (platformId) {
    const pid = normalizeId(platformId);
    if (pid) {
      const a = admins.find(x =>
        normalizeId(x.platform_id || '') === pid ||
        normalizeId(x.username || '')   === pid
      );
      if (a) return a.id;
    }
    // نصي
    const a2 = admins.find(x =>
      x.platform_id === platformId || x.username === platformId
    );
    if (a2) return a2.id;
  }
  if (name) {
    const n = name.trim().toLowerCase().replace(/\s+/g, '');
    const a = admins.find(x => {
      const fn = (x.full_name || '').toLowerCase().replace(/\s+/g, '');
      const un = (x.username  || '').toLowerCase().replace(/\s+/g, '');
      return fn.includes(n) || n.includes(fn) || un.includes(n);
    });
    if (a) return a.id;
  }
  return '';
}

function parseAgencyText(text: string, admins: Admin[]): typeof EMPTY_AGENCY & { _warn?: string; _adminPid?: string; _adminName?: string } {
  const adminPid  = extractField(text,
    'ايدي الادمن', 'ايدي الادمين', 'ID الادمن', 'id الادمن',
    'رقم الادمن', 'ايدي المشرف', 'id المشرف',
  );
  const adminName = extractField(text,
    'اسم الادمن', 'اسم الادمين', 'اسم المشرف', 'المشرف',
  );
  const admin_id  = findAdmin(admins, adminPid, adminName);

  const rawWhatsapp = extractField(text,
    'واتس الوكيل', 'واتساب الوكيل', 'الواتس', 'واتساب', 'رقم الواتس', 'رقم واتساب',
  );

  // تاريخ الإنشاء: يستوعب الأخطاء الإملائية الشائعة
  const creationRaw = extractField(text,
    'تاريخ الانشاء', 'تاريخ الإنشاء', 'تاريخ الانشهاء',
    'تاريخ إنشاء', 'تاريخ انشاء', 'تاريخ الأنشاء',
    'الانشاء', 'الإنشاء',
  );

  return {
    agent_id:        extractField(text, 'ايدي الوكيل', 'id الوكيل', 'كود الوكالة', 'رقم الوكيل', 'ايدي الوكالة'),
    agency_name:     extractField(text, 'اسم الوكالة', 'الوكالة'),
    country:         extractField(text, 'البلد', 'الدولة', 'بلد الوكيل'),
    agent_whatsapp:  rawWhatsapp,
    source_platform: extractField(text,
      'برامج جاء منها', 'البرنامج القادم منه', 'البرنامج القادم',
      'المنصة', 'البرنامج', 'قادم من', 'جاء من',
    ),
    creation_date:   parseDate(creationRaw),
    opening_date:    parseDate(extractField(text, 'تاريخ الافتتاح', 'تاريخ الفتح', 'الافتتاح')),
    admin_id,
    notes: '',
    _warn:      !admin_id && (adminPid || adminName) ? `لم يُعثر على مشرف: ${adminPid || adminName}` : undefined,
    _adminPid:  adminPid  || undefined,
    _adminName: adminName || undefined,
  };
}

function parseSupporterText(text: string, admins: Admin[]): typeof EMPTY_SUPPORTER & { _warn?: string; _adminPid?: string; _adminName?: string } {
  const adminPid  = extractField(text,
    'ايدي الادمن', 'ايدي الادمين', 'ID الادمن', 'id الادمن',
    'رقم الادمن', 'ايدي المشرف',
  );
  const adminName = extractField(text,
    'اسم الادمن', 'اسم الادمين', 'اسم المشرف', 'المشرف',
  );
  const admin_id  = findAdmin(admins, adminPid, adminName);

  // الإدارة: سطر يبدأ بـ "إدارة" أو يحتوي عليها
  const cleanedLines = cleanLines(text).split('\n');
  const mgmtLine = cleanedLines.find(l => /^إدار[ةه]/u.test(l));
  const management = mgmtLine?.trim() || extractField(text, 'الإدارة', 'إدارة', 'الادارة');

  return {
    supporter_id:    extractField(text, 'ايدي الداعم', 'id الداعم', 'ID الداعم', 'رقم الداعم'),
    source_platform: extractField(text,
      'البرنامج القادم منه', 'البرنامج القادم', 'البرنامج', 'المنصة', 'قادم من',
    ),
    level:           extractField(text, 'ليفل', 'المستوى', 'level', 'اللفل'),
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

  // Bulk all-admins report
  const [allReportsData, setAllReportsData]       = useState<ReportData[]>([]);
  const [allReportsYear, setAllReportsYear]       = useState(now.getFullYear());
  const [allReportsMonth, setAllReportsMonth]     = useState(now.getMonth() + 1);
  const [allReportsPeriod, setAllReportsPeriod]   = useState<1|2|3>(getCurrentPeriod() as 1|2|3);
  const [loadingAllReports, setLoadingAllReports] = useState(false);
  const [allReportsDlg, setAllReportsDlg]         = useState(false);
  const [copiedAll, setCopiedAll]                 = useState(false);
  const [expandedReports, setExpandedReports]     = useState<Set<string>>(new Set());
  const [copiedSingle, setCopiedSingle]           = useState<string|null>(null);

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
      let d: any = {};
      try { d = await r.json(); } catch { throw new Error(`خطأ ${r.status} — تأكد من تشغيل السيرفر`); }
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
      agent_id: ag.agent_id||'', agency_name: ag.agency_name||'', agency_code: ag.agency_code||'', admin_id: ag.admin_id||'',
      country: ag.country||'', agent_whatsapp: ag.agent_whatsapp||'',
      source_platform: ag.source_platform||'',
      creation_date: ag.creation_date ? ag.creation_date.split('T')[0] : '',
      opening_date: ag.opening_date ? ag.opening_date.split('T')[0] : '',
      notes: ag.notes||'',
      period: String(ag.period || getCurrentPeriod()),
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
    setSupporterForm({ supporter_id: s.supporter_id||'', source_platform: s.source_platform||'', level: s.level||'', management: s.management||'', admin_id: s.admin_id||'', notes: s.notes||'', period: String(s.period || getCurrentPeriod()) });
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

  // ── Bulk all-admins report ──────────────────────────────
  async function generateAllReports() {
    setLoadingAllReports(true);
    try {
      const r = await h(`/api/work-report-all?year=${allReportsYear}&month=${allReportsMonth}&period=${allReportsPeriod}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);

      // Build a map from the backend response
      const reportsMap = new Map<string, ReportData>();
      (d.reports || []).forEach((rd: ReportData) => {
        if (rd.admin?.id) reportsMap.set(rd.admin.id, rd);
      });

      // Merge with ALL admins from frontend state so no one is missing (even with 0 work)
      const merged: ReportData[] = admins.map(admin => {
        return reportsMap.get(admin.id) ?? {
          admin,
          agencies_activated: [],
          agencies_opened: [],
          supporters: [],
        };
      });

      // Sort: admins with most work appear first
      merged.sort((a, b) => {
        const aTotal = a.agencies_activated.length + a.supporters.length;
        const bTotal = b.agencies_activated.length + b.supporters.length;
        return bTotal - aTotal;
      });

      setAllReportsData(merged);
      setExpandedReports(new Set());
      setAllReportsDlg(true);
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setLoadingAllReports(false); }
  }
  function toggleExpand(adminId: string) {
    setExpandedReports(prev => {
      const next = new Set(prev);
      next.has(adminId) ? next.delete(adminId) : next.add(adminId);
      return next;
    });
  }
  async function copyAllReports() {
    const text = allReportsData.map(rd => buildReportText(rd)).join('\n\n' + '━'.repeat(32) + '\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedAll(true); setTimeout(()=>setCopiedAll(false), 2000);
  }
  async function copySingleReport(rd: ReportData) {
    await navigator.clipboard.writeText(buildReportText(rd));
    const id = rd.admin?.id || '';
    setCopiedSingle(id); setTimeout(()=>setCopiedSingle(null), 2000);
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

          {/* Bulk all-admins report card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <DownloadCloud className="h-5 w-5"/>استخراج تقارير جميع الأدمنية دفعة واحدة
              </CardTitle>
              <p className="text-sm text-muted-foreground">يولّد تقرير مستقل لكل أدمن في نفس الوقت بناءً على الشهر والفترة المحددة</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">السنة</label>
                  <Select value={String(allReportsYear)} onValueChange={v=>setAllReportsYear(Number(v))}>
                    <SelectTrigger data-testid="select-all-reports-year"><SelectValue/></SelectTrigger>
                    <SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الشهر</label>
                  <Select value={String(allReportsMonth)} onValueChange={v=>setAllReportsMonth(Number(v))}>
                    <SelectTrigger data-testid="select-all-reports-month"><SelectValue/></SelectTrigger>
                    <SelectContent>{MONTHS.map((m,i)=><SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الفترة</label>
                  <Select value={String(allReportsPeriod)} onValueChange={v=>setAllReportsPeriod(Number(v) as 1|2|3)}>
                    <SelectTrigger data-testid="select-all-reports-period"><SelectValue/></SelectTrigger>
                    <SelectContent>{[1,2,3].map(p=><SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                data-testid="button-generate-all-reports"
                onClick={generateAllReports}
                disabled={loadingAllReports}
                className="gap-2 w-full sm:w-auto"
              >
                <DownloadCloud className="h-4 w-4"/>
                {loadingAllReports ? `جاري الاستخراج... (${admins.length} أدمن)` : `استخراج تقارير الكل (${admins.length} أدمن)`}
              </Button>
            </CardContent>
          </Card>

          {/* Single admin report card */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>توليد تقرير أدمن محدد</CardTitle></CardHeader>
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
            <div className="space-y-1">
              <label className="text-sm font-medium">كود الوكالة</label>
              <Input placeholder="كود الوكالة" value={agencyForm.agency_code} onChange={e=>setAF('agency_code',e.target.value)}/>
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
              <label className="text-sm font-medium">المدة</label>
              <Select value={agencyForm.period} onValueChange={v => setAF('period', v)}>
                <SelectTrigger><SelectValue placeholder="اختر المدة"/></SelectTrigger>
                <SelectContent>
                  {[1,2,3].map(p => <SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <label className="text-sm font-medium">المدة</label>
              <Select value={supporterForm.period} onValueChange={v => setSF('period', v)}>
                <SelectTrigger><SelectValue placeholder="اختر المدة"/></SelectTrigger>
                <SelectContent>
                  {[1,2,3].map(p => <SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* ══ ALL REPORTS DIALOG ══ */}
      <Dialog open={allReportsDlg} onOpenChange={setAllReportsDlg}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-primary"/>
              تقارير جميع الأدمنية — {getPeriodLabel(allReportsPeriod)} — {MONTHS[allReportsMonth-1]} {allReportsYear}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-2 bg-muted/50 rounded-lg p-3 text-sm">
              <Badge variant="secondary">{allReportsData.length} أدمن</Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">
                {allReportsData.reduce((s,r)=>s+r.agencies_activated.length,0)} وكالة مفعّلة
              </Badge>
              <Badge variant="outline" className="text-purple-700 border-purple-300">
                {allReportsData.reduce((s,r)=>s+r.agencies_opened.length,0)} وكالة افتُتحت
              </Badge>
              <Badge variant="outline" className="text-orange-700 border-orange-300">
                {allReportsData.reduce((s,r)=>s+r.supporters.length,0)} داعم
              </Badge>
              <Button
                data-testid="button-copy-all-reports"
                variant={copiedAll ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 mr-auto"
                onClick={copyAllReports}
              >
                {copiedAll ? <><Check className="h-3.5 w-3.5"/>تم نسخ الكل!</> : <><Copy className="h-3.5 w-3.5"/>نسخ جميع التقارير</>}
              </Button>
            </div>

            {/* Individual admin reports */}
            {allReportsData.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30"/>
                <p>لا يوجد أدمنية معتمدون</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allReportsData.map(rd => {
                  const id = rd.admin?.id || '';
                  const isExpanded = expandedReports.has(id);
                  const total = rd.agencies_activated.length + rd.agencies_opened.length + rd.supporters.length;
                  return (
                    <div key={id} className="border rounded-lg overflow-hidden">
                      {/* Admin header row */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={()=>toggleExpand(id)}
                        data-testid={`row-admin-report-${id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{rd.admin?.full_name||rd.admin?.username||'—'}</p>
                          <p className="text-xs text-muted-foreground">{rd.admin?.platform_id||rd.admin?.username||''}</p>
                        </div>
                        <div className="flex gap-2 text-xs shrink-0">
                          <span className="text-green-700 font-medium">{rd.agencies_activated.length} وكالة</span>
                          <span className="text-purple-700 font-medium">{rd.agencies_opened.length} افتتاح</span>
                          <span className="text-orange-700 font-medium">{rd.supporters.length} داعم</span>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="shrink-0 h-7 w-7"
                          onClick={e=>{e.stopPropagation(); copySingleReport(rd);}}
                          data-testid={`button-copy-report-${id}`}
                        >
                          {copiedSingle===id ? <Check className="h-3.5 w-3.5 text-green-600"/> : <Copy className="h-3.5 w-3.5"/>}
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                      </div>

                      {/* Expanded report content */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-3 font-mono text-xs space-y-3">
                          <div>
                            <p className="font-bold mb-1">📋 الوكالات المفعّلة ({rd.agencies_activated.length})</p>
                            {rd.agencies_activated.length===0 ? <p className="text-muted-foreground">لا يوجد</p>
                              : rd.agencies_activated.map((ag,i)=><p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name?` (${ag.agency_name})`:''}</p>)}
                          </div>
                          <div>
                            <p className="font-bold mb-1">🎉 الوكالات المفتوحة ({rd.agencies_opened.length})</p>
                            {rd.agencies_opened.length===0 ? <p className="text-muted-foreground">لا يوجد</p>
                              : rd.agencies_opened.map((ag,i)=><p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name?` (${ag.agency_name})`:''}</p>)}
                          </div>
                          <div>
                            <p className="font-bold mb-1">👥 الداعمون ({rd.supporters.length})</p>
                            {rd.supporters.length===0 ? <p className="text-muted-foreground">لا يوجد</p>
                              : rd.supporters.map((s,i)=><p key={s.id}>{i+1}: {s.supporter_id}{s.level?` | ليفل: ${s.level}`:''}</p>)}
                          </div>
                          {total===0 && <p className="text-center text-muted-foreground py-1">لا توجد بيانات لهذه الفترة</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                  {reportData.admin?.phone && <p><span className="text-muted-foreground">رقم الهاتف:</span> <strong>{reportData.admin.phone}</strong></p>}
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
