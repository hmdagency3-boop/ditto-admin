import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import AgoraRTC, {
  IAgoraRTCClient, IRemoteAudioTrack, IRemoteVideoTrack, IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

AgoraRTC.setLogLevel(4);

export const AGORA_APP_ID = "1b77c926d478406cae3174ce0565db4b";
export const SESSION_UID  = 281306;

export interface ActiveSession {
  roomId:      string;
  roomName:    string;
  client:      IAgoraRTCClient;
  audioTracks: IRemoteAudioTrack[];
  videoTracks: IRemoteVideoTrack[];
  muted:       boolean;
  localTrack:  IMicrophoneAudioTrack | null;
  isTalking:   boolean;
  micMuted:    boolean;
}

export interface ChatMessage { id: string; uid: string; nick: string; text: string; ts: number; }

export interface RoomMember {
  uid:         number;
  nick:        string;
  avatar:      string | null;
  gender:      number | null;
  isManager:   boolean;
  isCreator:   boolean;
  onMic:       boolean;
  inRoom:      boolean;
  growthLevel: number;
  charmLevel:  number;
  carName:     string | null;
  noLv:        number;
  erbanNo:     number | null;
}

interface DittoSessionContextValue {
  activeSession:        ActiveSession | null;
  setActiveSession:     React.Dispatch<React.SetStateAction<ActiveSession | null>>;
  isMuted:              boolean;
  isMicMuted:           boolean;
  videoOpen:            boolean;
  setVideoOpen:         React.Dispatch<React.SetStateAction<boolean>>;
  membersOpen:          boolean;
  setMembersOpen:       React.Dispatch<React.SetStateAction<boolean>>;
  chatOpen:             boolean;
  setChatOpen:          React.Dispatch<React.SetStateAction<boolean>>;
  members:              RoomMember[];
  membersLoading:       boolean;
  agoraPublisherUids:   number[];
  setAgoraPublisherUids: React.Dispatch<React.SetStateAction<number[]>>;
  chatMessages:         ChatMessage[];
  chatStatus:           "idle"|"connecting"|"connected"|"failed"|"no_credentials";
  videoContainerRef:    React.RefObject<HTMLDivElement>;
  chatEndRef:           React.RefObject<HTMLDivElement>;
  stopSession:          () => Promise<void>;
  toggleMute:           () => void;
  toggleMic:            () => Promise<void>;
  setIsMicMuted:        React.Dispatch<React.SetStateAction<boolean>>;
  setMembers:           React.Dispatch<React.SetStateAction<RoomMember[]>>;
}

const DittoSessionContext = createContext<DittoSessionContextValue | null>(null);

export function useDittoSession() {
  const ctx = useContext(DittoSessionContext);
  if (!ctx) throw new Error("useDittoSession must be used inside DittoSessionProvider");
  return ctx;
}

export function DittoSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isMicMuted,    setIsMicMuted]    = useState(false);
  const [videoOpen,     setVideoOpen]     = useState(false);
  const [membersOpen,   setMembersOpen]   = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [members,       setMembers]       = useState<RoomMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [agoraPublisherUids, setAgoraPublisherUids] = useState<number[]>([]);
  const [chatMessages,  setChatMessages]  = useState<ChatMessage[]>([]);
  const [chatStatus,    setChatStatus]    = useState<"idle"|"connecting"|"connected"|"failed"|"no_credentials">("idle");

  const nimChatroomRef    = useRef<unknown>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef        = useRef<HTMLDivElement>(null);

  // ── Video: auto-open panel when video track arrives ─────────────────────────
  useEffect(() => {
    if ((activeSession?.videoTracks.length ?? 0) > 0) setVideoOpen(true);
  }, [activeSession?.videoTracks.length]);

  // ── Video: play tracks into container ───────────────────────────────────────
  useEffect(() => {
    if (!videoOpen) return;
    const tracks    = activeSession?.videoTracks ?? [];
    const container = videoContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    tracks.forEach(track => {
      const el = document.createElement("div");
      el.style.cssText = "width:100%;height:100%;position:absolute;inset:0";
      container.appendChild(el);
      try { track.play(el); } catch {}
    });
  }, [activeSession?.videoTracks, videoOpen]);

  // ── NIM chatroom connect/disconnect ─────────────────────────────────────────
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
        const creds    = await credsRes.json() as { ok: boolean; nimAppKey: string; nimAccount: string | null; nimToken: string | null; hasToken: boolean };
        const addrData = await addrRes.json() as { ok: boolean; addresses: string[] };
        if (cancelled) return;
        if (!creds.hasToken || !creds.nimToken) { if (!cancelled) setChatStatus("no_credentials"); return; }

        const ChatroomMod = await import("nim-web-sdk-ng/dist/v1/CHATROOM_BROWSER_SDK.js" as any);
        const Chatroom    = (ChatroomMod as any).default ?? ChatroomMod;
        if (cancelled) return;

        const chatroomAddresses: string[] = addrData.addresses ?? [];
        if (chatroomAddresses.length === 0) { if (!cancelled) setChatStatus("no_credentials"); return; }

        const chatroom = Chatroom.getInstance({
          appkey:            creds.nimAppKey,
          account:           creds.nimAccount ?? String(SESSION_UID),
          token:             creds.nimToken,
          chatroomId:        String(activeSession.roomId),
          chatroomNick:      "monitor",
          chatroomAddresses,
          onconnect: () => { if (!cancelled) setChatStatus("connected"); },
          onmsgs: (msgs: any[]) => {
            if (cancelled) return;
            const newMsgs: ChatMessage[] = msgs
              .filter(m => m.type === "text" || m.text || m.type === "custom")
              .map(m => ({
                id:   m.idClient ?? (Date.now() + Math.random()).toString(),
                uid:  m.fromAccount ?? "?",
                nick: m.fromNick ?? "",
                text: m.text ?? (typeof m.attach?.content === "string" ? m.attach.content : JSON.stringify(m.attach ?? "")),
                ts:   m.time ?? Date.now(),
              }));
            if (newMsgs.length > 0) {
              setChatMessages(prev => [...prev, ...newMsgs].slice(-300));
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
            for (const m of msgs) {
              if (m.type !== "chatroomNotification") continue;
              const nType = m.attach?.type as string | undefined;
              const rawMembers: any[] = m.attach?.members ?? (m.attach?.member ? [m.attach.member] : []);
              if (nType === "memberEnter" && rawMembers.length > 0) {
                const entering: RoomMember[] = rawMembers.map((nm: any) => {
                  let custom: Record<string, unknown> = {};
                  try { custom = JSON.parse(nm.custom ?? "{}"); } catch {}
                  return {
                    uid: parseInt(nm.account) || 0, nick: nm.nick ?? "", avatar: nm.avatar ?? null,
                    gender: null,
                    isManager: nm.chatroomMemberType === "manager" || nm.chatroomMemberType === "creator",
                    isCreator: nm.chatroomMemberType === "creator",
                    onMic: false, inRoom: true,
                    growthLevel: Number(custom.growthLevel ?? custom.lv ?? 0),
                    charmLevel:  Number(custom.charmLevel ?? 0),
                    carName:     (custom.carName as string) ?? null,
                    noLv:        Number(custom.noLv ?? 0),
                    erbanNo:     typeof custom.erbanNo === "number" ? custom.erbanNo : null,
                  };
                });
                setMembers(prev => {
                  const existing = new Set(prev.map(p => p.uid));
                  return [...prev, ...entering.filter(e => !existing.has(e.uid))];
                });
              } else if (nType === "memberExit" && rawMembers.length > 0) {
                const leaving = new Set(rawMembers.map((nm: any) => parseInt(nm.account)));
                setMembers(prev => prev.filter(p => !leaving.has(p.uid)));
              }
            }
          },
          ondisconnect: () => { if (!cancelled) setChatStatus("idle"); },
          onerror:      () => { if (!cancelled) setChatStatus("failed"); },
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

  // ── Members: fetch profiles for Agora publishers ─────────────────────────────
  useEffect(() => {
    if (!activeSession) { setMembers([]); return; }
    if (agoraPublisherUids.length === 0) { setMembers([]); return; }
    let cancelled = false;
    setMembersLoading(true);

    Promise.allSettled(
      agoraPublisherUids.map(uid =>
        fetch(`/api/ditto/user/${uid}/profile`).then(r => r.json())
      )
    ).then(results => {
      if (cancelled) return;
      const mapped: RoomMember[] = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => {
          const v = r.value;
          return {
            uid: Number(v.uid ?? 0), nick: v.nickname ?? v.nick ?? "",
            avatar: v.avatar ?? null, gender: v.gender ?? null,
            isManager: false, isCreator: false, onMic: true, inRoom: true,
            growthLevel: v.level ?? 0, charmLevel: 0, carName: null, noLv: 0,
            erbanNo: v.erbanNo ?? null,
          };
        })
        .filter(m => m.uid > 0);
      setMembers(mapped);
      setMembersLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeSession?.roomId, agoraPublisherUids]);

  // ── stopSession ──────────────────────────────────────────────────────────────
  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      activeSession.audioTracks.forEach(t => t.stop());
      activeSession.videoTracks.forEach(t => t.stop());
      if (activeSession.localTrack) { activeSession.localTrack.stop(); activeSession.localTrack.close(); }
      await activeSession.client.leave();
    } catch {}
    setActiveSession(null);
    setIsMuted(false);
    setIsMicMuted(false);
    setVideoOpen(false);
    setChatOpen(false);
    setMembersOpen(false);
    setAgoraPublisherUids([]);
    setMembers([]);
  }, [activeSession]);

  const toggleMute = useCallback(() => {
    if (!activeSession) return;
    const newMuted = !isMuted;
    activeSession.audioTracks.forEach(t => { if (newMuted) t.stop(); else t.play(); });
    setIsMuted(newMuted);
  }, [activeSession, isMuted]);

  const toggleMic = useCallback(async () => {
    if (!activeSession?.localTrack) return;
    const newMicMuted = !isMicMuted;
    await activeSession.localTrack.setMuted(newMicMuted);
    setIsMicMuted(newMicMuted);
  }, [activeSession, isMicMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeSession) {
        activeSession.audioTracks.forEach(t => t.stop());
        if (activeSession.localTrack) { activeSession.localTrack.stop(); activeSession.localTrack.close(); }
        activeSession.client.leave().catch(() => {});
      }
    };
  }, []);

  return (
    <DittoSessionContext.Provider value={{
      activeSession, setActiveSession,
      isMuted, isMicMuted,
      videoOpen, setVideoOpen,
      membersOpen, setMembersOpen,
      chatOpen, setChatOpen,
      members, setMembers, membersLoading,
      agoraPublisherUids, setAgoraPublisherUids,
      chatMessages, chatStatus,
      videoContainerRef, chatEndRef,
      stopSession, toggleMute, toggleMic,
      setIsMicMuted,
    }}>
      {children}
    </DittoSessionContext.Provider>
  );
}
