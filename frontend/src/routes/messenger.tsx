import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare,
  Paperclip, Search, Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById, me, formatRelativeTime, VOICE_TRANSCRIPTS, makeMockWaveform } from "@/lib/mock";
import type { Message } from "@/lib/mock";
import { useStore, actions, selectors, openOrCreateDialogWith } from "@/lib/store";
import { ChatHeaderActions } from "@/components/messenger/ChatHeaderActions";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { CreateChatDialog } from "@/components/messenger/CreateChatDialog";
import { VoiceBubble } from "@/components/messenger/VoiceBubble";
import { TimeAgo } from "@/components/TimeAgo";
import { VoiceRecorder } from "@/components/messenger/VoiceRecorder";
import { CallsList } from "@/components/calls/CallsList";
import { getAllChannels, useSubscriptions, formatCount } from "@/lib/channels";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/messenger")({
  head: () => ({ meta: [{ title: tStatic("messenger.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: MessengerPage,
});


const pulse = {
  animate: { opacity: [0.4, 0.7, 0.4] },
  transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
};

function DialogListSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-[12px] px-[16px] py-[12px] border-b" style={{ borderColor: "var(--border)" }}>
          <motion.div {...pulse} className="h-[48px] w-[48px] rounded-full" style={{ background: "var(--background-surface)" }} />
          <div className="flex-1 space-y-[8px]">
            <motion.div {...pulse} className="h-[12px] rounded-[6px]" style={{ background: "var(--background-surface)", width: `${50 + (i * 7) % 30}%` }} />
            <motion.div {...pulse} className="h-[12px] rounded-[6px]" style={{ background: "var(--background-surface)", width: `${60 + (i * 11) % 25}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  const items = [
    { w: "60%", h: 36, side: "left" as const },
    { w: "40%", h: 48, side: "right" as const },
    { w: "75%", h: 60, side: "left" as const },
  ];
  return (
    <div className="flex flex-col gap-[16px] p-[20px]">
      {items.map((b, i) => (
        <div key={i} className={`flex ${b.side === "right" ? "justify-end" : "justify-start"}`}>
          <motion.div
            {...pulse}
            style={{
              width: b.w,
              height: b.h,
              background: "var(--background-surface)",
              borderRadius: b.side === "right" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status?: Message["status"] }) {
  if (!status) return null;
  if (status === "sent") return <Check size={12} style={{ color: "rgba(255,255,255,0.5)" }} />;
  if (status === "delivered") return <CheckCheck size={12} style={{ color: "rgba(255,255,255,0.5)" }} />;
  return <CheckCheck size={12} style={{ color: "white" }} />;
}

function MessageBubble({
  msg, prev, allMessages, onReply,
}: {
  msg: Message; prev?: Message; allMessages: Message[]; onReply: (m: Message) => void;
}) {
  const { t } = useTranslation();
  const isMe = msg.authorId === me.id;
  const author = userById(msg.authorId);
  const isFirstInGroup = !prev || prev.authorId !== msg.authorId;
  const reply = msg.replyTo ? allMessages.find((m) => m.id === msg.replyTo) : null;
  const replyAuthor = reply ? userById(reply.authorId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex items-end gap-[8px] ${isMe ? "justify-end" : "justify-start"}`}
      style={{ marginTop: isFirstInGroup ? 16 : 4 }}
    >
      {!isMe && (
        <div className="w-[28px] shrink-0">
          {isFirstInGroup && <img src={author.avatar} alt="" className="h-[28px] w-[28px] rounded-full object-cover" />}
        </div>
      )}
      <div className="relative max-w-[70%]">
        {!isMe && (
          <button
            onClick={() => onReply(msg)}
            className="absolute -right-[36px] top-1/2 -translate-y-1/2 grid h-[28px] w-[28px] place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
            aria-label={t("categories.reply")}
          >
            <CornerUpLeft size={14} />
          </button>
        )}
        <div
          className="px-[14px] py-[10px]"
          style={{
            background: isMe ? "var(--accent)" : "var(--background-surface)",
            color: isMe ? "white" : "var(--foreground)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          }}
        >
          {reply && (
            <div
              className="mb-[6px] pl-[8px] text-[12px]"
              style={{
                borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.4)" : "var(--accent)"}`,
                color: isMe ? "rgba(255,255,255,0.85)" : "var(--foreground-50)",
              }}
            >
              <div className="font-semibold">{reply.authorId === me.id ? t("common.you") : replyAuthor?.name}</div>
              <div className="truncate">{reply.text}</div>
            </div>
          )}
          {msg.image && (
            <img
              src={msg.image}
              alt=""
              className="mb-[6px] max-h-[320px] w-full object-cover"
              style={{ borderRadius: "12px", maxWidth: 280 }}
            />
          )}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
          {msg.text && (
            <div className="text-[14px] leading-[1.4]" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.text}
            </div>
          )}
          <div
            className="mt-[4px] flex items-center justify-end gap-[4px] font-mono text-[10px]"
            style={{ color: isMe ? "rgba(255,255,255,0.6)" : "var(--foreground-30)" }}
          >
            <TimeAgo iso={msg.time} />
            {isMe && <StatusIcon status={msg.status} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MessengerPage() {
  const { t } = useTranslation();
  const dlgs = useStore(selectors.dialogsList);
  const dialogMetaMap = useStore((s) => s.dialogMeta);
  const { chat } = Route.useSearch();
  const [activeId, setActiveId] = useState<string | null>(chat ?? dlgs[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">(chat ? "chat" : "list");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [listTab, setListTab] = useState<"chats" | "channels" | "calls">("chats");
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getMeta = (id: string) => dialogMetaMap[id] ?? { archived: false, muted: false, blocked: false };


  // Respond to ?chat= search-param changes (e.g. "Написать" from another page)
  useEffect(() => {
    if (!chat) return;
    const exists = dlgs.some((d) => d.id === chat);
    if (exists) {
      setActiveId(chat);
      setMobileView("chat");
      actions.markRead(chat);
    }
  }, [chat, dlgs]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);


  useEffect(() => {
    if (activeId) {
      setChatLoading(true);
      const t = setTimeout(() => setChatLoading(false), 350);
      return () => clearTimeout(t);
    }
  }, [activeId]);

  const active = useMemo(() => dlgs.find((d) => d.id === activeId) ?? null, [dlgs, activeId]);
  const partner = active ? userById(active.userId) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = dlgs.filter((d) => {
      const m = getMeta(d.id);
      return showArchived ? m.archived : !m.archived;
    });
    if (!q) return base;
    return base.filter((d) => {
      const u = userById(d.userId);
      return u.name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q);
    });
  }, [dlgs, query, dialogMetaMap, showArchived]);

  const archivedCount = useMemo(
    () => dlgs.filter((d) => getMeta(d.id).archived).length,
    [dlgs, dialogMetaMap]
  );

  const handleCreateChat = (userId: string) => {
    const id = openOrCreateDialogWith(userId);
    setCreateOpen(false);
    setActiveId(id);
    setMobileView("chat");
    setShowArchived(false);
    actions.markRead(id);
    toast.success(t("messenger.chatOpened"), { description: t("messenger.chatOpenedDesc") });
  };


  useEffect(() => {
    if (!scrollRef.current || chatLoading) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages.length, chatLoading, activeId]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileView("chat");
    setReplyTo(null);
    actions.markRead(id);
  };

  const send = () => {
    if (!text.trim() || !active) return;
    if (getMeta(active.id).blocked) {
      toast.error(t("messenger.userBlocked"), { description: t("messenger.userBlockedDesc") });
      return;
    }
    const m: Message = {
      id: `nm${Date.now()}`,
      authorId: me.id,
      time: new Date().toISOString(),
      text: text.trim(),
      status: "sent",
      replyTo: replyTo?.id,
    };
    actions.addMessage(active.id, m);
    setText("");
    setReplyTo(null);
  };

  const sendVoice = (durationSec: number) => {
    if (!active) return;
    if (getMeta(active.id).blocked) {
      toast.error(t("messenger.userBlocked"), { description: t("messenger.userBlockedDesc") });
      return;
    }
    const seed = Date.now();
    const transcript = VOICE_TRANSCRIPTS[seed % VOICE_TRANSCRIPTS.length];
    const m: Message = {
      id: `nm${seed}`,
      authorId: me.id,
      time: new Date().toISOString(),
      text: "",
      status: "sent",
      replyTo: replyTo?.id,
      voice: {
        duration: durationSec,
        waveform: makeMockWaveform(seed),
        transcript,
      },
    };
    actions.addMessage(active.id, m);
    setReplyTo(null);
    toast.success(t("messenger.voiceSent"));
  };



  return (
    <AppLayout rightColumn={false}>
      <div
        className="grid overflow-hidden md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr]"
        style={{
          height: "calc(100vh - 120px)",
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
        }}
      >
        {/* Dialog List */}
        <aside
          className={`flex min-h-0 flex-col md:flex ${mobileView === "list" ? "flex" : "hidden"}`}
          style={{ background: "var(--background-elevated)", borderRight: "1px solid var(--border)" }}
        >
          <div className="sticky top-0 z-10 flex flex-col gap-[10px] px-[16px] py-[12px]" style={{ background: "var(--background-elevated)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-[8px]">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("messenger.searchDialog")}
                  className="w-full text-[14px] outline-none"
                  style={{
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 12,
                    background: "var(--background-surface)",
                    borderRadius: 10,
                    border: "1.5px solid transparent",
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--background)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "var(--background-surface)"; }}
                />
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label={t("messenger.newChat")}
                title={t("messenger.newChat")}
                className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[10px]"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="flex items-center gap-[6px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([
                { key: "chats-active" as const, label: t("messenger.tabActive") },
                { key: "channels" as const, label: t("messenger.tabChannels") },
                { key: "chats-archive" as const, label: `${t("messenger.tabArchive")}${archivedCount ? ` · ${archivedCount}` : ""}` },
                { key: "calls" as const, label: t("messenger.tabCalls") },
              ]).map((tabItem) => {
                const isActive =
                  (tabItem.key === "calls" && listTab === "calls") ||
                  (tabItem.key === "channels" && listTab === "channels") ||
                  (tabItem.key === "chats-active" && listTab === "chats" && !showArchived) ||
                  (tabItem.key === "chats-archive" && listTab === "chats" && showArchived);
                return (
                  <button
                    key={tabItem.key}
                    onClick={() => {
                      if (tabItem.key === "calls") setListTab("calls");
                      else if (tabItem.key === "channels") setListTab("channels");
                      else {
                        setListTab("chats");
                        setShowArchived(tabItem.key === "chats-archive");
                      }
                    }}
                    className="inline-flex shrink-0 items-center text-[12px] font-semibold transition-colors"
                    style={{
                      height: 28, padding: "0 12px", borderRadius: 999,
                      background: isActive ? "var(--accent-soft)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--foreground-50)",
                      border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >
                    {tabItem.label}
                  </button>
                );
              })}
            </div>
          </div>



          <div className="min-h-0 flex-1 overflow-y-auto">
            {listTab === "calls" ? (
              <CallsList
                onOpenChat={(did) => {
                  setListTab("chats");
                  setShowArchived(false);
                  setActiveId(did);
                  setMobileView("chat");
                  actions.markRead(did);
                }}
              />
            ) : listTab === "channels" ? (
              <ChannelsList query={query} />
            ) : loading ? (
              <DialogListSkeleton />


            ) : filtered.length === 0 ? (
              <EmptyDialogs />
            ) : (
              <motion.ul initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}>
                {filtered.map((d) => {
                  const u = userById(d.userId);
                  const isActive = d.id === activeId;
                  return (
                    <motion.li key={d.id} variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}>
                      <button
                        onClick={() => handleSelect(d.id)}
                        className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors duration-150"
                        style={{
                          background: isActive ? "var(--accent-soft)" : "transparent",
                          borderBottom: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--background-surface-hover)"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                      >
                        <div className="relative">
                          <img src={u.avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                          {u.online && (
                            <span
                              className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full"
                              style={{ background: "var(--success)", border: "2px solid var(--background-elevated)" }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-[8px]">
                            <span className="flex min-w-0 items-center gap-[6px] truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                              <span className="truncate">{u.name}</span>
                              {getMeta(d.id).muted && <BellOff size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                              {getMeta(d.id).blocked && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
                              {getMeta(d.id).archived && <Archive size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                            </span>
                            <TimeAgo iso={d.time} className="shrink-0 font-mono text-[11px]" style={{ color: "var(--foreground-50)" }} />
                          </div>
                          <div className="truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>{d.lastMessage}</div>
                        </div>
                        {!!d.unread && !getMeta(d.id).muted && (
                          <span
                            className="grid h-[20px] w-[20px] place-items-center rounded-full text-[11px] font-semibold"
                            style={{ background: "var(--accent)", color: "white" }}
                          >
                            {d.unread}
                          </span>
                        )}

                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </aside>

        {/* Chat Panel */}
        <section className={`flex min-h-0 flex-col md:flex ${mobileView === "chat" ? "flex" : "hidden"}`} style={{ background: "var(--background)" }}>
          {!active ? (
            <EmptyChat />
          ) : (
            <>
              {/* Header */}
              <header className="sticky top-0 z-10 flex items-center gap-[12px] px-[20px]" style={{ height: 60, background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => setMobileView("list")}
                  className="grid h-[40px] w-[40px] place-items-center rounded-full md:hidden"
                  style={{ color: "var(--foreground-70)" }}
                  aria-label={t("common.back")}
                >
                  <ArrowLeft size={20} />
                </button>
                <Link to="/user/$id" params={{ id: partner!.id }} className="flex items-center gap-[12px]">
                  <img src={partner!.avatar} alt="" className="h-[40px] w-[40px] rounded-full object-cover" />
                  <div>
                    <div className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{partner!.name}</div>
                    <div className="flex items-center gap-[6px] text-[12px]">
                      {partner!.online ? (
                        <>
                          <span className="h-[8px] w-[8px] rounded-full" style={{ background: "var(--success)" }} />
                          <span style={{ color: "var(--success)" }}>{t("messenger.online")}</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--foreground-50)" }}>{t("messenger.recently")}</span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="ml-auto flex items-center gap-[4px]">
                  <LanguageSwitcher />
                  <ChatHeaderActions partnerId={partner!.id} partnerName={partner!.name} dialogId={active.id} />
                </div>


              </header>

              {/* Messages */}
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[16px]">
                {chatLoading ? (
                  <MessageSkeleton />
                ) : (
                  active.messages.map((m, i) => (
                    <MessageBubble key={m.id} msg={m} prev={active.messages[i - 1]} allMessages={active.messages} onReply={setReplyTo} />
                  ))
                )}
              </div>

              {/* Input */}
              <div className="shrink-0" style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
                <AnimatePresence>
                  {replyTo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mx-[16px] mt-[12px] flex items-center gap-[10px] px-[16px] py-[10px]"
                        style={{
                          background: "var(--background-surface)",
                          borderRadius: "10px 10px 0 0",
                          borderBottom: "2px solid var(--accent)",
                        }}
                      >
                        <CornerUpLeft size={14} style={{ color: "var(--accent)" }} />
                        <div className="min-w-0 flex-1 text-[12px]">
                          <div className="font-semibold" style={{ color: "var(--foreground-70)" }}>
                            {t("messenger.replyTo", { name: replyTo.authorId === me.id ? t("common.you") : userById(replyTo.authorId).name })}
                          </div>
                          <div className="truncate" style={{ color: "var(--foreground-50)" }}>{replyTo.text}</div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="grid h-[20px] w-[20px] place-items-center rounded-full" style={{ color: "var(--foreground-50)" }} aria-label={t("messenger.cancelReply")}>
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative flex items-end gap-[8px] px-[12px] py-[10px]" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
                  <div
                    className="flex flex-1 items-end gap-[4px] pl-[6px] pr-[4px]"
                    style={{
                      minHeight: 42,
                      background: "var(--background-surface)",
                      borderRadius: 22,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <button
                      className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
                      style={{ color: "var(--foreground-50)" }}
                      aria-label={t("messenger.attach")}
                    >
                      <Paperclip size={18} />
                    </button>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={t("messenger.messagePlaceholder")}
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-[14px] outline-none"
                      style={{
                        minHeight: 36, maxHeight: 120,
                        padding: "9px 4px",
                        color: "var(--foreground)",
                        lineHeight: 1.35,
                      }}
                    />
                  </div>
                  {text.trim() ? (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={send}
                      className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full transition-opacity"
                      style={{
                        background: "var(--accent)",
                        color: "white",
                        boxShadow: "0 4px 12px -2px color-mix(in oklab, var(--accent) 50%, transparent)",
                      }}
                      aria-label={t("messenger.send")}
                    >
                      <Send size={18} />
                    </motion.button>
                  ) : (
                    <VoiceRecorder onSend={sendVoice} />
                  )}
                </div>

              </div>
            </>
          )}
        </section>
      </div>
      <CreateChatDialog open={createOpen} onClose={() => setCreateOpen(false)} onPick={handleCreateChat} />
    </AppLayout>
  );
}

function EmptyChat() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[24px] text-center">
      <div
        className="grid h-[96px] w-[96px] place-items-center rounded-full"
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
      >
        <MessageSquare size={36} />
      </div>
      <div className="mt-[16px] text-[16px]" style={{ color: "var(--foreground-50)" }}>{t("messenger.pickDialog")}</div>
      <div className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-30)" }}>{t("messenger.orNew")}</div>
    </div>
  );
}

function EmptyDialogs() {
  return (
    <div className="flex flex-col items-center justify-center px-[24px] py-[80px] text-center">
      <div
        className="grid h-[120px] w-[120px] place-items-center rounded-full"
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
      >
        <Users size={44} />
      </div>
      <div className="mt-[16px] font-display text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>{t("messenger.noDialogs")}</div>
      <div className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("messenger.noDialogsDesc")}</div>
      <Link
        to="/friends"
        className="mt-[20px] inline-flex items-center justify-center font-semibold transition-colors duration-150"
        style={{
          height: 44, padding: "0 28px", borderRadius: 999, background: "var(--accent)", color: "white", fontSize: 14,
        }}
      >{t("messenger.findFriends")}</Link>
    </div>
  );
}

function ChannelsList({ query }: { query: string }) {
  const { t } = useTranslation();
  const subs = useSubscriptions();
  const all = getAllChannels();
  const q = query.trim().toLowerCase();
  const list = (q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    : all
  ).slice().sort((a, b) => {
    const sa = subs.has(a.id) ? 1 : 0;
    const sb = subs.has(b.id) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.subscribers - a.subscribers;
  });

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-[24px] py-[60px] text-center">
        <div className="grid h-[80px] w-[80px] place-items-center rounded-full" style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}>
          <Radio size={32} />
        </div>
        <div className="mt-[12px] font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{t("messenger.channelsNotFound")}</div>
      </div>
    );
  }

  return (
    <ul>
      {list.map((c) => {
        const subscribed = subs.has(c.id);
        return (
          <li key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <Link
              to="/channel/$id"
              params={{ id: c.id }}
              className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors duration-150"
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--background-surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div
                className="grid h-[48px] w-[48px] shrink-0 place-items-center font-display text-[18px] font-bold text-white"
                style={{ background: c.avatarColor, borderRadius: 12 }}
              >
                {c.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  <span className="truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {c.name}
                  </span>
                  {c.kind === "official" && <BadgeCheck size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                </div>
                <div className="mt-[2px] flex items-center gap-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  <span className="inline-flex items-center gap-[4px]"><Users size={11} /> {formatCount(c.subscribers)}</span>
                  <span className="truncate">{c.description}</span>
                </div>
              </div>
              {subscribed && (
                <span
                  className="shrink-0 inline-flex items-center gap-[4px] text-[11px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 8px", borderRadius: 999 }}
                >
                  <Check size={11} /> {t("messenger.subscribedBadge")}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
