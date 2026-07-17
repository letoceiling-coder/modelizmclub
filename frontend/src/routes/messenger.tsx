import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare, Pin, MoreHorizontal,
  Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck, ImageOff, ImagePlus,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById, formatRelativeTime, makeMockWaveform } from "@/lib/mock";
import type { Message } from "@/lib/mock";
import {
  useStore, actions, selectors,
  setDialogs, setDialogMessages, replaceMessage, upsertMessage,
  GUEST_USER, getState,
} from "@/lib/store";
import {
  fetchConversations, fetchMessages, sendMessage as apiSendMessage,
  uploadVoice, sendVoiceMessage as apiSendVoiceMessage,
  uploadChatAttachment, sendAttachmentMessage,
  hideMessageForMe, pinMessage as apiPinMessage,
} from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";
import { setWatchingDialog } from "@/lib/realtime/user";
import { setHubConversation } from "@/lib/realtime/hub";
import { isEchoConnected, onEchoConnection } from "@/lib/realtime/echo";
import { useOnlineSet } from "@/lib/realtime/presence";
import { ChatHeaderActions } from "@/components/messenger/ChatHeaderActions";
import { AttachmentMenu, type AttachmentKind } from "@/components/messenger/AttachmentMenu";
import { MessageFileBubble } from "@/components/messenger/MessageFileBubble";
import { MessageActionsMenu, type MessageActionsMenuHandle } from "@/components/messenger/MessageActionsMenu";
import { ForwardDialog } from "@/components/messenger/ForwardDialog";
import { DialogContextMenu } from "@/components/messenger/DialogContextMenu";
import { VoiceBubble } from "@/components/messenger/VoiceBubble";
import { TimeAgo } from "@/components/TimeAgo";
import { VoiceRecorder } from "@/components/messenger/VoiceRecorder";
import { CallsList } from "@/components/calls/CallsList";
import { useChannels, formatCount } from "@/lib/channels";
import { Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ChatAvatar } from "@/components/messenger/ChatAvatar";

export const Route = createFileRoute("/messenger")({
  head: () => ({ meta: [{ title: "Мессенджер — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  validateSearch: (search: Record<string, unknown>): { chat?: string } => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: MessengerPage,
});


function DialogListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-[12px] border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
          <Skeleton className="h-[48px] w-[48px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-[8px]">
            <Skeleton className="h-[12px] rounded-[6px]" style={{ width: `${50 + (i * 7) % 30}%` }} />
            <Skeleton className="h-[12px] rounded-[6px]" style={{ width: `${60 + (i * 11) % 25}%` }} />
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
          <Skeleton
            style={{
              width: b.w,
              height: b.h,
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

const IMAGE_MAX_W = 280;
const IMAGE_MAX_H = 320;
const IMAGE_PLACEHOLDER_H = 200;

function fitImageSize(naturalW: number, naturalH: number): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { w: IMAGE_MAX_W, h: IMAGE_PLACEHOLDER_H };
  }
  const scale = Math.min(IMAGE_MAX_W / naturalW, IMAGE_MAX_H / naturalH, 1);
  return {
    w: Math.max(120, Math.round(naturalW * scale)),
    h: Math.max(90, Math.round(naturalH * scale)),
  };
}

function MessageImage({ src, onResize }: { src: string; onResize?: () => void }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [frame, setFrame] = useState({ w: IMAGE_MAX_W, h: IMAGE_PLACEHOLDER_H });

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setFrame(fitImageSize(img.naturalWidth, img.naturalHeight));
      setLoaded(true);
      onResize?.();
    };
    img.onerror = () => {
      if (!alive) return;
      setBroken(true);
      onResize?.();
    };
    img.src = src;
    return () => {
      alive = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onResize]);

  if (broken) {
    return (
      <div
        className="mb-[6px] grid place-items-center"
        style={{
          width: IMAGE_MAX_W,
          maxWidth: "100%",
          height: IMAGE_PLACEHOLDER_H,
          borderRadius: 12,
          background: "var(--background-surface)",
          color: "var(--foreground-30)",
        }}
      >
        <ImageOff size={26} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть фото на весь экран"
        className="mb-[6px] block cursor-zoom-in p-0"
        style={{ width: frame.w, maxWidth: "100%" }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: "100%",
            height: frame.h,
            borderRadius: 12,
            background: "var(--background-surface)",
            transition: "height 180ms ease",
          }}
        >
          {!loaded && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }}
            />
          )}
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            style={{
              borderRadius: 12,
              opacity: loaded ? 1 : 0,
              transition: "opacity 180ms ease",
            }}
          />
        </div>
      </button>
      {open && <ImageLightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

function MessageBubble({
  msg, prev, allMessages, onReply, onCopy, onForward, onPin, onDelete, onReport, onMediaResize,
}: {
  msg: Message; prev?: Message; allMessages: Message[];
  onReply: (m: Message) => void;
  onCopy: (m: Message) => void;
  onForward: (m: Message) => void;
  onPin: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReport: (m: Message) => void;
  onMediaResize?: () => void;
}) {
  const meId = useStore((s) => s.currentUserId);
  const isMe = msg.authorId === meId;
  const author = userById(msg.authorId);
  const isFirstInGroup = !prev || prev.authorId !== msg.authorId;
  const hasMedia = Boolean(msg.image || msg.file || msg.voice);
  const reply = msg.replyTo ? allMessages.find((m) => m.id === msg.replyTo) : null;
  const replyAuthor = reply ? userById(reply.authorId) : null;
  const forwardedAuthor = msg.forwardedFrom ? userById(msg.forwardedFrom) : null;

  const menuRef = useRef<MessageActionsMenuHandle>(null);
  const touchTimer = useRef<number | null>(null);
  const startLongPress = () => {
    touchTimer.current = window.setTimeout(() => menuRef.current?.open(), 400);
  };
  const cancelLongPress = () => {
    if (touchTimer.current) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  return (
    <motion.div
      initial={hasMedia ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: hasMedia ? 0.18 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex items-end gap-[8px] ${isMe ? "justify-end" : "justify-start"}`}
      style={{ marginTop: isFirstInGroup ? 16 : 4 }}
    >
      {!isMe && (
        <div className="w-[28px] shrink-0">
          {isFirstInGroup && <ChatAvatar src={author.avatar} name={author.name} size={28} />}
        </div>
      )}
      <div
        className="relative max-w-[82%] sm:max-w-[70%]"
        data-msg-id={msg.id}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
      >
        {/* Hover affordance is desktop-only: on mobile the same menu opens via
            long-press → portal bottom-sheet, so this off-bubble trigger would
            only push the row past the viewport (horizontal overflow). */}
        <div className={`absolute top-1/2 hidden -translate-y-1/2 sm:block ${isMe ? "-left-[48px]" : "-right-[48px]"}`}>
          <MessageActionsMenu
            ref={menuRef}
            isMe={isMe}
            pinned={Boolean(msg.pinned)}
            align={isMe ? "right" : "left"}
            onReply={() => onReply(msg)}
            onCopy={() => onCopy(msg)}
            onForward={() => onForward(msg)}
            onPin={() => onPin(msg)}
            onDelete={() => onDelete(msg)}
            onReport={() => onReport(msg)}
          />
        </div>
        <div
          className="px-[14px] py-[10px]"
          style={{
            background: isMe ? "var(--accent)" : "var(--background-surface)",
            color: isMe ? "white" : "var(--foreground)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          }}
        >
          {forwardedAuthor && (
            <div
              className="mb-[6px] text-[11px] font-semibold italic"
              style={{ color: isMe ? "rgba(255,255,255,0.75)" : "var(--foreground-50)" }}
            >
              Переслано от {forwardedAuthor.name}
            </div>
          )}
          {reply && (
            <div
              className="mb-[6px] pl-[8px] text-[12px]"
              style={{
                borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.4)" : "var(--accent)"}`,
                color: isMe ? "rgba(255,255,255,0.85)" : "var(--foreground-50)",
              }}
            >
              <div className="font-semibold">{reply.authorId === meId ? "Вы" : replyAuthor?.name}</div>
              <div className="truncate">{reply.text}</div>
            </div>
          )}
          {msg.image && <MessageImage src={msg.image} onResize={onMediaResize} />}
          {msg.file && <MessageFileBubble file={msg.file} isMe={isMe} />}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} />}
          {msg.text && (
            <div className="text-[14px] leading-[1.4]" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
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
  const dlgs = useStore(selectors.dialogsList);
  const meId = useStore((s) => s.currentUserId);
  const dialogMetaMap = useStore((s) => s.dialogMeta);
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const dialogAdRefs = useStore((s) => s.dialogAdRefs);
  const isPartnerBlocked = (dialogUserId: string) => blockedUserIds.includes(dialogUserId);
  const onlineSet = useOnlineSet();
  const { chat } = Route.useSearch();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(chat ?? dlgs[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">(chat ? "chat" : "list");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [listTab, setListTab] = useState<"chats" | "channels" | "calls">("chats");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleMediaResize = useCallback(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  const getMeta = (id: string) => dialogMetaMap[id] ?? { archived: false, muted: false, blocked: false };


  // Respond to ?chat= search-param changes (e.g. "Написать" from another page).
  // Deps include `dlgs`, whose reference changes on every store dispatch
  // (useStore's snapshot memo), not just when dialogs actually change — so
  // this can re-fire for unrelated updates while `chat` is still set to a
  // dialog the user just deleted (deselectDialog's navigate() clearing the
  // URL is async and can lose the race). Guard against re-selecting a
  // dialog that's been locally deleted.
  useEffect(() => {
    if (!chat) return;
    const dlg = dlgs.find((d) => d.id === chat);
    if (!dlg) return;
    if (dialogMetaMap[chat]?.deletedLocally) return;
    setActiveId(chat);
    setMobileView("chat");
    if (dlg.unread) actions.markRead(chat);
  }, [chat, dlgs, dialogMetaMap]);

  useEffect(() => {
    let alive = true;
    fetchConversations(meId)
      .then((list) => {
        if (!alive) return;
        setDialogs(list);
        list.forEach((d) => {
          if (d.listing) actions.setDialogAd(d.id, d.listing);
        });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [meId]);

  useEffect(() => {
    setWatchingDialog(activeId);
    return () => setWatchingDialog(null);
  }, [activeId]);

  // Poll dialog list only when WebSocket is down.
  useEffect(() => {
    if (meId === GUEST_USER.id) return;
    const tick = () => {
      if (isEchoConnected()) return;
      fetchConversations(meId)
        .then((list) => setDialogs(list))
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, 20_000);
    const unsubConn = onEchoConnection((connected) => {
      if (connected) tick();
    });
    return () => {
      window.clearInterval(interval);
      unsubConn();
    };
  }, [meId]);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    setChatLoading(true);
    fetchMessages(activeId)
      .then(async (msgs) => {
        if (!alive) return;
        setDialogMessages(activeId, msgs);
        const pending = getState().pendingDialogMessages[activeId];
        if (pending) {
          try {
            const saved = await apiSendMessage(activeId, pending);
            actions.addMessage(activeId, saved);
          } catch {
            /* delivery-choice message is best-effort; conversation itself already exists */
          } finally {
            actions.clearPendingMessage(activeId);
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setChatLoading(false); });
    return () => { alive = false; };
  }, [activeId]);

  // Poll messages only when WebSocket is down (open chat fallback).
  useEffect(() => {
    if (!activeId) return;
    const id = activeId;
    const tick = () => {
      if (isEchoConnected()) return;
      if (getState().pendingDialogMessages[id]) return; // avoid clobbering while the delivery-choice flush (other effect) is in flight
      fetchMessages(id)
        .then((msgs) => setDialogMessages(id, msgs))
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, 12_000);
    const unsubConn = onEchoConnection((connected) => {
      if (connected) tick();
    });
    return () => {
      window.clearInterval(interval);
      unsubConn();
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeId || meId === GUEST_USER.id) {
      setHubConversation(null);
      return;
    }
    setHubConversation(activeId, (m) => upsertMessage(activeId, m));
    return () => setHubConversation(null);
  }, [activeId, meId]);

  const active = useMemo(() => dlgs.find((d) => d.id === activeId) ?? null, [dlgs, activeId]);
  const partner = active ? userById(active.userId) : null;
  const activeAdRef = activeId ? dialogAdRefs[activeId] : undefined;

  const pinnedMessage = active?.messages.find((m) => m.pinned && !m.deletedForMe) ?? null;

  const scrollToMessage = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = dlgs.filter((d) => {
      const m = getMeta(d.id);
      if (m.deletedLocally) return false;
      return showArchived ? m.archived : !m.archived;
    });
    const searched = !q
      ? base
      : base.filter((d) => {
          const u = userById(d.userId);
          return u.name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q);
        });
    if (showArchived) return searched;
    return [...searched].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      return pb - pa;
    });
  }, [dlgs, query, dialogMetaMap, showArchived]);

  const archivedCount = useMemo(
    () => dlgs.filter((d) => { const m = getMeta(d.id); return m.archived && !m.deletedLocally; }).length,
    [dlgs, dialogMetaMap]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeId]);

  useEffect(() => {
    if (!scrollRef.current || chatLoading) return;
    scrollToBottom(stickToBottomRef.current ? "smooth" : "auto");
  }, [active?.messages.length, chatLoading, activeId, scrollToBottom]);

  useEffect(() => {
    const target = messagesContentRef.current;
    if (!target) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom("auto");
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [activeId, active?.messages.length, scrollToBottom]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileView("chat");
    setReplyTo(null);
    actions.markRead(id);
  };

  // Used after "Удалить чат". Also clears the ?chat= search param when it
  // points at the deleted dialog — otherwise the sync-from-URL effect above
  // (deps: [chat, dlgs]) re-fires on the next store dispatch (dlgs gets a new
  // array reference from useStore's snapshot memo on every dispatch, even
  // when the dialogs themselves didn't change) and silently re-selects the
  // just-deleted dialog right back.
  const deselectDialog = (id: string) => {
    setActiveId(null);
    setMobileView("list");
    if (chat === id) void navigate({ to: "/messenger", search: {} });
  };

  const [dialogCtxMenu, setDialogCtxMenu] = useState<{ dialogId: string; point: { x: number; y: number } } | null>(null);
  const dialogLongPressTimer = useRef<number | null>(null);
  const suppressNextDialogClick = useRef(false);
  const startDialogLongPress = (dialogId: string, x: number, y: number) => {
    dialogLongPressTimer.current = window.setTimeout(() => {
      suppressNextDialogClick.current = true;
      setDialogCtxMenu({ dialogId, point: { x, y } });
    }, 450);
  };
  const cancelDialogLongPress = () => {
    if (dialogLongPressTimer.current) {
      window.clearTimeout(dialogLongPressTimer.current);
      dialogLongPressTimer.current = null;
    }
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    if (isPartnerBlocked(active.userId)) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
    const dialogId = active.id;
    const body = text.trim();
    const replyId = replyTo?.id;
    const tempId = `tmp${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      clientKey: tempId,
      authorId: meId,
      time: new Date().toISOString(),
      text: body,
      status: "sent",
      replyTo: replyId,
    };
    actions.addMessage(dialogId, optimistic);
    setText("");
    setReplyTo(null);
    try {
      const saved = await apiSendMessage(dialogId, body, replyId);
      replaceMessage(dialogId, tempId, saved);
    } catch {
      toast.error("Не удалось отправить сообщение");
    }
  };

  const sendVoice = async (blob: Blob, durationSec: number) => {
    if (!active) return;
    if (isPartnerBlocked(active.userId)) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
    const dialogId = active.id;
    const replyId = replyTo?.id;
    const tempId = `tmp${Date.now()}`;
    const localUrl = URL.createObjectURL(blob);
    const optimistic: Message = {
      id: tempId,
      clientKey: tempId,
      authorId: meId,
      time: new Date().toISOString(),
      text: "",
      status: "sent",
      replyTo: replyId,
      voice: {
        duration: durationSec,
        waveform: makeMockWaveform(Date.now()),
        src: localUrl,
      },
    };
    actions.addMessage(dialogId, optimistic);
    setReplyTo(null);
    // Demo mode has no media backend — the optimistic message already carries a
    // playable blob URL + waveform + duration, so it IS the final message. Skip
    // the upload/send (which would 404 against no backend) and keep the blob.
    if (isDemoMode()) return;
    try {
      const { uuid } = await uploadVoice(blob, durationSec);
      const saved = await apiSendVoiceMessage(dialogId, uuid, durationSec, replyId);
      replaceMessage(dialogId, tempId, saved);
      URL.revokeObjectURL(localUrl);
    } catch {
      toast.error("Не удалось отправить голосовое");
    }
  };

  const handleAttachment = async (file: File, kind: AttachmentKind) => {
    if (!active) return;
    if (isPartnerBlocked(active.userId)) {
      toast.error("Пользователь заблокирован", { description: "Разблокируйте его, чтобы отправлять сообщения" });
      return;
    }
    const dialogId = active.id;
    const url = URL.createObjectURL(file);
    const replyId = replyTo?.id;
    const tempId = `tmp${Date.now()}`;
    const base: Message = {
      id: tempId,
      clientKey: tempId,
      authorId: meId,
      time: new Date().toISOString(),
      text: "",
      status: "sent",
      replyTo: replyId,
    };
    const optimistic: Message =
      kind === "image" ? { ...base, image: url } : { ...base, file: { name: file.name, size: file.size, kind, url } };
    actions.addMessage(dialogId, optimistic);
    setReplyTo(null);
    if (isDemoMode()) {
      toast("Вложение отправлено (демо)", { description: "Загрузка на сервер появится позже" });
      return;
    }
    try {
      const uploaded = await uploadChatAttachment(dialogId, file);
      const saved = await sendAttachmentMessage(dialogId, uploaded.media_uuid, uploaded.type, replyId);
      replaceMessage(dialogId, tempId, saved);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Не удалось отправить вложение");
    }
  };

  const quickPhotoRef = useRef<HTMLInputElement>(null);
  const handleQuickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleAttachment(file, "image");
  };

  const handleCopy = (m: Message) => {
    const text = m.text || (m.file ? m.file.name : m.image ? "[изображение]" : "[вложение]");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Скопировано"),
      () => toast.error("Не удалось скопировать"),
    );
  };

  const handlePinMessage = async (m: Message) => {
    if (!active) return;
    actions.pinMessage(active.id, m.id);
    if (!isDemoMode()) {
      try {
        await apiPinMessage(active.id, m.id);
      } catch {
        toast.error("Не удалось закрепить сообщение");
      }
    }
  };

  const handleDeleteMessage = async (m: Message) => {
    if (!active) return;
    actions.deleteMessageForMe(active.id, m.id);
    if (!isDemoMode()) {
      try {
        await hideMessageForMe(active.id, m.id);
      } catch {
        toast.error("Не удалось удалить сообщение");
      }
    }
  };

  const handleReportMessage = () => {
    toast("Жалоба: будет доступно позже");
  };

  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  return (
    <AppLayout rightColumn={false} hideMobileHeader hideBottomNav={mobileView === "chat"}>
      <div
        className={`grid overflow-hidden ${
          mobileView === "chat"
            ? "h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-24px)]"
            : "h-[calc(100dvh-var(--safe-top)-var(--bottom-nav-space)-28px)]"
        } md:grid-cols-[320px_1fr] lg:h-[calc(100vh-var(--desktop-topbar-h)-var(--mobile-header-h)-28px)] lg:grid-cols-[320px_1fr]`}
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
        }}
      >
        {/* Dialog List */}
        <aside
          className={`flex min-h-0 min-w-0 flex-col md:flex ${mobileView === "list" ? "flex" : "hidden"}`}
          style={{ background: "var(--background-elevated)", borderRight: "1px solid var(--border)" }}
        >
          <div className="sticky top-0 z-10 flex flex-col gap-[10px] px-[16px] py-[12px]" style={{ background: "var(--background-elevated)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-[8px]">
              <div className="min-w-0 flex-1">
                <SearchInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={() => setQuery("")}
                  placeholder="Поиск диалога"
                  aria-label="Поиск диалога"
                />
              </div>
            </div>
            <div className="flex items-center gap-[16px] overflow-x-auto no-scrollbar" style={{ borderBottom: "1px solid var(--border)" }}>
              {([
                { key: "chats-active" as const, label: "Активные" },
                { key: "channels" as const, label: "Каналы" },
                { key: "chats-archive" as const, label: `Архив${archivedCount ? ` · ${archivedCount}` : ""}` },
                { key: "calls" as const, label: "Звонки" },
              ]).map((t) => {
                const isActive =
                  (t.key === "calls" && listTab === "calls") ||
                  (t.key === "channels" && listTab === "channels") ||
                  (t.key === "chats-active" && listTab === "chats" && !showArchived) ||
                  (t.key === "chats-archive" && listTab === "chats" && showArchived);
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      if (t.key === "calls") setListTab("calls");
                      else if (t.key === "channels") setListTab("channels");
                      else {
                        setListTab("chats");
                        setShowArchived(t.key === "chats-archive");
                      }
                    }}
                    className="shrink-0 text-[13px] transition-colors"
                    style={{
                      height: 32,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--accent)" : "var(--foreground-50)",
                      borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    {t.label}
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
              <ul>
                {filtered.map((d) => {
                  const u = userById(d.userId);
                  const isActive = d.id === activeId;
                  const isUnread = !!d.unread && !getMeta(d.id).muted;
                  const adRef = dialogAdRefs[d.id];
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => {
                          if (suppressNextDialogClick.current) {
                            suppressNextDialogClick.current = false;
                            return;
                          }
                          handleSelect(d.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setDialogCtxMenu({ dialogId: d.id, point: { x: e.clientX, y: e.clientY } });
                        }}
                        onTouchStart={(e) => {
                          const t = e.touches[0];
                          startDialogLongPress(d.id, t.clientX, t.clientY);
                        }}
                        onTouchEnd={cancelDialogLongPress}
                        onTouchMove={cancelDialogLongPress}
                        className="group flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors duration-150"
                        style={{
                          background: isActive ? "var(--accent-soft)" : "transparent",
                          borderBottom: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--background-surface-hover)"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                      >
                        <ChatAvatar src={u.avatar} name={u.name} size={48} online={onlineSet.has(d.userId) || u.online} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-[8px]">
                            {/* Flex row of [pin?] name [muted?/blocked?/archived?].
                                The name must carry BOTH `truncate` and `min-w-0`
                                — a flex child's default `min-width:auto` otherwise
                                refuses to shrink below its text's intrinsic width,
                                so once a pin/mute icon takes space the name gets
                                clipped (or hidden entirely) instead of ellipsizing.
                                `truncate` on the flex *container* is a no-op, so it
                                lives only on the text span. */}
                            <span className="flex min-w-0 items-center gap-[6px] font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                              {d.pinned && <Pin size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                              <span className="min-w-0 truncate" title={u.name}>{u.name}</span>
                              {getMeta(d.id).muted && <BellOff size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                              {isPartnerBlocked(d.userId) && <Ban size={12} style={{ color: "var(--error)", flexShrink: 0 }} />}
                              {getMeta(d.id).archived && <Archive size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />}
                            </span>
                            <TimeAgo
                              iso={d.time}
                              className="shrink-0 font-mono text-[11px]"
                              style={{ color: isUnread ? "var(--accent)" : "var(--foreground-50)", fontWeight: isUnread ? 700 : 400 }}
                            />
                          </div>
                          <div
                            className="truncate text-[13px]"
                            style={{ color: isUnread ? "var(--foreground)" : "var(--foreground-50)", fontWeight: isUnread ? 600 : 400 }}
                          >
                            {d.lastMessage}
                          </div>
                          {adRef && (
                            <div className="mt-[4px] flex items-center gap-[6px]">
                              {adRef.image ? (
                                <img src={adRef.image} alt="" className="h-[18px] w-[18px] shrink-0 rounded-[4px] object-cover" />
                              ) : (
                                <div className="h-[18px] w-[18px] shrink-0 rounded-[4px]" style={{ background: "var(--background-surface)" }} />
                              )}
                              <span className="truncate text-[11px]" style={{ color: "var(--foreground-50)" }}>{adRef.title}</span>
                            </div>
                          )}
                        </div>
                        {!!d.unread && !getMeta(d.id).muted && (
                          <Badge
                            variant="default"
                            withIcon={false}
                            className="h-[20px] min-w-[20px] shrink-0 justify-center rounded-full px-[6px] py-0 text-[11px] leading-none tabular-nums"
                          >
                            {d.unread}
                          </Badge>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Действия с чатом"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setDialogCtxMenu({ dialogId: d.id, point: { x: r.left, y: r.bottom } });
                          }}
                          className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                          style={{ color: "var(--foreground-50)" }}
                        >
                          <MoreHorizontal size={16} />
                        </span>

                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat Panel */}
        <section className={`flex min-h-0 min-w-0 flex-col md:flex ${mobileView === "chat" ? "flex" : "hidden"}`} style={{ background: "var(--background)" }}>
          {!active ? (
            <EmptyChat />
          ) : (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 flex flex-col" style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
              <header className="flex items-center gap-[12px] px-[12px] sm:px-[20px]" style={{ height: 60 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileView("list")}
                  className="rounded-full text-[var(--foreground-70)] md:hidden"
                  aria-label="Назад"
                >
                  <ArrowLeft size={20} />
                </Button>
                <Link to="/user/$id" params={{ id: partner!.slug ?? partner!.id }} className="flex min-w-0 items-center gap-[12px]">
                  <ChatAvatar src={partner!.avatar} name={partner!.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }} title={partner!.name}>{partner!.name}</div>
                    <div className="flex items-center gap-[6px] text-[12px]">
                      {(onlineSet.has(partner!.id) || partner!.online) ? (
                        <>
                          <span className="h-[8px] w-[8px] rounded-full" style={{ background: "var(--success)" }} />
                          <span style={{ color: "var(--success)" }}>В сети</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--foreground-50)" }}>Был(а) недавно</span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="ml-auto flex items-center gap-[4px]">
                  <ChatHeaderActions
                    partnerId={partner!.id}
                    partnerName={partner!.name}
                    dialogId={active.id}
                    pinned={Boolean(active.pinned)}
                    onDeleted={() => deselectDialog(active.id)}
                  />
                </div>


              </header>
                {activeAdRef && (
                  <Link
                    to="/ads/$id"
                    params={{ id: activeAdRef.id }}
                    className="flex items-center gap-[10px] px-[12px] py-[8px] transition-colors hover:bg-[var(--background-surface)] sm:px-[20px]"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {activeAdRef.image ? (
                      <img
                        src={activeAdRef.image}
                        alt=""
                        className="h-[36px] w-[36px] shrink-0 rounded-[8px] object-cover"
                      />
                    ) : (
                      <div className="h-[36px] w-[36px] shrink-0 rounded-[8px]" style={{ background: "var(--background-surface)" }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]" style={{ color: "var(--foreground)" }}>{activeAdRef.title}</div>
                      <div className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                        {activeAdRef.price.toLocaleString("ru")} ₽
                      </div>
                    </div>
                  </Link>
                )}
              </div>

              {pinnedMessage && (
                <button
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  className="flex w-full items-center gap-[10px] border-b px-[20px] py-[8px] text-left"
                  style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
                >
                  <Pin size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>
                    {pinnedMessage.text || (pinnedMessage.file ? pinnedMessage.file.name : "Вложение")}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.pinMessage(active!.id, pinnedMessage.id);
                    }}
                    className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full"
                    style={{ color: "var(--foreground-50)" }}
                    aria-label="Открепить сообщение"
                  >
                    <X size={13} />
                  </span>
                </button>
              )}

              {/* Messages */}
              <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-[12px] py-[16px] sm:px-[20px]" style={{ overflowAnchor: "auto" }}>
                {chatLoading ? (
                  <MessageSkeleton />
                ) : (
                  <div ref={messagesContentRef}>
                    {active.messages
                      .filter((m) => !m.deletedForMe)
                      .map((m, i, arr) => (
                        <MessageBubble
                          key={m.clientKey ?? m.id}
                          msg={m}
                          prev={arr[i - 1]}
                          allMessages={active.messages}
                          onReply={setReplyTo}
                          onCopy={handleCopy}
                          onForward={setForwardMsg}
                          onPin={handlePinMessage}
                          onDelete={handleDeleteMessage}
                          onReport={handleReportMessage}
                          onMediaResize={handleMediaResize}
                        />
                      ))}
                  </div>
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
                            Ответ: {replyTo.authorId === meId ? "Вы" : userById(replyTo.authorId).name}
                          </div>
                          <div className="truncate" style={{ color: "var(--foreground-50)" }}>{replyTo.text}</div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="grid h-[20px] w-[20px] place-items-center rounded-full" style={{ color: "var(--foreground-50)" }} aria-label="Отменить ответ">
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Composer: attach · photo · input · mic/send — one optical
                    line (items-end), equal 44px tap targets, equal gaps. Attach
                    controls live outside the pill so the row reads as one set. */}
                <div className="relative flex items-end gap-[4px] px-[8px] py-[8px]" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
                  <AttachmentMenu onPick={handleAttachment} />
                  <input
                    ref={quickPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleQuickPhoto}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => quickPhotoRef.current?.click()}
                    className="h-[44px] w-[44px] shrink-0 rounded-full text-[var(--foreground-50)] sm:h-[40px] sm:w-[40px]"
                    aria-label="Быстрое фото"
                  >
                    <ImagePlus size={18} />
                  </Button>
                  <div
                    className="flex min-w-0 flex-1 items-center px-[14px]"
                    style={{
                      minHeight: 44,
                      background: "var(--background-surface)",
                      borderRadius: 22,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Сообщение..."
                      rows={1}
                      className="min-w-0 flex-1 resize-none bg-transparent text-[14px] outline-none"
                      style={{
                        minHeight: 24, maxHeight: 120,
                        padding: "0",
                        color: "var(--foreground)",
                        lineHeight: 1.35,
                      }}
                    />
                  </div>
                  {text.trim() ? (
                    <Button
                      size="icon"
                      onClick={send}
                      className="h-[44px] w-[44px] shrink-0 rounded-full transition-transform active:scale-95 sm:h-[40px] sm:w-[40px]"
                      aria-label="Отправить"
                    >
                      <Send size={18} />
                    </Button>
                  ) : (
                    <VoiceRecorder onSend={sendVoice} />
                  )}
                </div>

              </div>
            </>
          )}
        </section>
      </div>
      <ForwardDialog message={forwardMsg} onClose={() => setForwardMsg(null)} />
      <DialogContextMenu
        point={dialogCtxMenu?.point ?? null}
        onClose={() => setDialogCtxMenu(null)}
        pinned={Boolean(dlgs.find((x) => x.id === dialogCtxMenu?.dialogId)?.pinned)}
        muted={Boolean(dialogCtxMenu && getMeta(dialogCtxMenu.dialogId).muted)}
        onMarkUnread={() => dialogCtxMenu && actions.markUnread(dialogCtxMenu.dialogId)}
        onTogglePin={() => {
          if (!dialogCtxMenu) return;
          const dlg = dlgs.find((x) => x.id === dialogCtxMenu.dialogId);
          actions.pinDialog(dialogCtxMenu.dialogId, !dlg?.pinned);
        }}
        onToggleMute={() => {
          if (!dialogCtxMenu) return;
          const muted = getMeta(dialogCtxMenu.dialogId).muted;
          actions.setDialogMeta(dialogCtxMenu.dialogId, muted ? { muted: false, mutedUntil: undefined } : { muted: true });
        }}
        onClearHistory={() => {
          if (!dialogCtxMenu) return;
          if (!window.confirm("Очистить историю переписки в этом чате? Это действие нельзя отменить.")) return;
          actions.clearHistory(dialogCtxMenu.dialogId);
        }}
        onDeleteChat={() => {
          if (!dialogCtxMenu) return;
          if (!window.confirm("Удалить чат? Переписка исчезнет из списка.")) return;
          actions.setDialogMeta(dialogCtxMenu.dialogId, { deletedLocally: true });
          if (activeId === dialogCtxMenu.dialogId) deselectDialog(dialogCtxMenu.dialogId);
        }}
      />
    </AppLayout>
  );
}

function EmptyChat() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="Выберите диалог"
      description="или начните новый разговор"
      variant="bare"
      className="flex-1"
    />
  );
}

function EmptyDialogs() {
  return (
    <EmptyState
      icon={Users}
      title="Нет диалогов"
      description="Начните общение в категориях или найдите друзей"
      variant="bare"
    >
      <Button asChild size="lg" className="rounded-full px-[28px]">
        <Link to="/friends">Найти друзей</Link>
      </Button>
    </EmptyState>
  );
}

function ChannelsList({ query }: { query: string }) {
  const { channels: all } = useChannels();
  const q = query.trim().toLowerCase();
  const list = (q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    : all
  ).slice().sort((a, b) => {
    const sa = a.isSubscribed ? 1 : 0;
    const sb = b.isSubscribed ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.subscribers - a.subscribers;
  });

  if (list.length === 0) {
    return <EmptyState icon={Radio} title="Каналы не найдены" variant="bare" />;
  }

  return (
    <ul>
      {list.map((c) => {
        const subscribed = Boolean(c.isSubscribed);
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
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 8px", borderRadius: "var(--r-pill)" }}
                >
                  <Check size={11} /> Подписан
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
