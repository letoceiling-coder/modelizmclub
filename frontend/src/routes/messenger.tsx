import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare,
  Paperclip, Search, Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { ChatMessage, Conversation, PostAuthor } from "@/lib/types";
import { avatarUrl } from "@/lib/utils/time";
import { formatCount } from "@/lib/utils/format";
import {
  fetchConversations, fetchMessages, sendMessage, createConversation, mapApiMessage,
} from "@/lib/api/chat";
import { fetchCommunities } from "@/lib/api/communities";
import { subscribeConversation } from "@/lib/realtime/echo";
import { ChatHeaderActions, type DialogMeta } from "@/components/messenger/ChatHeaderActions";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { CreateChatDialog } from "@/components/messenger/CreateChatDialog";
import { VoiceBubble } from "@/components/messenger/VoiceBubble";
import { TimeAgo } from "@/components/TimeAgo";
import { VoiceRecorder } from "@/components/messenger/VoiceRecorder";
import { CallsList } from "@/components/calls/CallsList";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { VOICE_TRANSCRIPTS, makeMockWaveform } from "@/lib/utils/voice";

export const Route = createFileRoute("/messenger")({
  head: () => ({ meta: [{ title: tStatic("messenger.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: MessengerPage,
});

function StatusIcon({ status }: { status?: ChatMessage["status"] }) {
  if (!status) return null;
  if (status === "sent") return <Check size={12} style={{ color: "rgba(255,255,255,0.5)" }} />;
  if (status === "delivered") return <CheckCheck size={12} style={{ color: "rgba(255,255,255,0.5)" }} />;
  return <CheckCheck size={12} style={{ color: "white" }} />;
}

function MessageBubble({
  msg, prev, meSlug, onReply,
}: {
  msg: ChatMessage; prev?: ChatMessage; meSlug: string | null; onReply: (m: ChatMessage) => void;
}) {
  const { t } = useTranslation();
  const isMe = msg.author.slug === meSlug;
  const isFirstInGroup = !prev || prev.author.slug !== msg.author.slug;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`group flex items-end gap-[8px] ${isMe ? "justify-end" : "justify-start"}`}
      style={{ marginTop: isFirstInGroup ? 16 : 4 }}
    >
      {!isMe && (
        <div className="w-[28px] shrink-0">
          {isFirstInGroup && <img src={msg.author.avatar ?? avatarUrl(msg.author.name)} alt="" className="h-[28px] w-[28px] rounded-full object-cover" />}
        </div>
      )}
      <div className="relative max-w-[70%]">
        <div
          className="px-[14px] py-[10px]"
          style={{
            background: isMe ? "var(--accent)" : "var(--background-surface)",
            color: isMe ? "white" : "var(--foreground)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          }}
        >
          {msg.replyTo && (
            <div className="mb-[6px] pl-[8px] text-[12px]" style={{ borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.4)" : "var(--accent)"}`, color: isMe ? "rgba(255,255,255,0.85)" : "var(--foreground-50)" }}>
              <div className="font-semibold">{msg.replyTo.authorName}</div>
              <div className="truncate">{msg.replyTo.text}</div>
            </div>
          )}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
          {msg.text && <div className="text-[14px] leading-[1.4]" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</div>}
          <div className="mt-[4px] flex items-center justify-end gap-[4px] font-mono text-[10px]" style={{ color: isMe ? "rgba(255,255,255,0.6)" : "var(--foreground-30)" }}>
            <span>{msg.time}</span>
            {isMe && <StatusIcon status={msg.status} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MessengerPage() {
  const { t } = useTranslation();
  const { isAuthenticated, slug, displayName } = useAuth();
  const navigate = useNavigate();
  const { chat } = Route.useSearch();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(chat ?? null);
  const [dialogMeta, setDialogMeta] = useState<Record<string, DialogMeta>>({});
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">(chat ? "chat" : "list");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [listTab, setListTab] = useState<"chats" | "channels" | "calls">("chats");
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getMeta = (id: string) => dialogMeta[id] ?? { archived: false, muted: false, blocked: false };
  const patchMeta = (id: string, patch: Partial<DialogMeta>) =>
    setDialogMeta((prev) => ({ ...prev, [id]: { ...getMeta(id), ...patch } }));

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void fetchConversations().then((items) => {
      if (!cancelled) {
        setConversations(items);
        if (!activeId && items[0]) setActiveId(items[0].id);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!chat) return;
    setActiveId(chat);
    setMobileView("chat");
  }, [chat]);

  useEffect(() => {
    if (!activeId || !isAuthenticated) return;
    let cancelled = false;
    setChatLoading(true);
    void fetchMessages(activeId).then((items) => {
      if (!cancelled) {
        setMessages(items);
        setChatLoading(false);
      }
    });
    const unsub = subscribeConversation(activeId, (payload) => {
      const raw = payload.message as Record<string, unknown>;
      if (raw && typeof raw === "object" && "uuid" in raw) {
        setMessages((prev) => [...prev, mapApiMessage(raw as Parameters<typeof mapApiMessage>[0])]);
      }
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeId, isAuthenticated]);

  useEffect(() => {
    if (scrollRef.current && !chatLoading) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, chatLoading, activeId]);

  const active = useMemo(() => conversations.find((d) => d.id === activeId) ?? null, [conversations, activeId]);
  const partner = useMemo((): PostAuthor | null => {
    if (!active) return null;
    return active.participants.find((p) => p.slug !== slug) ?? active.participants[0] ?? null;
  }, [active, slug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = conversations.filter((d) => {
      const m = getMeta(d.id);
      return showArchived ? m.archived : !m.archived;
    });
    if (!q) return base;
    return base.filter((d) => {
      const name = d.participants.find((p) => p.slug !== slug)?.name ?? d.title;
      return name.toLowerCase().includes(q) || (d.lastMessage ?? "").toLowerCase().includes(q);
    });
  }, [conversations, query, showArchived, dialogMeta, slug]);

  const archivedCount = useMemo(() => conversations.filter((d) => getMeta(d.id).archived).length, [conversations, dialogMeta]);

  const handleCreateChat = async (userId: string) => {
    try {
      const conv = await createConversation(Number(userId));
      setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
      setCreateOpen(false);
      setActiveId(conv.id);
      setMobileView("chat");
      setShowArchived(false);
      toast.success(t("messenger.chatOpened"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileView("chat");
    setReplyTo(null);
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    if (getMeta(active.id).blocked) {
      toast.error(t("messenger.userBlocked"));
      return;
    }
    try {
      const msg = await sendMessage(active.id, text.trim(), replyTo?.id);
      setMessages((prev) => [...prev, msg]);
      setText("");
      setReplyTo(null);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const sendVoice = async (durationSec: number) => {
    if (!active) return;
    const seed = Date.now();
    const transcript = VOICE_TRANSCRIPTS[seed % VOICE_TRANSCRIPTS.length];
    const local: ChatMessage = {
      id: `local-${seed}`,
      author: { slug: slug ?? "me", name: displayName ?? "Me", avatar: avatarUrl(displayName ?? "Me") },
      time: tStatic("common.justNow"),
      text: "",
      type: "voice",
      status: "sent",
      voice: { duration: durationSec, waveform: makeMockWaveform(seed), transcript },
    };
    setMessages((prev) => [...prev, local]);
    setReplyTo(null);
    toast.success(t("messenger.voiceSent"));
  };

  if (!isAuthenticated) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-[80px] text-center">
          <p style={{ color: "var(--foreground-50)" }}>{t("messenger.loginRequired")}</p>
          <Link to="/login" className="mt-[12px] inline-block font-semibold" style={{ color: "var(--accent)" }}>{t("auth.login")}</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="grid overflow-hidden md:grid-cols-[320px_1fr]" style={{ height: "calc(100vh - 120px)", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}>
        <aside className={`flex min-h-0 flex-col md:flex ${mobileView === "list" ? "flex" : "hidden"}`} style={{ background: "var(--background-elevated)", borderRight: "1px solid var(--border)" }}>
          <div className="sticky top-0 z-10 flex flex-col gap-[10px] px-[16px] py-[12px]" style={{ background: "var(--background-elevated)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-[8px]">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("messenger.searchDialog")} className="w-full text-[14px] outline-none" style={{ height: 40, paddingLeft: 36, background: "var(--background-surface)", borderRadius: 10, color: "var(--foreground)" }} />
              </div>
              <button type="button" onClick={() => setCreateOpen(true)} className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--accent)", color: "white" }}>
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listTab === "calls" ? (
              <CallsList onOpenChat={(did) => { setListTab("chats"); setActiveId(did); setMobileView("chat"); }} />
            ) : listTab === "channels" ? (
              <ChannelsList query={query} />
            ) : loading ? (
              <div className="p-4 text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div>
            ) : filtered.length === 0 ? (
              <EmptyDialogs />
            ) : (
              <ul>
                {filtered.map((d) => {
                  const p = d.participants.find((x) => x.slug !== slug) ?? d.participants[0];
                  const name = p?.name ?? d.title;
                  const avatar = p?.avatar ?? avatarUrl(name);
                  return (
                    <li key={d.id}>
                      <button onClick={() => handleSelect(d.id)} className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left" style={{ background: d.id === activeId ? "var(--accent-soft)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                        <img src={avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-[14px]">{name}</div>
                          <div className="truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>{d.lastMessage}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className={`flex min-h-0 flex-col md:flex ${mobileView === "chat" ? "flex" : "hidden"}`}>
          {!active || !partner ? (
            <EmptyChat />
          ) : (
            <>
              <header className="flex items-center gap-[12px] px-[20px]" style={{ height: 60, borderBottom: "1px solid var(--border)" }}>
                <button onClick={() => setMobileView("list")} className="md:hidden"><ArrowLeft size={20} /></button>
                <img src={partner.avatar ?? avatarUrl(partner.name)} alt="" className="h-[40px] w-[40px] rounded-full" />
                <div className="font-semibold">{partner.name}</div>
                <div className="ml-auto flex items-center gap-[4px]">
                  <LanguageSwitcher />
                  <ChatHeaderActions partnerId={partner.slug} partnerName={partner.name} dialogId={active.id} meta={getMeta(active.id)} onMetaChange={(p) => patchMeta(active.id, p)} />
                </div>
              </header>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[16px]">
                {chatLoading ? <div>{t("common.loading")}</div> : messages.map((m, i) => (
                  <MessageBubble key={m.id} msg={m} prev={messages[i - 1]} meSlug={slug} onReply={setReplyTo} />
                ))}
              </div>
              <div className="shrink-0 border-t px-[12px] py-[10px]" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-end gap-[8px]">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={t("messenger.messagePlaceholder")} rows={1} className="flex-1 resize-none bg-transparent text-[14px] outline-none" style={{ minHeight: 36, color: "var(--foreground)" }} />
                  {text.trim() ? (
                    <button onClick={() => void send()} className="grid h-[42px] w-[42px] place-items-center rounded-full" style={{ background: "var(--accent)", color: "white" }}><Send size={18} /></button>
                  ) : (
                    <VoiceRecorder onSend={sendVoice} />
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <CreateChatDialog open={createOpen} onClose={() => setCreateOpen(false)} onPick={(id) => void handleCreateChat(id)} />
    </AppLayout>
  );
}

function EmptyChat() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[24px] text-center">
      <MessageSquare size={36} style={{ color: "var(--foreground-30)" }} />
      <div className="mt-[16px] text-[16px]" style={{ color: "var(--foreground-50)" }}>{t("messenger.pickDialog")}</div>
    </div>
  );
}

function EmptyDialogs() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center px-[24px] py-[80px] text-center">
      <Users size={44} style={{ color: "var(--foreground-30)" }} />
      <div className="mt-[16px] font-semibold">{t("messenger.noDialogs")}</div>
      <Link to="/friends" className="mt-[20px] font-semibold" style={{ color: "var(--accent)" }}>{t("messenger.findFriends")}</Link>
    </div>
  );
}

function ChannelsList({ query }: { query: string }) {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<{ id: string; name: string; description: string; members: number; joined?: boolean }[]>([]);
  useEffect(() => {
    void fetchCommunities({ official: true }).then(setChannels);
  }, []);
  const q = query.trim().toLowerCase();
  const list = (q ? channels.filter((c) => c.name.toLowerCase().includes(q)) : channels).sort((a, b) => b.members - a.members);
  if (list.length === 0) return <div className="py-[40px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("messenger.channelsNotFound")}</div>;
  return (
    <ul>
      {list.map((c) => (
        <li key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
          <Link to="/channel/$id" params={{ id: c.id }} className="flex items-center gap-[12px] px-[16px] py-[12px]">
            <div className="grid h-[48px] w-[48px] place-items-center font-bold text-white" style={{ background: "var(--accent)", borderRadius: 12 }}>{c.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-[6px]"><span className="truncate font-semibold">{c.name}</span>{c.joined && <BadgeCheck size={12} style={{ color: "var(--accent)" }} />}</div>
              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}><Users size={11} /> {formatCount(c.members)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
