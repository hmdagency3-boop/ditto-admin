import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid, Users, Radio, User, Copy, Check, Loader2, X,
  Volume2, VolumeX, Mic, MicOff, Search, XCircle, MessageSquare,
  Video, VideoOff, Headphones,
} from "lucide-react";

const TABS = ["POPULAR", "EG", "SA", "AE"];
const AGORA_APP_ID = "1b77c926d478406cae3174ce0565db4b";
const SESSION_UID = 281306;

interface Room {
  roomId: string | null;
  roomName: string | null;
  cover: string | null;
  onlineNum: number | null;
  uid: string | null;
  nick: string | null;
  erbanNo: number | null;
  countryCode: string | null;
  countryName: string | null;
  countryIcon: string | null;
  gender: number | null;
  roomDesc: string | null;
  hotScore: number | null;
}

interface RoomsData {
  ok: boolean;
  rooms: Room[];
  total: number | null;
}

interface TrtcTokenData {
  ok: boolean;
  token?: string;
  privateMapKey?: string;
  channel?: number;
  error?: unknown;
}

type ListenState = "idle" | "fetching" | "connecting" | "listening" | "error";

interface ActiveSession {
  roomId: string;
  roomName: string;
  client: any;
  audioTracks: any[];
  videoTracks: any[];
  muted: boolean;
  localTrack: any | null;
  isTalking: boolean;
  micMuted: boolean;
}

interface ChatMessage {
  id: string;
  uid: string;
  nick: string;
  text: string;
  ts: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function DittoRooms() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<"idle" | "connecting" | "connected" | "failed" | "no_credentials">("idle");
  const nimChatroomRef = useRef<unknown>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<Room[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearchMode = searchQuery.length > 0;

  // Listen states per room
  const [listenStates, setListenStates] = useState<Record<string, ListenState>>({});

  // Agora publisher UIDs
  const [agoraPublisherUids, setAgoraPublisherUids] = useState<number[]>([]);

  const { data: roomList, isLoading } = useQuery<RoomsData>({
    queryKey: ["/api/ditto/rooms", activeTab],
    queryFn: () => fetch(`/api/ditto/rooms?tab=${activeTab}&pageNum=1&pageSize=30`).then(r => r.json()),
    refetchInterval: 30000,
    enabled: !isSearchMode,
  });

  // Play video tracks
  useEffect(() => {
    if (!videoOpen) return;
    const tracks = activeSession?.videoTracks ?? [];
    const container = videoContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    tracks.forEach((track: any) => {
      const el = document.createElement("div");
      el.style.cssText = "width:100%;height:100%;position:absolute;inset:0";
      container.appendChild(el);
      try { track.play(el); } catch {}
    });
  }, [activeSession?.videoTracks, videoOpen]);

  // Auto-open video panel when track arrives
  useEffect(() => {
    if ((activeSession?.videoTracks.length ?? 0) > 0) setVideoOpen(true);
  }, [activeSession?.videoTracks?.length]);

  // NIM chat
  useEffect(() => {
    if (!activeSession) {
      if (nimChatroomRef.current) {
        try { (nimChatroomRef.current as any).exit(); } catch {}
        nimChatroomRef.current = null;
      }
      setChatMessages([]);
      setChatStatus("idle");
      return;
    }
    setChatStatus("connecting");
    setChatMessages([]);
    let cancelled = false;

    (async () => {
      try {
        const [credsRes, addrRes] = await Promise.all([
          fetch("/api/ditto/nim-credentials"),
          fetch("/api/ditto/nim-addresses"),
        ]);
        const creds = await credsRes.json() as { ok: boolean; nimAppKey: string; nimAccount: string | null; nimToken: string | null; hasToken: boolean };
        const addrData = await addrRes.json() as { ok: boolean; addresses: string[] };
        if (cancelled) return;
        if (!creds.hasToken || !creds.nimToken) { if (!cancelled) setChatStatus("no_credentials"); return; }

        const ChatroomMod = await import("nim-web-sdk-ng/dist/v1/CHATROOM_BROWSER_SDK.js" as any);
        const Chatroom = (ChatroomMod as any).default ?? ChatroomMod;
        if (cancelled) return;

        const chatroomAddresses: string[] = addrData.addresses ?? [];
        if (chatroomAddresses.length === 0) { if (!cancelled) setChatStatus("no_credentials"); return; }

        const chatroom = Chatroom.getInstance({
          appkey: creds.nimAppKey,
          account: creds.nimAccount ?? "0",
          token: creds.nimToken,
          chatroomId: String(activeSession.roomId),
          chatroomNick: "monitor",
          chatroomAddresses,
          onconnect: () => { if (!cancelled) setChatStatus("connected"); },
          onmsgs: (msgs: any[]) => {
            if (cancelled) return;
            const newMsgs: ChatMessage[] = msgs
              .filter(m => m.type === "text" || m.text || m.type === "custom")
              .map(m => ({
                id: m.idClient ?? (Date.now() + Math.random()).toString(),
                uid: m.fromAccount ?? "?",
                nick: m.fromNick ?? "",
                text: m.text ?? JSON.stringify(m.attach ?? ""),
                ts: m.time ?? Date.now(),
              }));
            if (newMsgs.length > 0) {
              setChatMessages(prev => [...prev, ...newMsgs].slice(-300));
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
          },
          ondisconnect: () => { if (!cancelled) setChatStatus("idle"); },
          onerror: () => { if (!cancelled) setChatStatus("failed"); },
        });
        nimChatroomRef.current = chatroom;
      } catch { if (!cancelled) setChatStatus("failed"); }
    })();

    return () => {
      cancelled = true;
      if (nimChatroomRef.current) {
        try { (nimChatroomRef.current as any).exit(); } catch {}
        nimChatroomRef.current = null;
      }
    };
  }, [activeSession?.roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  useEffect(() => {
    return () => {
      if (activeSession) {
        activeSession.audioTracks.forEach((t: any) => t.stop());
        if (activeSession.localTrack) { activeSession.localTrack.stop(); activeSession.localTrack.close(); }
        activeSession.client.leave().catch(() => {});
      }
    };
  }, []);

  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      activeSession.audioTracks.forEach((t: any) => t.stop());
      activeSession.videoTracks.forEach((t: any) => t.stop());
      if (activeSession.localTrack) { activeSession.localTrack.stop(); activeSession.localTrack.close(); }
      await activeSession.client.leave();
    } catch {}
    setActiveSession(null);
    setIsMuted(false);
    setIsMicMuted(false);
    setVideoOpen(false);
    setChatOpen(false);
    setAgoraPublisherUids([]);
  }, [activeSession]);

  const toggleMute = useCallback(() => {
    if (!activeSession) return;
    const newMuted = !isMuted;
    activeSession.audioTracks.forEach((t: any) => { if (newMuted) t.stop(); else t.play(); });
    setIsMuted(newMuted);
  }, [activeSession, isMuted]);

  const toggleMic = useCallback(async () => {
    if (!activeSession?.localTrack) return;
    const newMicMuted = !isMicMuted;
    await activeSession.localTrack.setMuted(newMicMuted);
    setIsMicMuted(newMicMuted);
  }, [activeSession, isMicMuted]);

  async function startListening(room: Room) {
    if (!room.roomId) return;
    const roomId = String(room.roomId);
    setListenStates(p => ({ ...p, [roomId]: "fetching" }));
    try {
      const tokenRes = await fetch("/api/ditto/trtc-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const tokenData = await tokenRes.json() as TrtcTokenData;
      if (!tokenData.ok || !tokenData.token) {
        setListenStates(p => ({ ...p, [roomId]: "error" }));
        setTimeout(() => setListenStates(p => ({ ...p, [roomId]: "idle" })), 3000);
        return;
      }

      setListenStates(p => ({ ...p, [roomId]: "connecting" }));
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(4);
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await client.setClientRole("audience");
      await client.join(AGORA_APP_ID, roomId, tokenData.token, SESSION_UID);

      const audioTracks: any[] = [];
      const videoTracks: any[] = [];
      const publisherUids: number[] = [];

      client.on("user-published", async (remoteUser: any, mediaType: "audio" | "video") => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === "audio") {
          remoteUser.audioTrack?.play();
          audioTracks.push(remoteUser.audioTrack);
          setActiveSession(prev => prev ? { ...prev, audioTracks: [...prev.audioTracks, remoteUser.audioTrack] } : prev);
        }
        if (mediaType === "video") {
          videoTracks.push(remoteUser.videoTrack);
          setActiveSession(prev => prev ? { ...prev, videoTracks: [...prev.videoTracks, remoteUser.videoTrack] } : prev);
        }
        if (!publisherUids.includes(remoteUser.uid)) {
          publisherUids.push(remoteUser.uid);
          setAgoraPublisherUids(prev => [...new Set([...prev, remoteUser.uid])]);
        }
      });

      client.on("user-unpublished", (remoteUser: any, mediaType: "audio" | "video") => {
        if (mediaType === "audio") {
          setActiveSession(prev => prev ? { ...prev, audioTracks: prev.audioTracks.filter((t: any) => t !== remoteUser.audioTrack) } : prev);
        }
        if (mediaType === "video") {
          setActiveSession(prev => prev ? { ...prev, videoTracks: prev.videoTracks.filter((t: any) => t !== remoteUser.videoTrack) } : prev);
        }
      });

      setActiveSession({ roomId, roomName: room.roomName ?? "", client, audioTracks, videoTracks, muted: false, localTrack: null, isTalking: false, micMuted: false });
      setListenStates(p => ({ ...p, [roomId]: "listening" }));
    } catch {
      setListenStates(p => ({ ...p, [roomId]: "error" }));
      setTimeout(() => setListenStates(p => ({ ...p, [roomId]: "idle" })), 3000);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/ditto/rooms/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { ok: boolean; rooms: Room[] };
      if (data.ok) setSearchResults(data.rooms);
      else { setSearchError("لم يتم العثور على نتائج"); setSearchResults([]); }
    } catch {
      setSearchError("خطأ في الشبكة");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchInput("");
    setSearchResults(null);
    setSearchError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const displayRooms = isSearchMode ? (searchResults ?? []) : (roomList?.rooms ?? []);

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="border-b pb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" />
              الغرف الحية
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSearchMode
                ? searchLoading ? "جاري البحث..." : `${searchResults?.length ?? 0} نتيجة لـ "${searchQuery}"`
                : roomList?.total != null ? `${roomList.total} بث نشط` : "تصفح البث المباشر"}
            </p>
          </div>
          {!isSearchMode && (
            <div className="flex gap-0 border rounded-md overflow-hidden w-fit">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-0 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="ابحث بالـ ID أو الاسم..."
              className="w-full bg-background border border-border border-r-0 pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary h-9 rounded-l-md"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); if (!isSearchMode) inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={!searchInput.trim() || searchLoading} size="sm" className="rounded-l-none h-9 px-4">
            {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            <span className="ml-1">بحث</span>
          </Button>
          {isSearchMode && (
            <Button type="button" variant="outline" size="sm" onClick={clearSearch} className="ml-2 h-9">
              <X className="w-3 h-3 mr-1" /> مسح
            </Button>
          )}
        </form>
      </div>

      {/* Active session bar */}
      {activeSession && (
        <div className={`shrink-0 border rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${activeSession.isTalking ? "border-green-500/50 bg-green-500/5" : "border-primary/50 bg-primary/5"}`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute h-full w-full rounded-full opacity-75 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`}></span>
            </span>
            <span className={`text-xs font-bold ${activeSession.isTalking ? "text-green-600" : "text-primary"}`}>
              {activeSession.isTalking ? "يبث" : "يستمع"}
            </span>
            <span className="text-xs text-muted-foreground">
              غرفة <span className="text-foreground font-bold">{activeSession.roomId}</span>
              {activeSession.roomName && <> · <span className="truncate max-w-[150px] inline-block align-bottom">{activeSession.roomName}</span></>}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={isMuted ? "destructive" : "outline"} className="h-7 text-xs gap-1" onClick={toggleMute}>
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {isMuted ? "مكتوم" : "صوت"}
            </Button>
            <Button size="sm" variant={videoOpen ? "default" : "outline"} className="h-7 text-xs gap-1 relative" onClick={() => setVideoOpen(o => !o)}>
              {(activeSession.videoTracks.length ?? 0) > 0 ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              فيديو
              {(activeSession.videoTracks.length ?? 0) > 0 && <span className="absolute -top-1 -right-1 bg-green-400 w-2 h-2 rounded-full animate-pulse" />}
            </Button>
            <Button size="sm" variant={chatOpen ? "default" : "outline"} className="h-7 text-xs gap-1 relative" onClick={() => setChatOpen(o => !o)}>
              <MessageSquare className="w-3 h-3" />
              شات
              {chatStatus === "connected" && <span className="absolute -top-1 -right-1 bg-green-400 w-2 h-2 rounded-full" />}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={stopSession}>
              <X className="w-3 h-3 mr-1" /> إيقاف
            </Button>
          </div>
        </div>
      )}

      {/* Video panel */}
      {activeSession && videoOpen && (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shrink-0 max-h-64">
          <div ref={videoContainerRef} className="absolute inset-0" />
          {(activeSession.videoTracks.length ?? 0) === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/50 text-sm">لا يوجد فيديو حالياً</p>
            </div>
          )}
        </div>
      )}

      {/* Chat panel */}
      {activeSession && chatOpen && (
        <Card className="shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              شات الغرفة
              <Badge variant={chatStatus === "connected" ? "default" : "secondary"} className="text-[10px]">
                {chatStatus === "connected" ? "متصل" : chatStatus === "connecting" ? "يتصل..." : chatStatus === "no_credentials" ? "لا بيانات" : chatStatus === "failed" ? "فشل" : "غير متصل"}
              </Badge>
            </span>
          </div>
          <div className="h-40 overflow-y-auto p-3 space-y-1.5" dir="auto">
            {chatMessages.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center mt-4">
                {chatStatus === "no_credentials" ? "أضف netEaseToken في إعدادات الجلسة لتفعيل الشات" : "لا توجد رسائل بعد..."}
              </p>
            ) : chatMessages.map(m => (
              <div key={m.id} className="text-xs">
                <span className="font-bold text-primary">{m.nick || m.uid}: </span>
                <span>{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </Card>
      )}

      {/* Rooms grid */}
      <div className="flex-1 overflow-auto">
        {(isLoading && !isSearchMode) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
          </div>
        ) : displayRooms.length === 0 ? (
          <div className="h-48 flex items-center justify-center border rounded-lg border-dashed text-muted-foreground">
            {isSearchMode ? searchError ?? "لا توجد نتائج" : "لا توجد غرف"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayRooms.map((room, i) => {
              const roomId = String(room.roomId ?? "");
              const listenState = listenStates[roomId] ?? "idle";
              const isActive = activeSession?.roomId === roomId;

              return (
                <div key={roomId || i} className={`relative rounded-lg overflow-hidden border group flex flex-col ${isActive ? "border-primary" : "border-border"}`}>
                  {/* Cover */}
                  <div className="relative aspect-video">
                    <Badge className="absolute top-1.5 right-1.5 z-10 text-[10px] gap-1 py-0 h-4 bg-red-600">
                      <Radio className="w-2 h-2 animate-pulse" /> LIVE
                    </Badge>
                    {room.cover ? (
                      <img src={room.cover} alt={room.roomName ?? ""} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <User className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {room.countryIcon && (
                      <img src={room.countryIcon} alt={room.countryCode ?? ""} className="absolute bottom-1 left-1 w-5 h-3.5 object-cover rounded" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                    <div className="text-xs font-bold truncate">{room.roomName || "بدون اسم"}</div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground truncate">{room.nick || `UID:${room.uid}`}</span>
                      <span className="flex items-center gap-0.5 font-bold text-muted-foreground">
                        <Users className="w-2.5 h-2.5" />
                        {room.onlineNum?.toLocaleString() ?? 0}
                      </span>
                    </div>
                    {room.erbanNo && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>ID: {room.erbanNo}</span>
                        <CopyButton text={String(room.erbanNo)} />
                      </div>
                    )}

                    {/* Listen button */}
                    <div className="mt-auto pt-1">
                      {isActive ? (
                        <Button size="sm" variant="destructive" className="w-full h-7 text-[10px]" onClick={stopSession}>
                          إيقاف
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[10px] gap-1"
                          disabled={listenState === "fetching" || listenState === "connecting" || !!activeSession}
                          onClick={() => startListening(room)}
                        >
                          {listenState === "fetching" || listenState === "connecting" ? (
                            <><Loader2 className="w-2.5 h-2.5 animate-spin" /> يتصل...</>
                          ) : listenState === "error" ? (
                            <>خطأ</>
                          ) : (
                            <><Headphones className="w-2.5 h-2.5" /> استمع</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
