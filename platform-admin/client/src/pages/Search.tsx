import { useState, useRef } from 'react';
import { Search as SearchIcon, X, LayoutGrid, List, UserSearch, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
        uid: d.uid || d.id || '',
        nick: d.nick || d.nickName || d.name || '',
        avatar: d.avatar || d.headImg || '',
        country: d.country || d.countryCode || '',
        gender: d.gender,
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
    erbanNo: sayyo.erbanNo,
    uid: sayyo.uid,
    nick: ditto?.nickName || sayyo.nick,
    avatar: ditto?.avatar || sayyo.avatar,
    country: ditto?.country || sayyo.country,
    gender: ditto?.gender ?? sayyo.gender,
    ditto,
    nobleName: ditto?.nobleName,
    chatGift: ditto?.chatGift,
    chatRange: ditto?.chatRange,
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

function genderLabel(g?: number, t?: (k: string) => string) {
  if (g === 1) return t ? t('search.male') : 'ذكر';
  if (g === 2) return t ? t('search.female') : 'أنثى';
  return '—';
}

function UserCard({ user, t }: { user: MergedUser; t: (k: string) => string }) {
  const avatar = user.avatar || user.ditto?.avatar;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative shrink-0">
          <Avatar className="h-20 w-20 ring-2 ring-primary/20">
            {avatar && <AvatarImage src={avatar} alt={user.nick} />}
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {user.nick ? user.nick[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          {user.ditto?.onLine && (
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{user.nick || '—'}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">#{user.erbanNo}</Badge>
            {user.uid && <Badge variant="secondary">UID: {user.uid}</Badge>}
            {user.nobleName && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">👑 {user.nobleName}</Badge>}
            {user.ditto?.onLine && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('search.online')}</Badge>}
            {user.ditto?.ban !== 1 && user.ditto && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{t('search.safe')}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoBlock title={t('search.basicInfo')} rows={[
          { label: t('search.erban'), value: user.erbanNo },
          { label: t('search.uid'), value: user.uid || '—' },
          { label: t('search.name'), value: user.nick || '—' },
          { label: t('search.country'), value: user.country || '—' },
          { label: t('search.gender'), value: genderLabel(user.gender, t) },
        ]} />
        {user.ditto && (
          <InfoBlock title={t('search.platformInfo')} rows={[
            { label: t('search.status'), value: user.ditto.onLine ? t('search.online') : '—' },
            { label: t('search.ban'), value: user.ditto.ban !== 1 ? t('search.safe') : '—' },
            { label: t('search.gifts'), value: user.chatGift === 1 ? t('search.enabled') : t('search.disabled') },
            { label: t('search.chatRange'), value: user.chatRange === 1 ? t('search.public') : t('search.private') },
          ]} />
        )}
      </div>
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div className="space-y-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="font-medium text-end truncate">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchCard({ user, t }: { user: MergedUser; t: (k: string) => string }) {
  const avatar = user.avatar || user.ditto?.avatar;
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {avatar && <AvatarImage src={avatar} />}
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {user.nick ? user.nick[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          {user.ditto?.onLine && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{user.nick || '—'}</p>
          <p className="text-xs text-muted-foreground">#{user.erbanNo}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {user.country && <Badge variant="outline" className="text-xs px-1.5 py-0">{user.country}</Badge>}
        {user.nobleName && <Badge className="text-xs px-1.5 py-0 bg-amber-100 text-amber-800">👑</Badge>}
        {user.ditto?.onLine && <Badge className="text-xs px-1.5 py-0 bg-green-100 text-green-800">🟢</Badge>}
        {user.ditto?.ban !== 1 && user.ditto && <Badge className="text-xs px-1.5 py-0 bg-emerald-100 text-emerald-800">✅</Badge>}
      </div>
    </div>
  );
}

function BatchRow({ user, t }: { user: MergedUser; t: (k: string) => string }) {
  const avatar = user.avatar || user.ditto?.avatar;
  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {avatar && <AvatarImage src={avatar} />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {user.nick ? user.nick[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{user.nick || '—'}</p>
            <p className="text-xs text-muted-foreground">#{user.erbanNo}</p>
          </div>
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">{user.uid}</td>
      <td className="p-3 text-sm">{user.country || '—'}</td>
      <td className="p-3 text-sm">{genderLabel(user.gender, t)}</td>
      <td className="p-3">
        <div className="flex gap-1 flex-wrap">
          {user.ditto?.onLine && <Badge className="text-xs bg-green-100 text-green-800">🟢</Badge>}
          {user.ditto?.ban !== 1 && user.ditto && <Badge className="text-xs bg-emerald-100 text-emerald-800">✅</Badge>}
          {user.nobleName && <Badge className="text-xs bg-amber-100 text-amber-800">👑</Badge>}
        </div>
      </td>
    </tr>
  );
}

export default function SearchPage() {
  const { t, lang } = useLang();

  // Single search
  const [singleInput, setSingleInput] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<MergedUser | null | 'not_found'>(null);

  // Batch search
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
    <div className="p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserSearch className="h-8 w-8" />
          {t('search.title')}
        </h1>
        <p className="text-muted-foreground mt-1">Sayyouditto + Dittoparty APIs</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="single">{t('search.single')}</TabsTrigger>
          <TabsTrigger value="batch">{t('search.batch')}</TabsTrigger>
        </TabsList>

        {/* ── Single Search ── */}
        <TabsContent value="single" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  placeholder={t('search.placeholder')}
                  value={singleInput}
                  onChange={e => setSingleInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSingleSearch()}
                  disabled={singleLoading}
                  className="flex-1"
                />
                {singleInput && (
                  <Button variant="ghost" size="icon" onClick={() => { setSingleInput(''); setSingleResult(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button onClick={handleSingleSearch} disabled={singleLoading || !singleInput.trim()}>
                  {singleLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <SearchIcon className="h-4 w-4" />
                  }
                  <span className="mr-1 hidden sm:inline">{singleLoading ? t('search.loading') : t('search.btn')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {singleResult === null && (
            <div className="text-center py-16 text-muted-foreground">
              <UserSearch className="h-16 w-16 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium mb-1">{t('search.title')}</p>
              <p className="text-sm">{t('search.empty')}</p>
            </div>
          )}

          {singleResult === 'not_found' && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <X className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{t('search.noResult')}</p>
              </CardContent>
            </Card>
          )}

          {singleResult && singleResult !== 'not_found' && (
            <Card>
              <CardContent className="pt-4">
                <UserCard user={singleResult} t={t} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Batch Search ── */}
        <TabsContent value="batch" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Textarea
                placeholder={t('search.batchPlaceholder')}
                value={batchInput}
                onChange={e => setBatchInput(e.target.value)}
                rows={6}
                disabled={batchLoading}
                className="font-mono text-sm resize-none"
                dir="ltr"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {batchInput.split('\n').filter(l => l.trim()).length} {t('search.erban')}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setBatchInput(''); setBatchResults([]); setBatchProgress(0); setBatchTotal(0); }}>
                    <X className="h-3 w-3 mr-1" />{t('search.clear')}
                  </Button>
                  <Button onClick={handleBatchSearch} disabled={batchLoading || !batchInput.trim()}>
                    {batchLoading
                      ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      : <SearchIcon className="h-4 w-4 mr-1" />
                    }
                    {batchLoading ? t('search.loading') : t('search.batchBtn')}
                  </Button>
                </div>
              </div>

              {batchLoading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('search.progress')}</span>
                    <span>{batchProgress}/{batchTotal} ({progressPct}%)</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {!batchLoading && batchResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <UserSearch className="h-14 w-14 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('search.batchEmpty')}</p>
            </div>
          )}

          {batchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {batchResults.length} {batchResults.length === 1 ? t('search.found') : t('search.results')}
                </span>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {t('search.viewGrid')}
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-3.5 w-3.5" />
                    {t('search.viewTable')}
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {batchResults.map(u => (
                    <BatchCard key={u.erbanNo} user={u} t={t} />
                  ))}
                </div>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-start p-3 font-medium">{t('search.name')}</th>
                          <th className="text-start p-3 font-medium">UID</th>
                          <th className="text-start p-3 font-medium">{t('search.country')}</th>
                          <th className="text-start p-3 font-medium">{t('search.gender')}</th>
                          <th className="text-start p-3 font-medium">{t('search.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResults.map(u => (
                          <BatchRow key={u.erbanNo} user={u} t={t} />
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
