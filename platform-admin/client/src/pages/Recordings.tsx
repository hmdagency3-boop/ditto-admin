import { useState, useRef, useEffect, useCallback } from "react";
import { useDittoSession } from "@/contexts/DittoSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Circle, Square, Users, Mic, Video } from "lucide-react";
import { Link } from "wouter";

const W = 1280;
const H = 720;

type ImgCache = Map<string, HTMLImageElement | null>;

function loadImg(url: string, cache: ImgCache) {
  if (!url || cache.has(url)) return;
  cache.set(url, null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload  = () => cache.set(url, img);
  img.onerror = () => { /* keep null placeholder */ };
  img.src = url;
}

function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  nick: string,
  cx: number, cy: number, r: number,
  isActive: boolean
) {
  // Glow ring for active speakers
  if (isActive) {
    const grd = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 12);
    grd.addColorStop(0, "rgba(34,197,94,0.8)");
    grd.addColorStop(1, "rgba(34,197,94,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, 2 * Math.PI);
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Clip to circle and draw image or colored placeholder
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    const PALETTE = ["#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#06b6d4"];
    ctx.fillStyle = PALETTE[(nick.charCodeAt(0) || 0) % PALETTE.length];
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(r * 0.55)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(nick.slice(0, 2), cx, cy);
  }

  ctx.restore();
}

export default function Recordings() {
  const { activeSession, members, agoraPublisherUids } = useDittoSession();
  const { token } = useAuth();
  const { toast } = useToast();

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const recRef      = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef    = useRef<number | null>(null);
  const imgCache    = useRef<ImgCache>(new Map());
  const elapsedRef  = useRef(0);
  const blinkRef    = useRef(true);
  const blinkTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [uploading, setUploading] = useState(false);

  // ── Canvas draw ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cache = imgCache.current;
    const cover  = activeSession?.cover ?? null;
    const rName  = activeSession?.roomName ?? "";
    const pubSet = new Set(agoraPublisherUids);

    // Pre-load room cover
    if (cover) loadImg(cover, cache);

    // Speakers: on-mic members first, fallback to all members
    const speakers = members.filter(m => m.onMic).length > 0
      ? members.filter(m => m.onMic)
      : members;

    // Pre-load speaker avatars
    speakers.forEach(m => { if (m.avatar) loadImg(m.avatar, cache); });

    // ── Background ────────────────────────────────────────────────────────────
    const coverImg = cover ? cache.get(cover) ?? null : null;

    if (coverImg) {
      // Blurred cover
      ctx.filter = "blur(24px) brightness(0.22) saturate(1.4)";
      ctx.drawImage(coverImg, -30, -30, W + 60, H + 60);
      ctx.filter = "none";
    } else {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0b0f1a");
      bg.addColorStop(1, "#0f172a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    // Subtle dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);

    // ── Header bar ────────────────────────────────────────────────────────────
    const headerH = 88;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, headerH);

    // Room cover thumbnail
    const thumbSize = 64;
    const thumbX = 16, thumbY = 12;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect?.(thumbX, thumbY, thumbSize, thumbSize, 8);
    ctx.clip();
    if (coverImg) {
      ctx.drawImage(coverImg, thumbX, thumbY, thumbSize, thumbSize);
    } else {
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
      ctx.fillStyle = "#60a5fa";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎙", thumbX + thumbSize / 2, thumbY + thumbSize / 2);
    }
    ctx.restore();

    // Room name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const displayName = rName.length > 38 ? rName.slice(0, 37) + "…" : rName;
    ctx.fillText(displayName || "الروم", thumbX + thumbSize + 14, thumbY + 22);

    // Members count
    ctx.fillStyle = "#9ca3af";
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText(`${speakers.length} على المايك • ${members.length} عضو`, thumbX + thumbSize + 14, thumbY + 48);

    // ── LIVE / REC indicator (top right) ─────────────────────────────────────
    if (recording || recRef.current) {
      const s = elapsedRef.current;
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");

      // Blinking dot
      if (blinkRef.current) {
        ctx.beginPath();
        ctx.arc(W - 160, 28, 9, 0, 2 * Math.PI);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("REC", W - 145, 28);

      ctx.fillStyle = "#d1d5db";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${mm}:${ss}`, W - 100, 60);
    }

    // ── Speakers grid ─────────────────────────────────────────────────────────
    const AREA_Y     = headerH + 18;
    const AREA_H     = H - AREA_Y - 18;

    if (speakers.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "22px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("لا يوجد أحد على المايك حالياً", W / 2, H / 2);
    } else {
      const count = speakers.length;
      const cols  = count <= 4 ? count : count <= 9 ? Math.ceil(Math.sqrt(count)) : 5;
      const rows  = Math.ceil(count / cols);

      const cellW  = W / cols;
      const cellH  = AREA_H / rows;
      const maxR   = Math.min(cellW, cellH) * 0.32;
      const r      = Math.max(Math.min(maxR, 90), 38);
      const nameFS = Math.max(Math.min(r * 0.28, 16), 11);

      speakers.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx  = cellW * col + cellW / 2;
        const cy  = AREA_Y + cellH * row + cellH * 0.45;
        const isActive = pubSet.has(m.uid);

        const img = m.avatar ? (cache.get(m.avatar) ?? null) : null;
        drawCircleAvatar(ctx, img, m.nick, cx, cy, r, isActive);

        // Name
        const trimmedNick = m.nick.length > 16 ? m.nick.slice(0, 15) + "…" : m.nick;
        ctx.fillStyle = "#f1f5f9";
        ctx.font = `${nameFS}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(trimmedNick, cx, cy + r + 8);

        // Mic icon badge for active
        if (isActive) {
          ctx.fillStyle = "#22c55e";
          ctx.font = `${nameFS}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("🎤", cx, cy + r + 8 + nameFS + 4);
        }
      });
    }

    // ── Watermark ─────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = "13px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Ditto Admin • " + new Date().toLocaleTimeString("ar-EG"), W - 12, H - 8);

  }, [activeSession, members, agoraPublisherUids, recording]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    function loop() {
      draw();
      frameRef.current = requestAnimationFrame(loop);
    }
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [draw]);

  // ── Blink dot every 500ms ─────────────────────────────────────────────────
  useEffect(() => {
    blinkTimer.current = setInterval(() => { blinkRef.current = !blinkRef.current; }, 500);
    return () => { if (blinkTimer.current) clearInterval(blinkTimer.current); };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
  }

  async function uploadToServer(blob: Blob, filename: string) {
    if (!token || blob.size > 200 * 1024 * 1024) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("recording", blob, filename);
      const r  = await fetch("/api/recordings", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      const ct = r.headers.get("content-type") ?? "";
      if (r.ok && ct.includes("application/json")) {
        toast({ title: "تم الحفظ على السيرفر ✅" });
      }
    } catch { /* silent */ } finally { setUploading(false); }
  }

  // ── Start recording ───────────────────────────────────────────────────────
  async function startRecording() {
    const canvas = canvasRef.current;
    if (!canvas || !activeSession) return;

    chunksRef.current = [];
    const stream = canvas.captureStream(25);

    // ── Capture Agora audio ──────────────────────────────────────────────
    const audioTracks = activeSession.audioTracks ?? [];
    if (audioTracks.length > 0) {
      try {
        // Close previous AudioContext if any
        audioCtxRef.current?.close().catch(() => {});

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        for (const agoraTrack of audioTracks) {
          try {
            // getMediaStreamTrack() gives the raw browser MediaStreamTrack
            const mt = (agoraTrack as any).getMediaStreamTrack?.() as MediaStreamTrack | undefined;
            if (mt) {
              // createMediaStreamSource reads from the track WITHOUT rerouting
              // so Agora's own audio output (speakers) is unaffected
              const src = audioCtx.createMediaStreamSource(new MediaStream([mt]));
              src.connect(dest);
            }
          } catch { /* skip this track */ }
        }

        // Add mixed audio track to canvas stream so recorder captures it
        dest.stream.getAudioTracks().forEach(at => stream.addTrack(at));
      } catch (err) {
        console.warn("Audio capture setup failed:", err);
      }
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      // Clean up AudioContext
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;

      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const name = `room-${activeSession.roomId}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
      downloadBlob(blob, name);
      await uploadToServer(blob, name);
      recRef.current = null;
    };

    recorder.start(1000);
    elapsedRef.current = 0;
    setElapsed(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
  }

  // ── Stop recording ────────────────────────────────────────────────────────
  function stopRecording() {
    if (recRef.current?.state === "recording") recRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecording(false);
    setElapsed(0);
    elapsedRef.current = 0;
  }

  const onMicCount = members.filter(m => m.onMic).length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Video className="h-5 w-5 text-red-500" /> تسجيل الروم
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          يسجل الروم مع صور المتحدثين — يتنزّل تلقائياً عند الإيقاف
        </p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {activeSession ? (
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {activeSession.roomName}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            لم تدخل روم بعد
          </Badge>
        )}

        <Badge variant="outline" className="gap-1">
          <Mic className="h-3 w-3" />
          {onMicCount} على المايك
        </Badge>

        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {members.length} عضو
        </Badge>

        {recording && (
          <Badge variant="destructive" className="gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white inline-block" />
            {fmt(elapsed)}
          </Badge>
        )}
      </div>

      {/* Canvas preview */}
      <Card className={`overflow-hidden p-0 ${recording ? "ring-2 ring-red-500 shadow-lg shadow-red-900/30" : ""}`}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full block"
          style={{ aspectRatio: "16/9" }}
        />
      </Card>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {!recording ? (
          <Button
            size="lg"
            onClick={startRecording}
            disabled={!activeSession}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white px-10"
          >
            <Circle className="h-5 w-5" />
            ابدأ التسجيل
          </Button>
        ) : (
          <Button
            size="lg"
            variant="destructive"
            onClick={stopRecording}
            className="gap-2 px-10"
          >
            <Square className="h-5 w-5 fill-white" />
            إيقاف التسجيل
          </Button>
        )}
      </div>

      {uploading && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          ⬆️ جاري رفع التسجيل على السيرفر...
        </p>
      )}

      {/* Guide if no session */}
      {!activeSession && (
        <Card className="border-dashed border-2">
          <CardContent className="p-6 text-center space-y-3">
            <div className="text-4xl">🎙️</div>
            <p className="font-semibold">ادخل روم أولاً للتسجيل</p>
            <p className="text-sm text-muted-foreground">
              روح <strong>غرف Ditto</strong> من القائمة الجانبية واضغط <strong>استمع</strong> على أي روم،
              ثم ارجع لهذه الصفحة وابدأ التسجيل
            </p>
            <Link href="/ditto-rooms">
              <Button variant="outline" size="sm" className="gap-2 mt-2">
                <Video className="h-4 w-4" /> روح لغرف Ditto
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
