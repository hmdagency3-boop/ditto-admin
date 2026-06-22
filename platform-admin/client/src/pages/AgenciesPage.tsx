import { useState, useEffect } from 'react';
import { Building2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Agency {
  id: string;
  agent_id: string;
  agency_name?: string;
  agency_code?: string;
  agent_photo?: string;
  country?: string;
  agent_whatsapp?: string;
  source_platform?: string;
  creation_date?: string;
  opening_date?: string;
  status: 'activated' | 'opened';
  admin_id: string;
  notes?: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  username: string;
}

export default function AgenciesPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activated' | 'opened'>('all');

  useEffect(() => {
    async function load() {
      try {
        const h = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const [agR, adR] = await Promise.all([h('/api/agencies'), h('/api/users')]);
        if (agR.ok) setAgencies(await agR.json());
        if (adR.ok) setAdmins(await adR.json());
      } catch {
        toast({ title: 'حدث خطأ أثناء تحميل البيانات', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

  const filtered = agencies.filter(ag => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ag.agent_id?.toLowerCase().includes(q) ||
      ag.agency_name?.toLowerCase().includes(q) ||
      ag.agency_code?.toLowerCase().includes(q) ||
      ag.country?.toLowerCase().includes(q) ||
      adminMap[ag.admin_id]?.full_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || ag.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  const cellCls = 'border border-border px-3 py-2.5 text-sm';
  const headCls = 'border border-border px-3 py-2.5 text-sm font-semibold bg-muted text-right';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الوكالات</h1>
          <p className="text-sm text-muted-foreground">عرض جميع الوكالات المسجلة في النظام</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الوكالات', value: agencies.length, color: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
          { label: 'مفعّلة', value: agencies.filter(a => a.status === 'activated').length, color: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
          { label: 'تم افتتاحها', value: agencies.filter(a => a.status === 'opened').length, color: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-md ${s.color}`}>
                <Building2 className={`h-5 w-5 ${s.icon}`} />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>قائمة الوكالات</CardTitle>
              <CardDescription>{filtered.length} وكالة من إجمالي {agencies.length}</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-10 w-full sm:w-52"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'activated', 'opened'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {s === 'all' ? 'الكل' : s === 'activated' ? 'مفعّلة' : 'مفتوحة'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">لا توجد وكالات</h3>
              <p>لم يتم العثور على وكالات تطابق البحث</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={headCls}>#</th>
                    <th className={headCls}>الوكيل</th>
                    <th className={headCls}>اسم الوكالة</th>
                    <th className={headCls}>كود الوكالة</th>
                    <th className={headCls}>البلد</th>
                    <th className={headCls}>واتساب</th>
                    <th className={headCls}>المنصة</th>
                    <th className={headCls}>تاريخ الإنشاء</th>
                    <th className={headCls}>تاريخ الافتتاح</th>
                    <th className={headCls}>الحالة</th>
                    <th className={headCls}>المشرف</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ag, idx) => {
                    const admin = adminMap[ag.admin_id];
                    return (
                      <tr key={ag.id} className="hover:bg-muted/40 transition-colors">
                        <td className={`${cellCls} text-muted-foreground text-center w-10`}>{idx + 1}</td>
                        <td className={cellCls}>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Avatar className="h-7 w-7 shrink-0">
                              {ag.agent_photo && <AvatarImage src={ag.agent_photo} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {getInitials(ag.agency_name || ag.agent_id)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-mono font-semibold">{ag.agent_id}</span>
                          </div>
                        </td>
                        <td className={`${cellCls} font-medium`}>{ag.agency_name || '—'}</td>
                        <td className={`${cellCls} font-mono`}>{ag.agency_code || '—'}</td>
                        <td className={cellCls}>{ag.country || '—'}</td>
                        <td className={`${cellCls} font-mono`} dir="ltr">{ag.agent_whatsapp || '—'}</td>
                        <td className={cellCls}>{ag.source_platform || '—'}</td>
                        <td className={`${cellCls} text-muted-foreground`}>
                          {ag.creation_date ? ag.creation_date.split('T')[0] : '—'}
                        </td>
                        <td className={`${cellCls} text-muted-foreground`}>
                          {ag.opening_date ? ag.opening_date.split('T')[0] : '—'}
                        </td>
                        <td className={cellCls}>
                          <Badge className={ag.status === 'opened'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100'}>
                            {ag.status === 'opened' ? '🎉 مفتوحة' : '✅ مفعّلة'}
                          </Badge>
                        </td>
                        <td className={cellCls}>{admin ? (admin.full_name || admin.username) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
