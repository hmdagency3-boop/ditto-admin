import { useState, useEffect } from 'react';
import { Users, Search, User, Star, Layers, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface Supporter {
  id: string;
  supporter_id: string;
  supporter_photo?: string;
  source_platform?: string;
  level?: string;
  management?: string;
  notes?: string;
  admin_id: string;
  period?: number;
  created_at: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  username: string;
  platform_id?: string;
}

async function h(url: string) {
  const token = localStorage.getItem('auth_token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

const LEVEL_COLORS: Record<string, string> = {
  'VIP': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Gold': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Silver': 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  'Bronze': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function SupportersPage() {
  const { toast } = useToast();
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [spR, adR] = await Promise.all([h('/api/supporters'), h('/api/users')]);
        if (spR.ok) setSupporters(await spR.json());
        if (adR.ok) {
          const users = await adR.json();
          setAdmins(users.filter((u: any) => u.role === 'admin' || u.role === 'super_admin'));
        }
      } catch {
        toast({ title: 'حدث خطأ أثناء تحميل البيانات', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

  const filtered = supporters.filter(sp => {
    const q = search.toLowerCase();
    return (
      !q ||
      sp.supporter_id?.toLowerCase().includes(q) ||
      sp.level?.toLowerCase().includes(q) ||
      sp.management?.toLowerCase().includes(q) ||
      sp.source_platform?.toLowerCase().includes(q)
    );
  });

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الداعمين</h1>
          <p className="text-sm text-muted-foreground">إجمالي: {supporters.length} داعم</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث بالأيدي أو المستوى أو الإدارة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Users className="h-12 w-12 opacity-30" />
          <p>لا يوجد داعمين يطابقون البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(sp => {
            const admin = adminMap[sp.admin_id];
            const levelColor = sp.level ? LEVEL_COLORS[sp.level] || 'bg-primary/10 text-primary' : '';
            return (
              <Card key={sp.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1.5 w-full bg-gradient-to-r from-primary to-primary/50" />
                <CardContent className="p-4 space-y-4">
                  {/* Supporter Avatar + ID */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border-2 border-border">
                      {sp.supporter_photo && <AvatarImage src={sp.supporter_photo} alt={sp.supporter_id} />}
                      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                        {getInitials(sp.supporter_id)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{sp.supporter_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sp.created_at).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                  </div>

                  {/* Level Badge */}
                  {sp.level && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${levelColor}`}>
                      <Star className="h-3 w-3" /> {sp.level}
                    </span>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {sp.management && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sp.management}</span>
                      </div>
                    )}
                    {sp.source_platform && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sp.source_platform}</span>
                      </div>
                    )}
                    {sp.notes && (
                      <p className="text-xs text-muted-foreground bg-muted rounded p-2 line-clamp-2">
                        {sp.notes}
                      </p>
                    )}
                  </div>

                  {/* Admin */}
                  {admin && (
                    <div className="pt-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">مشرف: {admin.full_name || admin.username}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
