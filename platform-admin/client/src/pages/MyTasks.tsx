import { useState, useEffect } from 'react';
import { ClipboardList, Calendar, CheckCircle2, Clock, CircleDot, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

const STATUS_CONFIG = {
  pending:     { label: 'معلقة',   icon: CircleDot,    class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  in_progress: { label: 'جارية',   icon: Clock,        class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'         },
  completed:   { label: 'مكتملة',  icon: CheckCircle2, class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'       },
};

const PRIORITY_CONFIG = {
  low:    { label: 'منخفضة', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'             },
  medium: { label: 'متوسطة', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'  },
  high:   { label: 'عالية',  class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'              },
};

const NEXT_STATUS: Record<Task['status'], Task['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

export default function MyTasks() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    try {
      const res = await fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: Task[] = await res.json();
        setTasks(data.filter(t => t.assigned_to === user?.id));
      }
    } catch { } finally { setLoading(false); }
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
      toast({ title: status === 'completed' ? '✅ تم إنجاز المهمة!' : 'تم تحديث الحالة' });
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' });
    }
  }

  const filtered = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter);
  const counts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  if (loading) return (
    <div className="page-wrapper">
      <Skeleton className="h-10 w-48" />
      {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ClipboardList className="page-title-icon" />
          مهامي
        </h1>
        <p className="text-muted-foreground mt-1">المهام المكلّف بها — {tasks.length} مهمة إجمالاً</p>
      </div>

      {/* Quick status filter */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'الكل', tasks.length], ['pending', 'معلقة', counts.pending], ['in_progress', 'جارية', counts.in_progress], ['completed', 'مكتملة', counts.completed]] as const).map(([key, label, count]) => (
          <Button
            key={key}
            variant={statusFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(key)}
            className="gap-2"
          >
            {label}
            <Badge variant={statusFilter === key ? 'secondary' : 'outline'} className="text-xs h-5 min-w-5">
              {count}
            </Badge>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mb-1">
              {statusFilter === 'all' ? 'لا توجد مهام مكلّف بها' : `لا توجد مهام ${STATUS_CONFIG[statusFilter as Exclude<typeof statusFilter, 'all'>]?.label}`}
            </h3>
            <p className="text-muted-foreground text-sm">
              {statusFilter === 'all' ? 'ستظهر المهام المكلّف بها هنا' : 'جرّب تغيير الفلتر'}
            </p>
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
              <Card key={task.id} className={task.status === 'completed' ? 'opacity-70' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      className="mt-1 shrink-0 transition-transform hover:scale-110"
                      onClick={() => updateStatus(task.id, NEXT_STATUS[task.status])}
                      title="تغيير الحالة"
                    >
                      <StatusIcon className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-500' : task.status === 'in_progress' ? 'text-blue-500' : 'text-yellow-500'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h3>
                        <Badge className={`${pc.class} text-xs`}>{pc.label}</Badge>
                        {isOverdue && <Badge variant="destructive" className="text-xs">متأخرة</Badge>}
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <Badge className={`${sc.class} text-xs`}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {sc.label}
                        </Badge>
                        {task.due_date && (
                          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            <Calendar className="h-3 w-3" />
                            <span>التسليم: {format(new Date(task.due_date), 'd MMM yyyy', { locale: ar })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 shrink-0">
                          تحديث
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
