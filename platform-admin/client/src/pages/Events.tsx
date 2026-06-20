import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Plus, Trash2, Calendar, ToggleLeft, ToggleRight, Pencil, ImageIcon, Upload, X as XIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  description?: string;
  color: string;
  image_url?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

const eventSchema = z.object({
  title: z.string().min(2, 'العنوان مطلوب'),
  description: z.string().optional(),
  color: z.enum(['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink']),
  image_url: z.string().optional(),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date: z.string().min(1, 'تاريخ النهاية مطلوب'),
});
type EventFormData = z.infer<typeof eventSchema>;

const colorLabels: Record<string, { label: string; class: string }> = {
  blue:   { label: 'أزرق',   class: 'bg-blue-500'   },
  green:  { label: 'أخضر',   class: 'bg-green-500'  },
  purple: { label: 'بنفسجي', class: 'bg-purple-500' },
  orange: { label: 'برتقالي',class: 'bg-orange-500' },
  red:    { label: 'أحمر',   class: 'bg-red-500'    },
  yellow: { label: 'أصفر',   class: 'bg-yellow-500' },
  pink:   { label: 'وردي',   class: 'bg-pink-500'   },
};

export default function Events() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', description: '', color: 'blue', image_url: '', start_date: '', end_date: '' },
  });

  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    return () => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEvents(await res.json());
    } catch { } finally { setLoading(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    setSelectedFile(null);
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    form.setValue('image_url', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openCreate() {
    setEditingEvent(null);
    setSelectedFile(null);
    setPreviewUrl('');
    form.reset({ title: '', description: '', color: 'blue', image_url: '', start_date: '', end_date: '' });
    setDialogOpen(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setSelectedFile(null);
    setPreviewUrl(event.image_url || '');
    form.reset({
      title: event.title,
      description: event.description || '',
      color: event.color as any,
      image_url: event.image_url || '',
      start_date: event.start_date.slice(0, 16),
      end_date: event.end_date.slice(0, 16),
    });
    setDialogOpen(true);
  }

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/upload/event-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'فشل رفع الصورة'); }
    const { url } = await res.json();
    return url;
  }

  async function onSubmit(data: EventFormData) {
    setIsSubmitting(true);
    try {
      let imageUrl = data.image_url || '';
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const method = editingEvent ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, image_url: imageUrl }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast({ title: editingEvent ? 'تم تعديل الإيفنت' : 'تم إنشاء الإيفنت' });
      setDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl('');
      fetchEvents();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  }

  async function toggleActive(event: Event) {
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !event.is_active }),
      });
      if (!res.ok) throw new Error();
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_active: !e.is_active } : e));
      toast({ title: event.is_active ? 'تم إيقاف الإيفنت' : 'تم تفعيل الإيفنت' });
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' });
    }
  }

  async function deleteEvent(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setEvents(prev => prev.filter(e => e.id !== id));
      toast({ title: 'تم حذف الإيفنت' });
    } catch {
      toast({ title: 'خطأ أثناء الحذف', variant: 'destructive' });
    }
  }

  function isCurrentlyActive(event: Event) {
    if (!event.is_active) return false;
    const now = new Date();
    return new Date(event.start_date) <= now && new Date(event.end_date) >= now;
  }

  if (loading) return (
    <div className="page-wrapper">
      <Skeleton className="h-10 w-48" />
      {[1, 2].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Megaphone className="page-title-icon" />
            الإيفنتات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة البنرات والإعلانات التي تظهر في الصفحة الرئيسية</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          إيفنت جديد
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'تعديل الإيفنت' : 'إيفنت جديد'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>العنوان</FormLabel>
                  <FormControl><Input placeholder="عنوان الإيفنت..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl><Textarea placeholder="تفاصيل الإيفنت..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">صورة البنر (اختياري)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {previewUrl ? (
                  <div className="relative rounded-md overflow-hidden border h-28">
                    <img src={previewUrl} alt="معاينة" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-1 left-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80 transition-colors flex items-center gap-1"
                    >
                      <Upload className="h-3 w-3" />
                      تغيير
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 py-6 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">اضغط لرفع صورة</span>
                    <span className="text-xs opacity-60">PNG، JPG — حجم أقصى 5 MB</span>
                  </button>
                )}
              </div>
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>لون البنر</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${colorLabels[field.value]?.class}`} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(colorLabels).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${val.class}`} />
                            {val.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="start_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ البداية</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ النهاية</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'جاري الحفظ...' : editingEvent ? 'حفظ التعديلات' : 'إنشاء الإيفنت'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mb-1">لا توجد إيفنتات</h3>
            <p className="text-muted-foreground text-sm">أنشئ إيفنتاً ليظهر كبنر في الصفحة الرئيسية</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const c = colorLabels[event.color] || colorLabels.blue;
            const active = isCurrentlyActive(event);
            return (
              <Card key={event.id} className={`border-r-4 ${active ? `border-r-${event.color}-500` : 'border-r-muted'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${c.class} bg-opacity-15`}>
                      <Megaphone className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{event.title}</h3>
                        {active ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">نشط الآن</Badge>
                        ) : event.is_active ? (
                          <Badge variant="outline" className="text-xs">مجدول</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">موقوف</Badge>
                        )}
                        <div className={`h-3 w-3 rounded-full ${c.class}`} />
                      </div>
                      {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(event.start_date), 'd MMM yyyy - hh:mm a', { locale: ar })}
                          {' — '}
                          {format(new Date(event.end_date), 'd MMM yyyy - hh:mm a', { locale: ar })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(event)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(event)}>
                        {event.is_active
                          ? <ToggleRight className="h-5 w-5 text-green-500" />
                          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف الإيفنت</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف هذا الإيفنت؟</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteEvent(event.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
