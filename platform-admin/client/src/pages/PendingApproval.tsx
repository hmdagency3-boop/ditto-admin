import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getStoredPendingRequest, clearPendingRequest } from '@/lib/deviceFingerprint';

export default function PendingApproval() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'not_found'>('pending');
  const [username, setUsername] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const pending = getStoredPendingRequest();
    if (!pending) {
      setLocation('/login');
      return;
    }
    setUsername(pending.username);
    checkStatus();
  }, []);

  async function checkStatus() {
    const pending = getStoredPendingRequest();
    if (!pending) return;

    setChecking(true);
    try {
      const response = await fetch('/api/auth/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: pending.username,
          fingerprint: pending.fingerprint 
        }),
      });

      const data = await response.json();
      
      if (data.status === 'approved') {
        setStatus('approved');
        clearPendingRequest();
        setTimeout(() => setLocation('/login'), 2000);
      } else if (data.status === 'rejected') {
        setStatus('rejected');
        clearPendingRequest();
      } else if (data.status === 'not_found') {
        setStatus('not_found');
        clearPendingRequest();
        setTimeout(() => setLocation('/login'), 3000);
      } else {
        setStatus('pending');
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setChecking(false);
    }
  }

  function handleGoToLogin() {
    clearPendingRequest();
    setLocation('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'pending' && (
            <>
              <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 w-fit">
                <Clock className="h-12 w-12 text-yellow-600 dark:text-yellow-400 animate-pulse" />
              </div>
              <CardTitle className="text-2xl">في انتظار الموافقة</CardTitle>
              <CardDescription>
                تم إرسال طلب فتح حسابك وهو قيد المراجعة من قبل المسؤول
              </CardDescription>
            </>
          )}
          
          {status === 'approved' && (
            <>
              <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/30 w-fit">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-600">تمت الموافقة!</CardTitle>
              <CardDescription>
                تم قبول طلبك. جاري تحويلك لصفحة تسجيل الدخول...
              </CardDescription>
            </>
          )}
          
          {status === 'rejected' && (
            <>
              <div className="mx-auto mb-4 p-4 rounded-full bg-red-100 dark:bg-red-900/30 w-fit">
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl text-red-600">تم رفض الطلب</CardTitle>
              <CardDescription>
                للأسف تم رفض طلب فتح حسابك. يمكنك التواصل مع المسؤول لمعرفة السبب.
              </CardDescription>
            </>
          )}
          
          {status === 'not_found' && (
            <>
              <div className="mx-auto mb-4 p-4 rounded-full bg-gray-100 dark:bg-gray-900/30 w-fit">
                <XCircle className="h-12 w-12 text-gray-600 dark:text-gray-400" />
              </div>
              <CardTitle className="text-2xl">لم يتم العثور على الطلب</CardTitle>
              <CardDescription>
                لم نتمكن من العثور على طلبك. جاري تحويلك لصفحة تسجيل الدخول...
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {username && status === 'pending' && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">اسم المستخدم</p>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                @{username}
              </Badge>
            </div>
          )}
          
          {status === 'pending' && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  سيتم إشعارك تلقائياً عند الموافقة على طلبك.
                  يمكنك أيضاً التحقق يدوياً من حالة الطلب.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={checkStatus} 
                  disabled={checking}
                  className="w-full"
                >
                  {checking ? (
                    <>
                      <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 ml-2" />
                      التحقق من حالة الطلب
                    </>
                  )}
                </Button>
                
                {lastChecked && (
                  <p className="text-xs text-center text-muted-foreground">
                    آخر تحقق: {lastChecked.toLocaleTimeString('ar-EG')}
                  </p>
                )}
              </div>
            </>
          )}
          
          {(status === 'rejected' || status === 'not_found') && (
            <Button onClick={handleGoToLogin} className="w-full">
              العودة لتسجيل الدخول
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
