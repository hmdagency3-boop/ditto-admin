import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected"
  | "logged_out"
  | "error";

interface ConnectionInfo {
  status: ConnectionStatus;
  qr: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

const initialStatus: ConnectionInfo = {
  status: "disconnected",
  qr: null,
  phoneNumber: null,
  lastError: null,
};

export default function WhatsApp() {
  const { lang } = useLang();
  const { toast } = useToast();
  const isArabic = lang === "ar";
  const [connection, setConnection] = useState<ConnectionInfo>(initialStatus);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const request = useCallback(async (url: string, method = "GET") => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "حدث خطأ أثناء الاتصال");
    return data as ConnectionInfo;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setConnection(await request("/api/whatsapp/status"));
    } catch (error) {
      toast({
        title: isArabic ? "تعذر تحميل حالة واتساب" : "Unable to load WhatsApp status",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isArabic, request, toast]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!["connecting", "qr"].includes(connection.status)) return;
    const timer = window.setInterval(() => void refreshStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [connection.status, refreshStatus]);

  const connect = async () => {
    setActionLoading(true);
    try {
      setConnection(await request("/api/whatsapp/connect", "POST"));
    } catch (error) {
      toast({
        title: isArabic ? "تعذر بدء الربط" : "Unable to start connection",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const disconnect = async () => {
    setActionLoading(true);
    try {
      setConnection(await request("/api/whatsapp/disconnect", "POST"));
      toast({ title: isArabic ? "تم فصل واتساب" : "WhatsApp disconnected" });
    } catch (error) {
      toast({
        title: isArabic ? "تعذر فصل واتساب" : "Unable to disconnect WhatsApp",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = connection.status === "connected";
  const statusLabel = isConnected
    ? isArabic ? "متصل" : "Connected"
    : connection.status === "qr"
      ? isArabic ? "في انتظار مسح QR" : "Waiting for QR scan"
      : connection.status === "connecting"
        ? isArabic ? "جاري الاتصال" : "Connecting"
        : connection.status === "error"
          ? isArabic ? "حدث خطأ" : "Error"
          : isArabic ? "غير متصل" : "Disconnected";

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8 space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isArabic ? "ربط واتساب ويب" : "WhatsApp Web"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isArabic ? "اربط حساب واتساب الخاص بالنظام من خلال رمز QR" : "Link the system WhatsApp account using a QR code"}
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant={isConnected ? "default" : connection.status === "error" ? "destructive" : "secondary"}
          className={isConnected ? "bg-[#25D366] text-white hover:bg-[#25D366]" : ""}
        >
          <span className={`me-2 h-2 w-2 rounded-full ${isConnected ? "bg-white" : "bg-current opacity-60"}`} />
          {statusLabel}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              {isConnected ? <CheckCircle2 className="h-5 w-5 text-[#25D366]" /> : <Link2 className="h-5 w-5 text-primary" />}
              {isConnected
                ? isArabic ? "الحساب متصل بالنظام" : "Account connected"
                : isArabic ? "توصيل حساب واتساب" : "Connect a WhatsApp account"}
            </CardTitle>
            <CardDescription>
              {isConnected
                ? isArabic ? "الجلسة محفوظة ويمكن للنظام استخدامها حتى بعد إعادة تشغيله." : "The session is saved and can be used after a restart."
                : isArabic ? "افتح واتساب على هاتفك وامسح الرمز الظاهر هنا." : "Open WhatsApp on your phone and scan the code shown here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[390px] flex-col items-center justify-center p-6">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#25D366]/10">
                  <Phone className="h-10 w-10 text-[#128C7E]" />
                </div>
                <div>
                  <p className="text-lg font-semibold" dir="ltr">+{connection.phoneNumber || "—"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isArabic ? "هذا الحساب متصل حاليًا بواتساب ويب." : "This account is currently connected to WhatsApp Web."}
                  </p>
                </div>
                <Button variant="destructive" onClick={disconnect} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="animate-spin" /> : <Unplug />}
                  {isArabic ? "فصل الحساب" : "Disconnect account"}
                </Button>
              </div>
            ) : connection.qr ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <img src={connection.qr} alt={isArabic ? "رمز ربط واتساب" : "WhatsApp linking QR code"} className="h-64 w-64" />
                </div>
                <div>
                  <p className="font-semibold">{isArabic ? "امسح الرمز من تطبيق واتساب" : "Scan this code from WhatsApp"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isArabic ? "الإعدادات ← الأجهزة المرتبطة ← ربط جهاز" : "Settings → Linked devices → Link a device"}
                  </p>
                </div>
              </div>
            ) : connection.status === "connecting" ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-medium">{isArabic ? "جاري تجهيز جلسة واتساب..." : "Preparing WhatsApp session..."}</p>
                <p className="text-sm text-muted-foreground">{isArabic ? "سيظهر رمز QR خلال لحظات." : "The QR code will appear shortly."}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{isArabic ? "لم يتم ربط أي حساب" : "No account connected"}</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {isArabic ? "ابدأ الربط لإنشاء جلسة جديدة والحصول على رمز QR." : "Start the connection to create a new session and get a QR code."}
                  </p>
                </div>
                <Button onClick={connect} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="animate-spin" /> : <Link2 />}
                  {isArabic ? "بدء الربط" : "Start connection"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {isArabic ? "طريقة الربط" : "How it works"}
            </CardTitle>
            <CardDescription>
              {isArabic ? "خطوات آمنة لربط الحساب" : "Safe steps to link your account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              [1, isArabic ? "اضغط بدء الربط" : "Click Start connection"],
              [2, isArabic ? "افتح الأجهزة المرتبطة في واتساب" : "Open Linked devices in WhatsApp"],
              [3, isArabic ? "امسح رمز QR الظاهر أمامك" : "Scan the displayed QR code"],
            ].map(([number, text]) => (
              <div className="flex items-start gap-3" key={number}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{number}</span>
                <p className="pt-1 text-sm leading-6">{text}</p>
              </div>
            ))}
            <Separator />
            <p className="text-xs leading-5 text-muted-foreground">
              {isArabic
                ? "لا تشارك رمز QR مع أي شخص. يتم حفظ جلسة الربط على السيرفر الخاص بالنظام."
                : "Never share the QR code. The linked session is stored on this system server."}
            </p>
            {connection.lastError && (
              <Alert variant="destructive">
                <AlertTitle>{isArabic ? "ملاحظة" : "Notice"}</AlertTitle>
                <AlertDescription>{connection.lastError}</AlertDescription>
              </Alert>
            )}
            <Button variant="outline" className="w-full" onClick={() => void refreshStatus()} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              {isArabic ? "تحديث الحالة" : "Refresh status"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}