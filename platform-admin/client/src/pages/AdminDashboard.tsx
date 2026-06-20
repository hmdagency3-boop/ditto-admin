import { useState, useEffect } from 'react';
import { EventsBanner } from '@/components/EventsBanner';
import { 
  Clock, 
  LogIn, 
  LogOut,
  Calendar,
  Star,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Users2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';
import { format, differenceInMinutes, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

const SHIFT_SLOTS = [
  { number: 1,  label: "12:00 ص - 2:00 ص",  startHour: 0  },
  { number: 2,  label: "2:00 ص - 4:00 ص",   startHour: 2  },
  { number: 3,  label: "4:00 ص - 6:00 ص",   startHour: 4  },
  { number: 4,  label: "6:00 ص - 8:00 ص",   startHour: 6  },
  { number: 5,  label: "8:00 ص - 10:00 ص",  startHour: 8  },
  { number: 6,  label: "10:00 ص - 12:00 م", startHour: 10 },
  { number: 7,  label: "12:00 م - 2:00 م",  startHour: 12 },
  { number: 8,  label: "2:00 م - 4:00 م",   startHour: 14 },
  { number: 9,  label: "4:00 م - 6:00 م",   startHour: 16 },
  { number: 10, label: "6:00 م - 8:00 م",   startHour: 18 },
  { number: 11, label: "8:00 م - 10:00 م",  startHour: 20 },
  { number: 12, label: "10:00 م - 12:00 ص", startHour: 22 },
];

function getEgyptHour(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const egypt = new Date(utc + 3 * 3600000);
  return egypt.getHours();
}

function getCurrentShiftNumber(): number {
  return Math.floor(getEgyptHour() / 2) + 1;
}

function getNextShiftNumber(current: number): number {
  return (current % 12) + 1;
}

interface NextShiftUser {
  id: string;
  full_name: string;
  username: string;
  platform_id?: string;
  externalImage?: string;
  externalName?: string;
}

interface Attendance {
  id: string;
  user_id: string;
  check_in: string;
  check_out?: string;
  date: string;
  status: string;
  created_at?: string;
}

interface Shift {
  id: string;
  user_id: string;
  shift_number: number;
  created_by: string;
  created_at?: string;
}

interface Rating {
  id: string;
  user_id: string;
  score: number;
  comment?: string;
  rated_by: string;
  created_at: string;
}

interface Warning {
  id: string;
  user_id: string;
  severity: string;
  reason: string;
  issued_by: string;
  created_at?: string;
}

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string; image?: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [myRatings, setMyRatings] = useState<Rating[]>([]);
  const [myWarnings, setMyWarnings] = useState<Warning[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, absent: 0, total: 0 });
  const [nextShiftUsers, setNextShiftUsers] = useState<NextShiftUser[]>([]);
  const [nextShiftNumber, setNextShiftNumber] = useState<number>(1);
  const [currentShiftNumber, setCurrentShiftNumber] = useState<number>(1);

  useEffect(() => {
    if (user?.id) {
      // Fetch external profile data
      const fetchProfile = async () => {
        const profile = await fetchUserProfile(user.platform_id || user.username);
        setUserProfile(profile);
      };
      fetchProfile();
      fetchDashboardData();
    }
  }, [user?.id, token]);

  async function fetchDashboardData() {
    if (!user?.id || !token) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const attendanceRes = await fetch('/api/attendance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const allAttendance = await attendanceRes.json();
      
      const todayRecord = allAttendance.find((a: Attendance) => a.user_id === user.id && a.date === today);
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      const monthlyAttendance = allAttendance.filter((a: Attendance) => a.user_id === user.id && a.date >= monthStart && a.date <= monthEnd);

      const shiftsRes = await fetch('/api/shifts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const allShifts = await shiftsRes.json();
      const shifts = allShifts.filter((s: Shift) => s.user_id === user.id).slice(0, 5);

      // حساب الشيفت الحالي والقادم
      const currShift = getCurrentShiftNumber();
      const nextShift = getNextShiftNumber(currShift);
      setCurrentShiftNumber(currShift);
      setNextShiftNumber(nextShift);

      // جلب بيانات المستخدمين للشيفت القادم
      const usersRes = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const allUsers: NextShiftUser[] = await usersRes.json();
        const usersMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
        const nextShiftUserIds = (allShifts as Shift[])
          .filter(s => s.shift_number === nextShift && s.user_id !== user.id)
          .map(s => s.user_id);
        const uniqueIds = [...new Set(nextShiftUserIds)];
        const usersWithProfiles = await Promise.all(
          uniqueIds.map(async (uid) => {
            const u = usersMap[uid];
            if (!u) return null;
            try {
              const p = await fetchUserProfile((u as any).platform_id || u.username);
              return { ...u, externalImage: p?.image, externalName: p?.name };
            } catch {
              return u;
            }
          })
        );
        setNextShiftUsers(usersWithProfiles.filter(Boolean) as NextShiftUser[]);
      }

      const ratingsRes = await fetch('/api/ratings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const allRatings = await ratingsRes.json();
      const ratings = allRatings.filter((r: Rating) => r.user_id === user.id).slice(0, 3);

      const warningsRes = await fetch('/api/warnings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const allWarnings = await warningsRes.json();
      const warnings = allWarnings.filter((w: Warning) => w.user_id === user.id).slice(0, 3);

      setTodayAttendance(todayRecord || null);
      setUpcomingShifts(shifts);
      setMyRatings(ratings);
      setMyWarnings(warnings);

      if (monthlyAttendance) {
        const stats = {
          present: monthlyAttendance.filter((a: Attendance) => a.status === 'present').length,
          late: monthlyAttendance.filter((a: Attendance) => a.status === 'late').length,
          absent: monthlyAttendance.filter((a: Attendance) => a.status === 'absent').length,
          total: monthlyAttendance.length,
        };
        setAttendanceStats(stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn() {
    if (!user?.id || !token) return;
    
    setCheckingIn(true);
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      
      // Check if already checked in today
      const attendanceRes = await fetch('/api/attendance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const allAttendance = await attendanceRes.json();
      const existingRecord = allAttendance.find((a: Attendance) => a.user_id === user.id && a.date === today);
      
      if (existingRecord) {
        toast({
          title: 'تم التسجيل مسبقاً',
          description: 'لقد سجلت حضورك اليوم بالفعل',
          variant: 'destructive',
        });
        fetchDashboardData();
        return;
      }
      
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          check_in: now.toISOString(),
          date: today,
          status: 'present',
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setTodayAttendance(data.data);
      toast({
        title: 'تم تسجيل الحضور',
        description: `تم تسجيل حضورك في ${format(now, 'hh:mm a', { locale: ar })}`,
      });
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: 'خطأ في تسجيل الحضور',
        description: 'حدث خطأ أثناء تسجيل الحضور، يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    if (!user?.id || !todayAttendance?.id || !token) return;
    
    setCheckingIn(true);
    try {
      const now = new Date();
      
      const res = await fetch(`/api/attendance/${todayAttendance.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          check_out: now.toISOString(),
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setTodayAttendance(data.data);
      
      const hoursWorked = differenceInMinutes(now, new Date(todayAttendance.check_in)) / 60;
      toast({
        title: 'تم تسجيل الانصراف',
        description: `تم تسجيل انصرافك في ${format(now, 'hh:mm a', { locale: ar })} - عملت ${hoursWorked.toFixed(1)} ساعات`,
      });
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: 'خطأ في تسجيل الانصراف',
        description: 'حدث خطأ أثناء تسجيل الانصراف، يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setCheckingIn(false);
    }
  }

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100) 
    : 0;

  const avgRating = myRatings.length > 0 
    ? (myRatings.reduce((acc, r) => acc + r.score, 0) / myRatings.length).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="page-wrapper">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <EventsBanner />
      <div>
        <h1 className="page-title">مرحباً، {userProfile?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'مستخدم'}</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}
        </p>
      </div>

      <Card className="bg-gradient-to-l from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="h-5 w-5" />
            تسجيل الحضور
          </CardTitle>
          <CardDescription>
            {todayAttendance 
              ? `سجلت حضورك اليوم في ${format(new Date(todayAttendance.check_in), 'hh:mm a', { locale: ar })}`
              : 'لم تسجل حضورك اليوم بعد'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {!todayAttendance ? (
              <Button 
                size="lg" 
                onClick={handleCheckIn} 
                disabled={checkingIn}
                className="min-w-40"
                data-testid="button-check-in"
              >
                <LogIn className="h-5 w-5 ml-2" />
                {checkingIn ? 'جاري التسجيل...' : 'تسجيل الحضور'}
              </Button>
            ) : !todayAttendance.check_out ? (
              <Button 
                size="lg" 
                variant="secondary"
                onClick={handleCheckOut} 
                disabled={checkingIn}
                className="min-w-40"
                data-testid="button-check-out"
              >
                <LogOut className="h-5 w-5 ml-2" />
                {checkingIn ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">انتهت ورديتك اليوم</span>
                <span className="text-muted-foreground">
                  ({format(new Date(todayAttendance.check_in), 'hh:mm a', { locale: ar })} - {format(new Date(todayAttendance.check_out), 'hh:mm a', { locale: ar })})
                </span>
              </div>
            )}
            
            {todayAttendance && !todayAttendance.check_out && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">الوقت الحالي:</span>
                <Badge variant="outline" className="font-mono">
                  {format(new Date(), 'hh:mm a', { locale: ar })}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              نسبة الحضور هذا الشهر
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendancePercentage}%</div>
            <Progress value={attendancePercentage} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {attendanceStats.present} حضور من أصل {attendanceStats.total} يوم
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              متوسط التقييم
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRating}</div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`h-4 w-4 ${Number(avgRating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} 
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              من {myRatings.length} تقييمات
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              الإنذارات
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myWarnings.length}</div>
            {myWarnings.length > 0 ? (
              <div className="flex items-center gap-2 mt-2">
                {myWarnings.slice(0, 3).map((w) => (
                  <Badge 
                    key={w.id}
                    variant={w.severity === 'high' ? 'destructive' : w.severity === 'medium' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {w.severity === 'high' ? 'عالي' : w.severity === 'medium' ? 'متوسط' : 'منخفض'}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                لا توجد إنذارات
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* كارت الشيفت القادم */}
      <Card className="border-2 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" />
              الشيفت القادم — من سيكون معك؟
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                الحالي: شيفت #{currentShiftNumber} ({SHIFT_SLOTS.find(s => s.number === currentShiftNumber)?.label})
              </Badge>
              <Badge className="text-xs">
                القادم: شيفت #{nextShiftNumber}
              </Badge>
            </div>
          </div>
          <CardDescription>
            {SHIFT_SLOTS.find(s => s.number === nextShiftNumber)?.label} — المشرفون المعيّنون لهذا الشيفت
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nextShiftUsers.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-muted-foreground">
              <Users2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">لا يوجد مشرفون مُعيَّنون للشيفت القادم</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {nextShiftUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 bg-background rounded-xl border p-3 min-w-[160px]">
                  <Avatar className="h-10 w-10 shrink-0">
                    {u.externalImage && <AvatarImage src={u.externalImage} alt={u.full_name} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {u.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {u.externalName || u.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              الشيفتات القادمة
            </CardTitle>
            <CardDescription>جدول ورديات العمل القادمة</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لم يتم تعيين شيفت لك بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => {
                  const SLOT_LABELS: Record<number, string> = {
                    1: '12:00 ص - 2:00 ص', 2: '2:00 ص - 4:00 ص', 3: '4:00 ص - 6:00 ص',
                    4: '6:00 ص - 8:00 ص',  5: '8:00 ص - 10:00 ص', 6: '10:00 ص - 12:00 م',
                    7: '12:00 م - 2:00 م', 8: '2:00 م - 4:00 م',  9: '4:00 م - 6:00 م',
                    10: '6:00 م - 8:00 م', 11: '8:00 م - 10:00 م', 12: '10:00 م - 12:00 ص',
                  };
                  return (
                    <div
                      key={shift.id}
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                      data-testid={`shift-${shift.id}`}
                    >
                      <div className="p-2 rounded-md bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">يومياً — كل أيام الأسبوع</p>
                        <p className="text-xs text-muted-foreground">
                          {SLOT_LABELS[shift.shift_number] ?? `شيفت #${shift.shift_number}`}
                        </p>
                      </div>
                      <Badge variant="outline">شيفت #{shift.shift_number}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5" />
              آخر التقييمات
            </CardTitle>
            <CardDescription>تقييماتك الأخيرة من الإدارة</CardDescription>
          </CardHeader>
          <CardContent>
            {myRatings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد تقييمات حتى الآن</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRatings.map((rating) => (
                  <div 
                    key={rating.id} 
                    className="p-3 rounded-md bg-muted/50"
                    data-testid={`rating-${rating.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-4 w-4 ${rating.score >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(rating.created_at), 'd MMMM yyyy', { locale: ar })}
                      </span>
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-muted-foreground">{rating.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
