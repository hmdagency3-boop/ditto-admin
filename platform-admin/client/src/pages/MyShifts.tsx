import { useState, useEffect } from 'react';
import { Clock, Sun, Moon, Sunset, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

const SHIFT_SLOTS = [
  { number: 1,  labelAr: "12:00 ص - 2:00 ص",  type: 'night'     },
  { number: 2,  labelAr: "2:00 ص - 4:00 ص",   type: 'night'     },
  { number: 3,  labelAr: "4:00 ص - 6:00 ص",   type: 'night'     },
  { number: 4,  labelAr: "6:00 ص - 8:00 ص",   type: 'morning'   },
  { number: 5,  labelAr: "8:00 ص - 10:00 ص",  type: 'morning'   },
  { number: 6,  labelAr: "10:00 ص - 12:00 م", type: 'morning'   },
  { number: 7,  labelAr: "12:00 م - 2:00 م",  type: 'afternoon' },
  { number: 8,  labelAr: "2:00 م - 4:00 م",   type: 'afternoon' },
  { number: 9,  labelAr: "4:00 م - 6:00 م",   type: 'afternoon' },
  { number: 10, labelAr: "6:00 م - 8:00 م",   type: 'evening'   },
  { number: 11, labelAr: "8:00 م - 10:00 م",  type: 'evening'   },
  { number: 12, labelAr: "10:00 م - 12:00 ص", type: 'evening'   },
];

interface ShiftRecord {
  id: string;
  user_id: string;
  shift_number: number;
}

const typeStyles: Record<string, string> = {
  morning:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  afternoon: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  evening:   'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  night:     'bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-300  border-blue-300  dark:border-blue-700',
};

const typeIcon: Record<string, React.ElementType> = {
  morning:   Sun,
  afternoon: Sunset,
  evening:   Moon,
  night:     Moon,
};

const typeLabel: Record<string, string> = {
  morning:   'صباحي',
  afternoon: 'ظهري',
  evening:   'مسائي',
  night:     'ليلي',
};

export default function MyShifts() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myShifts, setMyShifts] = useState<ShiftRecord[]>([]);

  useEffect(() => {
    if (user?.id) fetchShifts();
  }, [user?.id]);

  async function fetchShifts() {
    if (!user?.id || !token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/shifts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const allShifts = await res.json();
      const data = allShifts
        .filter((s: ShiftRecord) => s.user_id === user.id)
        .sort((a: ShiftRecord, b: ShiftRecord) => a.shift_number - b.shift_number);
      setMyShifts(data);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-8 w-8" />
          شيفتاتي
        </h1>
        <p className="text-muted-foreground mt-1">شيفتاتك الثابتة — بتوقيت مصر</p>
      </div>

      {myShifts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">لم يتم تعيين شيفت لك بعد</p>
            <p className="text-muted-foreground/70 text-sm mt-1">تواصل مع السوبر أدمن</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myShifts.map((shift) => {
            const slot = SHIFT_SLOTS.find(s => s.number === shift.shift_number);
            if (!slot) return null;
            const Icon = typeIcon[slot.type];
            return (
              <Card key={shift.id} className={`border-2 ${typeStyles[slot.type]}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs font-mono ${typeStyles[slot.type]}`}>
                      شيفت #{slot.number}
                    </Badge>
                    <Badge className={typeStyles[slot.type]}>
                      {typeLabel[slot.type]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${typeStyles[slot.type]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl" dir="ltr">{slot.labelAr}</CardTitle>
                      <CardDescription className="mt-0.5">يومياً — كل أيام الأسبوع</CardDescription>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {myShifts.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {myShifts.length === 1 ? 'لديك شيفت واحد' : `لديك ${myShifts.length} شيفتات`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {myShifts.map(s => {
                    const slot = SHIFT_SLOTS.find(sl => sl.number === s.shift_number);
                    return slot?.labelAr;
                  }).join(' — ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
