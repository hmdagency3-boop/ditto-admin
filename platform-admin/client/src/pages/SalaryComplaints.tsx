import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardPaste,
  FileWarning,
  Globe2,
  ImageIcon,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  is_exceptional: boolean;
  exceptional_reason: string | null;
  status: 'pending' | 'resolved';
  payment_proof_path?: string | null;
  payment_proof_url?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

type ComplaintForm = Omit<SalaryComplaint, 'id' | 'created_at' | 'amount' | 'status' | 'payment_proof_path' | 'payment_proof_url' | 'resolved_at' | 'resolved_by'> & { amount: string };

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
  is_exceptional: false,
  exceptional_reason: '',
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

function allowedComplaintMonths() {
  const now = cairoDateParts();
  const year = Number(now.year);
  const monthIndex = Number(now.month) - 1;
  return [1, 2].map(offset => {
    const date = new Date(Date.UTC(year, monthIndex - offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function defaultComplaintMonth() {
  return allowedComplaintMonths()[0];
}

function formatMonth(value: string) {
  if (!value) return '—';
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function formatAmount(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} $`;
}

function cleanPastedLines(text: string) {
  return text.split('\n')
    .map(line => line.replace(/^[\s\u200b\-\*•◦◆▪▸➤→＊]+/, '').trim())
    .join('\n');
}

const SALARY_PASTE_LABELS = [
  'كود الوكالة', 'كود وكالة', 'كود الوكيل',
  'ايدي الوكيل', 'اي دي الوكيل', 'أي دي الوكيل', 'ID الوكيل',
  'ايدي المضيف', 'اي دي المضيف', 'أي دي المضيف', 'ID المضيف',
  'رقم الكاش', 'الكاش', 'cash',
  'هاتف المضيف', 'رقم هاتف المضيف', 'واتساب المضيف', 'رقم المضيف',
  'بلد المضيف', 'البلد', 'الدولة',
  'شهر الشكوى', 'شهر الراتب', 'المستحق عن شهر', 'الشهر',
  'مبلغ الشكوى', 'قيمة الراتب', 'المبلغ', 'الراتب', 'المستحق',
  'نوع الشكوى', 'نوع الشكوي', 'سبب الشكوى', 'تفاصيل الشكوى', 'الشكوى',
  'سبب الاستثناء', 'سبب الضرورة', 'سبب الحالة الضرورية',
  'ايدي الداعم', 'ID الداعم', 'ايدي الوكالة', 'رقم الوكيل',
];

function cleanExtractedPastedValue(value: string) {
  let cleaned = value.trim().replace(/^[:\-\/|]\s*/, '').trim();
  let nextLabelIndex = -1;
  for (const label of SALARY_PASTE_LABELS) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = cleaned.match(new RegExp(`(?:^|\\s)${escapedLabel}\\s*[:\\-：/|]`, 'i'));
    if (match?.index !== undefined && (nextLabelIndex === -1 || match.index < nextLabelIndex)) {
      nextLabelIndex = match.index;
    }
  }
  if (nextLabelIndex === 0) return '';
  if (nextLabelIndex > 0) cleaned = cleaned.slice(0, nextLabelIndex).trim();

  return cleaned
    .replace(/\s*(?:في|فی)\s+حال\s+رفع\b.*$/i, '')
    .replace(/\s+إدارة\s+الوكالات\b.*$/i, '')
    .trim();
}

function extractPastedField(rawText: string, ...keys: string[]) {
  const text = cleanPastedLines(rawText);
  const lines = text.split('\n');

  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineRegex = new RegExp(`^${escapedKey}\\s*[:\\-：/|]\\s*(.*)$`, 'i');
    for (const line of lines) {
      const match = line.match(lineRegex);
      if (match?.[1]) return cleanExtractedPastedValue(match[1]);
    }
    const fullRegex = new RegExp(`${escapedKey}\\s*[:\\-：/|]\\s*([^\\n]+)`, 'i');
    const match = text.match(fullRegex);
    if (match?.[1]) return cleanExtractedPastedValue(match[1]);
  }
  return '';
}

function removeIgnoredPastedLines(text: string) {
  return cleanPastedLines(text)
    .split('\n')
    .filter(line => {
      const normalized = line.replace(/[\s\u200b]/g, '');
      return !/^(?:البلد|الدولة)(?:\+|و)(?:علم|علامة)الحساب[:：\-\/|]?/.test(normalized);
    })
    .join('\n');
}

function normalizeComplaintMonth(value: string) {
  const clean = value.trim().replace(/[^\d/-]/g, '');
  const yearMonth = clean.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2].padStart(2, '0')}`;
  const monthYear = clean.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, '0')}`;
  const monthOnly = clean.match(/^(0?[1-9]|1[0-2])$/);
  if (monthOnly) {
    const matchingMonth = allowedComplaintMonths().find(value => value.endsWith(`-${monthOnly[1].padStart(2, '0')}`));
    return matchingMonth || '';
  }
  return '';
}

function normalizeComplaintAmount(value: string) {
  const clean = value
    .trim()
    .replace(/(?:USD|دولار|جنيه|جنيه مصري|\$)/gi, '')
    .replace(/,/g, '')
    .trim();
  return Number(clean);
}

function parseSalaryComplaintText(text: string): Partial<ComplaintForm> {
  const complaintText = removeIgnoredPastedLines(text);
  const month = extractPastedField(
    complaintText,
    'شهر الشكوى', 'شهر الراتب', 'المستحق عن شهر', 'الشهر',
  );
  const parsedAmount = normalizeComplaintAmount(
    extractPastedField(complaintText, 'مبلغ الشكوى', 'قيمة الراتب', 'المبلغ', 'الراتب', 'المستحق'),
  );
  return {
    agency_code: extractPastedField(complaintText, 'كود الوكالة', 'كود وكالة', 'كود الوكيل'),
    agent_id: extractPastedField(complaintText, 'ايدي الوكيل', 'اي دي الوكيل', 'أي دي الوكيل', 'ID الوكيل', 'id الوكيل', 'رقم الوكيل', 'ايدي الوكالة'),
    host_id: extractPastedField(complaintText, 'ايدي المضيف', 'اي دي المضيف', 'أي دي المضيف', 'ID المضيف', 'id المضيف', 'رقم المضيف', 'ايدي الداعم', 'ID الداعم'),
    cash_number: extractPastedField(complaintText, 'رقم الكاش', 'الكاش', 'cash'),
    host_phone: extractPastedField(complaintText, 'هاتف المضيف', 'رقم هاتف المضيف', 'واتساب المضيف', 'رقم المضيف'),
    country: extractPastedField(complaintText, 'بلد المضيف', 'البلد', 'الدولة'),
    complaint_month: normalizeComplaintMonth(month),
    amount: Number.isFinite(parsedAmount) ? String(parsedAmount) : '',
    complaint_type: extractPastedField(complaintText, 'نوع الشكوى', 'نوع الشكوي', 'سبب الشكوى', 'تفاصيل الشكوى', 'الشكوى'),
    exceptional_reason: extractPastedField(complaintText, 'سبب الاستثناء', 'سبب الضرورة', 'سبب الحالة الضرورية'),
  };
}

export default function SalaryComplaints() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<SalaryComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<SalaryComplaint | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [resolving, setResolving] = useState(false);
  const [proofTarget, setProofTarget] = useState<SalaryComplaint | null>(null);
  const [search, setSearch] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [form, setForm] = useState<ComplaintForm>({
    ...EMPTY_FORM,
    complaint_month: defaultComplaintMonth(),
  });

  const cairoDay = cairoDateParts().day;
  const submissionOpen = cairoDay >= 15 && cairoDay <= 17;
  const allowedMonths = allowedComplaintMonths();

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
    setForm({
      ...EMPTY_FORM,
      complaint_month: defaultComplaintMonth(),
      is_exceptional: !submissionOpen,
    });
    setDialogOpen(true);
  }

  function applyPastedComplaint() {
    const parsed = parseSalaryComplaintText(pasteText);
    const filledFields = Object.entries(parsed).filter(([, value]) => String(value || '').trim());
    if (filledFields.length === 0) {
      toast({ title: 'لم يتم العثور على حقول', description: 'تأكد أن النص يحتوي على أسماء الحقول مثل أيدي المضيف أو المبلغ', variant: 'destructive' });
      return;
    }
    setForm(previous => ({
      ...previous,
      ...Object.fromEntries(filledFields),
      is_exceptional: previous.is_exceptional,
      exceptional_reason: previous.is_exceptional
        ? String(parsed.exceptional_reason || previous.exceptional_reason || '')
        : previous.exceptional_reason,
    }));
    setPasteOpen(false);
    setPasteText('');
    toast({ title: 'تم تحليل الاستمارة', description: `تم ملء ${filledFields.length} حقول. راجع البيانات قبل الحفظ.` });
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
    if (!allowedMonths.includes(form.complaint_month)) {
      toast({
        title: 'الشهر غير مسموح',
        description: `يمكن استقبال شكاوى الشهرين السابقين فقط: ${allowedMonths.map(formatMonth).join(' و ')}`,
        variant: 'destructive',
      });
      return;
    }
    if (form.is_exceptional && (form.exceptional_reason || '').trim().length < 5) {
      toast({ title: 'سبب الاستثناء مطلوب', description: 'اكتب سببًا واضحًا للحالة الضرورية', variant: 'destructive' });
      return;
    }

    const amount = normalizeComplaintAmount(form.amount);
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

  function openResolveDialog(item: SalaryComplaint) {
    setResolveTarget(item);
    setProofFile(null);
    setProofPreview('');
  }

  function closeResolveDialog() {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setResolveTarget(null);
    setProofFile(null);
    setProofPreview('');
  }

  function selectProofFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'نوع ملف غير صحيح', description: 'يجب إرفاق صورة فقط', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'الصورة كبيرة جدًا', description: 'الحد الأقصى لصورة الإثبات هو 5 ميجابايت', variant: 'destructive' });
      return;
    }
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function resolveComplaint() {
    if (!resolveTarget) return;
    if (!proofFile) {
      toast({ title: 'إثبات الإرسال مطلوب', description: 'أرفق صورة دليل إرسال الراتب قبل تسجيل الحالة كمحلولة', variant: 'destructive' });
      return;
    }
    setResolving(true);
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      const response = await fetch(`/api/salary-complaints/${resolveTarget.id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر تسجيل تسليم الراتب');
      toast({ title: 'تم حل الشكوى', description: 'تم تسجيل تسليم الراتب وحفظ صورة الإثبات' });
      closeResolveDialog();
      await loadComplaints();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'تعذر تسجيل تسليم الراتب', variant: 'destructive' });
    } finally {
      setResolving(false);
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
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {submissionOpen ? 'إضافة شكوى' : 'إضافة شكوى استثنائية'}
        </Button>
      </div>

      <Card className={submissionOpen ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20'}>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${submissionOpen ? 'text-emerald-600' : 'text-red-600'}`} />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{submissionOpen ? 'فترة إضافة الشكاوى مفتوحة' : 'فترة إضافة الشكاوى مغلقة'}</p>
            <p className="text-muted-foreground">
              الإضافة العادية متاحة من يوم 15 إلى يوم 17 من كل شهر. للحالات الضرورية يمكن تسجيل شكوى استثنائية في أي وقت. اليوم الحالي في توقيت القاهرة: <strong>{cairoDay}</strong>.
            </p>
            <p className="font-medium text-blue-700 dark:text-blue-300">
              الشهور المسموح باستقبال شكاواها: <strong>{allowedMonths.map(formatMonth).join(' و ')}</strong> فقط.
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
            <div><p className="text-2xl font-bold">{formatAmount(complaints.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p><p className="text-xs text-muted-foreground">إجمالي المبالغ بالدولار</p></div>
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
                    {['كود الوكالة', 'أيدي الوكيل', 'أيدي المضيف', 'رقم الكاش', 'هاتف المضيف', 'البلد', 'الشهر', 'المبلغ بالدولار', 'نوع الشكوى', 'الحالة', 'الإجراء'].map(label => (
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
                      <td className="whitespace-nowrap px-3 py-3">
                         {item.status === 'resolved' ? (
                           <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                             <CheckCircle2 className="h-3.5 w-3.5" />محلولة
                           </span>
                        ) : (
                           <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">قيد المراجعة</span>
                        )}
                         {item.is_exceptional && <span className="mt-1 block text-[11px] text-muted-foreground" title={item.exceptional_reason || undefined}>استثنائية</span>}
                      </td>
                      <td className="px-3 py-3">
                         <div className="flex items-center gap-1">
                           {item.status === 'resolved' && item.payment_proof_url ? (
                             <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40" onClick={() => setProofTarget(item)} title="عرض إثبات إرسال الراتب">
                               <ImageIcon className="h-4 w-4" />الإثبات
                             </Button>
                           ) : item.status !== 'resolved' ? (
                             <Button variant="outline" size="sm" className="gap-1 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" onClick={() => openResolveDialog(item)}>
                               <CheckCircle2 className="h-4 w-4" />تسليم الراتب
                             </Button>
                           ) : null}
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteComplaint(item.id)} disabled={deletingId === item.id} title="حذف الشكوى">
                             {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                           </Button>
                         </div>
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
            <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-amber-600" />{form.is_exceptional ? 'إضافة شكوى راتب استثنائية' : 'إضافة شكوى راتب'}</DialogTitle>
            <DialogDescription className="sr-only">نموذج إضافة بيانات شكوى الراتب</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant={pasteOpen ? 'default' : 'outline'}
            size="sm"
            className="w-fit gap-2"
            onClick={() => { setPasteOpen(previous => !previous); setPasteText(''); }}
          >
            <ClipboardPaste className="h-4 w-4" />
            {pasteOpen ? 'إخفاء اللصق' : 'لصق الاستمارة تلقائيًا'}
          </Button>
          {pasteOpen && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label>الصق بيانات الاستمارة هنا</Label>
              <Textarea
                value={pasteText}
                onChange={event => setPasteText(event.target.value)}
                placeholder={'مثال:\nكود وكالة: 6033\nايدي الوكيل: 11143\nاي دي المضيف: 2169298\nالمبلغ: 50$'}
                rows={6}
                dir="rtl"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applyPastedComplaint}>تعبئة الحقول</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setPasteOpen(false); setPasteText(''); }}>إلغاء</Button>
              </div>
            </div>
          )}
          <div className={`rounded-lg border p-3 text-sm ${form.is_exceptional ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'}`}>
            {form.is_exceptional
              ? 'هذه شكوى استثنائية خارج الموعد الرسمي. اكتب سبب الضرورة بوضوح، وسيتم حفظها مميزة للمراجعة.'
              : 'في حال رفع شكوى كيدية أو تعدد حسابات سيتم البند فكن حذرًا.'}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>كود وكالة *</Label><Input value={form.agency_code} onChange={event => setField('agency_code', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي الوكيل *</Label><Input value={form.agent_id} onChange={event => setField('agent_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي المضيف *</Label><Input value={form.host_id} onChange={event => setField('host_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>رقم الكاش *</Label><div className="relative"><WalletCards className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.cash_number} onChange={event => setField('cash_number', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>هاتف المضيف *</Label><div className="relative"><Phone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.host_phone} onChange={event => setField('host_phone', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>البلد *</Label><div className="relative"><Globe2 className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.country} onChange={event => setField('country', event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>الشهر المستحق *</Label><Input type="month" min={allowedMonths[1]} max={allowedMonths[0]} value={form.complaint_month} onChange={event => setField('complaint_month', event.target.value)} /><p className="text-xs text-muted-foreground">المسموح: {allowedMonths.map(formatMonth).join(' و ')} فقط</p></div>
            <div className="space-y-1.5"><Label>المبلغ بالدولار *</Label><div className="relative"><Banknote className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="number" min="0" step="0.01" className="pr-9" value={form.amount} onChange={event => setField('amount', event.target.value)} placeholder="مثال: 50" /></div></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>نوع الشكوى *</Label><Textarea value={form.complaint_type} onChange={event => setField('complaint_type', event.target.value)} placeholder="اكتب نوع الشكوى بالتفصيل..." rows={3} /></div>
            {form.is_exceptional && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>سبب الاستثناء الضروري *</Label>
                <Textarea value={form.exceptional_reason || ''} onChange={event => setField('exceptional_reason', event.target.value)} placeholder="لماذا لا يمكن انتظار الفترة الرسمية؟" rows={3} />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveComplaint} disabled={saving} className="flex-1 gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'جاري الحفظ...' : 'حفظ الشكوى'}</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolveTarget)} onOpenChange={open => { if (!open && !resolving) closeResolveDialog(); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />تسليم الراتب وحل الشكوى</DialogTitle>
            <DialogDescription>أرفق صورة واضحة تثبت إرسال الراتب. لن يتم تغيير الحالة إلى «محلولة» بدون الصورة.</DialogDescription>
          </DialogHeader>
          {resolveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p><span className="text-muted-foreground">أيدي المضيف:</span> {resolveTarget.host_id}</p>
                <p><span className="text-muted-foreground">المبلغ:</span> {formatAmount(Number(resolveTarget.amount))}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary-proof">صورة دليل إرسال الراتب *</Label>
                <Input id="salary-proof" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selectProofFile(event.target.files?.[0])} />
                <p className="text-xs text-muted-foreground">الصور فقط، والحد الأقصى 5 ميجابايت.</p>
              </div>
              {proofPreview && <img src={proofPreview} alt="معاينة إثبات إرسال الراتب" className="max-h-64 w-full rounded-lg border object-contain" />}
              <div className="flex gap-3">
                <Button onClick={resolveComplaint} disabled={resolving} className="flex-1 gap-2">
                  {resolving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {resolving ? 'جاري الحفظ...' : 'تأكيد التسليم وحل الشكوى'}
                </Button>
                <Button variant="outline" onClick={closeResolveDialog} disabled={resolving}>إلغاء</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(proofTarget)} onOpenChange={open => { if (!open) setProofTarget(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              إثبات إرسال الراتب
            </DialogTitle>
            <DialogDescription>
              {proofTarget ? `أيدي المضيف: ${proofTarget.host_id} — ${formatAmount(Number(proofTarget.amount))}` : ''}
            </DialogDescription>
          </DialogHeader>
          {proofTarget?.payment_proof_url && (
            <img
              src={proofTarget.payment_proof_url}
              alt="صورة إثبات إرسال الراتب"
              className="max-h-[65vh] w-full rounded-lg border bg-muted/20 object-contain"
            />
          )}
          <Button variant="outline" onClick={() => setProofTarget(null)}>إغلاق</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}