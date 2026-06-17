import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock,
  Sun,
  Moon,
  Sunset,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type Shift } from '@/lib/supabase';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, isToday, isFuture, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function MyShifts() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: addDays(currentWeekStart, 6),
  });

  useEffect(() => {
    if (profile?.id) {
      fetchShifts();
    }
  }, [profile?.id, currentWeekStart]);

  async function fetchShifts() {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
      const weekEnd = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', profile.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  }

  const getShiftIcon = (type: string) => {
    switch (type) {
      case 'morning': return Sun;
      case 'afternoon': return Sunset;
      case 'night': return Moon;
      default: return Clock;
    }
  };

  const getShiftColor = (type: string) => {
    switch (type) {
      case 'morning': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'afternoon': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'night': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      default: return 'bg-muted';
    }
  };

  const getShiftsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter(s => s.date === dateStr);
  };

  const upcomingShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date);
    return isToday(shiftDate) || isFuture(shiftDate);
  });

  const pastShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date);
    return isPast(shiftDate) && !isToday(shiftDate);
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            شيفتاتي
          </h1>
          <p className="text-muted-foreground mt-1">
            جدول ورديات العمل الخاص بك
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
            data-testid="button-prev-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            data-testid="button-today"
          >
            اليوم
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
            data-testid="button-next-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {format(currentWeekStart, 'd MMMM', { locale: ar })} - {format(addDays(currentWeekStart, 6), 'd MMMM yyyy', { locale: ar })}
          </CardTitle>
          <CardDescription>
            {shifts.length} شيفتات هذا الأسبوع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayShifts = getShiftsForDay(day);
              const today = isToday(day);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-32 p-3 rounded-md border transition-colors ${
                    today 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : dayShifts.length > 0 
                        ? 'border-border bg-card' 
                        : 'border-border/50 bg-muted/30'
                  }`}
                >
                  <div className={`text-center mb-3 pb-2 border-b ${today ? 'border-primary/30' : 'border-border/50'}`}>
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEEE', { locale: ar })}
                    </div>
                    <div className={`text-xl font-bold ${today ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <div className="text-xs text-center text-muted-foreground py-2">
                        إجازة
                      </div>
                    ) : (
                      dayShifts.map((shift) => {
                        const ShiftIcon = getShiftIcon(shift.shift_type);
                        return (
                          <div 
                            key={shift.id} 
                            className={`p-2 rounded-md text-xs border ${getShiftColor(shift.shift_type)}`}
                            data-testid={`shift-${shift.id}`}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <ShiftIcon className="h-3 w-3" />
                              <span className="font-medium">
                                {shift.shift_type === 'morning' ? 'صباحي' : 
                                 shift.shift_type === 'afternoon' ? 'مسائي' : 'ليلي'}
                              </span>
                            </div>
                            <div className="font-mono text-xs opacity-80" dir="ltr">
                              {shift.start_time} - {shift.end_time}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              الشيفتات القادمة
            </CardTitle>
            <CardDescription>شيفتات هذا الأسبوع المتبقية</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد شيفتات قادمة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => {
                  const ShiftIcon = getShiftIcon(shift.shift_type);
                  const shiftDate = new Date(shift.date);
                  return (
                    <div 
                      key={shift.id} 
                      className={`flex items-center gap-3 p-3 rounded-md border ${
                        isToday(shiftDate) ? 'bg-primary/5 border-primary/30' : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className={`p-2 rounded-md ${getShiftColor(shift.shift_type)}`}>
                        <ShiftIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(shiftDate, 'EEEE', { locale: ar })}
                          </span>
                          {isToday(shiftDate) && (
                            <Badge variant="default" className="text-xs">اليوم</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(shiftDate, 'd MMMM', { locale: ar })}
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge variant="outline" className={getShiftColor(shift.shift_type)}>
                          {shift.shift_type === 'morning' ? 'صباحي' : 
                           shift.shift_type === 'afternoon' ? 'مسائي' : 'ليلي'}
                        </Badge>
                        <div className="text-xs font-mono mt-1" dir="ltr">
                          {shift.start_time} - {shift.end_time}
                        </div>
                      </div>
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
              <Calendar className="h-5 w-5 text-muted-foreground" />
              الشيفتات السابقة
            </CardTitle>
            <CardDescription>شيفتات هذا الأسبوع المنتهية</CardDescription>
          </CardHeader>
          <CardContent>
            {pastShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد شيفتات سابقة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastShifts.map((shift) => {
                  const ShiftIcon = getShiftIcon(shift.shift_type);
                  const shiftDate = new Date(shift.date);
                  return (
                    <div 
                      key={shift.id} 
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/50 opacity-75"
                    >
                      <div className={`p-2 rounded-md ${getShiftColor(shift.shift_type)}`}>
                        <ShiftIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {format(shiftDate, 'EEEE', { locale: ar })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(shiftDate, 'd MMMM', { locale: ar })}
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge variant="secondary">
                          {shift.shift_type === 'morning' ? 'صباحي' : 
                           shift.shift_type === 'afternoon' ? 'مسائي' : 'ليلي'}
                        </Badge>
                        <div className="text-xs font-mono mt-1 text-muted-foreground" dir="ltr">
                          {shift.start_time} - {shift.end_time}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
