import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle, Square, Download, Trash2, Video, Upload, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface RecFile {
  name: string;
  created_at: string;
  metadata?: { size?: number };
  url?: string;
}

export default function Recordings() {
  const { token } = useAuth();
  const { toast } = useToast();

  const h = useCallback((url: string, opts?: RequestInit) =>
    fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts?.headers || {}),
      },
    }), [token]);

  const [recording, setRecording]     = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [uploading, setUploading]     = useState(false);
  const [list, setList]               = useState<RecFile[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await h('/api/recordings');
      if (r.ok) setList(await r.json());
    } finally { setLoadingList(false); }
  }, [h]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function formatSize(bytes?: number) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function uploadToServer(blob: Blob) {
    const sizeMB = blob.size / (1024 * 1024);
    if (sizeMB > 200) {
      toast({
        title: 'تنبيه — الملف كبير جداً',
        description: `الحجم ${sizeMB.toFixed(0)} MB — تم التنزيل محلياً فقط. السيرفر يدعم حتى 200 MB`,
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      const filename = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      form.append('recording', blob, filename);
      const r = await h('/api/recordings', { method: 'POST', body: form });
      if (r.ok) {
        toast({ title: 'تم الحفظ على السيرفر ✅' });
        fetchList();
      } else {
        const d = await r.json().catch(() => ({}));
        toast({ title: 'فشل الرفع', description: d.message || 'خطأ غير معروف', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'فشل الرفع', description: e.message, variant: 'destructive' });
    } finally { setUploading(false); }
  }

  function handleStop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setRecording(false);
    setElapsed(0);
  }

  async function startRecording() {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const name = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        downloadBlob(blob, name);
        await uploadToServer(blob);
      };

      stream.getVideoTracks()[0]?.addEventListener('ended', () => handleStop());

      recorder.start(1000);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    } catch (e: any) {
      if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
        toast({ title: 'خطأ', description: 'تعذر الوصول للشاشة', variant: 'destructive' });
      }
    }
  }

  async function deleteRec(name: string) {
    const r = await h(`/api/recordings/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (r.ok) { toast({ title: 'تم الحذف' }); fetchList(); }
    else toast({ title: 'فشل الحذف', variant: 'destructive' });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Video className="h-6 w-6 text-red-500" /> تسجيل الرومات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          سجّل شاشتك أثناء مشاهدة الرومات الصوتية والفيديو — يتنزّل على جهازك ويتحفظ على السيرفر تلقائياً
        </p>
      </div>

      <Card className={recording ? 'border-red-500 shadow-red-100 dark:shadow-red-900 shadow-lg' : ''}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-5">
            {recording ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-4xl font-mono font-bold tabular-nums">{formatTime(elapsed)}</span>
                  <Badge variant="destructive" className="text-sm">جاري التسجيل</Badge>
                </div>
                <p className="text-sm text-muted-foreground">عند الانتهاء اضغط إيقاف أو أغلق مشاركة الشاشة</p>
                <Button size="lg" variant="destructive" onClick={handleStop} className="gap-2 px-8">
                  <Square className="h-5 w-5 fill-white" /> إيقاف التسجيل
                </Button>
              </>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <p className="font-medium">اضغط لتبدأ تسجيل الشاشة</p>
                  <p className="text-sm text-muted-foreground">
                    ستظهر نافذة لاختيار الشاشة أو التبويب اللي عايز تسجّله
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={startRecording}
                  className="gap-2 px-8 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Circle className="h-5 w-5" /> ابدأ التسجيل
                </Button>
              </>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <Upload className="h-4 w-4" /> جاري رفع التسجيل على السيرفر...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-5 w-5" /> التسجيلات على السيرفر
            <Badge variant="secondary">{list.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchList} className="gap-1">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-muted-foreground text-sm text-center py-6">جاري التحميل...</p>
          ) : list.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Video className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">لا توجد تسجيلات محفوظة على السيرفر بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(rec => (
                <div
                  key={rec.name}
                  className="flex items-center justify-between p-3 border rounded-lg gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate font-medium">{rec.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(rec.created_at).toLocaleString('ar-EG')}</span>
                      {rec.metadata?.size != null && (
                        <span>• {formatSize(rec.metadata.size)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {rec.url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={rec.url} download={rec.name} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteRec(rec.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
