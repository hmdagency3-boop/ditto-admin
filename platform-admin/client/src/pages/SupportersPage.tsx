import { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';

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
  platformName?: string;
  platformImage?: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  username: string;
  platform_id?: string;
  platformName?: string;
  platformImage?: string;
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
        const spData: Supporter[] = spR.ok ? await spR.json() : [];
        const adData: AdminUser[] = adR.ok ? await adR.json() : [];
        setSupporters(spData);
        setAdmins(adData);
        setLoading(false);

        // Fetch supporter profiles in background
        spData.forEach(async (sp) => {
          const profile = await fetchUserProfile(sp.supporter_id);
          if (profile) {
            setSupporters(prev => prev.map(s =>
              s.id === sp.id
                ? { ...s, platformName: profile.name, platformImage: profile.image }
                : s
            ));
          }
        });

        // Fetch admin profiles in background
        adData.forEach(async (admin) => {
          if (!admin.platform_id) return;
          const profile = await fetchUserProfile(admin.platform_id);
          if (profile) {
            setAdmins(prev => prev.map(a =>
              a.id === admin.id
                ? { ...a, platformName: profile.name, platformImage: profile.image }
                : a
            ));
          }
        });
      } catch {
        toast({ title: 'حدث خطأ أثناء تحميل البيانات', variant: 'destructive' });
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
      sp.platformName?.toLowerCase().includes(q) ||
      sp.level?.toLowerCase().includes(q) ||
      sp.management?.toLowerCase().includes(q) ||
      sp.source_platform?.toLowerCase().includes(q) ||
      adminMap[sp.admin_id]?.full_name?.toLowerCase().includes(q);
  });

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  const cellCls = 'border border-border px-3 py-2.5 text-sm';
  const headCls = 'border border-border px-3 py-2.5 text-sm font-semibold bg-muted text-right';

  const levels = [...new Set(supporters.map(s => s.level).filter(Boolean))];

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
                <div className="text-2xl font-bold">{supporters.filter(s => s.level === level).length}</div>
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
              <CardDescription>{filtered.length} داعم من إجمالي {supporters.length}</CardDescription>
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
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">لا يوجد داعمين</h3>
              <p>لم يتم العثور على داعمين يطابقون البحث</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={headCls}>#</th>
                    <th className={headCls}>الداعم</th>
                    <th className={headCls}>المستوى</th>
                    <th className={headCls}>الإدارة</th>
                    <th className={headCls}>المنصة</th>
                    <th className={headCls}>ملاحظات</th>
                    <th className={headCls}>تاريخ الإضافة</th>
                    <th className={headCls}>المشرف</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sp, idx) => {
                    const admin = adminMap[sp.admin_id];
                    const levelClass = sp.level
                      ? LEVEL_BADGE[sp.level] || 'bg-primary/10 text-primary hover:bg-primary/10'
                      : '';
                    const displayImage = sp.platformImage || sp.supporter_photo;
                    const displayName  = sp.platformName  || sp.supporter_id;
                    return (
                      <tr key={sp.id} className="hover:bg-muted/40 transition-colors">
                        <td className={`${cellCls} text-muted-foreground text-center w-10`}>{idx + 1}</td>
                        <td className={cellCls}>
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <Avatar className="h-8 w-8 shrink-0">
                              {displayImage && <AvatarImage src={displayImage} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{displayName}</p>
                              {sp.platformName && (
                                <p className="text-xs text-muted-foreground font-mono">{sp.supporter_id}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cellCls}>
                          {sp.level
                            ? <Badge className={levelClass}>{sp.level}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className={cellCls}>{sp.management || '—'}</td>
                        <td className={cellCls}>{sp.source_platform || '—'}</td>
                        <td className={`${cellCls} max-w-[160px]`}>
                          <p className="truncate text-muted-foreground">{sp.notes || '—'}</p>
                        </td>
                        <td className={`${cellCls} text-muted-foreground whitespace-nowrap`}>
                          {new Date(sp.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className={cellCls}>
                          {admin ? (
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <Avatar className="h-7 w-7 shrink-0">
                                {admin.platformImage && <AvatarImage src={admin.platformImage} />}
                                <AvatarFallback className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold">
                                  {getInitials(admin.full_name || admin.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate text-sm">{admin.full_name || admin.username}</p>
                                {admin.platformName && admin.platformName !== admin.full_name && (
                                  <p className="text-xs text-primary/70 truncate">{admin.platformName}</p>
                                )}
                              </div>
                            </div>
                          ) : '—'}
                        </td>
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
