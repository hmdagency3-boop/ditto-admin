import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { 
  Users, 
  Clock, 
  Star, 
  AlertTriangle, 
  UserCheck,
  Calendar,
  ArrowLeft,
  UserPlus,
  Users2,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
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

function getEgyptNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 2 * 3600000); // Egypt = UTC+2
}

function getEgyptHour(): number {
  return getEgyptNow().getHours();
}

function getCurrentShiftNumber(): number {
  return Math.floor(getEgyptHour() / 2) + 1;
}

function getNextShiftNumber(current: number): number {
  return (current % 12) + 1;
}

function getShiftEndEgypt(shiftNum: number): { h: number; m: number } {
  const endHour = (shiftNum * 2) % 24;
  return { h: endHour, m: 0 };
}

function calcTimeLeft(shiftNum: number): string {
  const egypt = getEgyptNow();
  const endH = (shiftNum * 2) % 24;
  const endMs = endH * 3600000;
  const nowMs = egypt.getHours() * 3600000 + egypt.getMinutes() * 60000 + egypt.getSeconds() * 1000;
  let diffMs = endMs - nowMs;
  if (diffMs <= 0) diffMs += 24 * 3600000; // wrap midnight
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface DashboardStats {
  totalAdmins: number;
  pendingRequests: number;
  avgRating: number;
  activeWarnings: number;
}

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  status: string;
  platform_id?: string;
  created_at: string;
  externalName?: string;
  externalImage?: string;
}

interface ShiftUser {
  id: string;
  username: string;
  full_name: string;
  platform_id?: string;
  externalName?: string;
  externalImage?: string;
}

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAdmins: 0,
    pendingRequests: 0,
    avgRating: 0,
    activeWarnings: 0,
  });
  const [recentUsers, setRecentUsers] = useState<UserInfo[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentShiftNum, setCurrentShiftNum] = useState(1);
  const [nextShiftNum, setNextShiftNum] = useState(2);
  const [currentShiftUsers, setCurrentShiftUsers] = useState<ShiftUser[]>([]);
  const [nextShiftUsers, setNextShiftUsers] = useState<ShiftUser[]>([]);
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(getCurrentShiftNumber()));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // عداد تنازلي يتحدث كل ثانية
  useEffect(() => {
    const tick = () => {
      const curr = getCurrentShiftNumber();
      setCurrentShiftNum(curr);
      setNextShiftNum(getNextShiftNumber(curr));
      setTimeLeft(calcTimeLeft(curr));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function fetchDashboardData() {
    try {
      const currShift = getCurrentShiftNumber();
      const nextShift = getNextShiftNumber(currShift);
      setCurrentShiftNum(currShift);
      setNextShiftNum(nextShift);

      const [usersRes, pendingRes, ratingsRes, warningsRes, shiftsRes] = await Promise.all([
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users/pending', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/ratings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/warnings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/shifts', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      // Users & shift members
      if (usersRes.ok) {
        const users: UserInfo[] = await usersRes.json();
        const approvedUsers = users.filter(u => u.status === 'approved');
        const usersMap = Object.fromEntries(approvedUsers.map(u => [u.id, u]));

        const usersWithImages = await Promise.all(
          approvedUsers.map(async (u) => {
            try {
              const profile = await fetchUserProfile(u.platform_id || u.username);
              return { ...u, externalName: profile?.name, externalImage: profile?.image };
            } catch {
              return u;
            }
          })
        );
        setRecentUsers(usersWithImages.slice(0, 5));
        setStats(prev => ({ ...prev, totalAdmins: approvedUsers.length }));

        // Shift members
        if (shiftsRes.ok) {
          const allShifts: { user_id: string; shift_number: number }[] = await shiftsRes.json();

          const getShiftUsers = async (shiftNum: number): Promise<ShiftUser[]> => {
            const ids = [...new Set(allShifts.filter(s => s.shift_number === shiftNum).map(s => s.user_id))];
            return Promise.all(
              ids.map(async (uid) => {
                const u = usersMap[uid];
                if (!u) return null;
                try {
                  const p = await fetchUserProfile((u as any).platform_id || u.username);
                  return { ...u, externalImage: p?.image, externalName: p?.name };
                } catch {
                  return u as ShiftUser;
                }
              })
            ).then(list => list.filter(Boolean) as ShiftUser[]);
          };

          const [currUsers, nxtUsers] = await Promise.all([
            getShiftUsers(currShift),
            getShiftUsers(nextShift),
          ]);
          setCurrentShiftUsers(currUsers);
          setNextShiftUsers(nxtUsers);
        }
      }

      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        const pendingWithImages = await Promise.all(
          pending.map(async (u: UserInfo) => {
            try {
              const profile = await fetchUserProfile(u.platform_id || u.username);
              return { ...u, externalName: profile?.name, externalImage: profile?.image };
            } catch {
              return u;
            }
          })
        );
        setPendingUsers(pendingWithImages.slice(0, 5));
        setStats(prev => ({ ...prev, pendingRequests: pending.length }));
      }

      if (ratingsRes.ok) {
        const ratings = await ratingsRes.json();
        const avg = ratings.length > 0
          ? Math.round((ratings.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / ratings.length) * 10) / 10
          : 0;
        setStats(prev => ({ ...prev, avgRating: avg }));
      }

      if (warningsRes.ok) {
        const warnings = await warningsRes.json();
        setStats(prev => ({ ...prev, activeWarnings: warnings.length }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const statCards = [
    { title: 'إجمالي المشرفين', value: stats.totalAdmins, icon: Users, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'طلبات معلقة', value: stats.pendingRequests, icon: UserPlus, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { title: 'متوسط التقييم', value: stats.avgRating, icon: Star, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    { title: 'الإنذارات النشطة', value: stats.activeWarnings, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  ];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="stats-grid-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const ShiftMembersList = ({ users, emptyText }: { users: ShiftUser[]; emptyText: string }) => (
    users.length === 0 ? (
      <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
        <Users2 className="h-5 w-5 opacity-40" />
        <span>{emptyText}</span>
      </div>
    ) : (
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border">
            <Avatar className="h-9 w-9 shrink-0">
              {u.externalImage && <AvatarImage src={u.externalImage} alt={u.full_name} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(u.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {u.externalName || u.full_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild data-testid="button-pending-requests">
            <Link href="/pending-requests">
              <UserPlus className="h-4 w-4 ml-2" />
              طلبات التسجيل
              {stats.pendingRequests > 0 && (
                <Badge variant="destructive" className="mr-2">{stats.pendingRequests}</Badge>
              )}
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-view-admins">
            <Link href="/admins">
              <Users className="h-4 w-4 ml-2" />
              المشرفون
            </Link>
          </Button>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="stats-grid-4">
        {statCards.map((stat, index) => (
          <Card key={index} data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* الشيفت الحالي والقادم */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* الشيفت الحالي */}
        <Card className="border-2 border-green-500/30 bg-green-50/50 dark:bg-green-900/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="relative">
                  <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                الشيفت الحالي
              </CardTitle>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-300 text-xs">
                شيفت #{currentShiftNum} · {SHIFT_SLOTS.find(s => s.number === currentShiftNum)?.label}
              </Badge>
            </div>
            <CardDescription>
              {currentShiftUsers.length > 0
                ? `${currentShiftUsers.length} مشرف على رأس العمل الآن`
                : 'لا يوجد مشرفون مُعيَّنون لهذا الشيفت'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* عداد تنازلي */}
            <div className="flex items-center justify-between rounded-xl bg-green-100/80 dark:bg-green-900/30 px-4 py-3 border border-green-200 dark:border-green-800">
              <div className="text-xs text-green-700 dark:text-green-400 font-medium">
                ينتهي الشيفت خلال
              </div>
              <div className="font-mono text-2xl font-bold text-green-700 dark:text-green-300 tracking-widest" dir="ltr">
                {timeLeft}
              </div>
            </div>
            {/* وقت بداية الشيفت القادم */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                يبدأ الشيفت القادم (#{nextShiftNum}) الساعة{' '}
                <span className="font-semibold text-foreground" dir="ltr">
                  {String(getShiftEndEgypt(currentShiftNum).h).padStart(2, '0')}:00
                </span>
                {' '}بتوقيت مصر
              </span>
            </div>
            <ShiftMembersList users={currentShiftUsers} emptyText="لا يوجد مشرفون مُعيَّنون" />
          </CardContent>
        </Card>

        {/* الشيفت القادم */}
        <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronRight className="h-5 w-5 text-primary" />
                الشيفت القادم
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                شيفت #{nextShiftNum} · {SHIFT_SLOTS.find(s => s.number === nextShiftNum)?.label}
              </Badge>
            </div>
            <CardDescription>
              {nextShiftUsers.length > 0
                ? `${nextShiftUsers.length} مشرف سيبدأ الشيفت القادم`
                : 'لا يوجد مشرفون مُعيَّنون للشيفت القادم'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShiftMembersList users={nextShiftUsers} emptyText="لا يوجد مشرفون مُعيَّنون" />
          </CardContent>
        </Card>
      </div>

      {/* طلبات التسجيل والمشرفون النشطون */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">طلبات التسجيل المعلقة</CardTitle>
              <CardDescription>طلبات تنتظر الموافقة</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pending-requests">
                عرض الكل
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد طلبات معلقة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20"
                    data-testid={`pending-user-${user.id}`}
                  >
                    <Avatar className="h-9 w-9">
                      {user.externalImage && <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />}
                      <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name}
                        {user.externalName && user.externalName !== user.full_name && (
                          <span className="font-normal text-xs text-primary/70 mr-1 platform-nick">({user.externalName})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">معلق</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">المشرفون النشطون</CardTitle>
              <CardDescription>أحدث المشرفين المضافين</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admins">
                عرض الكل
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد مشرفون حتى الآن</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`user-${user.id}`}
                  >
                    <Avatar className="h-9 w-9">
                      {user.externalImage && <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name}
                        {user.externalName && user.externalName !== user.full_name && (
                          <span className="font-normal text-xs text-primary/70 mr-1 platform-nick">({user.externalName})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'} className="text-xs">
                      {user.role === 'super_admin' ? 'مدير' : 'مشرف'}
                    </Badge>
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
