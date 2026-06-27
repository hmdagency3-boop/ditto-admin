import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, User, Hash, Users, Star, AlertTriangle, Radio,
  Car, Shield, Award, Zap,
} from "lucide-react";

type SearchMode = "uid" | "erban" | "name";

interface ExtendedProfile {
  ok?: boolean;
  uid?: string;
  nickname?: string | null;
  avatar?: string | null;
  signature?: string | null;
  erbanNo?: number | null;
  hasPrettyErbanNo?: boolean | null;
  fansNum?: number | null;
  followNum?: number | null;
  level?: number | null;
  diamond?: number | null;
  online?: boolean | null;
  countryCode?: string | null;
  countryName?: string | null;
  countryIcon?: string | null;
  countryGroup?: string | null;
  vipLevel?: number | null;
  vipName?: string | null;
  vipIcon?: string | null;
  svipInfo?: { level?: number } | null;
  gender?: number | null;
  age?: number | null;
  growthLevel?: number | null;
  growthLevelPic?: string | null;
  experLevel?: number | null;
  experLevelPic?: string | null;
  charmLevel?: number | null;
  charmLevelPic?: string | null;
  noLv?: number | null;
  carName?: string | null;
  carUrl?: string | null;
  headwearName?: string | null;
  headwearUrl?: string | null;
  ban?: number | null;
  userMedalList?: Array<{ id: number; url: string; name: string; expiration?: number }>;
  userWearPropList?: Array<{ propId: number; propName: string; coverImg?: string | null; expireSecond?: number | null; wear?: boolean }>;
  source?: string;
  workerUsed?: boolean;
  workerNeeded?: boolean;
}

interface GiftData {
  uid?: string;
  totalGiftsNum?: number | null;
  totalGiftTypes?: number | null;
  topGifts?: Array<{ giftId: unknown; giftName: string | null; num: number | null; icon: string | null }>;
}

interface SearchResult {
  ok: boolean;
  users: Array<{ uid: unknown; nickname: string | null; avatar: string | null; erbanNo: number | null; fansNum: number | null; level: number | null }>;
  workerNeeded?: boolean;
}

function InfoCell({ label, value, color, wide }: { label: string; value: unknown; color?: string; wide?: boolean }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className={`bg-muted/30 rounded p-2 ${wide ? "col-span-2 md:col-span-3" : ""}`}>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-semibold truncate ${color ?? ""}`}>{String(value)}</div>
    </div>
  );
}

function Avatar({ src, size = 10 }: { src?: string | null; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <User className="w-4 h-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function fmtExpiry(ts: number | null | undefined): string {
  if (ts == null || ts === -1) return "دائم";
  const d = new Date(ts);
  if (d.getFullYear() > 2100) return "دائم";
  return d.toLocaleDateString("ar-EG");
}

export default function DittoProfileSearch() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SearchMode>("uid");
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [erbanLoading, setErbanLoading] = useState(false);
  const [erbanError, setErbanError] = useState<string | null>(null);

  const { data: gifts, isLoading: giftsLoading } = useQuery<GiftData>({
    queryKey: ["/api/ditto/user", activeUid],
    queryFn: () => fetch(`/api/ditto/user/${activeUid}`).then(r => r.json()),
    enabled: !!activeUid && mode === "uid",
  });

  const { data: profileRaw, isLoading: profileLoading } = useQuery<ExtendedProfile>({
    queryKey: ["/api/ditto/user/profile", activeUid],
    queryFn: () => fetch(`/api/ditto/user/${activeUid}/profile`).then(r => r.json()),
    enabled: !!activeUid && mode === "uid",
  });

  const { data: searchResult, isLoading: searchLoading } = useQuery<SearchResult>({
    queryKey: ["/api/ditto/search", activeQuery],
    queryFn: () => fetch(`/api/ditto/search?q=${encodeURIComponent(activeQuery!)}`).then(r => r.json()),
    enabled: !!activeQuery && mode === "name",
  });

  const profile = profileRaw as ExtendedProfile | undefined;

  const drillIntoUid = (uid: unknown) => {
    if (!uid) return;
    setMode("uid");
    setInput(String(uid));
    setActiveUid(String(uid));
    setActiveQuery(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;

    if (mode === "uid") { setActiveUid(v); setActiveQuery(null); return; }
    if (mode === "name") { setActiveQuery(v); setActiveUid(null); return; }

    if (mode === "erban") {
      setErbanError(null);
      setErbanLoading(true);
      setActiveUid(null);
      setActiveQuery(null);
      try {
        const resp = await fetch(`/api/ditto/lookup/erban/${encodeURIComponent(v)}`);
        const json = await resp.json() as { ok: boolean; uid?: number | string; nick?: string; error?: string };
        if (!json.ok || !json.uid) {
          setErbanError(json.error ?? "المستخدم غير موجود");
        } else {
          drillIntoUid(json.uid);
        }
      } catch {
        setErbanError("خطأ في الشبكة");
      } finally {
        setErbanLoading(false);
      }
    }
  };

  const loading = erbanLoading || giftsLoading || profileLoading || searchLoading;
  const hasLevels = profile?.experLevel != null || profile?.charmLevel != null || profile?.growthLevel != null || profile?.noLv != null;
  const hasCar = !!(profile?.carName || profile?.carUrl);
  const isBanned = profile?.ban != null && profile.ban > 0;
  const medals = profile?.userMedalList ?? [];
  const wearProps = (profile?.userWearPropList ?? []).filter(p => p.wear);

  const sourceBadge = profile?.source === "public_api_v5"
    ? { label: "API V5", cls: "bg-blue-500/20 text-blue-600 border-blue-500/30" }
    : profile?.source === "live_room"
    ? { label: "LIVE", cls: "bg-red-500/20 text-red-600 border-red-500/30" }
    : profile?.ok
    ? { label: "DIRECT", cls: "bg-green-500/20 text-green-600 border-green-500/30" }
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          بحث عن ملف مستخدم Ditto
        </h1>
        <p className="text-muted-foreground text-sm mt-1">بحث بالـ UID أو الاسم أو رقم الـ ID</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-0 border rounded-md overflow-hidden w-fit">
        {([
          { key: "uid",   label: "بالـ UID" },
          { key: "erban", label: "بالـ ID"  },
          { key: "name",  label: "بالاسم"   },
        ] as { key: SearchMode; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setActiveUid(null); setActiveQuery(null); setInput(""); }}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              mode === key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              placeholder={mode === "uid" ? "أدخل UID مثل 281306..." : mode === "erban" ? "أدخل رقم الـ ID..." : "أدخل الاسم..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              className="h-11 text-base"
            />
            <Button type="submit" disabled={loading} className="h-11 px-6">
              {loading ? "جاري البحث..." : "بحث"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {erbanError && !loading && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/5 px-4 py-3 rounded-lg text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erbanError}
        </div>
      )}

      {!loading && searchResult && !searchResult.ok && searchResult.workerNeeded && (
        <div className="flex items-center gap-2 border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 rounded-lg text-yellow-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          البحث بالاسم يتطلب تشغيل الـ Worker على جهاز Windows
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Name search results */}
      {!loading && searchResult && searchResult.ok && mode === "name" && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                نتائج البحث
              </CardTitle>
              <span className="text-xs text-muted-foreground">{searchResult.users.length} نتيجة</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {searchResult.users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">لم يتم العثور على نتائج</div>
            ) : (
              <div className="divide-y">
                {searchResult.users.map((u, i) => (
                  <div
                    key={String(u.uid ?? i)}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => drillIntoUid(u.uid)}
                  >
                    <Avatar src={u.avatar} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.nickname ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        UID: {String(u.uid ?? "—")}{u.erbanNo ? ` | ID: ${u.erbanNo}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {u.fansNum != null && <div className="text-xs text-muted-foreground">{u.fansNum.toLocaleString()} متابع</div>}
                      {u.level != null && <div className="text-xs text-primary">Lv {u.level}</div>}
                    </div>
                    <span className="text-primary text-xs">›</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* UID Profile Results */}
      {!loading && activeUid && mode === "uid" && (gifts || profile) && (
        <div className="space-y-4">

          {/* Main profile card */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  الملف الشخصي
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {profile?.online === true && (
                    <Badge className="bg-red-500/20 text-red-600 border border-red-500/30 gap-1 text-[10px]">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> مباشر
                    </Badge>
                  )}
                  {isBanned && <Badge variant="destructive" className="text-[10px]">محظور</Badge>}
                  {sourceBadge && <Badge variant="outline" className={`text-[10px] ${sourceBadge.cls}`}>{sourceBadge.label}</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex gap-5 items-start">
                {/* Avatar */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                    {profile?.avatar ? (
                      <img src={profile.avatar} alt="" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <User className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  {profile?.countryIcon && (
                    <img src={profile.countryIcon} alt={profile.countryCode ?? ""} className="w-7 h-5 object-cover rounded" />
                  )}
                  {profile?.vipIcon && (
                    <img src={profile.vipIcon} alt="VIP" className="h-6 object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  {profile?.gender != null && (
                    <Badge variant="outline" className={`text-[10px] ${profile.gender === 1 ? "border-blue-500 text-blue-500" : "border-pink-500 text-pink-500"}`}>
                      {profile.gender === 1 ? "ذكر" : "أنثى"}
                    </Badge>
                  )}
                </div>

                {/* Info grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                  <InfoCell label="UID" value={gifts?.uid ?? activeUid} color="text-primary" />
                  <InfoCell label="الاسم" value={profile?.nickname} />
                  <InfoCell label="رقم الـ ID" value={profile?.erbanNo != null ? `${profile.erbanNo}${profile.hasPrettyErbanNo ? " ✦" : ""}` : undefined} />
                  <InfoCell label="الدولة" value={profile?.countryName ?? profile?.countryCode} />
                  <InfoCell label="المجموعة" value={profile?.countryGroup} />
                  <InfoCell label="ترتيب المجموعة" value={profile?.countryGroup ? profile.countryGroupRank : undefined} />
                  <InfoCell label="العمر" value={profile?.age != null ? `${profile.age} سنة` : undefined} />
                  <InfoCell label="VIP" value={profile?.vipName || (profile?.vipLevel ? `Level ${profile.vipLevel}` : undefined)} color="text-yellow-500" />
                  <InfoCell label="SVIP" value={profile?.svipInfo?.level ? `Level ${profile.svipInfo.level}` : undefined} color="text-purple-500" />
                  <InfoCell label="المتابعون" value={profile?.fansNum?.toLocaleString()} />
                  <InfoCell label="الماس" value={profile?.diamond != null ? String(profile.diamond) : undefined} color="text-blue-400" />
                  {profile?.signature && <InfoCell label="التوقيع" value={profile.signature} wide />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gifts card */}
          {gifts && ((gifts.totalGiftsNum ?? 0) > 0 || (gifts.topGifts?.length ?? 0) > 0) && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  الهدايا المستلمة
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex gap-6 mb-4 text-sm">
                  {gifts.totalGiftsNum != null && (
                    <div><span className="text-muted-foreground ml-1">إجمالي:</span><span className="font-bold">{gifts.totalGiftsNum.toLocaleString()}</span></div>
                  )}
                  {gifts.totalGiftTypes != null && (
                    <div><span className="text-muted-foreground ml-1">أنواع:</span><span className="font-bold">{gifts.totalGiftTypes}</span></div>
                  )}
                </div>
                {gifts.topGifts && gifts.topGifts.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                    {gifts.topGifts.map((g, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 text-center">
                        {g.icon ? (
                          <img src={g.icon} alt={g.giftName ?? ""} className="w-10 h-10 object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Star className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground truncate w-full">{g.giftName}</span>
                        {g.num && <span className="text-[10px] font-bold text-primary">×{g.num.toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Levels card */}
          {hasLevels && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  المستويات
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {profile?.experLevel != null && (
                    <div className="border rounded-lg p-3 flex flex-col items-center gap-1">
                      {profile.experLevelPic && <img src={profile.experLevelPic} alt="" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <div className="text-[10px] text-muted-foreground">الخبرة</div>
                      <div className="text-xl font-bold text-yellow-500">Lv {profile.experLevel}</div>
                    </div>
                  )}
                  {profile?.charmLevel != null && (
                    <div className="border rounded-lg p-3 flex flex-col items-center gap-1">
                      {profile.charmLevelPic && <img src={profile.charmLevelPic} alt="" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <div className="text-[10px] text-muted-foreground">السحر</div>
                      <div className="text-xl font-bold text-pink-500">Lv {profile.charmLevel}</div>
                    </div>
                  )}
                  {profile?.growthLevel != null && (
                    <div className="border rounded-lg p-3 flex flex-col items-center gap-1">
                      {profile.growthLevelPic ? <img src={profile.growthLevelPic} alt="" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Shield className="w-6 h-6 text-green-500" />}
                      <div className="text-[10px] text-muted-foreground">النمو</div>
                      <div className="text-xl font-bold text-green-500">Lv {profile.growthLevel}</div>
                    </div>
                  )}
                  {profile?.noLv != null && (
                    <div className="border rounded-lg p-3 flex flex-col items-center gap-1">
                      <Hash className="w-6 h-6 text-orange-500" />
                      <div className="text-[10px] text-muted-foreground">مستوى الغرفة</div>
                      <div className="text-xl font-bold text-orange-500">Lv {profile.noLv}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Car + Headwear */}
          {(hasCar || profile?.headwearName) && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  الإكسسوارات
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex gap-6 flex-wrap">
                {hasCar && (
                  <div className="flex items-center gap-3">
                    {profile?.carUrl && <img src={profile.carUrl} alt="" className="h-12 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <div>
                      <div className="text-[10px] text-muted-foreground">السيارة</div>
                      <div className="font-semibold text-sm">{profile?.carName}</div>
                    </div>
                  </div>
                )}
                {profile?.headwearName && (
                  <div className="flex items-center gap-3">
                    {profile.headwearUrl && <img src={profile.headwearUrl} alt="" className="h-12 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <div>
                      <div className="text-[10px] text-muted-foreground">الإطار</div>
                      <div className="font-semibold text-sm">{profile.headwearName}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Medals */}
          {medals.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  الميداليات ({medals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex gap-3 flex-wrap">
                  {medals.map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 border rounded-lg p-2 min-w-16">
                      <img src={m.url} alt={m.name} className="h-8 object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <span className="text-[10px] text-center text-muted-foreground leading-tight">{m.name}</span>
                      {m.expiration && <span className="text-[9px] text-muted-foreground">{fmtExpiry(m.expiration)}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wear props */}
          {wearProps.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  العناصر المرتداة
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {wearProps.map((p, i) => (
                    <div key={i} className="border rounded-lg p-3 flex items-center gap-3">
                      {p.coverImg && <img src={p.coverImg} alt="" className="w-10 h-10 object-contain rounded"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.propName}</div>
                        {p.expireSecond != null && <div className="text-[10px] text-muted-foreground">{fmtExpiry(p.expireSecond)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
