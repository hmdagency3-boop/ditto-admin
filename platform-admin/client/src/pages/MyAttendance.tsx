import { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Attendance {
  id: string;
  user_id: string;
  check_in: string;
  check_out?: string;
  date: string;
  status: string;
  created_at?: string;
}

export default function MyAttendance() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    if (user?.id && token) {
      fetchAttendance();
    }
  }, [user?.id, token, dateFilter]);

  async function fetchAttendance() {
    if (!user?.id || !token) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch attendance');
      
      let allAttendance = await res.json();
      const today = new Date();
      
      if (dateFilter === 'week') {
        const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        allAttendance = allAttendance.filter((a: Attendance) => a.date >= weekStart && a.date <= weekEnd);
      } else if (dateFilter === 'month') {
        const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
        allAttendance = allAttendance.filter((a: Attendance) => a.date >= monthStart && a.date <= monthEnd);
      }

      allAttendance = allAttendance.filter((a: Attendance) => a.user_id === user.id).sort((a: Attendance, b: Attendance) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendance(allAttendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    late: attendance.filter(a => a.status === 'late').length,
    absent: attendance.filter(a => a.status === 'absent').length,
  };

  const attendancePercentage = stats.total > 0 
    ? Math.round((stats.present / stats.total) * 100) 
    : 0;

  const calculateHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return '-';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const totalHoursWorked = attendance.reduce((acc, record) => {
    if (record.check_out) {
      const diff = new Date(record.check_out).getTime() - new Date(record.check_in).getTime();
      return acc + diff / (1000 * 60 * 60);
    }
    return acc;
  }, 0);

  if (loading) {
    return (
      <div className="page-wrapper">
        <Skeleton className="h-10 w-48" />
        <div className="stats-grid-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Clock className="page-title-icon" />
            سجل حضوري
          </h1>
          <p className="text-muted-foreground mt-1">
            متابعة سجل الحضور والانصراف الخاص بك
          </p>
        </div>
        <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
          <SelectTrigger className="w-36" data-testid="select-date-filter">
            <Calendar className="h-4 w-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">هذا الأسبوع</SelectItem>
            <SelectItem value="month">هذا الشهر</SelectItem>
            <SelectItem value="all">الكل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="stats-grid-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">نسبة الحضور</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mb-2">{attendancePercentage}%</div>
            <Progress value={attendancePercentage} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.present}</div>
              <div className="text-sm text-muted-foreground">أيام حضور</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.late}</div>
              <div className="text-sm text-muted-foreground">أيام تأخير</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalHoursWorked.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">ساعات العمل</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الحضور التفصيلي</CardTitle>
          <CardDescription>
            {dateFilter === 'week' ? 'هذا الأسبوع' : 
             dateFilter === 'month' ? 'هذا الشهر' : 'جميع السجلات'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">لا توجد سجلات</h3>
              <p>لم يتم العثور على سجلات حضور للفترة المحددة</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">اليوم</TableHead>
                      <TableHead className="text-right">الحضور</TableHead>
                      <TableHead className="text-right">الانصراف</TableHead>
                      <TableHead className="text-right">ساعات العمل</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                        <TableCell className="font-medium">
                          {format(new Date(record.date), 'd MMM yyyy', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.date), 'EEEE', { locale: ar })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.check_in), 'hh:mm a', { locale: ar })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.check_out 
                            ? format(new Date(record.check_out), 'hh:mm a', { locale: ar })
                            : <Badge variant="outline">لم ينصرف</Badge>
                          }
                        </TableCell>
                        <TableCell className="font-mono">
                          {calculateHours(record.check_in, record.check_out)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              record.status === 'present' ? 'default' : 
                              record.status === 'late' ? 'secondary' : 'destructive'
                            }
                          >
                            {record.status === 'present' ? 'حاضر' : 
                             record.status === 'late' ? 'متأخر' : 'غائب'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {attendance.map((record) => (
                  <div key={record.id} className="border rounded-lg p-3 space-y-2" data-testid={`row-attendance-${record.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{format(new Date(record.date), 'EEEE', { locale: ar })}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(record.date), 'd MMM yyyy', { locale: ar })}</div>
                      </div>
                      <Badge 
                        variant={
                          record.status === 'present' ? 'default' : 
                          record.status === 'late' ? 'secondary' : 'destructive'
                        }
                      >
                        {record.status === 'present' ? 'حاضر' : record.status === 'late' ? 'متأخر' : 'غائب'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">الحضور</div>
                        <div className="font-mono font-medium">{format(new Date(record.check_in), 'hh:mm a', { locale: ar })}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">الانصراف</div>
                        <div className="font-mono font-medium">{record.check_out ? format(new Date(record.check_out), 'hh:mm a', { locale: ar }) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">الساعات</div>
                        <div className="font-mono font-medium">{calculateHours(record.check_in, record.check_out)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
