import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, Database, Key, Zap, LayoutGrid, Users, Radio,
  AlertTriangle, RefreshCw, X,
} from "lucide-react";
import { Link } from "wouter";

interface SessionData {
  uid: string | null;
  ticket_prefix: string | null;
  ticket_age_min: number | null;
  ticket_valid_for_min: number | null;
  ticket_expired: boolean;
}

interface BalanceData {
  ok: boolean;
  diamondNum?: number;
  goldNum?: number;
  coin?: number;
}

interface Room {
  roomId: string | null;
  roomName: string | null;
  cover: string | null;
  onlineNum: number | null;
  uid: string | null;
}

interface RoomsData {
  ok: boolean;
  rooms: Room[];
  total: number | null;
}

export default function DittoCommandCenter() {
  const queryClient = useQueryClient();
  const [showInject, setShowInject] = useState(false);
  const [injectFields, setInjectFields] = useState({
    ticket: "", access_token: "", uid: "", netEaseToken: "", nimAppKey: "",
  });
  const [injectState, setInjectState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [injectMsg, setInjectMsg] = useState("");

  const { data: session, isLoading: sessionLoading } = useQuery<SessionData>({
    queryKey: ["/api/ditto/session"],
    queryFn: () => fetch("/api/ditto/session").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery<BalanceData>({
    queryKey: ["/api/ditto/balance"],
    queryFn: () => fetch("/api/ditto/balance").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: roomsData, isLoading: roomsLoading } = useQuery<RoomsData>({
    queryKey: ["/api/ditto/rooms", "POPULAR", 1, 4],
    queryFn: () => fetch("/api/ditto/rooms?tab=POPULAR&pageNum=1&pageSize=4").then(r => r.json()),
    refetchInterval: 60000,
  });

  const sessionExpired = !sessionLoading && session?.ticket_expired;

  async function handleInject(e: React.FormEvent) {
    e.preventDefault();
    setInjectState("loading");
    setInjectMsg("");
    try {
      const res = await fetch("/api/ditto/session/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(injectFields),
      });
      const data = await res.json() as { ok: boolean; uid?: string; ticket_prefix?: string; error?: string; hasNimToken?: boolean };
      if (data.ok) {
        setInjectState("ok");
        setInjectMsg(`تم حفظ الجلسة — UID: ${data.uid}, ticket: ${data.ticket_prefix}${data.hasNimToken ? " ✓ NIM" : ""}`);
        setInjectFields({ ticket: "", access_token: "", uid: "", netEaseToken: "", nimAppKey: "" });
        setShowInject(false);
        queryClient.invalidateQueries();
      } else {
        setInjectState("err");
        setInjectMsg(data.error ?? "فشل الحفظ");
      }
    } catch (err) {
      setInjectState("err");
      setInjectMsg(err instanceof Error ? err.message : "خطأ في الشبكة");
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          مركز القيادة — Ditto
        </h1>
        <p className="text-muted-foreground text-sm mt-1">مراقبة حالة الجلسة والرصيد والغرف الحية</p>
      </div>

      {/* Session expired banner */}
      {sessionExpired && !showInject && (
        <div className="border border-destructive/60 bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-destructive font-bold text-sm">الجلسة منتهية</p>
            <p className="text-muted-foreground text-xs mt-1">
              التذكرة غير صالحة — أدخل جلسة جديدة من تطبيق Ditto
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowInject(true)}>
            <RefreshCw className="w-3 h-3 mr-1" />
            إدخال جلسة
          </Button>
        </div>
      )}

      {/* Inject form */}
      {showInject && (
        <Card className="border-primary/40">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                إدخال جلسة جديدة
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setShowInject(false); setInjectState("idle"); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleInject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["uid", "access_token", "ticket"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs uppercase tracking-wider">{field.replace(/_/g, " ")}</Label>
                    <Input
                      value={injectFields[field]}
                      onChange={e => setInjectFields(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={field === "uid" ? "281306" : "32-char hex"}
                      className="font-mono text-xs h-9"
                      required
                    />
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">netEaseToken (اختياري — للشات)</Label>
                  <Input
                    value={injectFields.netEaseToken}
                    onChange={e => setInjectFields(p => ({ ...p, netEaseToken: e.target.value }))}
                    placeholder="from /acc/third/login"
                    className="font-mono text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">NIM App Key (اختياري)</Label>
                  <Input
                    value={injectFields.nimAppKey}
                    onChange={e => setInjectFields(p => ({ ...p, nimAppKey: e.target.value }))}
                    placeholder="override NIM key"
                    className="font-mono text-xs h-9"
                  />
                </div>
              </div>
              {injectMsg && (
                <p className={`text-xs font-medium ${injectState === "ok" ? "text-green-600" : "text-destructive"}`}>
                  {injectMsg}
                </p>
              )}
              <Button type="submit" disabled={injectState === "loading"} className="w-full">
                {injectState === "loading" ? "جاري الحفظ..." : "حفظ الجلسة"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              حالة الجلسة
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {sessionLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
            ) : session ? (
              <>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground text-xs">UID</span>
                  <span className="font-bold font-mono">{session.uid || "—"}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground text-xs">TICKET</span>
                  <span className="font-mono text-sm">{session.ticket_prefix || "—"}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground text-xs">عمر التذكرة (دقيقة)</span>
                  <span>{session.ticket_age_min ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">الحالة</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.ticket_expired ? "destructive" : "default"}>
                      {session.ticket_expired ? "منتهية" : "صالحة"}
                    </Badge>
                    {session.ticket_expired && (
                      <Button size="sm" variant="ghost" className="h-5 text-xs p-1" onClick={() => setShowInject(true)}>
                        تجديد
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-destructive text-sm font-medium">خطأ في بيانات الجلسة</p>
            )}
          </CardContent>
        </Card>

        {/* Balance card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              الرصيد
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {balanceLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
            ) : balance?.ok ? (
              <>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground text-xs">الماس 💎</span>
                  <span className="font-bold text-lg text-primary">{balance.diamondNum?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground text-xs">الذهب 🥇</span>
                  <span className="font-bold text-lg text-yellow-500">{balance.goldNum?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">كوينز 🪙</span>
                  <span className="font-bold text-lg">{balance.coin?.toLocaleString() ?? 0}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد بيانات رصيد — الجلسة قد تكون منتهية</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live rooms preview */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              الغرف الحية (POPULAR)
            </CardTitle>
            <Link href="/ditto-rooms" className="text-xs text-primary hover:underline font-medium">
              عرض الكل
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {roomsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-video" />)}
            </div>
          ) : roomsData?.rooms && roomsData.rooms.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {roomsData.rooms.map((room, i) => (
                <div key={room.roomId || i} className="relative aspect-video overflow-hidden rounded-lg border group">
                  <Badge className="absolute top-1.5 right-1.5 z-10 text-[10px] gap-1 py-0 h-4 bg-red-600">
                    <Radio className="w-2 h-2 animate-pulse" /> LIVE
                  </Badge>
                  {room.cover ? (
                    <img src={room.cover} alt={room.roomName || ""} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Zap className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 p-2 w-full">
                    <p className="text-white text-xs font-bold truncate">{room.roomName || "بدون اسم"}</p>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-white/70">UID: {room.uid}</span>
                      <span className="text-white/90 flex items-center gap-0.5 font-bold">
                        <Users className="w-2.5 h-2.5" /> {room.onlineNum?.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border rounded-lg border-dashed">
              لا توجد غرف حية — الجلسة قد تكون منتهية
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
