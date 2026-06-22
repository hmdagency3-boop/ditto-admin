import { useState, useEffect } from 'react';
import { Building2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  const stats = {
    total: agencies.length,
    activated: agencies.filter(a => a.status === 'activated').length,
    opened: agencies.filter(a => a.status === 'opened').length,
  };

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

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
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">إجمالي الوكالات</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
              <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activated}</div>
              <div className="text-sm text-muted-foreground">مفعّلة</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-purple-100 dark:bg-purple-900/30">
              <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.opened}</div>
              <div className="text-sm text-muted-foreground">تم افتتاحها</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>قائمة الوكالات</CardTitle>
              <CardDescription>
                {filtered.length} وكالة من إجمالي {agencies.length}
              </CardDescription>
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
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">لا توجد وكالات</h3>
              <p>لم يتم العثور على وكالات تطابق البحث</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الوكيل</TableHead>
                      <TableHead className="text-right">اسم الوكالة</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">البلد</TableHead>
                      <TableHead className="text-right">واتساب</TableHead>
                      <TableHead className="text-right">المنصة</TableHead>
                      <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                      <TableHead className="text-right">تاريخ الافتتاح</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">المشرف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(ag => {
                      const admin = adminMap[ag.admin_id];
                      return (
                        <TableRow key={ag.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {ag.agent_photo && <AvatarImage src={ag.agent_photo} alt={ag.agent_id} />}
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                  {getInitials(ag.agency_name || ag.agent_id)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-mono font-semibold text-sm">{ag.agent_id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{ag.agency_name || '—'}</TableCell>
                          <TableCell className="font-mono text-sm">{ag.agency_code || '—'}</TableCell>
                          <TableCell>{ag.country || '—'}</TableCell>
                          <TableCell dir="ltr" className="text-sm">{ag.agent_whatsapp || '—'}</TableCell>
                          <TableCell>{ag.source_platform || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ag.creation_date ? ag.creation_date.split('T')[0] : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ag.opening_date ? ag.opening_date.split('T')[0] : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={ag.status === 'opened'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100'}>
                              {ag.status === 'opened' ? '🎉 مفتوحة' : '✅ مفعّلة'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {admin ? (admin.full_name || admin.username) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {filtered.map(ag => {
                  const admin = adminMap[ag.admin_id];
                  return (
                    <div key={ag.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-9 w-9">
                            {ag.agent_photo && <AvatarImage src={ag.agent_photo} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {getInitials(ag.agency_name || ag.agent_id)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-mono font-bold text-sm">{ag.agent_id}</p>
                            {ag.agency_name && <p className="text-xs text-muted-foreground">{ag.agency_name}</p>}
                          </div>
                        </div>
                        <Badge className={ag.status === 'opened'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}>
                          {ag.status === 'opened' ? '🎉 مفتوحة' : '✅ مفعّلة'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        {ag.agency_code    && <span>كود: <strong className="text-foreground">{ag.agency_code}</strong></span>}
                        {ag.country        && <span>🌍 {ag.country}</span>}
                        {ag.agent_whatsapp && <span>📞 {ag.agent_whatsapp}</span>}
                        {ag.source_platform&& <span>📱 {ag.source_platform}</span>}
                        {ag.creation_date  && <span>📅 {ag.creation_date.split('T')[0]}</span>}
                        {ag.opening_date   && <span>🎉 {ag.opening_date.split('T')[0]}</span>}
                      </div>
                      {admin && (
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          مشرف: {admin.full_name || admin.username}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
