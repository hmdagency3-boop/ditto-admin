import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutGrid, Users, Radio, User, Zap, Copy, Check, Loader2, X,
  Headphones, Mic, Search, XCircle,
} from "lucide-react";
import AgoraRTC, {
  IRemoteAudioTrack, IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";
import { useDittoSession, AGORA_APP_ID, SESSION_UID } from "@/contexts/DittoSessionContext";

const TABS = ["POPULAR", "EG", "SA", "AE"];

type ListenState = "idle" | "fetching" | "connecting" | "listening" | "error";
type TalkState   = "idle" | "fetching" | "connecting" | "talking"   | "error";

interface Room {
  roomId:      number | string | null;
  roomName:    string | null;
  cover:       string | null;
  onlineNum:   number | null;
  uid:         number | string | null;
  nick:        string | null;
  erbanNo:     number | null;
  countryCode: string | null;
  countryName: string | null;
  countryIcon: string | null;
  vipLevel:    number | null;
  vipName:     string | null;
  gender:      number | null;
  roomDesc:    string | null;
  hotScore:    number | null;
}

interface RoomsData { ok: boolean; rooms: Room[]; total: number | null; }

export default function DittoRooms() {
  const [activeTab,     setActiveTab]     = useState(TABS[0]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [searchResults, setSearchResults] = useState<Room[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,   setSearchError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearchMode = searchQuery.length > 0;

  const {
    activeSession, setActiveSession,
    setAgoraPublisherUids, setIsMicMuted, stopSession,
  } = useDittoSession();

  const { data: roomList, isLoading } = useQuery<RoomsData>({
    queryKey: ["/api/ditto/rooms", activeTab],
    queryFn:  () => fetch(`/api/ditto/rooms?tab=${activeTab}&pageNum=1&pageSize=30`).then(r => r.json()),
    refetchInterval: 30000,
    enabled: !isSearchMode,
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res  = await fetch(`/api/ditto/rooms/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { ok: boolean; rooms: Room[] };
      if (data.ok) setSearchResults(data.rooms);
      else { setSearchError("لم يتم العثور على نتائج"); setSearchResults([]); }
    } catch { setSearchError("خطأ في الشبكة"); setSearchResults([]); }
    finally  { setSearchLoading(false); }
  }

  function clearSearch() {
    setSearchQuery(""); setSearchInput(""); setSearchResults(null); setSearchError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function buildJoinHandlers(room: Room) {
    const roomIdStr = String(room.roomId);

    const onListen = async (token: string) => {
      await stopSession();
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await client.setClientRole("audience");
      const audioTracks: IRemoteAudioTrack[] = [];
      const videoTracks: IRemoteVideoTrack[]  = [];

      client.on("user-published", async (user, mediaType) => {
        setAgoraPublisherUids(prev => [...new Set([...prev, user.uid as number])]);
        if (mediaType === "audio") {
          const track = await client.subscribe(user, mediaType);
          audioTracks.push(track); track.play();
          setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
        } else if (mediaType === "video") {
          const track = await client.subscribe(user, "video") as IRemoteVideoTrack;
          videoTracks.push(track);
          setActiveSession(prev => prev ? { ...prev, videoTracks: [...prev.videoTracks, track] } : prev);
        }
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") setAgoraPublisherUids(prev => prev.filter(id => id !== (user.uid as number)));
        if (mediaType === "video") setActiveSession(prev => prev ? { ...prev, videoTracks: [] } : prev);
      });
      client.on("user-left", user => {
        setAgoraPublisherUids(prev => prev.filter(id => id !== (user.uid as number)));
      });

      await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);

      for (const u of client.remoteUsers) {
        setAgoraPublisherUids(prev => [...new Set([...prev, u.uid as number])]);
        if (u.hasAudio) { try { const t = await client.subscribe(u, "audio"); audioTracks.push(t); t.play(); } catch {} }
        if (u.hasVideo) { try { const t = await client.subscribe(u, "video") as IRemoteVideoTrack; videoTracks.push(t); } catch {} }
      }
      setActiveSession({
        roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "",
        client, audioTracks, videoTracks, muted: false, localTrack: null, isTalking: false, micMuted: false,
      });
    };

    const onTalk = async (token: string) => {
      await stopSession();
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await client.setClientRole("host");
      const audioTracks: IRemoteAudioTrack[] = [];
      const videoTracks: IRemoteVideoTrack[]  = [];

      client.on("user-published", async (user, mediaType) => {
        setAgoraPublisherUids(prev => [...new Set([...prev, user.uid as number])]);
        if (mediaType === "audio") {
          const track = await client.subscribe(user, mediaType);
          audioTracks.push(track); track.play();
          setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, track] } : prev);
        } else if (mediaType === "video") {
          const track = await client.subscribe(user, "video") as IRemoteVideoTrack;
          videoTracks.push(track);
          setActiveSession(prev => prev ? { ...prev, videoTracks: [...prev.videoTracks, track] } : prev);
        }
      });
      client.on("user-left", user => {
        setAgoraPublisherUids(prev => prev.filter(id => id !== (user.uid as number)));
      });

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "music_standard", AEC: true, ANS: true, AGC: true });
      await client.join(AGORA_APP_ID, roomIdStr, token, SESSION_UID);

      for (const u of client.remoteUsers) {
        setAgoraPublisherUids(prev => [...new Set([...prev, u.uid as number])]);
        if (u.hasAudio) { try { const t = await client.subscribe(u, "audio"); audioTracks.push(t); t.play(); } catch {} }
        if (u.hasVideo) { try { const t = await client.subscribe(u, "video") as IRemoteVideoTrack; videoTracks.push(t); } catch {} }
      }
      await client.publish([localTrack]);
      setActiveSession({
        roomId: roomIdStr, roomName: room.nick ?? room.roomName ?? "",
        client, audioTracks, videoTracks, muted: false, localTrack, isTalking: true, micMuted: false,
      });
      setIsMicMuted(false);
    };

    return { onListen, onTalk };
  }

  const displayRooms = isSearchMode ? (searchResults ?? []) : (roomList?.rooms ?? []);

  return (
    <div className="p-6 space-y-4 font-mono">
      {/* Header */}
      <header className="border-b border-border pb-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
              <LayoutGrid className="w-6 h-6" /> الغرف الحية
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSearchMode
                ? searchLoading ? "جاري البحث..." : `${searchResults?.length ?? 0} نتيجة لـ "${searchQuery}"`
                : roomList?.total != null ? `${roomList.total} بث نشط` : "تصفح البث المباشر"}
            </p>
          </div>
          {!isSearchMode && (
            <div className="flex gap-0 border border-border w-fit">
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input ref={inputRef} type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="ابحث بالـ ID أو الاسم..."
              className="w-full bg-background border border-border border-r-0 pl-9 pr-9 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 h-9" />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="submit" disabled={!searchInput.trim() || searchLoading}
            className="border border-border bg-primary/10 text-primary hover:bg-primary/20 px-4 h-9 text-xs font-bold tracking-widest uppercase transition-colors disabled:opacity-40 flex items-center gap-1.5">
            {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} بحث
          </button>
          {isSearchMode && (
            <button type="button" onClick={clearSearch}
              className="border border-border bg-background text-muted-foreground hover:text-foreground px-3 h-9 text-xs font-bold uppercase transition-colors flex items-center gap-1">
              <X className="w-3 h-3" /> مسح
            </button>
          )}
        </form>
      </header>

      {/* Room grid */}
      {isSearchMode && searchError && (
        <div className="border border-destructive/40 bg-destructive/5 p-4 text-destructive text-xs font-bold">⚠ {searchError}</div>
      )}
      {(isLoading && !isSearchMode) || (isSearchMode && searchLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-none" />)}
        </div>
      ) : displayRooms.length === 0 ? (
        <div className="flex items-center justify-center border border-dashed border-border p-16 text-center text-muted-foreground mt-8">
          <div>
            <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold tracking-widest uppercase">{isSearchMode ? "NO_RESULTS" : "NO_NODES_FOUND"}</p>
            <p className="text-sm mt-2 opacity-60">{isSearchMode ? "لا توجد غرف بهذا البحث" : "لا توجد غرف نشطة"}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayRooms.map((room, idx) => {
            const { onListen, onTalk } = buildJoinHandlers(room);
            return (
              <RoomCard
                key={room.roomId ?? idx}
                room={room}
                isActiveRoom={activeSession?.roomId === String(room.roomId)}
                isTalking={activeSession?.isTalking ?? false}
                onListen={onListen}
                onTalk={onTalk}
                onStop={stopSession}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Room Card ──────────────────────────────────────────────────────────────────
interface RoomCardProps {
  room:        Room;
  isActiveRoom: boolean;
  isTalking:   boolean;
  onListen:    (token: string) => Promise<void>;
  onTalk:      (token: string) => Promise<void>;
  onStop:      () => Promise<void>;
}

function RoomCard({ room, isActiveRoom, isTalking, onListen, onTalk, onStop }: RoomCardProps) {
  const [showToken,    setShowToken]    = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [tokenData,    setTokenData]    = useState<{ ok: boolean; token?: string } | null>(null);
  const [tokenPending, setTokenPending] = useState(false);
  const [listenState,  setListenState]  = useState<ListenState>("idle");
  const [listenError,  setListenError]  = useState<string | null>(null);
  const [talkState,    setTalkState]    = useState<TalkState>("idle");
  const [talkError,    setTalkError]    = useState<string | null>(null);

  const roomId = room.roomId != null ? String(room.roomId) : null;

  // Reset card state when this room is no longer active
  useState(() => {
    if (!isActiveRoom) { setListenState("idle"); setTalkState("idle"); }
  });

  async function fetchToken(type: "1" | "0") {
    if (!roomId) return null;
    const res = await fetch("/api/ditto/trtc-token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, type, channel: "1" }),
    });
    return await res.json() as { ok: boolean; token?: string; error?: unknown };
  }

  async function handleGetToken(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;
    setShowToken(true); setTokenPending(true); setTokenData(null);
    const data = await fetchToken("1");
    setTokenData(data); setTokenPending(false);
  }

  async function handleListen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;
    if (isActiveRoom && !isTalking) { await onStop(); setListenState("idle"); setTalkState("idle"); return; }
    setListenState("fetching"); setListenError(null);
    try {
      const data = await fetchToken("1");
      if (!data?.ok || !data.token) throw new Error(String(data?.error ?? "Token fetch failed"));
      setListenState("connecting");
      await onListen(data.token);
      setListenState("listening");
    } catch (err) {
      setListenState("error");
      setListenError(err instanceof Error ? err.message : "Connection failed");
      setTimeout(() => { setListenState("idle"); setListenError(null); }, 4000);
    }
  }

  async function handleTalk(e: React.MouseEvent) {
    e.stopPropagation();
    if (!roomId) return;
    if (isActiveRoom && isTalking) { await onStop(); setTalkState("idle"); setListenState("idle"); return; }
    setTalkState("fetching"); setTalkError(null);
    try {
      const data = await fetchToken("0");
      if (!data?.ok || !data.token) throw new Error(String(data?.error ?? "Token fetch failed"));
      setTalkState("connecting");
      await onTalk(data.token);
      setTalkState("talking");
    } catch (err) {
      setTalkState("error");
      setTalkError(err instanceof Error ? err.message : "Mic access or connection failed");
      setTimeout(() => { setTalkState("idle"); setTalkError(null); }, 5000);
    }
  }

  const listenLabel = isActiveRoom && !isTalking ? "LIVE"
    : listenState === "fetching"   ? "TOKEN..."
    : listenState === "connecting" ? "JOINING..."
    : listenState === "error"      ? "ERROR"
    : "INTERCEPT";

  const talkLabel = isActiveRoom && isTalking ? "ON_AIR"
    : talkState === "fetching"   ? "TOKEN..."
    : talkState === "connecting" ? "JOINING..."
    : talkState === "error"      ? "ERROR"
    : "TALK";

  const busy = listenState === "fetching" || listenState === "connecting"
            || talkState   === "fetching" || talkState   === "connecting";

  return (
    <Card className={`rounded-none overflow-hidden group transition-colors relative flex flex-col ${isActiveRoom ? (isTalking ? "border-green-500" : "border-primary") : "border-border hover:border-primary/50"}`}>
      {/* Cover */}
      <div className="relative w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden shrink-0">
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-black/80 border border-primary/50 rounded-none font-bold gap-1 text-[10px] text-primary">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
          </Badge>
        </div>
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          {room.countryIcon && <img src={room.countryIcon} alt={room.countryCode ?? ""} className="w-5 h-4 object-cover border border-white/20" />}
          {room.vipName     && <span className="bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 leading-none tracking-wide">{room.vipName}</span>}
        </div>

        {room.cover ? (
          <img src={room.cover} alt="" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <User className="w-10 h-10 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-white">
          <Users className="w-3 h-3" /> {room.onlineNum?.toLocaleString() ?? 0}
        </div>

        {roomId && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
            {/* INTERCEPT */}
            <button onClick={handleListen} disabled={busy}
              className={`flex items-center gap-1 border text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isActiveRoom && !isTalking ? "bg-primary/20 border-primary text-primary" : listenState === "error" ? "bg-destructive/20 border-destructive text-destructive" : "bg-black/70 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary"}`}>
              {listenState === "fetching" || listenState === "connecting" ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : isActiveRoom && !isTalking
                  ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span>
                  : <Headphones className="w-2.5 h-2.5" />}
              {listenLabel}
            </button>
            {/* TALK */}
            <button onClick={handleTalk} disabled={busy}
              className={`flex items-center gap-1 border text-[10px] font-bold tracking-widest uppercase px-2 py-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isActiveRoom && isTalking ? "bg-green-500/20 border-green-500 text-green-400" : talkState === "error" ? "bg-destructive/20 border-destructive text-destructive" : "bg-black/70 border-green-500/40 text-green-400 hover:bg-green-500/20 hover:border-green-500"}`}>
              {talkState === "fetching" || talkState === "connecting" ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : isActiveRoom && isTalking
                  ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" /></span>
                  : <Mic className="w-2.5 h-2.5" />}
              {talkLabel}
            </button>
            {/* TRTC token */}
            <button onClick={handleGetToken}
              className="flex items-center gap-1 bg-black/70 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors px-2 py-1 text-[10px] font-bold tracking-widest uppercase">
              <Zap className="w-2.5 h-2.5" /> TRTC
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex gap-3 items-start flex-1">
        <div className="w-8 h-8 border border-border/50 overflow-hidden bg-muted flex items-center justify-center shrink-0">
          {room.cover ? <img src={room.cover} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <User className="w-4 h-4 text-muted-foreground/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground text-sm leading-tight truncate">{room.nick ?? room.roomName ?? "UNNAMED"}</div>
          {room.roomName && room.nick && room.roomName !== room.nick && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">{room.roomName}</div>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {room.erbanNo  != null && <span className="text-[10px] text-primary/70">ID:{room.erbanNo}</span>}
            {room.countryCode      && <span className="text-[10px] text-muted-foreground">{room.countryCode}</span>}
            {room.vipName          && <span className="text-[10px] text-yellow-400/80">{room.vipName}</span>}
          </div>
          {listenState === "error" && listenError && <p className="text-[10px] text-destructive mt-1 font-bold">⚠ {listenError}</p>}
          {talkState   === "error" && talkError   && <p className="text-[10px] text-destructive mt-1 font-bold">⚠ {talkError}</p>}
        </div>
      </div>

      {/* TRTC token panel */}
      {showToken && (
        <div className="border-t border-primary/30 bg-black/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-primary font-bold tracking-widest uppercase flex items-center gap-1"><Zap className="w-3 h-3" /> AGORA TOKEN</span>
            <button onClick={e => { e.stopPropagation(); setShowToken(false); setTokenData(null); setCopied(false); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
          {tokenPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Fetching...</div>
          ) : tokenData?.ok && tokenData.token ? (
            <>
              <div className="bg-background/80 border border-border/50 p-2"><p className="text-[9px] text-primary/70 font-mono break-all leading-relaxed">{tokenData.token}</p></div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span>ch: <span className="text-foreground font-bold">{roomId}</span></span>
                <span>appId: <span className="text-foreground font-bold">{AGORA_APP_ID.slice(0, 8)}…</span></span>
              </div>
              <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(tokenData.token!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
                className="w-full flex items-center justify-center gap-1.5 border border-border/50 hover:border-primary/50 text-[10px] font-bold tracking-widest uppercase py-1.5 transition-colors hover:text-primary">
                {copied ? <><Check className="w-3 h-3 text-green-400" /> COPIED</> : <><Copy className="w-3 h-3" /> COPY TOKEN</>}
              </button>
            </>
          ) : (
            <p className="text-[10px] text-destructive font-bold">{tokenData ? "FETCH_FAILED" : "NO_RESPONSE"}</p>
          )}
        </div>
      )}
    </Card>
  );
}
