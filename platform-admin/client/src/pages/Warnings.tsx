import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  AlertTriangle, 
  Plus, 
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type Warning } from '@/lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  externalImage?: string;
  externalName?: string;
}

const addWarningSchema = z.object({
  userId: z.string().min(1, 'يجب اختيار المشرف'),
  severity: z.enum(['low', 'medium', 'high']),
  reason: z.string().min(5, 'يجب كتابة سبب الإنذار (5 أحرف على الأقل)'),
});

type AddWarningFormData = z.infer<typeof addWarningSchema>;
type WarningWithUser = Warning & { user?: UserInfo };

export default function Warnings() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<WarningWithUser[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddWarningFormData>({
    resolver: zodResolver(addWarningSchema),
    defaultValues: {
      userId: '',
      severity: 'low',
      reason: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [warningsRes, adminsRes] = await Promise.all([
        supabase?.from('warnings').select('*, user:users(*)').order('created_at', { ascending: false }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (warningsRes?.data) {
        // Fetch external images for users
        const warningsWithImages = await Promise.all(
          warningsRes.data.map(async (warning) => ({
            ...warning,
            user: warning.user ? {
              ...warning.user,
              ...await (async () => { const p = await fetchUserProfile(warning.user.platform_id || warning.user.username); return { externalImage: p?.image, externalName: p?.name }; })()
            } : undefined
          }))
        );
        setWarnings(warningsWithImages);
      }

      if (adminsRes?.ok) {
        const adminsData = await adminsRes.json();
        setAdmins(adminsData.filter((u: UserInfo) => u.role !== 'super_admin'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: AddWarningFormData) {
    if (!user?.id || !supabase) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('warnings').insert({
        user_id: data.userId,
        severity: data.severity,
        reason: data.reason,
        issued_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'تم إضافة الإنذار',
        description: 'تم إصدار الإنذار بنجاح',
      });

      form.reset();
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding warning:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إضافة الإنذار',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredWarnings = warnings.filter(warning => {
    const matchesSearch = warning.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         warning.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || warning.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">عالي</Badge>;
      case 'medium':
        return <Badge variant="secondary">متوسط</Badge>;
      default:
        return <Badge variant="outline">منخفض</Badge>;
    }
  };

  const stats = {
    total: warnings.length,
    high: warnings.filter(w => w.severity === 'high').length,
    medium: warnings.filter(w => w.severity === 'medium').length,
    low: warnings.filter(w => w.severity === 'low').length,
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            الإنذارات
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة إنذارات المشرفين
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-warning">
              <Plus className="h-4 w-4 ml-2" />
              إضافة إنذار
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إصدار إنذار جديد</DialogTitle>
              <DialogDescription>
                قم بإصدار إنذار لأحد المشرفين
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المشرف</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="اختر المشرف" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {admins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>درجة الخطورة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-severity">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">عالي</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>سبب الإنذار</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="اكتب سبب إصدار الإنذار..." 
                          data-testid="textarea-reason"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1" data-testid="button-submit-warning">
                    {isSubmitting ? 'جاري الإضافة...' : 'إصدار الإنذار'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-gray-100 dark:bg-gray-900/30">
              <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">إجمالي</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.high}</div>
              <div className="text-sm text-muted-foreground">عالي</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.medium}</div>
              <div className="text-sm text-muted-foreground">متوسط</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.low}</div>
              <div className="text-sm text-muted-foreground">منخفض</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="البحث عن مشرف..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search-warnings"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
          <SelectTrigger className="w-32" data-testid="select-severity-filter">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="high">عالي</SelectItem>
            <SelectItem value="medium">متوسط</SelectItem>
            <SelectItem value="low">منخفض</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm">
          {filteredWarnings.length} إنذار
        </Badge>
      </div>

      {filteredWarnings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">لا توجد إنذارات</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'لم يتم العثور على نتائج للبحث' : 'لم يتم إصدار أي إنذارات بعد'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredWarnings.map((warning) => (
            <Card key={warning.id} data-testid={`card-warning-${warning.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    {warning.user?.externalImage && (
                      <AvatarImage src={warning.user.externalImage} alt={warning.user.full_name} />
                    )}
                    <AvatarFallback className={`${
                      warning.severity === 'high' ? 'bg-red-100 text-red-600' :
                      warning.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {warning.user?.full_name ? getInitials(warning.user.full_name) : 'م'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {warning.user?.full_name || 'غير معروف'}
                        {warning.user?.externalName && warning.user.externalName !== warning.user.full_name && (
                          <span className="font-normal text-sm text-primary/70 mr-1">({warning.user.externalName})</span>
                        )}
                      </h3>
                      {getSeverityBadge(warning.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">@{warning.user?.username}</p>
                    <p className="mt-2">{warning.reason}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(warning.created_at), 'd MMM yyyy - hh:mm a', { locale: ar })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
