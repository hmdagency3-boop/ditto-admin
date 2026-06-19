import { useState, useEffect } from 'react';
import { 
  Clock,
  Plus, 
  X,
  Users,
  Shield,
  UserX
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';

const SHIFT_SLOTS = [
  { number: 1,  labelAr: "12:00 ص - 2:00 ص"  },
  { number: 2,  labelAr: "2:00 ص - 4:00 ص"   },
  { number: 3,  labelAr: "4:00 ص - 6:00 ص"   },
  { number: 4,  labelAr: "6:00 ص - 8:00 ص"   },
  { number: 5,  labelAr: "8:00 ص - 10:00 ص"  },
  { number: 6,  labelAr: "10:00 ص - 12:00 م" },
  { number: 7,  labelAr: "12:00 م - 2:00 م"  },
  { number: 8,  labelAr: "2:00 م - 4:00 م"   },
  { number: 9,  labelAr: "4:00 م - 6:00 م"   },
  { number: 10, labelAr: "6:00 م - 8:00 م"   },
  { number: 11, labelAr: "8:00 م - 10:00 م"  },
  { number: 12, labelAr: "10:00 م - 12:00 ص" },
];

interface UserInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  platform_id?: string;
  employment_status?: string;
  externalName?: string;
  externalImage?: string;
}

interface Shift {
  id: string;
  user_id: string;
  shift_number: number;
  created_by: string;
  created_at?: string;
}

type ShiftWithUser = Shift & { user?: UserInfo };

export default function Shifts() {
  const { token, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [selectedShiftNumber, setSelectedShiftNumber] = useState<number | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [shiftsRes, adminsRes] = await Promise.all([
        fetch('/api/shifts', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (shiftsRes.ok && adminsRes.ok) {
        const shiftsData: Shift[] = await shiftsRes.json();
        const adminsData: UserInfo[] = await adminsRes.json();

        const adminsWithImages = await Promise.all(
          adminsData.map(async (admin) => {
            const profile = await fetchUserProfile(admin.platform_id || admin.username);
            return { ...admin, externalName: profile?.name, externalImage: profile?.image };
          })
        );

        const shiftsWithUsers: ShiftWithUser[] = shiftsData.map((shift) => ({
          ...shift,
          user: adminsWithImages.find((u) => u.id === shift.user_id)
        }));

        setShifts(shiftsWithUsers);
        // فقط المشرفون (بدون super_admin)
        setAdmins(adminsWithImages.filter((u) => u.role !== 'super_admin'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addShift() {
    if (!selectedShiftNumber || !selectedAdmin || !token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: selectedAdmin, shift_number: selectedShiftNumber })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast({ title: 'تمت الإضافة', description: data.message });
      setSelectedAdmin('');
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'حدث خطأ', variant: 'destructive' });
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
      toast({ title: 'تم الحذف', description: 'تم حذف المشرف من الشيفت' });
      fetchData();
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  }

  function getShiftsForSlot(shiftNumber: number): ShiftWithUser[] {
    return shifts.filter(s => s.shift_number === shiftNumber);
  }

  // كل المشرفين غير المعيّنين — المفصولون يظهرون لكن معطّلون
  function getUnassignedAdmins(shiftNumber: number): UserInfo[] {
    const assignedIds = getShiftsForSlot(shiftNumber).map(s => s.user_id);
    return admins.filter(a => !assignedIds.includes(a.id));
  }

  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="page-wrapper">
        <Skeleton className="h-10 w-48" />
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Clock className="page-title-icon" />
            جدول الشيفتات
          </h1>
          <p className="text-muted-foreground mt-1">
            12 شيفت ثابت يومياً — بتوقيت مصر
          </p>
        </div>

        <div className="flex gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{admins.filter(a => a.employment_status !== 'dismissed').length} مشرف</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <span>{shifts.length} تعيين</span>
          </div>
        </div>
      </div>

      {/* Shift Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SHIFT_SLOTS.map((slot) => {
          const slotShifts = getShiftsForSlot(slot.number);
          const unassigned = getUnassignedAdmins(slot.number);
          const available = unassigned.filter(a => a.employment_status !== 'dismissed');

          return (
            <Card key={slot.number} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      #{slot.number}
                    </Badge>
                    <CardTitle className="text-sm font-semibold" dir="ltr">
                      {slot.labelAr}
                    </CardTitle>
                  </div>

                  {isSuperAdmin && (
                    <Dialog open={dialogOpen && selectedShiftNumber === slot.number} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) { setSelectedShiftNumber(slot.number); setSelectedAdmin(''); }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={available.length === 0}
                          title={available.length === 0 ? 'كل المشرفين مُعيّنون أو مفصولون' : 'إضافة مشرف'}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm" dir="rtl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            إضافة مشرف للشيفت
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <p className="text-sm text-muted-foreground">
                            الشيفت: <span className="font-medium text-foreground">{slot.labelAr}</span>
                          </p>
                          <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المشرف" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassigned.map((admin) => {
                                const isDismissed = admin.employment_status === 'dismissed';
                                return (
                                  <SelectItem
                                    key={admin.id}
                                    value={admin.id}
                                    disabled={isDismissed}
                                    className={isDismissed ? 'opacity-40 cursor-not-allowed' : ''}
                                  >
                                    <div className={`flex items-center gap-2 ${isDismissed ? 'grayscale' : ''}`}>
                                      <Avatar className="h-6 w-6">
                                        {admin.externalImage && <AvatarImage src={admin.externalImage} />}
                                        <AvatarFallback className="text-xs">
                                          {getInitials(admin.externalName || admin.full_name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>
                                        {admin.full_name}
                                        {admin.externalName && admin.externalName !== admin.full_name && (
                                          <span className="text-muted-foreground mr-1 platform-nick">({admin.externalName})</span>
                                        )}
                                        {isDismissed && (
                                          <span className="text-destructive mr-1 text-xs">(مفصول)</span>
                                        )}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button onClick={addShift} disabled={!selectedAdmin || isSubmitting} className="flex-1">
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
              </CardHeader>

              <CardContent className="px-4 pb-4">
                {slotShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    لا يوجد مشرف مُعيَّن
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slotShifts.map((shift) => {
                      const isDismissed = shift.user?.employment_status === 'dismissed';
                      return (
                        <div
                          key={shift.id}
                          className={`flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 text-xs transition-all ${
                            isDismissed
                              ? 'bg-muted/60 opacity-50 grayscale'
                              : 'bg-primary/10'
                          }`}
                          title={isDismissed ? 'هذا المشرف مفصول' : undefined}
                        >
                          <Avatar className="h-5 w-5">
                            {shift.user?.externalImage && <AvatarImage src={shift.user.externalImage} />}
                            <AvatarFallback className={`text-[8px] ${isDismissed ? 'bg-muted' : 'bg-primary/20'}`}>
                              {getInitials(shift.user?.externalName || shift.user?.full_name || '؟؟')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium flex items-center gap-1">
                            {shift.user?.full_name}
                            {shift.user?.externalName && shift.user.externalName !== shift.user.full_name && (
                              <span className="font-normal opacity-70 mr-1 platform-nick">({shift.user.externalName})</span>
                            )}
                            {isDismissed && <UserX className="h-3 w-3 text-destructive" />}
                          </span>
                          {isSuperAdmin && (
                            <button
                              onClick={() => removeShift(shift.id)}
                              className="text-destructive hover:bg-destructive/20 rounded-full p-0.5 ml-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
