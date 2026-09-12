import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users, 
  Plus, 
  Search, 
  Phone,
  Shield,
  UserCog,
  MoreVertical,
  Trash2,
  Clock,
  Pencil,
  Link,
  UserX,
  UserCheck,
  StickyNote
} from 'lucide-react';
import { AdminNotesDialog } from '@/components/AdminNotesDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const addAdminSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  full_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().optional(),
  platform_id: z.string().optional(),
});

const editAdminSchema = z.object({
  full_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().optional(),
  platform_id: z.string().optional(),
  password: z.string().optional(),
});

type AddAdminFormData = z.infer<typeof addAdminSchema>;
type EditAdminFormData = z.infer<typeof editAdminSchema>;

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  status: string;
  phone?: string;
  avatar_url?: string;
  platform_id?: string;
  created_at: string;
  employment_status?: string;
  externalImage?: string;
  externalName?: string;
}

export default function Admins() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token, user: currentUser, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notesAdmin, setNotesAdmin] = useState<UserInfo | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  const form = useForm<AddAdminFormData>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: { username: '', password: '', full_name: '', phone: '', platform_id: '' },
  });

  const editForm = useForm<EditAdminFormData>({
    resolver: zodResolver(editAdminSchema),
    defaultValues: { full_name: '', phone: '', platform_id: '', password: '' },
  });

  useEffect(() => { fetchAdmins(); }, []);

  async function fetchAdmins() {
    try {
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      const approvedAdmins = data.filter((u: UserInfo) => u.status === 'approved');
      // Show admins immediately — no waiting for external profiles
      setAdmins(approvedAdmins);
      setLoading(false);
      // Load platform profiles in background, update each admin as it arrives
      approvedAdmins.forEach(async (admin: UserInfo) => {
        const externalData = await fetchUserProfile(admin.platform_id || admin.username);
        if (externalData) {
          setAdmins(prev => prev.map(a =>
            a.id === admin.id
              ? { ...a, externalName: externalData.name, externalImage: externalData.image }
              : a
          ));
        }
      });
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء جلب بيانات المشرفين', variant: 'destructive' });
      setLoading(false);
    }
  }

  async function onSubmit(data: AddAdminFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone || null,
          platform_id: data.platform_id || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast({ title: 'تم إضافة المشرف', description: 'تم إرسال طلب التسجيل. يمكنك الموافقة عليه من صفحة طلبات التسجيل.' });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'خطأ في إضافة المشرف', description: error.message || 'حدث خطأ أثناء إضافة المشرف', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(admin: UserInfo) {
    setEditingAdmin(admin);
    editForm.reset({
      full_name: admin.full_name,
      phone: admin.phone || '',
      platform_id: admin.platform_id || '',
      password: '',
    });
    setEditDialogOpen(true);
  }

  async function onEditSubmit(data: EditAdminFormData) {
    if (!editingAdmin) return;
    setIsSubmitting(true);
    try {
      const body: Record<string, any> = {
        full_name: data.full_name,
        phone: data.phone || null,
        platform_id: data.platform_id || null,
      };
      if (data.password && data.password.trim().length > 0) {
        body.password = data.password;
      }

      const response = await fetch(`/api/users/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast({ title: 'تم التحديث', description: 'تم تحديث بيانات المشرف بنجاح' });
      setEditDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ أثناء التحديث', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteUser(userId: string) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }
      toast({ title: 'تم الحذف', description: 'تم حذف المشرف بنجاح' });
      fetchAdmins();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ أثناء حذف المشرف', variant: 'destructive' });
    }
  }

  async function toggleEmploymentStatus(admin: UserInfo) {
    const newStatus = admin.employment_status === 'dismissed' ? 'active' : 'dismissed';
    setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, employment_status: newStatus } : a));
    try {
      const response = await fetch(`/api/users/${admin.id}/employment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ employment_status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, employment_status: admin.employment_status } : a));
        throw new Error(data.message);
      }
      toast({
        title: newStatus === 'dismissed' ? 'تم الفصل' : 'تم التفعيل',
        description: newStatus === 'dismissed'
          ? `تم تحديد ${admin.full_name} كمفصول`
          : `تم تفعيل ${admin.full_name} مجدداً`,
      });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ', variant: 'destructive' });
    }
  }

  const filteredAdmins = admins
    .filter(admin => 
      admin.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (admin.platform_id && admin.platform_id.includes(searchQuery))
    )
    .sort((a, b) => {
      const aD = a.employment_status === 'dismissed' ? 1 : 0;
      const bD = b.employment_status === 'dismissed' ? 1 : 0;
      return aD - bD;
    });

  const getInitials = (name: string) =>
    name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  const cellCls = 'border border-border px-3 py-2.5 text-sm';
  const headCls = 'border border-border px-3 py-2.5 text-sm font-semibold bg-muted text-right';

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="page-title-icon" />
            المشرفون
          </h1>
          <p className="text-muted-foreground mt-1">إدارة جميع المشرفين في النظام</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-admin">
              <Plus className="h-4 w-4 ml-2" />
              إضافة مشرف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مشرف جديد</DialogTitle>
              <DialogDescription>أدخل بيانات المشرف الجديد. سيتم إنشاء طلب تسجيل يمكنك الموافقة عليه.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل</FormLabel>
                    <FormControl><Input placeholder="أحمد محمد" data-testid="input-admin-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المستخدم</FormLabel>
                    <FormControl><Input placeholder="ahmed123" data-testid="input-admin-username" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الهاتف (اختياري)</FormLabel>
                    <FormControl><Input placeholder="+966 5xxxxxxxx" data-testid="input-admin-phone" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="platform_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Link className="h-3.5 w-3.5" />
                      ID المنصة (sayyouditto)
                    </FormLabel>
                    <FormControl><Input placeholder="مثال: 123456" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" data-testid="input-admin-password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1" data-testid="button-submit-admin">
                    {isSubmitting ? 'جاري الإضافة...' : 'إضافة المشرف'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Admin Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المشرف</DialogTitle>
            <DialogDescription>
              تعديل بيانات <span className="font-semibold">{editingAdmin?.full_name}</span>
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl><Input placeholder="أحمد محمد" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الهاتف (اختياري)</FormLabel>
                  <FormControl><Input placeholder="+966 5xxxxxxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="platform_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Link className="h-3.5 w-3.5" />
                    ID المنصة (sayyouditto)
                  </FormLabel>
                  <FormControl><Input placeholder="مثال: 123456" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>كلمة مرور جديدة (اتركها فارغة للإبقاء على القديمة)</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="البحث بالاسم أو ID المنصة..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search-admins"
          />
        </div>
        <Badge variant="secondary" className="text-sm">{filteredAdmins.length} مشرف</Badge>
        <Badge variant="outline" className="text-sm text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
          <UserCheck className="h-3.5 w-3.5 ml-1" />
          {filteredAdmins.filter(a => a.employment_status !== 'dismissed').length} فعّال
        </Badge>
      </div>

      {filteredAdmins.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">لا يوجد مشرفون</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'لم يتم العثور على نتائج للبحث' : 'ابدأ بإضافة مشرف جديد'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${headCls} w-12 text-center`}>#</th>
                    <th className={headCls}>المشرف</th>
                    <th className={headCls}>اسم المستخدم</th>
                    <th className={headCls}>ID المنصة</th>
                    <th className={headCls}>رقم الهاتف</th>
                    <th className={headCls}>الصلاحية</th>
                    <th className={headCls}>الحالة</th>
                    <th className={headCls}>تاريخ الانضمام</th>
                    <th className={`${headCls} w-16`}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin, index) => {
                    const isDismissed = admin.employment_status === 'dismissed';
                    return (
                      <tr
                        key={admin.id}
                        className={`transition-colors hover:bg-muted/40 ${isDismissed ? 'opacity-60' : ''}`}
                        data-testid={`row-admin-${admin.id}`}
                      >
                        <td className={`${cellCls} text-center text-muted-foreground`}>{index + 1}</td>
                        <td className={cellCls}>
                          <div className="flex min-w-[190px] items-center gap-2">
                            <Avatar className="h-9 w-9 shrink-0">
                              {admin.externalImage && <AvatarImage src={admin.externalImage} alt={admin.full_name} />}
                              <AvatarFallback className="bg-primary/10 font-bold text-primary">
                                {getInitials(admin.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p
                                className="cursor-pointer select-none truncate font-semibold"
                                title="اضغط مرتين لفتح الملف الشخصي"
                                onDoubleClick={() => navigate(`/admins/${admin.id}`)}
                              >
                                {admin.full_name}
                              </p>
                              {admin.externalName && admin.externalName !== admin.full_name && (
                                <p className="platform-nick truncate text-xs text-primary/70">{admin.externalName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`${cellCls} whitespace-nowrap font-mono text-xs`} dir="ltr">
                          @{admin.username}
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>
                          {admin.platform_id ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs">
                              <Link className="h-3.5 w-3.5 text-muted-foreground" />
                              {admin.platform_id}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`} dir="ltr">
                          {admin.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {admin.phone}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={cellCls}>
                          <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                            {admin.role === 'super_admin' ? (
                              <><Shield className="ml-1 h-3 w-3" />مدير رئيسي</>
                            ) : (
                              <><UserCog className="ml-1 h-3 w-3" />مشرف</>
                            )}
                          </Badge>
                        </td>
                        <td className={cellCls}>
                          {isDismissed ? (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="h-3 w-3" />
                              مفصول
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-600 dark:bg-green-950/30">
                              <UserCheck className="h-3 w-3" />
                              فعّال
                            </Badge>
                          )}
                        </td>
                        <td className={`${cellCls} whitespace-nowrap text-muted-foreground`}>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(admin.created_at), 'd MMM yyyy', { locale: ar })}
                          </span>
                        </td>
                        <td className={cellCls} onClick={event => event.stopPropagation()}>
                          {admin.id !== currentUser?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
                                <DropdownMenuItem onClick={() => openEditDialog(admin)}>
                                  <Pencil className="h-4 w-4 ml-2" />
                                  تعديل البيانات
                                </DropdownMenuItem>
                                {isSuperAdmin && (
                                  <>
                                    <DropdownMenuItem onClick={() => { setNotesAdmin(admin); setNotesDialogOpen(true); }}>
                                      <StickyNote className="h-4 w-4 ml-2" />
                                      الملاحظات السرية
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => toggleEmploymentStatus(admin)}
                                      className={isDismissed ? 'text-green-600' : 'text-orange-600'}
                                    >
                                      {isDismissed ? (
                                        <><UserCheck className="h-4 w-4 ml-2" />تفعيل المشرف</>
                                      ) : (
                                        <><UserX className="h-4 w-4 ml-2" />فصل المشرف</>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => deleteUser(admin.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 ml-2" />
                                  حذف المشرف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Dialog */}
      {notesAdmin && (
        <AdminNotesDialog
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          adminId={notesAdmin.id}
          adminName={notesAdmin.full_name}
        />
      )}
    </div>
  );
}
