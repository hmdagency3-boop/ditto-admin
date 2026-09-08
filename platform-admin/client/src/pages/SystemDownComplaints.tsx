import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardPaste,
  FileWarning,
  Loader2,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
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

interface SystemDownComplaint {
  id: string;
  agency_code: string;
  agent_id: string;
  host_id: string;
  host_phone: string;
  complaint_type: string;
  down_reason: string;
  created_at: string;
}

type ComplaintForm = Omit<SystemDownComplaint, 'id' | 'created_at'>;

const EMPTY_FORM: ComplaintForm = {
  agency_code: '',
  agent_id: '',
  host_id: '',
  host_phone: '',
  complaint_type: '',
  down_reason: '',
};

const FORM_LABELS = [
  'كود وكالة', 'كود الوكالة', 'كود الوكيل',
  'ايدي الوكيل', 'اي دي الوكيل', 'أي دي الوكيل', 'ID الوكيل',
  'اي دي المضيف', 'أيدي المضيف', 'ايدي المضيف', 'ID المضيف',
  'هاتف المضيف', 'رقم هاتف المضيف', 'واتساب المضيف',
  'نوع الشكوى', 'نوع الشكوي', 'الشكوى',
  'سبب النزول', 'سبب حذف الحساب', 'سبب الحذف',
];

const REVIEW_NOTICE = 'سيتم الفحص تعداد الحسابات متبنن ادارة الوكالات وفي حال وجود حساب اخر سيتم باند فون او شكوى كيديه سيتم باند كعقوبه';

function cleanText(text: string) {
  return text.split('\n')
    .map(line => line.replace(/^[\s\u200b\-\*•◦◆▪▸➤→＊]+/, '').trim())
    .join('\n');
}

function extractField(text: string, ...keys: string[]) {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n');
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineMatch = new RegExp(`^${escaped}\\s*[:\\-：/|]\\s*(.*)$`, 'i');
    for (const line of lines) {
      const match = line.match(lineMatch);
      if (match?.[1]?.trim()) return match[1].trim();
    }
    const fullMatch = cleaned.match(new RegExp(`${escaped}\\s*[:\\-：/|]\\s*([^\\n]+)`, 'i'));
    if (fullMatch?.[1]?.trim()) return fullMatch[1].trim();
  }
  return '';
}

function parseComplaintText(text: string): Partial<ComplaintForm> {
  return {
    agency_code: extractField(text, 'كود وكالة', 'كود الوكالة', 'كود الوكيل'),
    agent_id: extractField(text, 'ايدي الوكيل', 'اي دي الوكيل', 'أي دي الوكيل', 'ID الوكيل'),
    host_id: extractField(text, 'اي دي المضيف', 'أيدي المضيف', 'ايدي المضيف', 'ID المضيف'),
    host_phone: extractField(text, 'هاتف المضيف', 'رقم هاتف المضيف', 'واتساب المضيف'),
    complaint_type: extractField(text, 'نوع الشكوى', 'نوع الشكوي', 'الشكوى'),
    down_reason: extractField(text, 'سبب النزول', 'سبب حذف الحساب', 'سبب الحذف'),
  };
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function SystemDownComplaints() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<SystemDownComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ComplaintForm>(EMPTY_FORM);

  async function loadComplaints() {
    setLoading(true);
    try {
      const response = await fetch('/api/system-down-complaints', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر تحميل شكاوى النزول');
      setComplaints(body);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'تعذر تحميل شكاوى النزول', variant: 'destructive' });
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
    setForm(EMPTY_FORM);
    setPasteText('');
    setPasteOpen(false);
    setDialogOpen(true);
  }

  function applyPastedComplaint() {
    const parsed = parseComplaintText(pasteText);
    const filledFields = Object.entries(parsed).filter(([, value]) => value?.trim());
    if (filledFields.length === 0) {
      toast({ title: 'لم يتم العثور على حقول', description: 'تأكد أن النص يحتوي على أسماء الحقول الموجودة في الاستمارة', variant: 'destructive' });
      return;
    }
    setForm(previous => ({ ...previous, ...Object.fromEntries(filledFields) }));
    setPasteOpen(false);
    setPasteText('');
    toast({ title: 'تم تحليل الاستمارة', description: `تم ملء ${filledFields.length} حقول. راجع البيانات قبل الحفظ.` });
  }

  async function saveComplaint() {
    const requiredFields: Array<[keyof ComplaintForm, string]> = [
      ['agency_code', 'كود الوكالة'],
      ['agent_id', 'أيدي الوكيل'],
      ['host_id', 'أيدي المضيف'],
      ['host_phone', 'هاتف المضيف'],
      ['complaint_type', 'نوع الشكوى'],
      ['down_reason', 'سبب النزول'],
    ];
    const missing = requiredFields.find(([field]) => !form[field].trim());
    if (missing) {
      toast({ title: 'بيانات ناقصة', description: `أدخل ${missing[1]}`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/system-down-complaints', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'تعذر حفظ الشكوى');
      toast({ title: 'تمت إضافة الشكوى', description: 'تم حفظ شكوى النزول من السيستم بنجاح' });
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
      const response = await fetch(`/api/system-down-complaints/${id}`, {
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
    return complaints.filter(item => [
      item.agency_code,
      item.agent_id,
      item.host_id,
      item.host_phone,
      item.complaint_type,
      item.down_reason,
    ].some(value => value.toLowerCase().includes(query)));
  }, [complaints, search]);

  if (loading) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-100 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <FileWarning className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">شكاوى النزول من السيستم</h1>
            <p className="mt-1 text-sm text-muted-foreground">إدارة طلبات نزول الحسابات — إدارة الوكالات 10005</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة شكوى نزول
        </Button>
      </div>

      <Card className="border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">تنبيه قبل تسجيل الشكوى</p>
            <p className="text-muted-foreground">{REVIEW_NOTICE}</p>
            <p className="font-medium text-red-700 dark:text-red-300">إدارة الوكالات 10005</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileWarning className="h-5 w-5 text-red-600" />
            <div><p className="text-2xl font-bold">{complaints.length}</p><p className="text-xs text-muted-foreground">إجمالي الشكاوى</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UserRound className="h-5 w-5 text-blue-600" />
            <div><p className="text-2xl font-bold">{new Set(complaints.map(item => item.host_id)).size}</p><p className="text-xs text-muted-foreground">حسابات مضيفين</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Phone className="h-5 w-5 text-emerald-600" />
            <div><p className="text-2xl font-bold">{new Set(complaints.map(item => item.agency_code)).size}</p><p className="text-xs text-muted-foreground">وكالات</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>قائمة شكاوى النزول</CardTitle>
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
              <table className="w-full min-w-[950px] text-right text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {['كود الوكالة', 'أيدي الوكيل', 'أيدي المضيف', 'هاتف المضيف', 'نوع الشكوى', 'سبب النزول', 'تاريخ الإضافة', 'الإجراء'].map(label => (
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
                      <td className="px-3 py-3">{item.host_phone}</td>
                      <td className="max-w-48 px-3 py-3">{item.complaint_type}</td>
                      <td className="max-w-64 px-3 py-3">{item.down_reason}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDate(item.created_at)}</td>
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
            <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-red-600" />إضافة شكوى نزول من السيستم</DialogTitle>
            <DialogDescription>أدخل بيانات الحساب وسبب طلب النزول للمراجعة.</DialogDescription>
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
                placeholder={'مثال:\nكود وكالة: 6033\nايدي الوكيل: 11143\nاي دي المضيف: 2169298\nسبب النزول: حساب آخر'}
                rows={7}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applyPastedComplaint}>تعبئة الحقول</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setPasteOpen(false); setPasteText(''); }}>إلغاء</Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {REVIEW_NOTICE}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>كود وكالة *</Label><Input value={form.agency_code} onChange={event => setField('agency_code', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي الوكيل *</Label><Input value={form.agent_id} onChange={event => setField('agent_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>أيدي المضيف *</Label><Input value={form.host_id} onChange={event => setField('host_id', event.target.value)} /></div>
            <div className="space-y-1.5"><Label>هاتف المضيف *</Label><div className="relative"><Phone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={form.host_phone} onChange={event => setField('host_phone', event.target.value)} /></div></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>نوع الشكوى *</Label><Textarea value={form.complaint_type} onChange={event => setField('complaint_type', event.target.value)} placeholder="مثال: شكوى نزول من السيستم" rows={2} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>سبب النزول *</Label><Textarea value={form.down_reason} onChange={event => setField('down_reason', event.target.value)} placeholder="اكتب سبب طلب النزول بالتفصيل..." rows={3} /></div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveComplaint} disabled={saving} className="flex-1 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'جاري الحفظ...' : 'حفظ الشكوى'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}