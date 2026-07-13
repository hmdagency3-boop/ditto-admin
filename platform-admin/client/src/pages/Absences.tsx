import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserX, Plus, Filter, Trash2, CheckCircle2, Clock,
  AlertTriangle, ShieldAlert, CalendarX, BadgeAlert,
  Search, ChevronDown, Calendar, Timer, FileText, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────────
type AbsenceType = 'tardiness' | 'absence' | 'emergency';
type PenaltyType = 'verbal_warning' | 'compensatory' | 'compensatory_plus_30' | 'double_shift' | 'return_shift' | 'none';

interface UserInfo {
  id: string; username: string; full_name: string;
  role: string; platform_id?: string;
  externalImage?: string; externalName?: string;
}

interface Absence {
  id: string;
  user_id: string;
  date: string;
  shift_number?: number;
  type: AbsenceType;
  tardiness_minutes?: number;
  excuse?: string;
  has_proof?: boolean;
  coverage_admin_id?: string;
  penalty: PenaltyType;
  penalty_extra_minutes: number;
  penalty_applied: boolean;
  penalty_scheduled_date?: string;
  monthly_violation_count: number;
  notes?: string;
  recorded_by: string;
  created_at: string;
  user?: UserInfo;
  coverage?: UserInfo;
  recorder?: UserInfo;
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────
const formSchema = z.object({
  user_id: z.string().min(1, 'يجب اختيار المشرف'),
  date: z.string().min(1, 'يجب تحديد التاريخ'),
  shift_number: z.string().optional(),
  type: z.enum(['tardiness', 'absence', 'emergency']),
  tardiness_minutes: z.string().optional(),
  excuse: z.string().optional(),
  has_proof: z.boolean().default(false),
  coverage_admin_id: z.string().optional(),
  notes: z.string().optional(),
  penalty_scheduled_date: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────────
const SHIFT_SLOTS = [
  '12:00 ص - 2:00 ص', '2:00 ص - 4:00 ص', '4:00 ص - 6:00 ص',
  '6:00 ص - 8:00 ص', '8:00 ص - 10:00 ص', '10:00 ص - 12:00 م',
  '12:00 م - 2:00 م', '2:00 م - 4:00 م', '4:00 م - 6:00 م',
  '6:00 م - 8:00 م', '8:00 م - 10:00 م', '10:00 م - 12:00 ص',
];

function penaltyLabel(p: PenaltyType): { text: string; color: string; icon: React.ReactNode } {
  switch (p) {
    case 'verbal_warning':
      return { text: 'إنذار شفهي', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertTriangle className="h-3 w-3" /> };
    case 'compensatory':
      return { text: 'تعويض بنفس المدة', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: <Timer className="h-3 w-3" /> };
    case 'compensatory_plus_30':
      return { text: 'تعويض + 30 دقيقة إضافية', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <BadgeAlert className="h-3 w-3" /> };
    case 'double_shift':
      return { text: 'مضاعفة الشيفت', color: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300', icon: <ShieldAlert className="h-3 w-3" /> };
    case 'return_shift':
      return { text: 'رد الشيفت لأدمن التغطية', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Users className="h-3 w-3" /> };
    case 'none':
      return { text: 'بدون عقوبة', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> };
  }
}

function typeLabel(t: AbsenceType): { text: string; color: string } {
  switch (t) {
    case 'tardiness': return { text: 'تأخير', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    case 'absence':   return { text: 'غياب كامل', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    case 'emergency': return { text: 'طارئ (بعذر)', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  }
}

const getInitials = (name: string) =>
  name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

// ── Component ──────────────────────────────────────────────────────────────────
export default function Absences() {
  const { token, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AbsenceType>('all');
  const [penaltyFilter, setPenaltyFilter] = useState<'all' | 'pending' | 'applied'>('all');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: '', date: new Date().toISOString().split('T')[0],
      shift_number: '', type: 'tardiness',
      tardiness_minutes: '', excuse: '', has_proof: false,
      coverage_admin_id: '', notes: '', penalty_scheduled_date: '',
    },
  });
  const watchType = form.watch('type');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [absRes, usersRes] = await Promise.all([
        fetch('/api/absences', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users',    { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!absRes.ok) throw new Error();

      const absData: Absence[] = await absRes.json();
      const usersData: UserInfo[] = usersRes.ok ? await usersRes.json() : [];

      // Enrich with external profiles
      const enriched = await Promise.all(
        usersData.map(async (u) => {
          try {
            const p = await fetchUserProfile(u.platform_id || u.username);
            return { ...u, externalImage: p?.image, externalName: p?.name };
          } catch { return u; }
        })
      );
      const userMap = Object.fromEntries(enriched.map(u => [u.id, u]));

      const absWithUsers = absData.map(a => ({
        ...a,
        user:     userMap[a.user_id],
        coverage: a.coverage_admin_id ? userMap[a.coverage_admin_id] : undefined,
        recorder: userMap[a.recorded_by],
      }));

      setAbsences(absWithUsers);
      setAdmins(enriched.filter(u => u.role !== 'super_admin'));
    } catch { toast({ title: 'خطأ', description: 'تعذّر تحميل البيانات', variant: 'destructive' }); }
    finally { setLoading(false); }
  }

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    try {
      const body: any = {
        user_id: data.user_id,
        date: data.date,
        type: data.type,
        notes: data.notes || null,
        penalty_scheduled_date: data.penalty_scheduled_date || null,
      };
      if (data.shift_number) body.shift_number = parseInt(data.shift_number);
      if (data.type === 'tardiness' && data.tardiness_minutes)
        body.tardiness_minutes = parseInt(data.tardiness_minutes);
      if (data.type === 'emergency') {
        body.excuse = data.excuse;
        body.has_proof = data.has_proof;
        if (data.coverage_admin_id) body.coverage_admin_id = data.coverage_admin_id;
      }

      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      toast({ title: 'تم التسجيل', description: 'تم تسجيل المخالفة وحساب العقوبة' });
      form.reset();
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'حدث خطأ', variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  }

  async function toggleApplied(absence: Absence) {
    try {
      const res = await fetch(`/api/absences/${absence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ penalty_applied: !absence.penalty_applied }),
      });
      if (!res.ok) throw new Error();
      toast({ title: absence.penalty_applied ? 'تم إلغاء التنفيذ' : 'تم تسجيل التنفيذ' });
      fetchData();
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' });
    }
  }

  async function deleteAbsence(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/absences/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'تم الحذف' });
      fetchData();
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' });
    } finally { setDeletingId(null); }
  }

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = absences.filter(a => {
    const name = (a.user?.externalName || a.user?.full_name || '').toLowerCase();
    const username = (a.user?.username || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    if (q && !name.includes(q) && !username.includes(q)) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (penaltyFilter === 'pending' && a.penalty_applied) return false;
    if (penaltyFilter === 'applied' && !a.penalty_applied) return false;
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = {
    total: absences.length,
    pending: absences.filter(a => !a.penalty_applied).length,
    tardiness: absences.filter(a => a.type === 'tardiness').length,
    absences: absences.filter(a => a.type === 'absence').length,
    emergency: absences.filter(a => a.type === 'emergency').length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-wrapper space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  return (
    <div className="page-wrapper space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarX className="page-title-icon" />
            سجل الغيابات والتأخير
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            لائحة تنظيم الالتزام والمواعيد — نظام 10005
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> تسجيل مخالفة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-red-500" />
                  تسجيل غياب أو تأخير
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

                  {/* Admin */}
                  <FormField control={form.control} name="user_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>المشرف</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="اختر مشرفاً" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {admins.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.externalName || a.full_name} (@{a.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Date + Shift row */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>التاريخ</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="shift_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>رقم الشيفت</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SHIFT_SLOTS.map((label, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>
                                شيفت {i+1} — {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Type */}
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع المخالفة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tardiness">⏰ تأخير عن الشيفت</SelectItem>
                          <SelectItem value="absence">🚫 غياب كامل (بدون عذر)</SelectItem>
                          <SelectItem value="emergency">🆘 حالة طارئة (بعذر)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Tardiness minutes */}
                  {watchType === 'tardiness' && (
                    <FormField control={form.control} name="tardiness_minutes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>مدة التأخير (بالدقائق)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} placeholder="مثال: 20" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          أقل من 15 دقيقة → إنذار شفهي • أكثر من 15 → تعويض بنفس المدة
                        </p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Emergency fields */}
                  {watchType === 'emergency' && (
                    <>
                      <FormField control={form.control} name="excuse" render={({ field }) => (
                        <FormItem>
                          <FormLabel>تفاصيل العذر</FormLabel>
                          <FormControl>
                            <Textarea placeholder="اشرح سبب الغياب..." rows={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="has_proof" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="cursor-pointer">يوجد إثبات أو إشعار مسبق</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="coverage_admin_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>أدمن التغطية</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {admins.map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.externalName || a.full_name} (@{a.username})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}

                  {/* Penalty scheduled date */}
                  <FormField control={form.control} name="penalty_scheduled_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ تنفيذ العقوبة (اختياري)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Notes */}
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات إضافية</FormLabel>
                      <FormControl>
                        <Textarea placeholder="أي ملاحظات..." rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      {isSubmitting ? 'جاري الحفظ...' : 'تسجيل المخالفة'}
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">إلغاء</Button>
                    </DialogClose>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700">
              <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">إجمالي المخالفات</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-200 dark:bg-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">عقوبات لم تُنفَّذ</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-200 dark:bg-amber-800">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.tardiness}</p>
              <p className="text-xs text-muted-foreground">حالات تأخير</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-200 dark:bg-rose-800">
              <UserX className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{stats.absences}</p>
              <p className="text-xs text-muted-foreground">غياب بدون عذر</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy Info Banner */}
      <Card className="border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-400">لائحة العقوبات التشغيلية (10005)</p>
              <div className="text-amber-700 dark:text-amber-500 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <span>⏰ تأخير &lt; 15 دقيقة → إنذار شفهي</span>
                <span>⏰ تأخير &gt; 15 دقيقة → تعويض بنفس المدة فوق الشيفت</span>
                <span>⚠️ تكرار التأخير مرتين بنفس الأسبوع → تعويض + 30 دقيقة إضافية</span>
                <span>🚫 غياب كامل بدون عذر → مضاعفة الشيفت (تعويض + شيفت إضافي)</span>
                <span>🆘 غياب طارئ بعذر → رد الشيفت لأدمن التغطية في موعد لاحق</span>
                <span className="text-red-600 dark:text-red-400 font-medium">❌ أكثر من 3 مخالفات / شهر → إزالة فورية</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم المشرف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 me-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="tardiness">تأخير</SelectItem>
            <SelectItem value="absence">غياب كامل</SelectItem>
            <SelectItem value="emergency">طارئ (بعذر)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={penaltyFilter} onValueChange={(v: any) => setPenaltyFilter(v)}>
          <SelectTrigger className="w-44">
            <ChevronDown className="h-4 w-4 me-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العقوبات</SelectItem>
            <SelectItem value="pending">لم تُنفَّذ بعد</SelectItem>
            <SelectItem value="applied">تم التنفيذ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CalendarX className="h-14 w-14 mb-4 opacity-30" />
          <p className="text-lg font-medium">لا توجد مخالفات</p>
          <p className="text-sm mt-1">لا توجد سجلات تطابق الفلتر الحالي</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((absence) => {
            const penalty = penaltyLabel(absence.penalty);
            const type    = typeLabel(absence.type);
            const user    = absence.user;
            const isOver3 = absence.monthly_violation_count >= 3;

            return (
              <Card
                key={absence.id}
                className={`transition-all border ${absence.penalty_applied ? 'opacity-60' : ''} ${isOver3 ? 'border-red-400 dark:border-red-700' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 shrink-0 mt-0.5">
                      {user?.externalImage && <AvatarImage src={user.externalImage} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {user ? getInitials(user.externalName || user.full_name) : '?'}
                      </AvatarFallback>
                    </Avatar>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold truncate">
                          {user?.externalName || user?.full_name || 'مستخدم محذوف'}
                        </span>
                        {user && (
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                        )}

                        {/* Type badge */}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${type.color}`}>
                          {type.text}
                        </span>

                        {/* Penalty badge */}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${penalty.color}`}>
                          {penalty.icon} {penalty.text}
                          {absence.type === 'tardiness' && absence.tardiness_minutes
                            ? ` (${absence.tardiness_minutes} دقيقة)`
                            : ''}
                          {absence.penalty_extra_minutes > 0
                            ? ` — تعويض ${absence.penalty_extra_minutes} دقيقة`
                            : ''}
                        </span>

                        {/* Applied badge */}
                        {absence.penalty_applied && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" /> تم التنفيذ
                          </span>
                        )}

                        {/* Monthly violation warning */}
                        {isOver3 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-300">
                            ⚠️ {absence.monthly_violation_count} مخالفات هذا الشهر
                          </span>
                        )}
                      </div>

                      {/* Details row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {absence.date}
                        </span>
                        {absence.shift_number && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            شيفت {absence.shift_number} — {SHIFT_SLOTS[absence.shift_number - 1]}
                          </span>
                        )}
                        {absence.penalty_scheduled_date && (
                          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <Timer className="h-3 w-3" />
                            موعد التنفيذ: {absence.penalty_scheduled_date}
                          </span>
                        )}
                        {absence.coverage && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Users className="h-3 w-3" />
                            تغطية: {absence.coverage.full_name}
                          </span>
                        )}
                      </div>

                      {/* Excuse */}
                      {absence.excuse && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          📋 {absence.excuse}
                          {absence.has_proof && (
                            <span className="mr-2 text-green-600 dark:text-green-400">✓ يوجد إثبات</span>
                          )}
                        </p>
                      )}

                      {/* Notes */}
                      {absence.notes && (
                        <p className="text-xs text-muted-foreground italic">ملاحظة: {absence.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {isSuperAdmin && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={absence.penalty_applied ? 'outline' : 'default'}
                          className="gap-1 text-xs"
                          onClick={() => toggleApplied(absence)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {absence.penalty_applied ? 'إلغاء' : 'تنفيذ'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف المخالفة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteAbsence(absence.id)}
                                disabled={deletingId === absence.id}
                              >
                                {deletingId === absence.id ? 'جاري الحذف...' : 'حذف'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
