import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, UserPlus, Eye, EyeOff, Shield, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { generateDeviceFingerprint, getStoredPendingRequest, storePendingRequest } from '@/lib/deviceFingerprint';

const loginSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signupSchema = z.object({
  username: z.string()
    .min(3, 'رقم الموظف يجب أن يكون 3 أرقام على الأقل')
    .regex(/^\d+$/, 'رقم الموظف يجب أن يكون أرقام فقط'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  useEffect(() => {
    const pending = getStoredPendingRequest();
    if (pending) {
      setLocation('/pending-approval');
    }
  }, []);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  async function onLogin(data: LoginFormData) {
    setIsLoading(true);
    setPendingMessage(null);
    setRejectedMessage(null);
    
    const { error, status } = await signIn(data.username, data.password);
    setIsLoading(false);
    
    if (error) {
      if (status === 'pending') {
        setPendingMessage(error.message);
      } else if (status === 'rejected') {
        setRejectedMessage(error.message);
      } else {
        toast({
          title: 'خطأ في تسجيل الدخول',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'تم تسجيل الدخول بنجاح',
        description: 'مرحباً بك في نظام إدارة المشرفين',
      });
      setLocation('/');
    }
  }

  async function onSignup(data: SignupFormData) {
    setIsLoading(true);
    setRegistrationSuccess(false);
    
    const fingerprint = await generateDeviceFingerprint();
    const { error, success, username } = await signUp(data.username, data.password, `موظف ${data.username}`, fingerprint);
    setIsLoading(false);
    
    if (error) {
      toast({
        title: 'خطأ في إنشاء الحساب',
        description: error.message,
        variant: 'destructive',
      });
    } else if (success && username) {
      storePendingRequest(username, fingerprint);
      signupForm.reset();
      toast({
        title: 'تم إرسال الطلب بنجاح',
        description: 'سيتم مراجعة طلبك من قبل المسؤول',
      });
      setLocation('/pending-approval');
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">نظام إدارة المشرفين</h1>
            <p className="text-muted-foreground mt-2">نظام شامل لإدارة الحضور والتقييمات</p>
          </div>
          
          <Card>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">الدخول إلى النظام</CardTitle>
              <CardDescription className="text-center">
                سجل دخولك أو أنشئ حساباً جديداً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="tab-login">
                    <LogIn className="w-4 h-4 ml-2" />
                    تسجيل الدخول
                  </TabsTrigger>
                  <TabsTrigger value="signup" data-testid="tab-signup">
                    <UserPlus className="w-4 h-4 ml-2" />
                    حساب جديد
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  {pendingMessage && (
                    <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-200">حسابك قيد المراجعة</AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        {pendingMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {rejectedMessage && (
                    <Alert className="mb-4 border-red-500 bg-red-50 dark:bg-red-950">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800 dark:text-red-200">تم رفض طلبك</AlertTitle>
                      <AlertDescription className="text-red-700 dark:text-red-300">
                        {rejectedMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>اسم المستخدم</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="أدخل اسم المستخدم" 
                                data-testid="input-login-username"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>كلمة المرور</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showPassword ? 'text' : 'password'} 
                                  placeholder="••••••••"
                                  data-testid="input-login-password"
                                  {...field} 
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute left-0 top-0 h-full px-3"
                                  onClick={() => setShowPassword(!showPassword)}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading}
                        data-testid="button-login-submit"
                      >
                        {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                
                <TabsContent value="signup">
                  {registrationSuccess && (
                    <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
                      <Clock className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800 dark:text-green-200">تم إرسال الطلب بنجاح</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        سيتم مراجعة طلبك من قبل المسؤول. يرجى الانتظار حتى تتم الموافقة على حسابك.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Form {...signupForm}>
                    <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                      <FormField
                        control={signupForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>رقم الموظف</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="12345" 
                                inputMode="numeric"
                                data-testid="input-signup-username"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={signupForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>كلمة المرور</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showPassword ? 'text' : 'password'} 
                                  placeholder="••••••••"
                                  data-testid="input-signup-password"
                                  {...field} 
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute left-0 top-0 h-full px-3"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading}
                        data-testid="button-signup-submit"
                      >
                        {isLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب التسجيل'}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <div className="mt-4 p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
            <p>للدخول كمسؤول: اسم المستخدم <strong>admin</strong> وكلمة المرور <strong>admin123</strong></p>
          </div>
        </div>
      </main>
      
      <footer className="p-4 text-center text-sm text-muted-foreground">
        جميع الحقوق محفوظة © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
