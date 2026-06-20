import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowRight, Phone, Shield, UserCog, Clock, Link, UserX, UserCheck,
  Star, AlertTriangle, History, StickyNote, Calendar, CheckCircle2,
  XCircle, AlertCircle, User, Hash, ImageIcon, Tag, Crown, Zap,
  TrendingUp, Users, Globe, Pencil, Trash2, Plus, X, Check, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AdminInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  status: string;
  phone?: string;
  platform_id?: string;
  created_at: string;
  employment_status?: string;
  externalImage?: string;
  externalName?: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in: string;
  check_out?: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  notes?: string;
}

interface RatingRecord {
  id: string;
  user_id: string;
  score: number;
  comment?: string;
  created_at: string;
}

interface WarningRecord {
  id: string;
  user_id: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  created_at: string;
}

interface ChangeLog {
  id: string;
  user_id: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
}

interface Note {
  id: string;
  user_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  name_change:        { label: 'تغيير الاسم',           icon: <User className="h-3.5 w-3.5" />,        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  platform_id_change: { label: 'تغيير رقم المنصة',      icon: <Hash className="h-3.5 w-3.5" />,        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  nick_change:        { label: 'تغيير الاسم في المنصة', icon: <Tag className="h-3.5 w-3.5" />,         color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  avatar_change:      { label: 'تغيير الصورة',          icon: <ImageIcon className="h-3.5 w-3.5" />,   color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  uid_mismatch:       { label: 'تغيير الرقم الثابت',    icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  noble_change:       { label: 'تغيير رتبة النبالة',    icon: <Crown className="h-3.5 w-3.5" />,       color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  vip_change:         { label: 'تغيير حالة VIP',        icon: <Star className="h-3.5 w-3.5" />,        color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  charm_change:       { label: 'تغيير مستوى السحر',     icon: <Zap className="h-3.5 w-3.5" />,         color: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' },
  exp_change:         { label: 'تغيير مستوى الخبرة',    icon: <TrendingUp className="h-3.5 w-3.5" />,  color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  fans_change:        { label: 'تغيير عدد المتابعين',   icon: <Users className="h-3.5 w-3.5" />,       color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
  country_change:     { label: 'تغيير الدولة',          icon: <Globe className="h-3.5 w-3.5" />,       color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
};

function isImageUrl(val: string | null): boolean {
  if (!val) return false;
  return val.startsWith('http') && (val.includes('avatar') || val.includes('.jpg') || val.includes('.jpeg') || val.includes('.png') || val.includes('res.sayyouditto') || val.includes('imageslim'));
}

function StarDisplay({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function AdminProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [ratings, setRatings] = useState<RatingRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (id && token) loadAll();
  }, [id, token]);

  async function loadAll() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, attRes, ratRes, warnRes, logsRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/attendance', { headers }),
        fetch('/api/ratings', { headers }),
        fetch('/api/warnings', { headers }),
        fetch('/api/change-logs', { headers }),
      ]);

      if (usersRes.ok) {
        const users: AdminInfo[] = await usersRes.json();
        const found = users.find(u => u.id === id);
        if (found) {
          const ext = await fetchUserProfile(found.platform_id || found.username);
          setAdmin({ ...found, externalImage: ext?.image, externalName: ext?.name });
        }
      }

      if (attRes.ok) {
        const all = await attRes.json();
        setAttendance(all.filter((r: AttendanceRecord) => r.user_id === id));
      }
      if (ratRes.ok) {
        const all = await ratRes.json();
        setRatings(all.filter((r: RatingRecord) => r.user_id === id));
      }
      if (warnRes.ok) {
        const all = await warnRes.json();
        setWarnings(all.filter((r: WarningRecord) => r.user_id === id));
      }
      if (logsRes.ok) {
        const all = await logsRes.json();
        setChangeLogs(all.filter((r: ChangeLog) => r.user_id === id));
      }

      if (isSuperAdmin) await fetchNotes();
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotes() {
    try {
      const res = await fetch(`/api/users/${id}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotes(await res.json());
    } catch {}
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/users/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newNote }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setNewNote('');
      fetchNotes();
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة الملاحظة بنجاح' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'حدث خطأ', variant: 'destructive' });
    } finally {
      setSubmittingNote(false);
    }
  }

  async function saveEditNote(noteId: string) {
    if (!editNoteContent.trim()) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editNoteContent }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setEditingNoteId(null);
      fetchNotes();
      toast({ title: 'تم التعديل' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'حدث خطأ', variant: 'destructive' });
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast({ title: 'تم الحذف' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر حذف الملاحظة', variant: 'destructive' });
    } finally {
      setDeletingNoteId(null);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="flex gap-6 mb-8">
          <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="page-wrapper text-center py-20">
        <p className="text-muted-foreground mb-4">لم يتم العثور على المشرف</p>
        <Button variant="outline" onClick={() => navigate('/admins')}>
          <ArrowRight className="h-4 w-4 ml-2" />
          رجوع
        </Button>
      </div>
    );
  }

  const isDismissed = admin.employment_status === 'dismissed';
  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1)
    : null;

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  return (
    <div className="page-wrapper max-w-4xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate('/admins')}>
        <ArrowRight className="h-4 w-4" />
        رجوع للمشرفين
      </Button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="relative flex-shrink-0">
              <Avatar className={`h-24 w-24 ${isDismissed ? 'grayscale' : ''}`}>
                {admin.externalImage && (
                  <AvatarImage src={admin.externalImage} alt={admin.full_name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                  {getInitials(admin.full_name)}
                </AvatarFallback>
              </Avatar>
              {isDismissed && (
                <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1">
                  <UserX className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-right">
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center mb-1">
                <h1 className="text-2xl font-bold">{admin.full_name}</h1>
                {admin.externalName && admin.externalName !== admin.full_name && (
                  <span className="text-base text-primary/70 platform-nick">({admin.externalName})</span>
                )}
              </div>
              <p className="text-muted-foreground mb-3">@{admin.username}</p>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                  {admin.role === 'super_admin'
                    ? <><Shield className="h-3 w-3 ml-1" />مدير رئيسي</>
                    : <><UserCog className="h-3 w-3 ml-1" />مشرف</>
                  }
                </Badge>
                {isDismissed ? (
                  <Badge variant="destructive"><UserX className="h-3 w-3 ml-1" />مفصول</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
                    <UserCheck className="h-3 w-3 ml-1" />فعّال
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-4 justify-center sm:justify-start text-sm text-muted-foreground">
                {admin.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{admin.phone}</span>
                  </span>
                )}
                {admin.platform_id && (
                  <span className="flex items-center gap-1.5">
                    <Link className="h-4 w-4" />
                    ID: {admin.platform_id}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  انضم {format(new Date(admin.created_at), 'd MMMM yyyy', { locale: ar })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
            <p className="text-xs text-muted-foreground mt-1">حضور</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{lateCount}</p>
            <p className="text-xs text-muted-foreground mt-1">تأخير</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-yellow-500">{avgRating ?? '—'}</p>
              {avgRating && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mb-0.5" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">متوسط التقييم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-destructive">{warnings.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إنذارات</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance" dir="rtl">
        <TabsList className={`w-full ${isSuperAdmin ? 'grid-cols-5' : 'grid-cols-4'} grid`}>
          <TabsTrigger value="attendance" className="flex items-center gap-1 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" />
            الحضور
          </TabsTrigger>
          <TabsTrigger value="ratings" className="flex items-center gap-1 text-xs sm:text-sm">
            <Star className="h-3.5 w-3.5" />
            التقييمات
          </TabsTrigger>
          <TabsTrigger value="warnings" className="flex items-center gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            الإنذارات
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5" />
            السجل
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="notes" className="flex items-center gap-1 text-xs sm:text-sm">
              <StickyNote className="h-3.5 w-3.5" />
              ملاحظات
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Attendance Tab ── */}
        <TabsContent value="attendance" className="mt-4">
          {attendance.length === 0 ? (
            <EmptyState icon={<Calendar className="h-10 w-10" />} label="لا توجد سجلات حضور" />
          ) : (
            <div className="space-y-2">
              {attendance.slice().reverse().map(rec => (
                <Card key={rec.id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {rec.status === 'present' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
                      {rec.status === 'late'    && <AlertCircle  className="h-5 w-5 text-orange-500 flex-shrink-0" />}
                      {rec.status === 'absent'  && <XCircle      className="h-5 w-5 text-destructive flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(rec.date), 'EEEE، d MMMM yyyy', { locale: ar })}
                        </p>
                        {rec.check_in && (
                          <p className="text-xs text-muted-foreground">
                            دخول: {format(new Date(rec.check_in), 'HH:mm')}
                            {rec.check_out && ` — خروج: ${format(new Date(rec.check_out), 'HH:mm')}`}
                          </p>
                        )}
                        {rec.notes && <p className="text-xs text-muted-foreground mt-0.5">{rec.notes}</p>}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        rec.status === 'present' ? 'text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30'
                        : rec.status === 'late'  ? 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30'
                        : 'text-destructive border-destructive/30 bg-destructive/5'
                      }
                    >
                      {rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : 'غائب'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Ratings Tab ── */}
        <TabsContent value="ratings" className="mt-4">
          {ratings.length === 0 ? (
            <EmptyState icon={<Star className="h-10 w-10" />} label="لا توجد تقييمات" />
          ) : (
            <div className="space-y-2">
              {ratings.slice().reverse().map(r => (
                <Card key={r.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <StarDisplay score={r.score} />
                        {r.comment && <p className="text-sm mt-2 text-muted-foreground">{r.comment}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(r.created_at), 'd MMM yyyy', { locale: ar })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Warnings Tab ── */}
        <TabsContent value="warnings" className="mt-4">
          {warnings.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-10 w-10" />} label="لا توجد إنذارات" />
          ) : (
            <div className="space-y-2">
              {warnings.slice().reverse().map(w => (
                <Card key={w.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5
                          ${w.severity === 'high' ? 'text-destructive' : w.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}`}
                        />
                        <div>
                          <Badge
                            variant="outline"
                            className={`mb-1 text-xs
                              ${w.severity === 'high'   ? 'text-destructive border-destructive/30 bg-destructive/5'
                              : w.severity === 'medium' ? 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30'
                              : 'text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30'}`}
                          >
                            {w.severity === 'high' ? 'شديد' : w.severity === 'medium' ? 'متوسط' : 'خفيف'}
                          </Badge>
                          <p className="text-sm">{w.reason}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(w.created_at), 'd MMM yyyy', { locale: ar })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Change Logs Tab ── */}
        <TabsContent value="logs" className="mt-4">
          {changeLogs.length === 0 ? (
            <EmptyState icon={<History className="h-10 w-10" />} label="لا توجد تغييرات مسجّلة" />
          ) : (
            <div className="space-y-2">
              {changeLogs.slice().reverse().map(log => {
                const meta = CHANGE_TYPE_LABELS[log.change_type] ?? { label: log.change_type, icon: <History className="h-3.5 w-3.5" />, color: 'bg-gray-100 text-gray-800' };
                return (
                  <Card key={log.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${meta.color}`}>
                          {meta.icon}{meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                            {log.change_type === 'avatar_change' ? (
                              <div className="flex gap-2 items-center">
                                {isImageUrl(log.old_value) && <img src={log.old_value!} className="h-7 w-7 rounded-full object-cover" alt="قديم" />}
                                <span>→</span>
                                {isImageUrl(log.new_value) && <img src={log.new_value!} className="h-7 w-7 rounded-full object-cover" alt="جديد" />}
                              </div>
                            ) : (
                              <>
                                {log.old_value && <span className="line-through opacity-60">{log.old_value}</span>}
                                {log.old_value && log.new_value && <span>←</span>}
                                {log.new_value && <span className="font-medium">{log.new_value}</span>}
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.detected_at), 'd MMM yyyy — HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Notes Tab (super admin only) ── */}
        {isSuperAdmin && (
          <TabsContent value="notes" className="mt-4">
            <div className="space-y-4">
              {/* Add note */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">ملاحظة جديدة (سرية)</p>
                  <Textarea
                    placeholder="اكتب ملاحظة خاصة هنا... (غير مرئية للمشرف)"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    className="resize-none min-h-[80px] text-sm"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Ctrl+Enter للحفظ السريع</p>
                    <Button size="sm" onClick={addNote} disabled={submittingNote || !newNote.trim()}>
                      {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span className="mr-1">إضافة</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Notes list */}
              {notes.length === 0 ? (
                <EmptyState icon={<StickyNote className="h-10 w-10" />} label="لا توجد ملاحظات بعد" />
              ) : (
                <div className="space-y-2">
                  <Badge variant="secondary">{notes.length} ملاحظة</Badge>
                  {notes.map(note => (
                    <Card key={note.id}>
                      <CardContent className="py-3 px-4 group">
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editNoteContent}
                              onChange={e => setEditNoteContent(e.target.value)}
                              className="resize-none min-h-[80px] text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>
                                <X className="h-3.5 w-3.5" />إلغاء
                              </Button>
                              <Button size="sm" onClick={() => saveEditNote(note.id)} disabled={!editNoteContent.trim()}>
                                <Check className="h-3.5 w-3.5" />حفظ
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteNote(note.id)} disabled={deletingNoteId === note.id}>
                                {deletingNoteId === note.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(note.created_at), 'd MMM yyyy — HH:mm', { locale: ar })}
                          {note.updated_at && note.updated_at !== note.created_at && <span className="mr-1 opacity-60">(معدّلة)</span>}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-center py-14 text-muted-foreground/50">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
