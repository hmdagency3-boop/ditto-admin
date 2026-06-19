import { useState, useEffect } from 'react';
import { 
  UserCheck, 
  UserX, 
  Clock,
  Users,
  RefreshCw,
  Smartphone,
  Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fetchUserProfile } from '@/lib/userProfileService';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PendingUser {
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
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  async function fetchPendingUsers() {
    try {
      const response = await fetch('/api/users/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch pending users');

      const data = await response.json();
      
      // Fetch external profile images for each pending user
      const usersWithImages = await Promise.all(
        data.map(async (user: PendingUser) => {
          const externalData = await fetchUserProfile(user.username);
          return {
            ...user,
            externalName: externalData?.name,
            externalImage: externalData?.image
          };
        })
      );
      
      setPendingUsers(usersWithImages);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء جلب طلبات التسجيل',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function approveUser(userId: string) {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to approve user');

      const data = await response.json();
      toast({
        title: 'تمت الموافقة',
        description: data.message,
      });

      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء الموافقة على الطلب',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectUser(userId: string) {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to reject user');

      const data = await response.json();
      toast({
        title: 'تم الرفض',
        description: data.message,
      });

      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء رفض الطلب',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
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

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
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
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Clock className="page-title-icon" />
            طلبات التسجيل
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة طلبات التسجيل المعلقة
          </p>
        </div>
        
        <Button variant="outline" onClick={fetchPendingUsers}>
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="text-sm">
          {pendingUsers.length} طلب معلق
        </Badge>
      </div>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">لا توجد طلبات معلقة</h3>
            <p className="text-muted-foreground">
              جميع طلبات التسجيل تمت مراجعتها
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <Card key={user.id} data-testid={`card-pending-${user.id}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar className="h-12 w-12">
                    {user.externalImage && (
                      <AvatarImage src={user.externalImage} alt={user.externalName || user.full_name} />
                    )}
                    <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold">{user.externalName || user.full_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span>@{user.username}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(user.created_at), 'd MMMM yyyy - hh:mm a', { locale: ar })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => approveUser(user.id)}
                      disabled={processingId === user.id}
                      data-testid={`button-approve-${user.id}`}
                    >
                      <UserCheck className="h-4 w-4 ml-2" />
                      {processingId === user.id ? 'جاري...' : 'موافقة'}
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => rejectUser(user.id)}
                      disabled={processingId === user.id}
                      data-testid={`button-reject-${user.id}`}
                    >
                      <UserX className="h-4 w-4 ml-2" />
                      رفض
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
