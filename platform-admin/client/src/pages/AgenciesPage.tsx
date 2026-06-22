import { useState, useEffect } from 'react';
import { Building2, Search, Phone, Globe, Calendar, Hash, User, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

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

export default function AgenciesPage() {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activated' | 'opened'>('all');

  useEffect(() => {
    async function load() {
      try {
        const [agR, adR] = await Promise.all([h('/api/agencies'), h('/api/users')]);
        if (agR.ok) setAgencies(await agR.json());
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

  const filtered = agencies.filter(ag => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      ag.agent_id?.toLowerCase().includes(q) ||
      ag.agency_name?.toLowerCase().includes(q) ||
      ag.agency_code?.toLowerCase().includes(q) ||
      ag.country?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || ag.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getInitials = (name: string) =>
    name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الوكالات</h1>
          <p className="text-sm text-muted-foreground">إجمالي: {agencies.length} وكالة</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالأيدي أو الاسم أو الكود أو البلد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'activated', 'opened'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {s === 'all' ? 'الكل' : s === 'activated' ? '🔵 مفعّل' : '🟢 مفتوح'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Building2 className="h-12 w-12 opacity-30" />
          <p>لا توجد وكالات تطابق البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(ag => {
            const admin = adminMap[ag.admin_id];
            return (
              <Card key={ag.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1.5 w-full ${ag.status === 'opened' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <CardContent className="p-4 space-y-4">
                  {/* Agent Avatar + Name */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border-2 border-border">
                      {ag.agent_photo && <AvatarImage src={ag.agent_photo} alt={ag.agent_id} />}
                      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                        {getInitials(ag.agency_name || ag.agent_id)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{ag.agency_name || ag.agent_id}</p>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {ag.agent_id}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <Badge variant={ag.status === 'opened' ? 'default' : 'secondary'} className="text-xs">
                    {ag.status === 'opened' ? '🟢 مفتوح' : '🔵 مفعّل'}
                  </Badge>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {ag.agency_code && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">كود: <strong className="text-foreground">{ag.agency_code}</strong></span>
                      </div>
                    )}
                    {ag.country && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ag.country}</span>
                      </div>
                    )}
                    {ag.agent_whatsapp && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ag.agent_whatsapp}</span>
                      </div>
                    )}
                    {ag.source_platform && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ag.source_platform}</span>
                      </div>
                    )}
                    {ag.creation_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>إنشاء: {ag.creation_date.split('T')[0]}</span>
                      </div>
                    )}
                    {ag.opening_date && (
                      <div className="flex items-center gap-2 text-green-600">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>افتتاح: {ag.opening_date.split('T')[0]}</span>
                      </div>
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
