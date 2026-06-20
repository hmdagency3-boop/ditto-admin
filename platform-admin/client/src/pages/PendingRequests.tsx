import { useState, useEffect } from 'react';
import { 
  UserCheck, 
  UserX, 
  Clock,
  Users,
  RefreshCw,
  Ban
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RequestUser {
  id: string;
  username: string;
  full_name: string;
  created_at: string;
  device_fingerprint?: string;
  ip_address?: string;
  externalName?: string;
  externalImage?: string;
}

export default function PendingRequests() {
  const { toast } = useToast();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<RequestUser[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<RequestUser[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  async function fetchAllUsers() {
    setLoading(true);
    await Promise.all([fetchPendingUsers(), fetchRejectedUsers()]);
    setLoading(false);
  }

  async function fetchWithImages(url: string): Promise<RequestUser[]> {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    return Promise.all(
      data.map(async (user: RequestUser) => {
        const ext = await fetchUserProfile(user.username);
        return { ...user, externalName: ext?.name, externalImage: ext?.image };
      })
    );
  }

  async function fetchPendingUsers() {
    try {
      const users = await fetchWithImages('/api/users/pending');
      setPendingUsers(users);
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء جلب الطلبات المعلقة', variant: 'destructive' });
    }
  }

  async function fetchRejectedUsers() {
    try {
      const users = await fetchWithImages('/api/users/rejected');
      setRejectedUsers(users);
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء جلب الطلبات المرفوضة', variant: 'destructive' });
    }
  }

  async function approveUser(userId: string, fromRejected = false) {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      toast({ title: 'تمت الموافقة', description: data.message });
      if (fromRejected) {
        setRejectedUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الموافقة على الطلب', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectUser(userId: string) {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      toast({ title: 'تم الرفض', description: data.message });
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء رفض الطلب', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const UserCard = ({
    user,
    showReject = false,
    fromRejected = false,
  }: {
    user: RequestUser;
    showReject?: boolean;
    fromRejected?: boolean;
  }) => (
    <Card key={user.id}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar className="h-12 w-12">
            {user.externalImage && (
              <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />
            )}
            <AvatarFallback className={fromRejected
              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
            }>
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">{user.externalName || user.full_name}</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span>@{user.username}</span>
              <span>•</span>
              <span>{format(new Date(user.created_at), 'd MMMM yyyy - hh:mm a', { locale: ar })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => approveUser(user.id, fromRejected)}
              disabled={processingId === user.id}
            >
              <UserCheck className="h-4 w-4 ml-2" />
              {processingId === user.id ? 'جاري...' : 'موافقة'}
            </Button>
            {showReject && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectUser(user.id)}
                disabled={processingId === user.id}
              >
                <UserX className="h-4 w-4 ml-2" />
                رفض
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <Card>
      <CardContent className="py-16 text-center">
        <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-2">{message}</h3>
      </CardContent>
    </Card>
  );

  const SkeletonCards = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Clock className="page-title-icon" />
            طلبات التسجيل
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة طلبات التسجيل المعلقة والمرفوضة
          </p>
        </div>
        <Button variant="outline" onClick={fetchAllUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            معلقة
            {pendingUsers.length > 0 && (
              <Badge variant="secondary" className="mr-1">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            مرفوضة
            {rejectedUsers.length > 0 && (
              <Badge variant="destructive" className="mr-1">{rejectedUsers.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {loading ? (
            <SkeletonCards />
          ) : pendingUsers.length === 0 ? (
            <EmptyState message="لا توجد طلبات معلقة" />
          ) : (
            <div className="space-y-4">
              {pendingUsers.map(user => (
                <UserCard key={user.id} user={user} showReject />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {loading ? (
            <SkeletonCards />
          ) : rejectedUsers.length === 0 ? (
            <EmptyState message="لا توجد طلبات مرفوضة" />
          ) : (
            <div className="space-y-4">
              {rejectedUsers.map(user => (
                <UserCard key={user.id} user={user} fromRejected />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
