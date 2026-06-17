import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, History, User, Hash, ImageIcon, Tag, AlertCircle } from 'lucide-react';

interface ChangeLog {
  id: string;
  user_id: string;
  user_full_name: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  name_change:       { label: 'تغيير الاسم',           icon: <User className="h-3.5 w-3.5" />,        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  platform_id_change:{ label: 'تغيير رقم المنصة',      icon: <Hash className="h-3.5 w-3.5" />,        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  nick_change:       { label: 'تغيير الاسم في المنصة', icon: <Tag className="h-3.5 w-3.5" />,         color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  avatar_change:     { label: 'تغيير الصورة',          icon: <ImageIcon className="h-3.5 w-3.5" />,   color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  uid_mismatch:      { label: 'تغيير الرقم الثابت',    icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

function isImageUrl(val: string | null): boolean {
  if (!val) return false;
  return val.startsWith('http') && (val.includes('avatar') || val.includes('.jpg') || val.includes('.jpeg') || val.includes('.png') || val.includes('res.sayyouditto') || val.includes('imageslim'));
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  } catch { return iso; }
}

export default function ChangeLogs() {
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/change-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data);
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر تحميل السجل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const checkAll = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/change-logs/check-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      toast({ title: 'تم الفحص', description: data.message });
      await fetchLogs();
    } catch {
      toast({ title: 'خطأ', description: 'فشل الفحص', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.change_type === filter);

  const counts: Record<string, number> = {};
  logs.forEach(l => { counts[l.change_type] = (counts[l.change_type] || 0) + 1; });

  const filterTypes = [
    { key: 'all', label: 'الكل' },
    ...Object.keys(CHANGE_TYPE_LABELS).filter(k => counts[k] > 0).map(k => ({
      key: k,
      label: CHANGE_TYPE_LABELS[k].label
    }))
  ];

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">سجل التغييرات</h1>
          <Badge variant="secondary" className="text-sm">{logs.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={checkAll} disabled={checking}>
            <RefreshCw className={`h-4 w-4 ml-1 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'جاري الفحص...' : 'فحص التغييرات الآن'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(CHANGE_TYPE_LABELS).map(([key, meta]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all hover:shadow-md ${filter === key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter(filter === key ? 'all' : key)}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${meta.color}`}>{meta.icon}</span>
              <div>
                <p className="text-xs text-muted-foreground leading-tight">{meta.label}</p>
                <p className="text-xl font-bold">{counts[key] || 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTypes.map(ft => (
          <button
            key={ft.key}
            onClick={() => setFilter(ft.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
              filter === ft.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            }`}
          >
            {ft.label}
            {ft.key !== 'all' && <span className="mr-1 opacity-70">({counts[ft.key] || 0})</span>}
          </button>
        ))}
      </div>

      {/* Logs */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد سجلات بعد</p>
            <p className="text-sm mt-1">اضغط "فحص التغييرات الآن" للبدء</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => {
            const meta = CHANGE_TYPE_LABELS[log.change_type] || { label: log.change_type, icon: null, color: 'bg-gray-100 text-gray-800' };
            const showAvatar = log.change_type === 'avatar_change';
            return (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-semibold text-sm">{log.user_full_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(log.detected_at)}</span>
                      </div>

                      {showAvatar ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          {log.old_value && (
                            <div className="text-center">
                              <img
                                src={log.old_value}
                                alt="قديم"
                                className="h-14 w-14 rounded-full object-cover border-2 border-red-300"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">قبل</p>
                            </div>
                          )}
                          <span className="text-muted-foreground text-lg">←</span>
                          {log.new_value && (
                            <div className="text-center">
                              <img
                                src={log.new_value}
                                alt="جديد"
                                className="h-14 w-14 rounded-full object-cover border-2 border-green-400"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">بعد</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          {log.old_value !== null && (
                            <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 font-mono">
                              {log.old_value || '(فارغ)'}
                            </span>
                          )}
                          {log.old_value !== null && log.new_value !== null && (
                            <span className="text-muted-foreground">←</span>
                          )}
                          {log.new_value !== null && (
                            <span className="px-2 py-0.5 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded border border-green-200 dark:border-green-800 font-mono">
                              {log.new_value || '(فارغ)'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
