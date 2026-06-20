import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ClipboardList, Plus, Trash2, Calendar, CheckCircle2,
  Clock, CircleDot, ChevronDown, Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to: string;
  assigned_by: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  assignee?: { id: string; username: string; full_name: string };
}

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  status: string;
  role: string;
}

const taskSchema = z.object({
  title: z.string().min(2, 'العنوان مطلوب'),
  description: z.string().optional(),
  assigned_to: z.string().min(1, 'يجب اختيار مشرف'),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional(),
});
type TaskFormData = z.infer<typeof taskSchema>;

const STATUS_CONFIG = {
  pending:     { label: 'معلقة',      icon: CircleDot,    class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  in_progress: { label: 'جارية',      icon: Clock,        class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed:   { label: 'مكتملة',     icon: CheckCircle2, class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

const PRIORITY_CONFIG = {
  low:    { label: 'منخفضة', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  medium: { label: 'متوسطة', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  high:   { label: 'عالية',  class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export default function Tasks() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' },
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const users: UserInfo[] = usersRes.ok ? await usersRes.json() : [];
      const usersMap: Record<string, UserInfo> = Object.fromEntries(users.map(u => [u.id, u]));
      setAdmins(users.filter(u => u.status === 'approved' && u.role !== 'super_admin'));

      if (tasksRes.ok) {
        const data: Task[] = await tasksRes.json();
        setTasks(data.map(t => ({ ...t, assignee: usersMap[t.assigned_to] })));
      }
    } catch { } finally { setLoading(false); }
  }

  function openCreate() {
    setEditingTask(null);
    form.reset({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    form.reset({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.slice(0, 16) : '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: TaskFormData) {
    setIsSubmitting(true);
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast({ title: editingTask ? 'تم تعديل المهمة' : 'تم إضافة المهمة' });
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  }

  async function updateStatus(id: string, status: Task['status']) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      toast({ title: 'تم تحديث الحالة' });
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' });
    }
  }

  async function deleteTask(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.filter(t => t.id !== id));
      toast({ title: 'تم حذف المهمة' });
    } catch {
      toast({ title: 'خطأ أثناء الحذف', variant: 'destructive' });
    }
  }

  const filtered = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  if (loading) return (
    <div className="page-wrapper">
      <Skeleton className="h-10 w-48" />
      <div className="stats-grid-4">{[1,2,3,4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList className="page-title-icon" />
            المهام
          </h1>
          <p className="text-muted-foreground mt-1">تكليف وإدارة مهام المشرفين</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          مهمة جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="stats-grid-4">
        {[
          { key: 'all',        label: 'الكل',     color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-900/30'      },
          { key: 'pending',    label: 'معلقة',    color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30'  },
          { key: 'in_progress',label: 'جارية',    color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30'      },
          { key: 'completed',  label: 'مكتملة',   color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30'    },
        ].map(({ key, label, color, bg }) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all ${statusFilter === key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(key as any)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-md ${bg}`}>
                <ClipboardList className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold">{counts[key as keyof typeof counts]}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'تعديل المهمة' : 'مهمة جديدة'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان المهمة</FormLabel>
                  <FormControl><Input placeholder="اكتب عنوان المهمة..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>التفاصيل (اختياري)</FormLabel>
                  <FormControl><Textarea placeholder="تفاصيل المهمة..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="assigned_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>تكليف إلى</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {admins.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.full_name} — @{a.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الأولوية</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">منخفضة</SelectItem>
                        <SelectItem value="medium">متوسطة</SelectItem>
                        <SelectItem value="high">عالية</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="due_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>موعد التسليم</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'جاري الحفظ...' : editingTask ? 'حفظ' : 'إضافة المهمة'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Tasks List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mb-1">لا توجد مهام</h3>
            <p className="text-muted-foreground text-sm">{statusFilter === 'all' ? 'ابدأ بإضافة مهمة جديدة' : `لا توجد مهام ${STATUS_CONFIG[statusFilter]?.label}`}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const sc = STATUS_CONFIG[task.status];
            const pc = PRIORITY_CONFIG[task.priority];
            const StatusIcon = sc.icon;
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            return (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{task.title}</h3>
                        <Badge className={`${sc.class} text-xs`}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {sc.label}
                        </Badge>
                        <Badge className={`${pc.class} text-xs`}>{pc.label}</Badge>
                        {isOverdue && <Badge variant="destructive" className="text-xs">متأخرة</Badge>}
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {task.assignee && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {task.assignee.full_name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{task.assignee.full_name}</span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(task.due_date), 'd MMM yyyy', { locale: ar })}</span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(task.created_at), 'd MMM yyyy', { locale: ar })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            الحالة
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(Object.keys(STATUS_CONFIG) as Task['status'][]).map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus(task.id, s)} className={task.status === s ? 'font-semibold' : ''}>
                              {STATUS_CONFIG[s].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(task)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف المهمة</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف هذه المهمة؟</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTask(task.id)}>حذف</AlertDialogAction>
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
