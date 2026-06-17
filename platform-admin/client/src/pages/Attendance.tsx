import { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar,
  Search,
  Filter,
  Download,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase, type Attendance } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  externalImage?: string;
}

type AttendanceWithUser = Attendance & { user: UserInfo };

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter]);

  async function fetchAttendance() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('*, user:users!attendance_user_id_fkey(*)')
        .order('created_at', { ascending: false });

      const today = new Date();
      
      if (dateFilter === 'today') {
        query = query.eq('date', format(today, 'yyyy-MM-dd'));
      } else if (dateFilter === 'week') {
        const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        query = query.gte('date', weekStart).lte('date', weekEnd);
      } else if (dateFilter === 'month') {
        const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
        query = query.gte('date', monthStart).lte('date', monthEnd);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch external images for users
      const attendanceWithImages = await Promise.all(
        (data || []).map(async (record) => ({
          ...record,
          user: record.user ? {
            ...record.user,
            externalImage: (await fetchUserProfile(record.user.platform_id || record.user.username))?.image
          } : undefined
        }))
      );
      
      setAttendance(attendanceWithImages);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAttendance = attendance.filter(record => {
    const matchesSearch = record.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    late: attendance.filter(a => a.status === 'late').length,
    absent: attendance.filter(a => a.status === 'absent').length,
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const calculateHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return '-';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
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
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-8 w-8" />
            سجل الحضور
          </h1>
          <p className="text-muted-foreground mt-1">
            متابعة حضور وانصراف جميع المشرفين
          </p>
        </div>
        <Button variant="outline" data-testid="button-export-attendance">
          <Download className="h-4 w-4 ml-2" />
          تصدير
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">إجمالي السجلات</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.present}</div>
              <div className="text-sm text-muted-foreground">حاضرون</div>
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
              <div className="text-sm text-muted-foreground">متأخرون</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30">
              <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.absent}</div>
              <div className="text-sm text-muted-foreground">غائبون</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>سجلات الحضور</CardTitle>
              <CardDescription>
                {dateFilter === 'today' ? 'اليوم' : 
                 dateFilter === 'week' ? 'هذا الأسبوع' : 
                 dateFilter === 'month' ? 'هذا الشهر' : 'جميع السجلات'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="البحث..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 w-48"
                  data-testid="input-search-attendance"
                />
              </div>
              <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                <SelectTrigger className="w-36" data-testid="select-date-filter">
                  <Calendar className="h-4 w-4 ml-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="all">الكل</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAttendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">لا توجد سجلات</h3>
              <p>لم يتم العثور على سجلات حضور للفترة المحددة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المشرف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحضور</TableHead>
                    <TableHead className="text-right">الانصراف</TableHead>
                    <TableHead className="text-right">ساعات العمل</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((record) => (
                    <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {record.user?.externalImage && (
                              <AvatarImage src={record.user.externalImage} alt={record.user.full_name} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {record.user?.full_name ? getInitials(record.user.full_name) : 'م'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{record.user?.full_name || 'غير معروف'}</div>
                            <div className="text-xs text-muted-foreground">@{record.user?.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(record.date), 'EEEE', { locale: ar })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(record.date), 'd MMM yyyy', { locale: ar })}
                        </div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
