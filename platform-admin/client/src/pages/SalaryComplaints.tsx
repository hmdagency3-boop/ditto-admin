import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  FileWarning,
  Globe2,
  Loader2,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SalaryComplaint {
  id: string;
  agency_code: string;
  agent_id: string;
  host_id: string;
  cash_number: string;
  host_phone: string;
  country: string;
  complaint_month: string;
  amount: number;
  complaint_type: string;
  created_at: string;
}

type ComplaintForm = Omit<SalaryComplaint, 'id' | 'created_at' | 'amount'> & { amount: string };

const EMPTY_FORM: ComplaintForm = {
  agency_code: '',
  agent_id: '',
  host_id: '',
  cash_number: '',
  host_phone: '',
  country: '',
  complaint_month: '',
  amount: '',
  complaint_type: '',
};

function cairoDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return {
    year: parts.find(p => p.type === 'year')?.value || '',
    month: parts.find(p => p.type === 'month')?.value || '',
    day: Number(parts.find(p => p.type === 'day')?.value || 0),
  };
}

function defaultComplaintMonth() {
  const now = cairoDateParts();
  return `${now.year}-${now.month}`;
}

function formatMonth(value: string) {
  if (!value) return '—';
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

export default function SalaryComplaints() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<SalaryComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ComplaintForm>({
    ...EMPTY_FORM,
    complaint_month: defaultComplaintMonth(),
  });

  const cairoDay = cairoDateParts().day;
  const submissionOpen = cairoDay >= 15 && cairoDay <= 17;

  async function loadComplaints() {
    setLoading(true);
    try {
      const response = await fetch('/api/salary-complaints', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر تحميل الشكاوى');
      setComplaints(body);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'تعذر تحميل الشكاوى', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadComplaints();
  }, [token]);

  function setField(field: keyof ComplaintForm, value: string) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function openAddDialog() {
    if (!submissionOpen) return;
    setForm({ ...EMPTY_FORM, complaint_month: defaultComplaintMonth() });
    setDialogOpen(true);
  }

  async function saveComplaint() {
    const requiredFields: Array<[keyof ComplaintForm, string]> = [
      ['agency_code', 'كود الوكالة'],
      ['agent_id', 'أيدي الوكيل'],
      ['host_id', 'أيدي المضيف'],
      ['cash_number', 'رقم الكاش'],
      ['host_phone', 'هاتف المضيف'],
      ['country', 'البلد'],
      ['complaint_month', 'الشهر'],
      ['amount', 'المبلغ'],
      ['complaint_type', 'نوع الشكوى'],
    ];
    const missing = requiredFields.find(([field]) => !String(form[field]).trim());
    if (missing) {
      toast({ title: 'بيانات ناقصة', description: `أدخل ${missing[1]}`, variant: 'destructive' });
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'المبلغ غير صحيح', description: 'أدخل مبلغًا رقميًا صحيحًا', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/salary-complaints', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, amount }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر حفظ الشكوى');
      toast({ title: 'تمت إضافة الشكوى', description: 'تم حفظ شكوى الراتب بنجاح' });
      setDialogOpen(false);
      await loadComplaints();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'تعذر حفظ الشكوى', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteComplaint(id: string) {
    if (!window.confirm('هل تريد حذف هذه الشكوى؟')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/salary-complaints/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر حذف الشكوى');
      setComplaints(previous => previous.filter(item => item.id !== id));
      toast({ title: 'تم حذف الشكوى' });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'تعذر حذف الشكوى', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return complaints;
    return complaints.filter(item =>
      [
        item.agency_code,
        item.agent_id,
        item.host_id,
        item.cash_number,
        item.host_phone,
        item.country,
        item.complaint_type,
      ].some(value => value?.toLowerCase().includes(query))
    );
  }, [complaints, search]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <FileWarning className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">شكاوى الرواتب</h1>
            <p className="mt-1 text-sm text-muted-foreground">إدارة شكاوى رواتب المضيفين — إدارة الوكالات 10005</p>
          </div>
        </div>
        <Button onClick={openAddDialog} disabled={!submissionOpen} className="gap-2">
          <Plus className="h-4 w-4" />
          {submissionOpen ? 'إضافة شكوى' : 'الإضافة مغلقة حاليًا'}
        </Button>
      </div>

      <Card className={submissionOpen ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20'}>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${submissionOpen ? 'text-emerald-600' : 'text-red-600'}`} />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{submissionOpen ? 'فترة إضافة الشكاوى مفتوحة' : 'فترة إضافة الشكاوى مغلقة'}</p>
            <p className="text-muted-foreground">
              الإضافة متاحة من يوم 15 إلى يوم 17 من كل شهر فقط. اليوم الحالي في توقيت القاهرة: <strong>{cairoDay}</strong>.
            </p>
            <p className="font-medium text-amber-700 dark:text-amber-400">
              في حال رفع شكوى كيدية أو تعدد حسابات سيتم البند، فكن حذرًا.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileWarning className="h-5 w-5 text-amber-600" />
            <div><p className="text-2xl font-bold">{complaints.length}</p><p className="text-xs text-muted-foreground">إجمالي الشكاوى</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <div><p className="text-2xl font-bold">{new Set(complaints.map(item => item.complaint_month)).size}</p><p className="text-xs text-muted-foreground">أشهر بها شكاوى</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Banknote className="h-5 w-5 text-emerald-600" />
            <div><p className="text-2xl font-bold">{formatAmount(complaints.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p><p className="text-xs text-muted-foreground">إجمالي المبالغ</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>قائمة شكاوى الرواتب</CardTitle>
              <CardDescription>{filteredComplaints.length} شكوى من أصل {complaints.length}</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالكود أو الأيدي..." className="pr-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredComplaints.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">لا توجد شكاوى مطابقة.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1050px] text-right text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {['كود الوكالة', 'أيدي الوكيل', 'أيدي المضيف', 'رقم الكاش', 'هاتف المضيف', 'البلد', 'الشهر', 'المبلغ', 'نوع الشكوى', 'الإجراء'].map(label => (
                      <th key={label} className="whitespace-nowrap px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredComplaints.map(item => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-3 py-3 font-medium">{item.agency_code}</td>
                      <td className="px-3 py-3">{item.agent_id}</td>
                      <td className="px-3 py-3">{item.host_id}</td>
                      <td className="px-3 py-3">{item.cash_number}</td>
                      <td className="px-3 py-3">{item.host_phone}</td>
                      <td className="px-3 py-3">{item.country}</td>
                      <td className="px-3 py-3">{formatMonth(item.complaint_month)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatAmount(Number(item.amount))}</td>
                      <td className="max-w-52 px-3 py-3">{item.complaint_type}</td>
                      <td className="px-3 py-3">
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteComplaint(item.id)} disabled={deletingId === item.id} title="حذف الشكوى">
                          {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-amber-600" />إضافة شكوى راتب</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            في حال رفع شكوى كيدية أو تعدد حسابات سيتم البند فكن حذرًا.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>كود وكالة *</Label><Input value={form.agency_code} onChange={event => setField('agency_code', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي الوكيل *</Label><Input value={form.agent_id} onChange={event => setField('agent_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي المضيف *</Label><Input value={form.host_id} onChange={event => setField('host_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>رقم الكاش *</Label><div className="relative"><WalletCards className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.cash_number} onChange={event => setField('cash_number', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>هاتف المضيف *</Label><div className="relative"><Phone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.host_phone} onChange={event => setField('host_phone', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>البلد *</Label><div className="relative"><Globe2 className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.country} onChange={event => setField('country', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>الشهر *</Label><Input type="month" value={form.complaint_month} onChange={event => setField('complaint_month', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>المبلغ *</Label><div className="relative"><Banknote className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="number" min="0" step="0.01" className="pr-9" value={form.amount} onChange={event => setField('amount', event.target.value)} /></div></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>نوع الشكوى *</Label><Textarea value={form.complaint_type} onChange={event => setField('complaint_type', event.target.value)} placeholder="اكتب نوع الشكوى بالتفصيل..." rows={3} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveComplaint} disabled={saving} className="flex-1 gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'جاري الحفظ...' : 'حفظ الشكوى'}</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}