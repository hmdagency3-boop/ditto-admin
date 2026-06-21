import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, FileText, Plus, Trash2,
  Copy, Check, CalendarDays, Pencil, X
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
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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

function getCurrentPeriod() {
  const d = new Date().getDate();
  return d <= 10 ? 1 : d <= 20 ? 2 : 3;
}

const EMPTY_AGENCY = {
  agent_id: '', agency_name: '', admin_id: '', country: '',
  agent_whatsapp: '', source_platform: '', creation_date: '',
  opening_date: '', notes: '',
};

const EMPTY_SUPPORTER = {
  supporter_id: '', source_platform: '', level: '',
  management: '', admin_id: '', notes: '',
};

export default function WorkManagement() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins]       = useState<Admin[]>([]);
  const [agencies, setAgencies]   = useState<Agency[]>([]);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterAdmin, setFilterAdmin] = useState('all');

  // Agency dialog
  const [agencyDlg, setAgencyDlg]     = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [agencyForm, setAgencyForm]   = useState(EMPTY_AGENCY);
  const [savingAgency, setSavingAgency] = useState(false);

  // Supporter dialog
  const [supporterDlg, setSupporterDlg]   = useState(false);
  const [editingSupporter, setEditingSupporter] = useState<Supporter | null>(null);
  const [supporterForm, setSupporterForm] = useState(EMPTY_SUPPORTER);
  const [savingSupporter, setSavingSupporter] = useState(false);

  // Report
  const now = new Date();
  const [reportAdmin, setReportAdmin]   = useState('');
  const [reportYear, setReportYear]     = useState(now.getFullYear());
  const [reportMonth, setReportMonth]   = useState(now.getMonth() + 1);
  const [reportPeriod, setReportPeriod] = useState<1|2|3>(getCurrentPeriod() as 1|2|3);
  const [reportData, setReportData]     = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportDlg, setReportDlg]       = useState(false);
  const [copied, setCopied]             = useState(false);

  const h = useCallback((url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) } }),
  [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, agenciesRes, supportersRes] = await Promise.all([
        h('/api/users'), h('/api/agencies'), h('/api/supporters'),
      ]);
      const a: Admin[]     = adminsRes.ok ? await adminsRes.json() : [];
      const ag: Agency[]   = agenciesRes.ok ? await agenciesRes.json() : [];
      const s: Supporter[] = supportersRes.ok ? await supportersRes.json() : [];
      setAdmins(a.filter(x => x.id));
      setAgencies(ag);
      setSupporters(s);
    } finally { setLoading(false); }
  }, [h]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function adminName(id: string) {
    const a = admins.find(x => x.id === id);
    return a ? (a.full_name || a.username) : '—';
  }

  function setAF(k: keyof typeof EMPTY_AGENCY, v: string) {
    setAgencyForm(f => ({ ...f, [k]: v }));
  }
  function setSF(k: keyof typeof EMPTY_SUPPORTER, v: string) {
    setSupporterForm(f => ({ ...f, [k]: v }));
  }

  function openAddAgency() {
    setEditingAgency(null);
    setAgencyForm(EMPTY_AGENCY);
    setAgencyDlg(true);
  }

  function openEditAgency(ag: Agency) {
    setEditingAgency(ag);
    setAgencyForm({
      agent_id: ag.agent_id || '',
      agency_name: ag.agency_name || '',
      admin_id: ag.admin_id || '',
      country: ag.country || '',
      agent_whatsapp: ag.agent_whatsapp || '',
      source_platform: ag.source_platform || '',
      creation_date: ag.creation_date ? ag.creation_date.split('T')[0] : '',
      opening_date: ag.opening_date ? ag.opening_date.split('T')[0] : '',
      notes: ag.notes || '',
    });
    setAgencyDlg(true);
  }

  // ── Agency CRUD ─────────────────────────────────────────────────────────────

  async function saveAgency() {
    const { agent_id, admin_id } = agencyForm;
    if (!agent_id.trim() || !admin_id) {
      toast({ title: 'أيدي الوكيل والمشرف مطلوبان', variant: 'destructive' }); return;
    }
    setSavingAgency(true);
    try {
      const body = { ...agencyForm, agent_id: agencyForm.agent_id.trim() };
      const url  = editingAgency ? `/api/agencies/${editingAgency.id}` : '/api/agencies';
      const method = editingAgency ? 'PATCH' : 'POST';
      const r = await h(url, { method, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: editingAgency ? 'تم التحديث' : 'تم إضافة الوكالة' });
      setAgencyDlg(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setSavingAgency(false); }
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

  // ── Supporter CRUD ───────────────────────────────────────────────────────────

  function openAddSupporter() {
    setEditingSupporter(null);
    setSupporterForm(EMPTY_SUPPORTER);
    setSupporterDlg(true);
  }

  function openEditSupporter(s: Supporter) {
    setEditingSupporter(s);
    setSupporterForm({
      supporter_id: s.supporter_id || '',
      source_platform: s.source_platform || '',
      level: s.level || '',
      management: s.management || '',
      admin_id: s.admin_id || '',
      notes: s.notes || '',
    });
    setSupporterDlg(true);
  }

  async function saveSupporter() {
    const { supporter_id, admin_id } = supporterForm;
    if (!supporter_id.trim() || !admin_id) {
      toast({ title: 'أيدي الداعم والمشرف مطلوبان', variant: 'destructive' }); return;
    }
    setSavingSupporter(true);
    try {
      const body = { ...supporterForm, supporter_id: supporterForm.supporter_id.trim() };
      const url  = editingSupporter ? `/api/supporters/${editingSupporter.id}` : '/api/supporters';
      const method = editingSupporter ? 'PATCH' : 'POST';
      const r = await h(url, { method, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: editingSupporter ? 'تم التحديث' : 'تم إضافة الداعم' });
      setSupporterDlg(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setSavingSupporter(false); }
  }

  async function deleteSupporter(id: string) {
    const r = await h(`/api/supporters/${id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchAll(); }
  }

  // ── PATCH supporters endpoint (add if missing) ─────────────────────────────

  // ── Report ───────────────────────────────────────────────────────────────────

  async function generateReport() {
    if (!reportAdmin) { toast({ title: 'اختر مشرفاً أولاً', variant: 'destructive' }); return; }
    setLoadingReport(true);
    try {
      const r = await h(`/api/work-report?admin_id=${reportAdmin}&year=${reportYear}&month=${reportMonth}&period=${reportPeriod}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setReportData(data);
      setReportDlg(true);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setLoadingReport(false); }
  }

  function buildReportText(rd: ReportData): string {
    const a = rd.admin;
    const lines = [
      '══════════════════════════════',
      '   📊 تقرير 10 ايام عمل الادمن',
      '══════════════════════════════',
      `اسم الادمن: ${a?.full_name || '—'}`,
      `أيدي الادمن: ${a?.platform_id || a?.username || '—'}`,
      '',
      `📋 عدد الوكالات التي تم تفعيلها  ${rd.agencies_activated.length}`,
      ...rd.agencies_activated.map((ag, i) => `${i + 1}: ${ag.agent_id}${ag.agency_name ? ` (${ag.agency_name})` : ''}`),
      '',
      `🎉 عدد الوكالات التي تم افتتاحها  ${rd.agencies_opened.length}`,
      ...rd.agencies_opened.map((ag, i) => `${i + 1}: ${ag.agent_id}${ag.agency_name ? ` (${ag.agency_name})` : ''}`),
      '',
      `👥 عدد الداعمين التي تم جلبهم  ${rd.supporters.length}`,
      ...rd.supporters.map((s, i) => `${i + 1}: ${s.supporter_id}${s.level ? ` | ليفل: ${s.level}` : ''}`),
      '══════════════════════════════',
    ];
    return lines.join('\n');
  }

  async function copyReport() {
    if (!reportData) return;
    await navigator.clipboard.writeText(buildReportText(reportData));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredAgencies  = filterAdmin === 'all' ? agencies  : agencies.filter(a => a.admin_id === filterAdmin);
  const filteredSupporters = filterAdmin === 'all' ? supporters : supporters.filter(s => s.admin_id === filterAdmin);
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إدارة العمل</h1>
          <p className="text-sm text-muted-foreground">تسجيل الوكالات والداعمين وتوليد تقارير الـ 10 أيام</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الوكالات', value: agencies.length, color: 'text-blue-600' },
          { label: 'مفعّلة', value: agencies.filter(a => a.status === 'activated').length, color: 'text-green-600' },
          { label: 'تم افتتاحها', value: agencies.filter(a => a.status === 'opened').length, color: 'text-purple-600' },
          { label: 'إجمالي الداعمين', value: supporters.length, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="agencies">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agencies" className="gap-1"><Building2 className="h-4 w-4" />الوكالات</TabsTrigger>
          <TabsTrigger value="supporters" className="gap-1"><Users className="h-4 w-4" />الداعمون</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><FileText className="h-4 w-4" />التقارير</TabsTrigger>
        </TabsList>

        {/* ══ AGENCIES ══ */}
        <TabsContent value="agencies" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filterAdmin} onValueChange={setFilterAdmin}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="فلتر بالمشرف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشرفين</SelectItem>
                {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openAddAgency} className="gap-2 mr-auto">
              <Plus className="h-4 w-4" />إضافة وكالة
            </Button>
          </div>

          {filteredAgencies.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد وكالات مسجلة</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredAgencies.map(ag => (
                <Card key={ag.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Row 1: agent ID + agency name + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-base">{ag.agent_id}</span>
                          {ag.agency_name && <span className="text-sm text-muted-foreground">— {ag.agency_name}</span>}
                          <Badge className={ag.status === 'opened'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}>
                            {ag.status === 'opened' ? '🎉 تم الافتتاح' : '✅ مفعّلة'}
                          </Badge>
                        </div>
                        {/* Row 2: admin */}
                        <p className="text-sm font-medium">المشرف: {adminName(ag.admin_id)}</p>
                        {/* Row 3: details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {ag.country && <span>🌍 {ag.country}</span>}
                          {ag.source_platform && <span>📱 {ag.source_platform}</span>}
                          {ag.agent_whatsapp && <span>📞 {ag.agent_whatsapp}</span>}
                          {ag.creation_date && <span>📅 إنشاء: {ag.creation_date}</span>}
                          {ag.opening_date && <span>🎉 افتتاح: {ag.opening_date}</span>}
                        </div>
                        {ag.notes && <p className="text-xs text-muted-foreground border-t pt-1">{ag.notes}</p>}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEditAgency(ag)} title="تعديل">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleAgencyStatus(ag)} className="text-xs px-2">
                          {ag.status === 'activated' ? '🎉 افتتاح' : '↩ تفعيل'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الوكالة؟</AlertDialogTitle>
                              <AlertDialogDescription>سيتم حذف وكالة <strong>{ag.agent_id}</strong> نهائياً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteAgency(ag.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
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
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="فلتر بالمشرف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشرفين</SelectItem>
                {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openAddSupporter} className="gap-2 mr-auto">
              <Plus className="h-4 w-4" />إضافة داعم
            </Button>
          </div>

          {filteredSupporters.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا يوجد داعمون مسجلون</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredSupporters.map(s => (
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
                          {s.management && <span>🏢 {s.management}</span>}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground border-t pt-1">{s.notes}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEditSupporter(s)} title="تعديل">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الداعم؟</AlertDialogTitle>
                              <AlertDialogDescription>سيتم حذف الداعم <strong>{s.supporter_id}</strong> نهائياً.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSupporter(s.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />توليد تقرير 10 أيام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">المشرف</label>
                  <Select value={reportAdmin} onValueChange={setReportAdmin}>
                    <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                    <SelectContent>
                      {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">السنة</label>
                  <Select value={String(reportYear)} onValueChange={v => setReportYear(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الشهر</label>
                  <Select value={String(reportMonth)} onValueChange={v => setReportMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الفترة</label>
                  <Select value={String(reportPeriod)} onValueChange={v => setReportPeriod(Number(v) as 1|2|3)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3].map(p => <SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateReport} disabled={loadingReport || !reportAdmin} className="gap-2">
                <FileText className="h-4 w-4" />
                {loadingReport ? 'جاري التوليد...' : 'توليد التقرير'}
              </Button>
            </CardContent>
          </Card>

          {/* Quick stats per admin */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map(a => {
              const aA = agencies.filter(ag => ag.admin_id === a.id);
              const aS = supporters.filter(s => s.admin_id === a.id);
              return (
                <Card key={a.id} className="hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => setReportAdmin(a.id)}>
                  <CardContent className="p-4">
                    <p className="font-semibold">{a.full_name || a.username}</p>
                    <p className="text-xs text-muted-foreground mb-3">{a.platform_id || a.username}</p>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center"><p className="font-bold text-green-600">{aA.filter(ag => ag.status === 'activated').length}</p><p className="text-xs text-muted-foreground">مفعّلة</p></div>
                      <div className="text-center"><p className="font-bold text-purple-600">{aA.filter(ag => ag.status === 'opened').length}</p><p className="text-xs text-muted-foreground">افتُتحت</p></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">أيدي الوكيل *</label>
              <Input placeholder="أيدي الوكيل على المنصة" value={agencyForm.agent_id} onChange={e => setAF('agent_id', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم الوكالة</label>
              <Input placeholder="اسم الوكالة" value={agencyForm.agency_name} onChange={e => setAF('agency_name', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={agencyForm.admin_id} onValueChange={v => setAF('admin_id', v)}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                <SelectContent>{admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">البلد</label>
              <Input placeholder="بلد الوكالة" value={agencyForm.country} onChange={e => setAF('country', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">واتس الوكيل</label>
              <Input placeholder="رقم الواتساب" value={agencyForm.agent_whatsapp} onChange={e => setAF('agent_whatsapp', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">البرنامج القادم منه</label>
              <Input placeholder="مثال: تيليجرام، واتساب، انستجرام..." value={agencyForm.source_platform} onChange={e => setAF('source_platform', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">تاريخ الإنشاء</label>
              <Input type="date" value={agencyForm.creation_date} onChange={e => setAF('creation_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">تاريخ الافتتاح <span className="text-xs text-muted-foreground">(إذا تم الافتتاح)</span></label>
              <Input type="date" value={agencyForm.opening_date} onChange={e => setAF('opening_date', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea placeholder="أي ملاحظات إضافية..." value={agencyForm.notes} onChange={e => setAF('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveAgency} disabled={savingAgency || !agencyForm.agent_id.trim() || !agencyForm.admin_id} className="flex-1">
              {savingAgency ? 'جاري الحفظ...' : editingAgency ? 'حفظ التعديلات' : 'إضافة الوكالة'}
            </Button>
            <Button variant="outline" onClick={() => setAgencyDlg(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ SUPPORTER DIALOG ══ */}
      <Dialog open={supporterDlg} onOpenChange={setSupporterDlg}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupporter ? 'تعديل بيانات الداعم' : 'إضافة داعم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">أيدي الداعم *</label>
              <Input placeholder="أيدي الداعم على المنصة" value={supporterForm.supporter_id} onChange={e => setSF('supporter_id', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ليفل</label>
              <Input placeholder="مثال: ليفل 5" value={supporterForm.level} onChange={e => setSF('level', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={supporterForm.admin_id} onValueChange={v => setSF('admin_id', v)}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                <SelectContent>{admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">البرنامج القادم منه</label>
              <Input placeholder="مثال: تيليجرام، واتساب..." value={supporterForm.source_platform} onChange={e => setSF('source_platform', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">الإدارة</label>
              <Input placeholder="مثال: إدارة أميرة 10005" value={supporterForm.management} onChange={e => setSF('management', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea placeholder="أي ملاحظات إضافية..." value={supporterForm.notes} onChange={e => setSF('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveSupporter} disabled={savingSupporter || !supporterForm.supporter_id.trim() || !supporterForm.admin_id} className="flex-1">
              {savingSupporter ? 'جاري الحفظ...' : editingSupporter ? 'حفظ التعديلات' : 'إضافة الداعم'}
            </Button>
            <Button variant="outline" onClick={() => setSupporterDlg(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ REPORT DIALOG ══ */}
      <Dialog open={reportDlg} onOpenChange={setReportDlg}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />تقرير 10 أيام عمل
            </DialogTitle>
          </DialogHeader>
          {reportData && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-5 font-mono text-sm space-y-4 border">
                <div className="text-center border-b pb-3">
                  <p className="font-bold text-base">📊 تقرير 10 ايام عمل الادمن</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getPeriodLabel(reportPeriod)} — {MONTHS[reportMonth-1]} {reportYear}
                  </p>
                </div>
                <div className="space-y-1">
                  <p><span className="text-muted-foreground">اسم الادمن:</span> <strong>{reportData.admin?.full_name || '—'}</strong></p>
                  <p><span className="text-muted-foreground">أيدي الادمن:</span> <strong>{reportData.admin?.platform_id || reportData.admin?.username || '—'}</strong></p>
                </div>
                <div>
                  <p className="font-bold mb-2">📋 عدد الوكالات التي تم تفعيلها  {reportData.agencies_activated.length}</p>
                  {reportData.agencies_activated.length === 0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_activated.map((ag, i) => (
                      <p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name ? ` (${ag.agency_name})` : ''}</p>
                    ))}
                </div>
                <div>
                  <p className="font-bold mb-2">🎉 عدد الوكالات التي تم افتتاحها  {reportData.agencies_opened.length}</p>
                  {reportData.agencies_opened.length === 0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_opened.map((ag, i) => (
                      <p key={ag.id}>{i+1}: {ag.agent_id}{ag.agency_name ? ` (${ag.agency_name})` : ''}</p>
                    ))}
                </div>
                <div>
                  <p className="font-bold mb-2">👥 عدد الداعمين التي تم جلبهم  {reportData.supporters.length}</p>
                  {reportData.supporters.length === 0 ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.supporters.map((s, i) => (
                      <p key={s.id}>{i+1}: {s.supporter_id}{s.level ? ` | ليفل: ${s.level}` : ''}</p>
                    ))}
                </div>
              </div>
              <Button onClick={copyReport} variant="outline" className="w-full gap-2">
                {copied ? <><Check className="h-4 w-4 text-green-600" />تم النسخ!</> : <><Copy className="h-4 w-4" />نسخ التقرير</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
