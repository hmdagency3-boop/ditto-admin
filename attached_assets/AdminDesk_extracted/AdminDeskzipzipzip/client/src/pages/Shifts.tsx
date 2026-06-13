import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';
import { format, addDays, startOfWeek, eachDayOfInterval, subWeeks, addWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';

// 12 fixed shift slots for each day
const SHIFT_SLOTS = [
  { number: 1, label: "12:00 AM - 2:00 AM", labelAr: "12:00 ص - 2:00 ص" },
  { number: 2, label: "2:00 AM - 4:00 AM", labelAr: "2:00 ص - 4:00 ص" },
  { number: 3, label: "4:00 AM - 6:00 AM", labelAr: "4:00 ص - 6:00 ص" },
  { number: 4, label: "6:00 AM - 8:00 AM", labelAr: "6:00 ص - 8:00 ص" },
  { number: 5, label: "8:00 AM - 10:00 AM", labelAr: "8:00 ص - 10:00 ص" },
  { number: 6, label: "10:00 AM - 12:00 PM", labelAr: "10:00 ص - 12:00 م" },
  { number: 7, label: "12:00 PM - 2:00 PM", labelAr: "12:00 م - 2:00 م" },
  { number: 8, label: "2:00 PM - 4:00 PM", labelAr: "2:00 م - 4:00 م" },
  { number: 9, label: "4:00 PM - 6:00 PM", labelAr: "4:00 م - 6:00 م" },
  { number: 10, label: "6:00 PM - 8:00 PM", labelAr: "6:00 م - 8:00 م" },
  { number: 11, label: "8:00 PM - 10:00 PM", labelAr: "8:00 م - 10:00 م" },
  { number: 12, label: "10:00 PM - 12:00 AM", labelAr: "10:00 م - 12:00 ص" },
];

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  externalName?: string;
  externalImage?: string;
}

interface Shift {
  id: string;
  user_id: string;
  date: string;
  shift_number: number;
  created_by: string;
  created_at?: string;
}

type ShiftWithUser = Shift & { user?: UserInfo };

export default function Shifts() {
  const { user, token, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ date: string; shiftNumber: number } | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: addDays(currentWeekStart, 6),
  });

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  async function fetchData() {
    setLoading(true);
    try {
      const [shiftsRes, adminsRes] = await Promise.all([
        fetch('/api/shifts', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (shiftsRes.ok && adminsRes.ok) {
        const shiftsData = await shiftsRes.json();
        const adminsData = await adminsRes.json();
        
        // Fetch external profiles for admins
        const adminsWithImages = await Promise.all(
          adminsData.map(async (admin: UserInfo) => {
            const profile = await fetchUserProfile(admin.username);
            return {
              ...admin,
              externalName: profile?.name,
              externalImage: profile?.image
            };
          })
        );
        
        // Map shifts with user data
        const shiftsWithUsers = shiftsData.map((shift: Shift) => ({
          ...shift,
          user: adminsWithImages.find((u: UserInfo) => u.id === shift.user_id)
        }));
        
        setShifts(shiftsWithUsers);
        setAdmins(adminsWithImages.filter((u: UserInfo) => u.role !== 'super_admin'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addShift() {
    if (!selectedCell || !selectedAdmin || !token) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: selectedAdmin,
          date: selectedCell.date,
          shift_number: selectedCell.shiftNumber,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      }

      toast({
        title: 'تمت الإضافة',
        description: data.message,
      });

      setSelectedAdmin('');
      setSelectedCell(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إضافة المشرف',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeShift(shiftId: string) {
    if (!token) return;
    
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error();

      toast({
        title: 'تم الحذف',
        description: 'تم حذف المشرف من الشيفت',
      });

      fetchData();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء الحذف',
        variant: 'destructive',
      });
    }
  }

  function getShiftsForCell(date: string, shiftNumber: number): ShiftWithUser[] {
    return shifts.filter(s => s.date === date && s.shift_number === shiftNumber);
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            جدول الشيفتات
          </h1>
          <p className="text-muted-foreground mt-1">
            12 شيفت يومياً - يمكن إضافة أكثر من مشرف لكل شيفت
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-sm px-4 py-2">
            {format(currentWeekStart, 'd MMM', { locale: ar })} - {format(addDays(currentWeekStart, 6), 'd MMM yyyy', { locale: ar })}
          </Badge>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            جدول الأسبوع
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              {/* Header Row - Days */}
              <div className="grid grid-cols-8 border-b bg-muted/50">
                <div className="p-3 text-center font-semibold text-sm border-l">
                  الوقت
                </div>
                {weekDays.map((day) => (
                  <div 
                    key={day.toISOString()} 
                    className="p-3 text-center font-semibold text-sm border-l"
                  >
                    <div>{format(day, 'EEEE', { locale: ar })}</div>
                    <div className="text-xs text-muted-foreground">{format(day, 'd/M')}</div>
                  </div>
                ))}
              </div>

              {/* Shift Rows */}
              {SHIFT_SLOTS.map((slot) => (
                <div key={slot.number} className="grid grid-cols-8 border-b hover:bg-muted/30 transition-colors">
                  {/* Time Label */}
                  <div className="p-2 text-xs font-medium border-l bg-muted/20 flex items-center justify-center">
                    {slot.labelAr}
                  </div>
                  
                  {/* Day Cells */}
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const cellShifts = getShiftsForCell(dateStr, slot.number);
                    
                    return (
                      <div 
                        key={`${dateStr}-${slot.number}`}
                        className="p-2 border-l min-h-[80px] relative group"
                      >
                        {/* Assigned Users */}
                        <div className="space-y-1">
                          {cellShifts.map((shift) => (
                            <div 
                              key={shift.id}
                              className="flex items-center gap-1 bg-primary/10 rounded-md p-1 text-xs"
                            >
                              <Avatar className="h-5 w-5">
                                {shift.user?.externalImage && (
                                  <AvatarImage src={shift.user.externalImage} />
                                )}
                                <AvatarFallback className="text-[8px] bg-primary/20">
                                  {getInitials(shift.user?.externalName || shift.user?.full_name || '??')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate flex-1 text-[10px]">
                                {shift.user?.externalName || shift.user?.full_name}
                              </span>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => removeShift(shift.id)}
                                  className="text-destructive hover:bg-destructive/20 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Add Button */}
                        {isSuperAdmin && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                onClick={() => setSelectedCell({ date: dateStr, shiftNumber: slot.number })}
                                className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full p-1 hover:bg-primary/90"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md" dir="rtl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Users className="h-5 w-5" />
                                  إضافة مشرف للشيفت
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">الشيفت:</span> {slot.labelAr}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">التاريخ:</span> {format(new Date(dateStr), 'EEEE d MMMM yyyy', { locale: ar })}
                                </div>
                                
                                <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر المشرف" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {admins.map((admin) => (
                                      <SelectItem key={admin.id} value={admin.id}>
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            {admin.externalImage && (
                                              <AvatarImage src={admin.externalImage} />
                                            )}
                                            <AvatarFallback className="text-xs">
                                              {getInitials(admin.externalName || admin.full_name)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{admin.externalName || admin.full_name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={addShift} 
                                    disabled={!selectedAdmin || isSubmitting}
                                    className="flex-1"
                                  >
                                    {isSubmitting ? 'جاري الإضافة...' : 'إضافة'}
                                  </Button>
                                  <DialogClose asChild>
                                    <Button variant="outline">إلغاء</Button>
                                  </DialogClose>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{shifts.length}</p>
                <p className="text-sm text-muted-foreground">إجمالي التعيينات</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admins.length}</p>
                <p className="text-sm text-muted-foreground">المشرفون المتاحون</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">شيفت يومياً</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
