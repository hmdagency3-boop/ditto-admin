import { useDittoSession } from "@/contexts/DittoSessionContext";
import {
  X, Volume2, VolumeX, Mic, MicOff, Video, VideoOff,
  Users, MessageSquare, User, Loader2, Headphones,
} from "lucide-react";

export function DittoSessionBar() {
  const {
    activeSession, isMuted, isMicMuted,
    videoOpen, setVideoOpen,
    membersOpen, setMembersOpen,
    chatOpen, setChatOpen,
    members, membersLoading, agoraPublisherUids,
    chatMessages, chatStatus,
    videoContainerRef, chatEndRef,
    stopSession, toggleMute, toggleMic,
  } = useDittoSession();

  if (!activeSession) return null;

  return (
    <>
      {/* ── Session bar ─────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b px-4 py-2 flex items-center justify-between gap-4 flex-wrap font-mono z-40 ${activeSession.isTalking ? "border-green-500/60 bg-green-500/5" : "border-primary/60 bg-primary/5"}`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession.isTalking ? "bg-green-400" : "bg-primary"}`} />
          </span>
          <span className={`text-xs font-bold tracking-widest uppercase ${activeSession.isTalking ? "text-green-400" : "text-primary"}`}>
            {activeSession.isTalking ? "BROADCASTING" : "INTERCEPTING"}
          </span>
          <span className="text-xs text-muted-foreground">
            Channel <span className="text-foreground font-bold">{activeSession.roomId}</span>
            {activeSession.roomName && (
              <> · <span className="text-foreground truncate max-w-[200px] inline-block align-bottom">{activeSession.roomName}</span></>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeSession.isTalking && (
            <button onClick={toggleMic}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors ${isMicMuted ? "border-destructive/50 text-destructive hover:bg-destructive/10" : "border-green-500/50 text-green-400 hover:bg-green-500/10"}`}>
              {isMicMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {isMicMuted ? "MIC_OFF" : "MIC_ON"}
            </button>
          )}
          <button onClick={toggleMute}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors ${isMuted ? "border-destructive/50 text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            {isMuted ? "MUTED" : "LIVE"}
          </button>
          <button onClick={() => setVideoOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors relative ${videoOpen ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
            {activeSession.videoTracks.length > 0 ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
            VIDEO
            {activeSession.videoTracks.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-green-400 w-2 h-2 rounded-full animate-pulse" />}
          </button>
          <button onClick={() => setMembersOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors relative ${membersOpen ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
            <Users className="w-3 h-3" /> MEMBERS
            {members.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-muted text-muted-foreground text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {members.length > 99 ? "99" : members.length}
              </span>
            )}
          </button>
          <button onClick={() => setChatOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors relative ${chatOpen ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
            <MessageSquare className="w-3 h-3" /> CHAT
            {chatMessages.length > 0 && !chatOpen && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {chatMessages.length > 99 ? "99" : chatMessages.length}
              </span>
            )}
          </button>
          <button onClick={stopSession}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-widest border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors">
            <X className="w-3 h-3" /> DISCONNECT
          </button>
        </div>
      </div>

      {/* ── Side panels row ─────────────────────────────────────────────────── */}
      {(membersOpen || videoOpen || chatOpen) && (
        <div className="flex border-b border-border shrink-0 overflow-hidden font-mono" style={{ height: "360px" }}>

          {/* Members panel */}
          {membersOpen && (
            <div className="w-64 shrink-0 border-r border-border flex flex-col bg-background">
              <div className="border-b border-border px-3 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-primary">MEMBERS</span>
                  {membersLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">{members.length} online</span>
                  <button onClick={() => setMembersOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {members.length === 0 && !membersLoading && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground px-3">
                    <div className="text-center">
                      <Headphones className="w-4 h-4 mx-auto mb-1 opacity-30" />
                      <p className="text-[9px] uppercase tracking-widest opacity-60">
                        {agoraPublisherUids.length === 0 ? "Waiting for speakers..." : "Loading profiles..."}
                      </p>
                    </div>
                  </div>
                )}
                {members.length > 0 && (
                  <div className="px-2 py-1 border-b border-border/20 bg-muted/10">
                    <span className="text-[8px] text-primary/60 uppercase tracking-widest font-bold">🎙 ON MIC · {members.length}</span>
                  </div>
                )}
                {members.map(m => (
                  <div key={m.uid} className="px-2 py-1.5 flex items-center gap-2 border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <div className="relative shrink-0">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-muted"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      {m.onMic && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {m.isCreator  && <span className="text-[8px] bg-primary/20 text-primary px-1 py-px leading-none shrink-0">HOST</span>}
                        {m.isManager && !m.isCreator && <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 py-px leading-none shrink-0">MOD</span>}
                        <span className="text-[10px] text-foreground truncate">{m.nick || `UID:${m.uid}`}</span>
                      </div>
                      <div className="text-[8px] text-muted-foreground/50 flex items-center gap-1.5 mt-px">
                        <span>Lv.{m.growthLevel}</span>
                        {m.erbanNo && <span>#{m.erbanNo}</span>}
                        {m.carName  && <span className="truncate max-w-[80px]">🚗 {m.carName}</span>}
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground/30 shrink-0">{m.uid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video panel */}
          {videoOpen && (
            <div className="w-80 shrink-0 border-r border-border flex flex-col bg-black">
              <div className="border-b border-border/50 px-3 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Video className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-primary">LIVE VIDEO</span>
                  {activeSession.videoTracks.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">{activeSession.videoTracks.length} stream(s)</span>
                  <button onClick={() => setVideoOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative bg-black">
                <div ref={videoContainerRef} className="absolute inset-0" />
                {activeSession.videoTracks.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
                    <div>
                      <VideoOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">No video stream</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat panel */}
          {chatOpen && (
            <div className="w-72 shrink-0 border-r border-border flex flex-col bg-background">
              <div className="border-b border-border px-3 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-primary">LIVE CHAT</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${chatStatus === "connected" ? "bg-green-400" : chatStatus === "connecting" ? "bg-yellow-400 animate-pulse" : chatStatus === "failed" ? "bg-destructive" : chatStatus === "no_credentials" ? "bg-orange-400" : "bg-muted"}`} />
                  <span className="text-[9px] text-muted-foreground uppercase">{chatStatus}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">{chatMessages.length} msgs</span>
                  <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                {chatStatus === "connecting" && chatMessages.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-muted-foreground">
                    <div className="text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /><p className="text-[9px] uppercase tracking-widest">Connecting to NIM...</p></div>
                  </div>
                )}
                {chatStatus === "failed" && (
                  <div className="p-2 border border-destructive/30 bg-destructive/5 text-[9px] text-destructive">
                    <p className="font-bold">NIM_CONNECT_FAILED</p>
                  </div>
                )}
                {chatStatus === "no_credentials" && (
                  <div className="p-2 border border-orange-400/30 bg-orange-400/5 text-[9px] text-orange-400">
                    <p className="font-bold">NO_NIM_TOKEN</p>
                    <p className="mt-1 opacity-70">netEaseToken missing.</p>
                  </div>
                )}
                {chatStatus === "connected" && chatMessages.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-muted-foreground">
                    <div className="text-center"><MessageSquare className="w-4 h-4 mx-auto mb-1 opacity-30" /><p className="text-[9px] uppercase tracking-widest opacity-60">Waiting...</p></div>
                  </div>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className="text-[10px] leading-relaxed">
                    <span className="text-primary/70 font-bold mr-1">{msg.nick || `UID:${msg.uid}`}</span>
                    <span className="text-foreground/80 break-words">{msg.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Remaining space filler */}
          <div className="flex-1 bg-background/30" />
        </div>
      )}
    </>
  );
}
