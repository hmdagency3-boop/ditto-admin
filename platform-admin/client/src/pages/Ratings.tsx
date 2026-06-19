import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Star, 
  Plus, 
  Search,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { type Rating } from '@/lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  platform_id?: string;
  externalImage?: string;
  externalName?: string;
}

const addRatingSchema = z.object({
  userId: z.string().min(1, 'يجب اختيار المشرف'),
  score: z.number().min(1).max(5),
  comment: z.string().optional(),
});

type AddRatingFormData = z.infer<typeof addRatingSchema>;
type RatingWithUser = Rating & { user?: UserInfo };

export default function Ratings() {
  const { user, token, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingWithUser[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedScore, setSelectedScore] = useState(5);

  const form = useForm<AddRatingFormData>({
    resolver: zodResolver(addRatingSchema),
    defaultValues: {
      userId: '',
      score: 5,
      comment: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [ratingsRes, adminsRes] = await Promise.all([
        fetch('/api/ratings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (ratingsRes.ok) {
        const ratingsData: Rating[] = await ratingsRes.json();
        const adminsData: UserInfo[] = adminsRes.ok ? await adminsRes.json() : [];

        const usersMap: Record<string, UserInfo> = {};
        for (const u of adminsData) usersMap[u.id] = u;

        const ratingsWithUsers = await Promise.all(
          ratingsData.map(async (rating) => {
            const u = usersMap[rating.user_id];
            if (!u) return { ...rating, user: undefined };
            try {
              const p = await fetchUserProfile((u as any).platform_id || u.username);
              return { ...rating, user: { ...u, externalImage: p?.image, externalName: p?.name } };
            } catch {
              return { ...rating, user: u };
            }
          })
        );
        setRatings(ratingsWithUsers);

        if (adminsRes.ok) {
          setAdmins(adminsData.filter((u) => u.role !== 'super_admin'));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: AddRatingFormData) {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: data.userId, score: selectedScore, comment: data.comment || null }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'حدث خطأ'); }
      toast({ title: 'تم إضافة التقييم', description: 'تم إضافة التقييم بنجاح' });
      form.reset();
      setSelectedScore(5);
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteRating(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ratings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'حدث خطأ'); }
      toast({ title: 'تم الحذف', description: 'تم حذف التقييم بنجاح' });
      setRatings(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  const filteredRatings = ratings.filter(rating => 
    rating.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rating.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const renderStars = (score: number, interactive = false, size = 'w-4 h-4') => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`${size} ${i < score ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
        onClick={interactive ? () => setSelectedScore(i + 1) : undefined}
      />
    ));
  };

  const stats = {
    total: ratings.length,
    average: ratings.length > 0
      ? (ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length).toFixed(1)
      : '0',
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Skeleton className="h-10 w-48" />
        <div className="stats-grid-2">
          {[1, 2].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-12 rounded-full mb-4" /><Skeleton className="h-5 w-32 mb-2" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Star className="page-title-icon" />
            التقييمات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة تقييمات المشرفين</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-rating">
              <Plus className="h-4 w-4 ml-2" />
              إضافة تقييم
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة تقييم جديد</DialogTitle>
              <DialogDescription>قم بتقييم أداء أحد المشرفين</DialogDescription>
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
                            <SelectItem key={admin.id} value={admin.id}>{admin.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">التقييم</label>
                  <div className="flex items-center gap-2">
                    {renderStars(selectedScore, true, 'w-8 h-8')}
                    <span className="text-lg font-bold mr-2">{selectedScore}/5</span>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="أضف ملاحظات حول الأداء..." data-testid="textarea-comment" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1" data-testid="button-submit-rating">
                    {isSubmitting ? 'جاري الإضافة...' : 'إضافة التقييم'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stats-grid-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
              <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.average}</div>
              <div className="text-sm text-muted-foreground">متوسط التقييم</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">إجمالي التقييمات</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث عن مشرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search-ratings"
          />
        </div>
        <Badge variant="secondary" className="text-sm">{filteredRatings.length} تقييم</Badge>
      </div>

      {filteredRatings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">لا توجد تقييمات</h3>
            <p className="text-muted-foreground">{searchQuery ? 'لم يتم العثور على نتائج للبحث' : 'ابدأ بإضافة تقييم جديد'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRatings.map((rating) => (
            <Card key={rating.id} data-testid={`card-rating-${rating.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    {rating.user?.externalImage && <AvatarImage src={rating.user.externalImage} alt={rating.user.full_name} />}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {rating.user?.full_name ? getInitials(rating.user.full_name) : 'م'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">
                      {rating.user?.full_name || 'غير معروف'}
                      {rating.user?.externalName && rating.user.externalName !== rating.user.full_name && (
                        <span className="font-normal text-sm text-primary/70 mr-1 platform-nick">({rating.user.externalName})</span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">@{rating.user?.username}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {renderStars(rating.score)}
                      <span className="text-sm font-medium mr-2">{rating.score}/5</span>
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{rating.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(rating.created_at), 'd MMM yyyy', { locale: ar })}
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          disabled={deletingId === rating.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف التقييم</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteRating(rating.id)}
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
