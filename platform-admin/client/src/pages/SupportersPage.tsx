import { useState, useEffect, useMemo } from 'react';
import { Users, Search, ArrowUpDown, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/lib/userProfileService';

type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'vip_days_asc' | 'vip_days_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_desc',  label: 'الأحدث إضافة' },
  { value: 'created_asc',   label: 'الأقدم إضافة' },
  { value: 'name_asc',      label: 'الاسم (أ-ي)' },
  { value: 'name_desc',     label: 'الاسم (ي-أ)' },
  { value: 'vip_days_asc',  label: 'مدة VIP (الأقرب للانتهاء)' },
  { value: 'vip_days_desc', label: 'مدة VIP (الأطول تبقياً)' },
];

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
  vipId?: number | null;
  vipName?: string | null;
  vipDaysLeft?: number | null;
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
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('created_desc');

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

        // Fetch supporter profiles in background, capped to avoid a request storm on large lists
        const CONCURRENCY = 5;
        let cursor = 0;
        const runNext = async (): Promise<void> => {
          const idx = cursor++;
          if (idx >= spData.length) return;
          const sp = spData[idx];
          const profile = await fetchUserProfile(sp.supporter_id);
          if (profile) {
            setSupporters(prev => prev.map(s =>
              s.id === sp.id
                ? { ...s, platformName: profile.name, platformImage: profile.image, vipId: profile.vipId, vipName: profile.vipName, vipDaysLeft: profile.vipDaysLeft }
                : s
            ));
          }
          return runNext();
        };
        Array.from({ length: Math.min(CONCURRENCY, spData.length) }, runNext);

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

  const adminMap = useMemo(() => Object.fromEntries(admins.map(a => [a.id, a])), [admins]);

  const levels = [...new Set(supporters.map(s => s.level).filter(Boolean))] as string[];
  const platforms = [...new Set(supporters.map(s => s.source_platform).filter(Boolean))] as string[];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = supporters.filter(sp => {
      const matchesSearch = !q ||
        sp.supporter_id?.toLowerCase().includes(q) ||
        sp.platformName?.toLowerCase().includes(q) ||
        sp.level?.toLowerCase().includes(q) ||
        sp.management?.toLowerCase().includes(q) ||
        sp.source_platform?.toLowerCase().includes(q) ||
        adminMap[sp.admin_id]?.full_name?.toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || sp.level === levelFilter;
      const matchesPlatform = platformFilter === 'all' || sp.source_platform === platformFilter;
      const matchesAdmin = adminFilter === 'all' || sp.admin_id === adminFilter;
      return matchesSearch && matchesLevel && matchesPlatform && matchesAdmin;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc':
          return (a.platformName || a.supporter_id).localeCompare(b.platformName || b.supporter_id, 'ar');
        case 'name_desc':
          return (b.platformName || b.supporter_id).localeCompare(a.platformName || a.supporter_id, 'ar');
        case 'vip_days_asc': {
          const av = a.vipDaysLeft ?? Number.POSITIVE_INFINITY;
          const bv = b.vipDaysLeft ?? Number.POSITIVE_INFINITY;
          return av - bv;
        }
        case 'vip_days_desc': {
          const av = a.vipDaysLeft ?? Number.NEGATIVE_INFINITY;
          const bv = b.vipDaysLeft ?? Number.NEGATIVE_INFINITY;
          return bv - av;
        }
        case 'created_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return list;
  }, [supporters, search, levelFilter, platformFilter, adminFilter, sortBy, adminMap]);

  const hasActiveFilters = levelFilter !== 'all' || platformFilter !== 'all' || adminFilter !== 'all' || sortBy !== 'created_desc';
  const resetFilters = () => {
    setLevelFilter('all');
    setPlatformFilter('all');
    setAdminFilter('all');
    setSortBy('created_desc');
  };

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  // Mirrors fmtVipDays() on the Ditto profile search page (vipInfoDto.vipDate = days remaining) exactly.
  const formatVipDays = (days?: number | null): { label: string; expired: boolean } | null => {
    if (days == null || !Number.isFinite(days)) return null;
    if (days <= 0) return { label: 'منتهية ⚠', expired: true };
    if (days === 1) return { label: 'يوم واحد متبقي', expired: false };
    return { label: `${days} يوم متبقي`, expired: days <= 7 };
  };

  const cellCls = 'border border-border px-3 py-2.5 text-sm';
  const headCls = 'border border-border px-3 py-2.5 text-sm font-semibold bg-muted text-right';

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
        <CardHeader className="space-y-3">
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

          {/* Filters & sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-level">
                <SelectValue placeholder="المستوى" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المستويات</SelectItem>
                {levels.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-platform">
                <SelectValue placeholder="المنصة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنصات</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={adminFilter} onValueChange={setAdminFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="select-filter-admin">
                <SelectValue placeholder="المشرف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشرفين</SelectItem>
                {admins.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name || a.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-52" data-testid="select-sort">
                <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                <SelectValue placeholder="ترتيب حسب" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
                <X className="h-3.5 w-3.5 ml-1" />
                إعادة تعيين
              </Button>
            )}
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
                    <th className={headCls}>VIP</th>
                    <th className={headCls}>مدة VIP</th>
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
                        <td className={cellCls}>
                          {sp.vipId
                            ? <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">{sp.vipName || `VIP ${sp.vipId}`}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>
                          {(() => {
                            const vipDays = formatVipDays(sp.vipDaysLeft);
                            if (!vipDays) return <span className="text-muted-foreground">—</span>;
                            return (
                              <span className={vipDays.expired ? 'text-red-500' : 'text-muted-foreground'}>
                                {vipDays.label}
                              </span>
                            );
                          })()}
                        </td>
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
