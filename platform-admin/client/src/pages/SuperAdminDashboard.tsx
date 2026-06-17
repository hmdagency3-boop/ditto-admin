import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { 
  Users, 
  Clock, 
  Star, 
  AlertTriangle, 
  UserCheck,
  TrendingUp,
  Calendar,
  Plus,
  ArrowLeft,
  UserPlus
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [usersRes, pendingRes] = await Promise.all([
        fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/users/pending', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok) {
        const users = await usersRes.json();
        const approvedUsers = users.filter((u: UserInfo) => u.status === 'approved');
        const usersWithImages = await Promise.all(
          approvedUsers.map(async (u: UserInfo) => {
            const profile = await fetchUserProfile(u.platform_id || u.username);
            return { ...u, externalName: profile?.name, externalImage: profile?.image };
          })
        );
        setRecentUsers(usersWithImages.slice(0, 5));
        setStats(prev => ({ ...prev, totalAdmins: approvedUsers.length }));
      }

      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        const pendingWithImages = await Promise.all(
          pending.map(async (u: UserInfo) => {
            const profile = await fetchUserProfile(u.platform_id || u.username);
            return { ...u, externalName: profile?.name, externalImage: profile?.image };
          })
        );
        setPendingUsers(pendingWithImages.slice(0, 5));
        setStats(prev => ({ ...prev, pendingRequests: pending.length }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const statCards = [
    { 
      title: 'إجمالي المشرفين', 
      value: stats.totalAdmins, 
      icon: Users, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    { 
      title: 'طلبات معلقة', 
      value: stats.pendingRequests, 
      icon: UserPlus, 
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    { 
      title: 'متوسط التقييم', 
      value: stats.avgRating, 
      icon: Star, 
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    { 
      title: 'الإنذارات النشطة', 
      value: stats.activeWarnings, 
      icon: AlertTriangle, 
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
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
          <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
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
                      {user.externalImage && (
                        <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />
                      )}
                      <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.externalName || user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      معلق
                    </Badge>
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
                      {user.externalImage && (
                        <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.externalName || user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                    <Badge 
                      variant={user.role === 'super_admin' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
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
