import { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Supporter {
  id: string;
  supporter_id: string;
  supporter_photo?: string;
  source_platform?: string;
  level?: string;
  management?: string;
  notes?: string;
  admin_id: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  username: string;
}

const LEVEL_BADGE: Record<string, string> = {
  'VIP':    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100',
  'Gold':   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100',
  'Silver': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-100',
  'Bronze': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100',
};

export default function SupportersPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const h = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const [spR, adR] = await Promise.all([h('/api/supporters'), h('/api/users')]);
        if (spR.ok) setSupporters(await spR.json());
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

  const filtered = supporters.filter(sp => {
    const q = search.toLowerCase();
    return !q ||
      sp.supporter_id?.toLowerCase().includes(q) ||
      sp.level?.toLowerCase().includes(q) ||
      sp.management?.toLowerCase().includes(q) ||
      sp.source_platform?.toLowerCase().includes(q) ||
      adminMap[sp.admin_id]?.full_name?.toLowerCase().includes(q);
  });

  const levels = [...new Set(supporters.map(s => s.level).filter(Boolean))];

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الداعمين</h1>
          <p className="text-sm text-muted-foreground">عرض جميع الداعمين المسجلين في النظام</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{supporters.length}</div>
              <div className="text-sm text-muted-foreground">إجمالي الداعمين</div>
            </div>
          </CardContent>
        </Card>
        {levels.slice(0, 3).map(level => (
          <Card key={level}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-md bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {supporters.filter(s => s.level === level).length}
                </div>
                <div className="text-sm text-muted-foreground">{level}</div>
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
              <CardTitle>قائمة الداعمين</CardTitle>
              <CardDescription>
                {filtered.length} داعم من إجمالي {supporters.length}
              </CardDescription>
            </div>
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 w-full sm:w-52"
              />
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
              <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">لا يوجد داعمين</h3>
              <p>لم يتم العثور على داعمين يطابقون البحث</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الداعم</TableHead>
                      <TableHead className="text-right">المستوى</TableHead>
                      <TableHead className="text-right">الإدارة</TableHead>
                      <TableHead className="text-right">المنصة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                      <TableHead className="text-right">تاريخ الإضافة</TableHead>
                      <TableHead className="text-right">المشرف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(sp => {
                      const admin = adminMap[sp.admin_id];
                      const levelClass = sp.level
                        ? LEVEL_BADGE[sp.level] || 'bg-primary/10 text-primary hover:bg-primary/10'
                        : '';
                      return (
                        <TableRow key={sp.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {sp.supporter_photo && <AvatarImage src={sp.supporter_photo} alt={sp.supporter_id} />}
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                  {getInitials(sp.supporter_id)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-mono font-semibold text-sm">{sp.supporter_id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sp.level
                              ? <Badge className={levelClass}>{sp.level}</Badge>
                              : <span className="text-muted-foreground text-sm">—</span>
                            }
                          </TableCell>
                          <TableCell>{sp.management || '—'}</TableCell>
                          <TableCell>{sp.source_platform || '—'}</TableCell>
                          <TableCell className="max-w-[180px]">
                            <p className="text-xs text-muted-foreground truncate">{sp.notes || '—'}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(sp.created_at).toLocaleDateString('ar-EG')}
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
                {filtered.map(sp => {
                  const admin = adminMap[sp.admin_id];
                  const levelClass = sp.level
                    ? LEVEL_BADGE[sp.level] || 'bg-primary/10 text-primary'
                    : '';
                  return (
                    <div key={sp.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-9 w-9">
                            {sp.supporter_photo && <AvatarImage src={sp.supporter_photo} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {getInitials(sp.supporter_id)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-mono font-bold text-sm">{sp.supporter_id}</span>
                        </div>
                        {sp.level && <Badge className={levelClass}>{sp.level}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        {sp.management       && <span>🏢 {sp.management}</span>}
                        {sp.source_platform  && <span>📱 {sp.source_platform}</span>}
                      </div>
                      {sp.notes && (
                        <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{sp.notes}</p>
                      )}
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
