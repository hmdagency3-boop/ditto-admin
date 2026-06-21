import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, FileText, Plus, Trash2, CheckCircle2,
  Copy, Check, ChevronDown, Search, CalendarDays
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
  code: string;
  admin_id: string;
  status: 'activated' | 'opened';
  notes?: string;
  created_at: string;
}

interface Supporter {
  id: string;
  supporter_code: string;
  admin_id: string;
  notes?: string;
  created_at: string;
}

interface ReportData {
  agencies_activated: Agency[];
  agencies_opened: Agency[];
  supporters: Supporter[];
  admin: Admin | null;
}

const MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

function getPeriodLabel(p: number) {
  if (p === 1) return 'الفترة الأولى (1 – 10)';
  if (p === 2) return 'الفترة الثانية (11 – 20)';
  return 'الفترة الثالثة (21 – نهاية الشهر)';
}

function getCurrentPeriod() {
  const d = new Date().getDate();
  return d <= 10 ? 1 : d <= 20 ? 2 : 3;
}

export default function WorkManagement() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins]         = useState<Admin[]>([]);
  const [agencies, setAgencies]     = useState<Agency[]>([]);
  const [supporters, setSupporter]  = useState<Supporter[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterAdmin, setFilterAdmin] = useState('all');

  // Agency dialog
  const [agencyDlg, setAgencyDlg]       = useState(false);
  const [agencyCode, setAgencyCode]     = useState('');
  const [agencyAdmin, setAgencyAdmin]   = useState('');
  const [agencyNotes, setAgencyNotes]   = useState('');
  const [savingAgency, setSavingAgency] = useState(false);

  // Supporter dialog
  const [supporterDlg, setSupporterDlg]         = useState(false);
  const [supporterCode, setSupporterCode]       = useState('');
  const [supporterAdmin, setSupporterAdmin]     = useState('');
  const [supporterNotes, setSupporterNotes]     = useState('');
  const [savingSupporter, setSavingSupporter]   = useState(false);

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
        h('/api/users'),
        h('/api/agencies'),
        h('/api/supporters'),
      ]);
      const adminsData: Admin[]     = adminsRes.ok ? await adminsRes.json() : [];
      const agenciesData: Agency[]  = agenciesRes.ok ? await agenciesRes.json() : [];
      const supportersData: Supporter[] = supportersRes.ok ? await supportersRes.json() : [];
      setAdmins(adminsData.filter(a => a.id));
      setAgencies(agenciesData);
      setSupporter(supportersData);
    } finally {
      setLoading(false);
    }
  }, [h]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function adminName(id: string) {
    const a = admins.find(x => x.id === id);
    return a ? a.full_name || a.username : '—';
  }

  // ── Agency actions ──────────────────────────────────────────────────────

  async function addAgency() {
    if (!agencyCode.trim() || !agencyAdmin) return;
    setSavingAgency(true);
    try {
      const r = await h('/api/agencies', { method: 'POST', body: JSON.stringify({ code: agencyCode.trim(), admin_id: agencyAdmin, notes: agencyNotes }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: 'تم إضافة الوكالة' });
      setAgencyDlg(false); setAgencyCode(''); setAgencyAdmin(''); setAgencyNotes('');
      fetchAll();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setSavingAgency(false); }
  }

  async function toggleAgencyStatus(a: Agency) {
    const newStatus = a.status === 'activated' ? 'opened' : 'activated';
    const r = await h(`/api/agencies/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (r.ok) {
      toast({ title: newStatus === 'opened' ? 'تم تسجيل الافتتاح ✅' : 'تم التراجع للتفعيل' });
      fetchAll();
    }
  }

  async function deleteAgency(id: string) {
    const r = await h(`/api/agencies/${id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchAll(); }
  }

  // ── Supporter actions ───────────────────────────────────────────────────

  async function addSupporter() {
    if (!supporterCode.trim() || !supporterAdmin) return;
    setSavingSupporter(true);
    try {
      const r = await h('/api/supporters', { method: 'POST', body: JSON.stringify({ supporter_code: supporterCode.trim(), admin_id: supporterAdmin, notes: supporterNotes }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: 'تم إضافة الداعم' });
      setSupporterDlg(false); setSupporterCode(''); setSupporterAdmin(''); setSupporterNotes('');
      fetchAll();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setSavingSupporter(false); }
  }

  async function deleteSupporter(id: string) {
    const r = await h(`/api/supporters/${id}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchAll(); }
  }

  // ── Report ──────────────────────────────────────────────────────────────

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
      toast({ title: 'خطأ في التقرير', description: e.message, variant: 'destructive' });
    } finally { setLoadingReport(false); }
  }

  function buildReportText(rd: ReportData): string {
    const a = rd.admin;
    const lines: string[] = [
      '══════════════════════════════',
      '   📊 تقرير 10 ايام عمل الادمن',
      '══════════════════════════════',
      `اسم الادمن: ${a?.full_name || '—'}`,
      `أيدي الادمن: ${a?.platform_id || a?.username || '—'}`,
      '',
      `📋 عدد الوكالات التي تم تفعيلها  ${rd.agencies_activated.length}`,
    ];
    rd.agencies_activated.forEach((ag, i) => lines.push(`${i + 1}: ${ag.code}`));
    lines.push('');
    lines.push(`🎉 عدد الوكالات التي تم افتتاحها  ${rd.agencies_opened.length}`);
    rd.agencies_opened.forEach((ag, i) => lines.push(`${i + 1}: ${ag.code}`));
    lines.push('');
    lines.push(`👥 عدد الداعمين التي تم جلبهم  ${rd.supporters.length}`);
    rd.supporters.forEach((s, i) => lines.push(`${i + 1}: ${s.supporter_code}`));
    lines.push('══════════════════════════════');
    return lines.join('\n');
  }

  async function copyReport() {
    if (!reportData) return;
    await navigator.clipboard.writeText(buildReportText(reportData));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Filtered lists ──────────────────────────────────────────────────────

  const filteredAgencies  = filterAdmin === 'all' ? agencies  : agencies.filter(a  => a.admin_id  === filterAdmin);
  const filteredSupporters = filterAdmin === 'all' ? supporters : supporters.filter(s => s.admin_id === filterAdmin);

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة العمل</h1>
            <p className="text-sm text-muted-foreground">تسجيل الوكالات والداعمين وتوليد تقارير الـ 10 أيام</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الوكالات', value: agencies.length, icon: Building2, color: 'text-blue-600' },
          { label: 'مفعّلة', value: agencies.filter(a => a.status === 'activated').length, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'تم افتتاحها', value: agencies.filter(a => a.status === 'opened').length, icon: CalendarDays, color: 'text-purple-600' },
          { label: 'إجمالي الداعمين', value: supporters.length, icon: Users, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="agencies">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agencies" className="gap-2"><Building2 className="h-4 w-4" />الوكالات</TabsTrigger>
          <TabsTrigger value="supporters" className="gap-2"><Users className="h-4 w-4" />الداعمون</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><FileText className="h-4 w-4" />التقارير</TabsTrigger>
        </TabsList>

        {/* ══ AGENCIES TAB ══ */}
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
            <Button onClick={() => setAgencyDlg(true)} className="gap-2 mr-auto">
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
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-lg">{ag.code}</span>
                        <Badge variant={ag.status === 'opened' ? 'default' : 'secondary'}
                          className={ag.status === 'opened' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : ''}>
                          {ag.status === 'opened' ? '🎉 تم الافتتاح' : '✅ مفعّلة'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{adminName(ag.admin_id)}</p>
                      {ag.notes && <p className="text-xs text-muted-foreground mt-1">{ag.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(ag.created_at), 'dd MMM yyyy', { locale: ar })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => toggleAgencyStatus(ag)}
                        title={ag.status === 'activated' ? 'تسجيل الافتتاح' : 'التراجع'}
                      >
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
                            <AlertDialogDescription>سيتم حذف الوكالة <strong>{ag.code}</strong> نهائياً.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAgency(ag.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ SUPPORTERS TAB ══ */}
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
            <Button onClick={() => setSupporterDlg(true)} className="gap-2 mr-auto">
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
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-lg">{s.supporter_code}</p>
                      <p className="text-sm text-muted-foreground">{adminName(s.admin_id)}</p>
                      {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(s.created_at), 'dd MMM yyyy', { locale: ar })}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الداعم؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف الداعم <strong>{s.supporter_code}</strong> نهائياً.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSupporter(s.id)} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ REPORTS TAB ══ */}
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
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الشهر</label>
                  <Select value={String(reportMonth)} onValueChange={v => setReportMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">الفترة</label>
                  <Select value={String(reportPeriod)} onValueChange={v => setReportPeriod(Number(v) as 1|2|3)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3].map(p => <SelectItem key={p} value={String(p)}>{getPeriodLabel(p)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateReport} disabled={loadingReport || !reportAdmin} className="gap-2 w-full sm:w-auto">
                <FileText className="h-4 w-4" />
                {loadingReport ? 'جاري التوليد...' : 'توليد التقرير'}
              </Button>
            </CardContent>
          </Card>

          {/* Quick view per admin */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map(a => {
              const adminAgencies  = agencies.filter(ag => ag.admin_id === a.id);
              const adminSupporters = supporters.filter(s => s.admin_id === a.id);
              return (
                <Card key={a.id} className="hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => { setReportAdmin(a.id); }}>
                  <CardContent className="p-4">
                    <p className="font-semibold">{a.full_name || a.username}</p>
                    <p className="text-xs text-muted-foreground mb-3">{a.platform_id || a.username}</p>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-bold text-blue-600">{adminAgencies.filter(ag => ag.status === 'activated').length}</p>
                        <p className="text-xs text-muted-foreground">مفعّلة</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-purple-600">{adminAgencies.filter(ag => ag.status === 'opened').length}</p>
                        <p className="text-xs text-muted-foreground">افتُتحت</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-orange-600">{adminSupporters.length}</p>
                        <p className="text-xs text-muted-foreground">داعم</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ ADD AGENCY DIALOG ══ */}
      <Dialog open={agencyDlg} onOpenChange={setAgencyDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>إضافة وكالة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">كود الوكالة *</label>
              <Input placeholder="أدخل كود الوكالة" value={agencyCode} onChange={e => setAgencyCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={agencyAdmin} onValueChange={setAgencyAdmin}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                <SelectContent>
                  {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ملاحظات (اختياري)</label>
              <Input placeholder="ملاحظات إضافية" value={agencyNotes} onChange={e => setAgencyNotes(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={addAgency} disabled={savingAgency || !agencyCode.trim() || !agencyAdmin} className="flex-1">
                {savingAgency ? 'جاري الحفظ...' : 'إضافة الوكالة'}
              </Button>
              <Button variant="outline" onClick={() => setAgencyDlg(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ ADD SUPPORTER DIALOG ══ */}
      <Dialog open={supporterDlg} onOpenChange={setSupporterDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>إضافة داعم جديد</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">أيدي الداعم *</label>
              <Input placeholder="أدخل أيدي الداعم" value={supporterCode} onChange={e => setSupporterCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">المشرف المسؤول *</label>
              <Select value={supporterAdmin} onValueChange={setSupporterAdmin}>
                <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                <SelectContent>
                  {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ملاحظات (اختياري)</label>
              <Input placeholder="ملاحظات إضافية" value={supporterNotes} onChange={e => setSupporterNotes(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={addSupporter} disabled={savingSupporter || !supporterCode.trim() || !supporterAdmin} className="flex-1">
                {savingSupporter ? 'جاري الحفظ...' : 'إضافة الداعم'}
              </Button>
              <Button variant="outline" onClick={() => setSupporterDlg(false)}>إلغاء</Button>
            </div>
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
              {/* Report card */}
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
                  {reportData.agencies_activated.length === 0
                    ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_activated.map((ag, i) => (
                        <p key={ag.id}>{i + 1}: {ag.code}</p>
                      ))
                  }
                </div>

                <div>
                  <p className="font-bold mb-2">🎉 عدد الوكالات التي تم افتتاحها  {reportData.agencies_opened.length}</p>
                  {reportData.agencies_opened.length === 0
                    ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.agencies_opened.map((ag, i) => (
                        <p key={ag.id}>{i + 1}: {ag.code}</p>
                      ))
                  }
                </div>

                <div>
                  <p className="font-bold mb-2">👥 عدد الداعمين التي تم جلبهم  {reportData.supporters.length}</p>
                  {reportData.supporters.length === 0
                    ? <p className="text-muted-foreground text-xs">لا يوجد</p>
                    : reportData.supporters.map((s, i) => (
                        <p key={s.id}>{i + 1}: {s.supporter_code}</p>
                      ))
                  }
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
