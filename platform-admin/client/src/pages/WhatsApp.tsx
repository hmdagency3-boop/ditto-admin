import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out" | "error";
interface ConnectionInfo {
  status: ConnectionStatus;
  qr: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}
interface Chat {
  jid: string;
  name: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: number;
}
interface ChatMessage {
  id: string;
  jid: string;
  text: string;
  fromMe: boolean;
  senderName: string;
  timestamp: number;
}

const initialStatus: ConnectionInfo = {
  status: "disconnected",
  qr: null,
  phoneNumber: null,
  lastError: null,
};

function formatTime(timestamp: number, isArabic: boolean) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WA";
}

export default function WhatsApp() {
  const { lang } = useLang();
  const { toast } = useToast();
  const isArabic = lang === "ar";
  const [connection, setConnection] = useState<ConnectionInfo>(initialStatus);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const request = useCallback(async (url: string, method = "GET", body?: unknown) => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "حدث خطأ أثناء الاتصال");
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await request("/api/whatsapp/status") as ConnectionInfo;
      setConnection(next);
      if (next.status === "connected") {
        const nextChats = await request("/api/whatsapp/chats") as Chat[];
        setChats(nextChats);
        setSelectedJid((current) => current || nextChats[0]?.jid || null);
      }
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

  const refreshMessages = useCallback(async () => {
    if (!selectedJid || connection.status !== "connected") return;
    try {
      setMessages(await request(`/api/whatsapp/chats/${encodeURIComponent(selectedJid)}/messages`) as ChatMessage[]);
      const nextChats = await request("/api/whatsapp/chats") as Chat[];
      setChats(nextChats);
    } catch {
      // The status card already communicates connection errors.
    }
  }, [connection.status, request, selectedJid]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!["connecting", "qr"].includes(connection.status)) return;
    const timer = window.setInterval(() => void refreshStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [connection.status, refreshStatus]);

  useEffect(() => {
    void refreshMessages();
    if (connection.status !== "connected") return;
    const timer = window.setInterval(() => void refreshMessages(), 3000);
    return () => window.clearInterval(timer);
  }, [connection.status, refreshMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedJid]);

  const connect = async () => {
    setActionLoading(true);
    try {
      setConnection(await request("/api/whatsapp/connect", "POST") as ConnectionInfo);
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
      setConnection(await request("/api/whatsapp/disconnect", "POST") as ConnectionInfo);
      setChats([]);
      setMessages([]);
      setSelectedJid(null);
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

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedJid || sending) return;
    setSending(true);
    try {
      const sent = await request("/api/whatsapp/messages", "POST", { jid: selectedJid, text }) as ChatMessage;
      setMessages((current) => [...current.filter((message) => message.id !== sent.id), sent]);
      setDraft("");
      void refreshMessages();
    } catch (error) {
      toast({
        title: isArabic ? "تعذر إرسال الرسالة" : "Unable to send message",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const filteredChats = useMemo(
    () => chats.filter((chat) => chat.name.toLowerCase().includes(search.toLowerCase()) || chat.jid.includes(search)),
    [chats, search],
  );
  const selectedChat = chats.find((chat) => chat.jid === selectedJid);
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

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isConnected) {
    return (
      <div className="flex h-[calc(100vh-4.5rem)] min-h-[560px] flex-col p-3 md:p-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]"><MessageCircle className="h-6 w-6" /></div>
            <div>
              <h1 className="text-xl font-bold">{isArabic ? "واتساب ويب" : "WhatsApp Web"}</h1>
              <p className="text-xs text-muted-foreground" dir="ltr">+{connection.phoneNumber || "—"}</p>
            </div>
            <Badge className="bg-[#25D366] text-white hover:bg-[#25D366]"><span className="me-2 h-2 w-2 rounded-full bg-white" />{statusLabel}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="animate-spin" /> : <Unplug />}
            {isArabic ? "فصل الحساب" : "Disconnect"}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[320px_1fr]" dir="ltr">
          <aside className="flex min-h-0 flex-col border-e" dir={isArabic ? "rtl" : "ltr"}>
            <div className="border-b p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">{isArabic ? "المحادثات" : "Chats"}</h2>
                <Button variant="ghost" size="icon" title={isArabic ? "محادثة جديدة" : "New chat"}><Plus /></Button>
              </div>
              <div className="relative">
                <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? "بحث في المحادثات" : "Search chats"} className="ps-9" />
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">
                {filteredChats.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />
                    {isArabic ? "لا توجد محادثات بعد" : "No chats yet"}
                  </div>
                ) : filteredChats.map((chat) => (
                  <button
                    key={chat.jid}
                    onClick={() => setSelectedJid(chat.jid)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-start transition-colors ${selectedJid === chat.jid ? "bg-primary/10" : "hover:bg-muted"}`}
                  >
                    <Avatar className="h-11 w-11 shrink-0"><AvatarFallback className="bg-[#25D366]/15 text-[#128C7E]">{initials(chat.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{chat.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(chat.lastMessageAt, isArabic)}</span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">{chat.lastMessage || chat.jid.split("@")[0]}</span>
                        {chat.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] text-white">{chat.unreadCount}</span>}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#efeae2] dark:bg-[#171d20]" dir={isArabic ? "rtl" : "ltr"}>
            {selectedChat ? (
              <>
                <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
                  <Avatar><AvatarFallback className="bg-[#25D366]/15 text-[#128C7E]">{initials(selectedChat.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{selectedChat.name}</h2>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{selectedChat.jid.split("@")[0]}</p>
                  </div>
                  <Phone className="ms-auto h-4 w-4 text-muted-foreground" />
                </header>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="mx-auto flex max-w-4xl flex-col gap-2 p-4">
                    {messages.length === 0 ? (
                      <div className="m-auto rounded-xl bg-card/80 px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
                        {isArabic ? "لا توجد رسائل محفوظة لهذه المحادثة" : "No saved messages in this chat"}
                      </div>
                    ) : messages.map((message) => (
                      <div key={message.id} className={`flex ${message.fromMe ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[78%] rounded-xl px-3 py-2 shadow-sm ${message.fromMe ? "rounded-tr-sm bg-[#d9fdd3] text-slate-900 dark:bg-[#005c4b] dark:text-white" : "rounded-tl-sm bg-white text-slate-900 dark:bg-[#202c33] dark:text-white"}`}>
                          <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                          <div className={`mt-1 flex items-center gap-1 text-[10px] ${message.fromMe ? "justify-start text-slate-500 dark:text-slate-300" : "justify-end text-muted-foreground"}`}>
                            {formatTime(message.timestamp, isArabic)}
                            {message.fromMe && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="border-t bg-card p-3">
                  <div className="mx-auto flex max-w-4xl items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder={isArabic ? "اكتب رسالة..." : "Type a message..."}
                      className="min-h-10 max-h-28 resize-none"
                      rows={1}
                    />
                    <Button size="icon" onClick={() => void sendMessage()} disabled={!draft.trim() || sending} className="h-10 w-10 shrink-0 rounded-full bg-[#128C7E] hover:bg-[#075E54]">
                      {sending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="m-auto text-center text-muted-foreground">
                <MessageCircle className="mx-auto mb-3 h-14 w-14 opacity-30" />
                <p className="font-medium">{isArabic ? "اختر محادثة لعرض الرسائل" : "Select a chat to view messages"}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]"><MessageCircle className="h-7 w-7" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isArabic ? "ربط واتساب ويب" : "WhatsApp Web"}</h1>
          <p className="text-sm text-muted-foreground">{isArabic ? "اربط حساب واتساب لعرض المحادثات وإرسال الرسائل من داخل النظام" : "Link WhatsApp to view chats and send messages from the system"}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-xl"><Link2 className="h-5 w-5 text-primary" />{isArabic ? "توصيل حساب واتساب" : "Connect a WhatsApp account"}</CardTitle>
            <CardDescription>{isArabic ? "افتح واتساب على هاتفك وامسح الرمز الظاهر هنا." : "Open WhatsApp on your phone and scan the code shown here."}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[390px] flex-col items-center justify-center p-6">
            {connection.qr ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl border bg-white p-4 shadow-sm"><img src={connection.qr} alt="WhatsApp QR" className="h-64 w-64" /></div>
                <p className="font-semibold">{isArabic ? "امسح الرمز من تطبيق واتساب" : "Scan this code from WhatsApp"}</p>
                <p className="text-sm text-muted-foreground">{isArabic ? "الإعدادات ← الأجهزة المرتبطة ← ربط جهاز" : "Settings → Linked devices → Link a device"}</p>
              </div>
            ) : connection.status === "connecting" ? (
              <div className="flex flex-col items-center gap-4 text-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="font-medium">{isArabic ? "جاري تجهيز جلسة واتساب..." : "Preparing WhatsApp session..."}</p></div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted"><Smartphone className="h-10 w-10 text-muted-foreground" /></div>
                <div><p className="font-semibold">{isArabic ? "لم يتم ربط أي حساب" : "No account connected"}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{isArabic ? "ابدأ الربط لإنشاء جلسة جديدة والحصول على رمز QR." : "Start the connection to create a new session and get a QR code."}</p></div>
                <Button onClick={connect} disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <Link2 />}{isArabic ? "بدء الربط" : "Start connection"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" />{isArabic ? "طريقة الربط" : "How it works"}</CardTitle><CardDescription>{isArabic ? "بعد الربط ستظهر المحادثات في واجهة واتساب داخل النظام." : "After linking, chats appear in the in-system WhatsApp interface."}</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {[isArabic ? "اضغط بدء الربط" : "Click Start connection", isArabic ? "افتح الأجهزة المرتبطة في واتساب" : "Open Linked devices in WhatsApp", isArabic ? "امسح رمز QR الظاهر أمامك" : "Scan the displayed QR code"].map((text, index) => <div className="flex items-start gap-3" key={text}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span><p className="pt-1 text-sm leading-6">{text}</p></div>)}
            <Separator />
            <p className="text-xs leading-5 text-muted-foreground">{isArabic ? "بعد الاتصال ستتمكن من فتح الشاتات وقراءة الرسائل وإرسال رسائل جديدة من نفس الصفحة." : "Once connected, you can open chats, read messages, and send new messages from this page."}</p>
            {connection.lastError && <Alert variant="destructive"><AlertTitle>{isArabic ? "ملاحظة" : "Notice"}</AlertTitle><AlertDescription>{connection.lastError}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}