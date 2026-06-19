import { useState, useRef } from 'react';
import {
  Search as SearchIcon, X, LayoutGrid, List,
  UserSearch, Loader2, Globe, Users, Zap,
  ShieldCheck, Crown, Star, Eye, MessageCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useLang } from '@/contexts/LangContext';

interface DittoData {
  uid: string;
  nickName?: string;
  avatar?: string;
  country?: string;
  gender?: number;
  ban?: number;
  onLine?: boolean;
  nobleName?: string;
  chatGift?: number;
  chatRange?: number;
}

interface SayyoData {
  erbanNo: string;
  uid: string;
  nick?: string;
  avatar?: string;
  country?: string;
  gender?: number;
  vipId?: string;
  charmLevel?: string;
  experLevel?: string;
  fansNum?: string;
}

interface MergedUser {
  erbanNo: string;
  uid: string;
  nick?: string;
  avatar?: string;
  country?: string;
  gender?: number;
  ditto?: DittoData;
  nobleName?: string;
  chatGift?: number;
  chatRange?: number;
  vipId?: string;
  charmLevel?: string;
  experLevel?: string;
  fansNum?: string;
}

const CONCURRENCY = 5;

async function fetchSayyo(erbanNo: string): Promise<SayyoData | null> {
  try {
    const r = await fetch(`https://www.sayyouditto.com/pay/payermax/getInfo?no=${encodeURIComponent(erbanNo)}`);
    const json = await r.json();
    if (json?.code === 200 && json?.data) {
      const d = json.data;
      return {
        erbanNo,
        uid:         d.uid || d.id || '',
        nick:        d.nick || d.nickName || d.name || '',
        avatar:      d.avatar || d.headImg || '',
        country:     d.country || d.countryCode || '',
        gender:      d.gender,
        vipId:       d.vipId    != null ? String(d.vipId)    : undefined,
        charmLevel:  d.charmLevel != null ? String(d.charmLevel) : undefined,
        experLevel:  d.experLevel != null ? String(d.experLevel) : undefined,
        fansNum:     d.fansNum  != null ? String(d.fansNum)  : undefined,
      };
    }
    return null;
  } catch { return null; }
}

async function fetchDitto(uid: string): Promise<DittoData | null> {
  try {
    const r = await fetch(`https://www.dittoparty.com/user/v4/get?uid=${encodeURIComponent(uid)}`);
    const json = await r.json();
    const d = json?.data || json?.user || json;
    if (d && (d.uid || d.nickName)) {
      return {
        uid: d.uid || uid,
        nickName: d.nickName || d.nick || '',
        avatar: d.avatar || d.headImg || '',
        country: d.country || d.countryCode || '',
        gender: d.gender,
        ban: d.ban,
        onLine: d.onLine || d.online,
        nobleName: d.nobleName,
        chatGift: d.chatGift,
        chatRange: d.chatRange,
      };
    }
    return null;
  } catch { return null; }
}

async function searchUser(erbanNo: string): Promise<MergedUser | null> {
  const sayyo = await fetchSayyo(erbanNo.trim());
  if (!sayyo) return null;
  let ditto: DittoData | null = null;
  if (sayyo.uid) ditto = await fetchDitto(sayyo.uid);
  return {
    erbanNo:    sayyo.erbanNo,
    uid:        sayyo.uid,
    nick:       ditto?.nickName || sayyo.nick,
    avatar:     ditto?.avatar || sayyo.avatar,
    country:    ditto?.country || sayyo.country,
    gender:     ditto?.gender ?? sayyo.gender,
    ditto,
    nobleName:  ditto?.nobleName,
    chatGift:   ditto?.chatGift,
    chatRange:  ditto?.chatRange,
    vipId:      sayyo.vipId,
    charmLevel: sayyo.charmLevel,
    experLevel: sayyo.experLevel,
    fansNum:    sayyo.fansNum,
  };
}

async function fetchBatch(
  numbers: string[],
  onProgress: (done: number) => void
): Promise<(MergedUser | null)[]> {
  const results: (MergedUser | null)[] = new Array(numbers.length).fill(null);
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < numbers.length) {
      const i = idx++;
      results[i] = await searchUser(numbers[i]);
      onProgress(++done);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function genderLabel(g?: number) {
  if (g === 1) return 'ذكر';
  if (g === 2) return 'أنثى';
  return '—';
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${color}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs opacity-70 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function UserCard({ user }: { user: MergedUser }) {
  const avatar = user.avatar || user.ditto?.avatar;
  const isSafe = user.ditto && user.ditto.ban !== 1;
  const isOnline = user.ditto?.onLine;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-24 w-24 ring-4 ring-primary/10 shadow-lg">
            {avatar && <AvatarImage src={avatar} alt={user.nick} className="object-cover" />}
            <AvatarFallback className="text-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold">
              {user.nick ? user.nick[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full shadow" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h2 className="text-2xl font-bold leading-tight truncate">{user.nick || '—'}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-sm text-muted-foreground font-mono">#{user.erbanNo}</span>
            {user.uid && <span className="text-xs text-muted-foreground">· UID {user.uid}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {isOnline && (
              <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                متصل الآن
              </Badge>
            )}
            {isSafe && (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <ShieldCheck className="h-3 w-3" />
                حساب سليم
              </Badge>
            )}
            {user.nobleName && (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 gap-1">
                <Crown className="h-3 w-3" />
                {user.nobleName}
              </Badge>
            )}
            {user.vipId && (
              <Badge className="bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20 gap-1">
                <Star className="h-3 w-3" />
                VIP {user.vipId}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatPill icon={Globe} label="الدولة" value={user.country || '—'}
          color="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" />
        <StatPill icon={Users} label="الجنس" value={genderLabel(user.gender)}
          color="bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300" />
        {user.fansNum && (
          <StatPill icon={Users} label="المتابعون" value={user.fansNum}
            color="bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300" />
        )}
        {user.charmLevel && (
          <StatPill icon={Star} label="مستوى السحر" value={user.charmLevel}
            color="bg-pink-50 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300" />
        )}
        {user.experLevel && (
          <StatPill icon={Zap} label="مستوى الخبرة" value={user.experLevel}
            color="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" />
        )}
        {user.ditto && (
          <StatPill
            icon={MessageCircle}
            label="الهدايا"
            value={user.chatGift === 1 ? 'مفعّلة' : 'معطّلة'}
            color={user.chatGift === 1
              ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"}
          />
        )}
        {user.ditto && (
          <StatPill
            icon={Eye}
            label="نطاق المحادثة"
            value={user.chatRange === 1 ? 'عام' : 'خاص'}
            color="bg-slate-50 text-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
          />
        )}
      </div>
    </div>
  );
}

function BatchCard({ user }: { user: MergedUser }) {
  const avatar = user.avatar || user.ditto?.avatar;
  return (
    <div className="rounded-2xl border bg-card p-3 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-default">
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            {avatar && <AvatarImage src={avatar} className="object-cover" />}
            <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
              {user.nick ? user.nick[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          {user.ditto?.onLine && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate leading-tight">{user.nick || '—'}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">#{user.erbanNo}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {user.country && (
          <Badge variant="outline" className="text-xs h-5 px-1.5">{user.country}</Badge>
        )}
        {user.nobleName && (
          <Badge className="text-xs h-5 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
            👑 {user.nobleName}
          </Badge>
        )}
        {user.vipId && (
          <Badge className="text-xs h-5 px-1.5 bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-0">
            ⭐ VIP{user.vipId}
          </Badge>
        )}
        {user.charmLevel && (
          <Badge className="text-xs h-5 px-1.5 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-0">
            ⚡ {user.charmLevel}
          </Badge>
        )}
        {user.ditto?.onLine && (
          <Badge className="text-xs h-5 px-1.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0">
            🟢
          </Badge>
        )}
        {user.ditto && user.ditto.ban !== 1 && (
          <Badge className="text-xs h-5 px-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
            ✅
          </Badge>
        )}
      </div>
    </div>
  );
}

function BatchRow({ user }: { user: MergedUser }) {
  const avatar = user.avatar || user.ditto?.avatar;
  return (
    <tr className="border-b hover:bg-muted/40 transition-colors">
      <td className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Avatar className="h-9 w-9">
              {avatar && <AvatarImage src={avatar} className="object-cover" />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {user.nick ? user.nick[0].toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>
            {user.ditto?.onLine && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm leading-tight">{user.nick || '—'}</p>
            <p className="text-xs text-muted-foreground font-mono">#{user.erbanNo}</p>
          </div>
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground font-mono">{user.uid}</td>
      <td className="p-3 text-sm">{user.country || '—'}</td>
      <td className="p-3 text-sm">{genderLabel(user.gender)}</td>
      <td className="p-3">
        <div className="flex gap-1 flex-wrap">
          {user.ditto?.onLine && <Badge className="text-xs h-5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0">🟢</Badge>}
          {user.ditto && user.ditto.ban !== 1 && <Badge className="text-xs h-5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">✅</Badge>}
          {user.nobleName && <Badge className="text-xs h-5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">👑 {user.nobleName}</Badge>}
          {user.vipId && <Badge className="text-xs h-5 bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-0">⭐ VIP{user.vipId}</Badge>}
          {user.charmLevel && <Badge className="text-xs h-5 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-0">⚡{user.charmLevel}</Badge>}
          {user.experLevel && <Badge className="text-xs h-5 bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-0">📈{user.experLevel}</Badge>}
        </div>
      </td>
    </tr>
  );
}

export default function SearchPage() {
  const { lang } = useLang();

  const [singleInput, setSingleInput] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<MergedUser | null | 'not_found'>(null);

  const [batchInput, setBatchInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<MergedUser[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const abortRef = useRef(false);

  async function handleSingleSearch() {
    if (!singleInput.trim()) return;
    setSingleLoading(true);
    setSingleResult(null);
    const r = await searchUser(singleInput.trim());
    setSingleResult(r ?? 'not_found');
    setSingleLoading(false);
  }

  async function handleBatchSearch() {
    const lines = batchInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBatchLoading(true);
    setBatchResults([]);
    setBatchProgress(0);
    setBatchTotal(lines.length);
    abortRef.current = false;
    const results = await fetchBatch(lines, (done) => setBatchProgress(done));
    setBatchResults(results.filter(Boolean) as MergedUser[]);
    setBatchLoading(false);
  }

  const progressPct = batchTotal > 0 ? Math.round((batchProgress / batchTotal) * 100) : 0;
  const isRtl = lang === 'ar';

  return (
    <div className="page-wrapper" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <UserSearch className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">البحث عن مستخدم</h1>
          <p className="text-xs text-muted-foreground mt-0.5">ابحث بالـ Erban Number للحصول على بيانات المستخدم</p>
        </div>
      </div>

      <Tabs defaultValue="single" className="space-y-4 mt-4">
        <TabsList className="h-10 p-1 bg-muted/60">
          <TabsTrigger value="single" className="gap-2 px-4 data-[state=active]:shadow-sm">
            <SearchIcon className="h-3.5 w-3.5" />
            بحث فردي
          </TabsTrigger>
          <TabsTrigger value="batch" className="gap-2 px-4 data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" />
            بحث جماعي
          </TabsTrigger>
        </TabsList>

        {/* ── Single Search ── */}
        <TabsContent value="single" className="space-y-4 mt-0">
          <Card className="border-0 shadow-sm bg-card/80 backdrop-blur">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="أدخل Erban Number..."
                    value={singleInput}
                    onChange={e => setSingleInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSingleSearch()}
                    disabled={singleLoading}
                    className="pr-9 h-11 text-sm font-mono"
                    dir="ltr"
                  />
                </div>
                {singleInput && (
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0"
                    onClick={() => { setSingleInput(''); setSingleResult(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button onClick={handleSingleSearch}
                  disabled={singleLoading || !singleInput.trim()}
                  className="h-11 px-5 gap-2 shrink-0">
                  {singleLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <SearchIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{singleLoading ? 'جاري البحث...' : 'بحث'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Empty state */}
          {singleResult === null && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <UserSearch className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium text-base">ابحث عن أي مستخدم</p>
              <p className="text-sm mt-1 max-w-xs opacity-70">أدخل رقم الـ Erban وسيظهر لك كامل بيانات المستخدم من المنصة</p>
            </div>
          )}

          {/* Not found */}
          {singleResult === 'not_found' && (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
                  <X className="h-7 w-7 text-red-400" />
                </div>
                <p className="font-semibold text-base">لم يتم العثور على المستخدم</p>
                <p className="text-sm mt-1 opacity-70">تأكد من صحة رقم الـ Erban وأعد المحاولة</p>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {singleResult && singleResult !== 'not_found' && (
            <Card className="border-0 shadow-sm bg-card/80">
              <CardContent className="pt-5 pb-5">
                <UserCard user={singleResult} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Batch Search ── */}
        <TabsContent value="batch" className="space-y-4 mt-0">
          <Card className="border-0 shadow-sm bg-card/80">
            <CardContent className="pt-5 pb-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  أدخل أرقام الـ Erban (رقم لكل سطر)
                </label>
                <Textarea
                  placeholder={"1234567\n9876543\n5551234\n..."}
                  value={batchInput}
                  onChange={e => setBatchInput(e.target.value)}
                  rows={7}
                  disabled={batchLoading}
                  className="font-mono text-sm resize-none border-muted bg-muted/30 focus-visible:bg-background transition-colors"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold">
                    {batchInput.split('\n').filter(l => l.trim()).length}
                  </div>
                  <span>رقم مدخل</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"
                    onClick={() => { setBatchInput(''); setBatchResults([]); setBatchProgress(0); setBatchTotal(0); }}
                    disabled={batchLoading}
                    className="gap-1.5 h-9">
                    <X className="h-3.5 w-3.5" />
                    مسح
                  </Button>
                  <Button onClick={handleBatchSearch}
                    disabled={batchLoading || !batchInput.trim()}
                    className="gap-1.5 h-9">
                    {batchLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Zap className="h-3.5 w-3.5" />}
                    {batchLoading ? 'جاري البحث...' : 'ابدأ البحث'}
                  </Button>
                </div>
              </div>

              {batchLoading && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>جاري معالجة الأرقام...</span>
                    <span className="font-mono font-medium">{batchProgress}/{batchTotal} ({progressPct}%)</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batch empty state */}
          {!batchLoading && batchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">البحث الجماعي</p>
              <p className="text-sm mt-1 opacity-70 max-w-xs">أدخل أرقام Erban متعددة واضغط ابدأ للبحث عنهم جميعاً دفعة واحدة</p>
            </div>
          )}

          {/* Batch results */}
          {batchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1 font-mono">
                    {batchResults.length}
                  </Badge>
                  <span className="text-sm text-muted-foreground">نتيجة</span>
                </div>
                <div className="flex rounded-xl border overflow-hidden bg-muted/40 p-0.5 gap-0.5">
                  <button
                    className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-all font-medium ${
                      viewMode === 'grid'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    شبكة
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-all font-medium ${
                      viewMode === 'table'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-3.5 w-3.5" />
                    جدول
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {batchResults.map(u => (
                    <BatchCard key={u.erbanNo} user={u} />
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-start p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">المستخدم</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">UID</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">الدولة</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">الجنس</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResults.map(u => (
                          <BatchRow key={u.erbanNo} user={u} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
