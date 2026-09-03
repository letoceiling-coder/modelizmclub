import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, CheckCheck, CornerUpLeft, MessageSquare, Pin, MoreHorizontal,
  Send, Users, X, Plus, Archive, Ban, BellOff, Radio, BadgeCheck, ImageOff,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById, formatRelativeTime, makeMockWaveform } from "@/lib/mock";
import type { Dialog, Message } from "@/lib/mock";
import {
  useStore, actions, selectors,
  setDialogs, setDialogMessages, mergeDialogMessages, replaceMessage, upsertMessage,
  GUEST_USER, getState, markOwnMessagesDelivered, markDialogDeleted, restoreDialog,
  openOrCreateDialogWith,
} from "@/lib/store";
import {
  fetchConversations, fetchConversation, fetchMessages, openConversation, sendMessage as apiSendMessage,
  uploadVoice, sendVoiceMessage as apiSendVoiceMessage,
  uploadChatAttachment, sendAttachmentMessage,
  hideMessageForMe, pinMessage as apiPinMessage, deleteConversation, clearConversationHistory,
  deleteMessageForEveryone,
} from "@/lib/api/chat";
import { chatAttachmentTooLargeMessage, chatAttachmentMessageType, formatChatAttachmentError, prepareChatAttachmentFile, readImageDimensions } from "@/lib/chat-attachments";
import { isDemoMode } from "@/lib/demo-mode";
import { blockUser, unblockUser } from "@/lib/api/social";
import { setWatchingDialog } from "@/lib/realtime/user";
import { setHubConversation } from "@/lib/realtime/hub";
import { isEchoConnected, onEchoConnection } from "@/lib/realtime/echo";
import { useOnlineSet } from "@/lib/realtime/presence";
import { isUserOnline, presenceLabel } from "@/lib/presence-status";
import { ChatHeaderActions } from "@/components/messenger/ChatHeaderActions";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import { ChatMessageSearch } from "@/components/messenger/ChatMessageSearch";
import { HighlightedText } from "@/components/messenger/HighlightedText";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { AttachmentMenu, type AttachmentKind } from "@/components/messenger/AttachmentMenu";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import { MessageFileBubble } from "@/components/messenger/MessageFileBubble";
import { MessageActionsMenu, type MessageActionsMenuHandle } from "@/components/messenger/MessageActionsMenu";
import { ForwardDialog } from "@/components/messenger/ForwardDialog";
import {
  ShareLinkDialog,
  clearPendingShare,
  readPendingShare,
  type ShareLinkPayload,
} from "@/components/messenger/ShareLinkDialog";
import { DialogContextMenu } from "@/components/messenger/DialogContextMenu";
import { VoiceBubble } from "@/components/messenger/VoiceBubble";
import { TimeAgo } from "@/components/TimeAgo";
import { VoiceRecorder } from "@/components/messenger/VoiceRecorder";
import { CallsList } from "@/components/calls/CallsList";
import { useChannels, formatCount } from "@/lib/channels";
import { Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ChatAvatar } from "@/components/messenger/ChatAvatar";

import i18n from "@/lib/i18n";
import { MessengerPageSkeleton } from "@/components/boot/PageSkeletons";

export const Route = createFileRoute("/messenger")({
  head: () => ({ meta: [{ title: i18n.t("pages.messenger.metaTitle") }] }),
  beforeLoad: async ({ location }) => {
    const { requireVerified } = await import("@/lib/auth/verification");
    await requireVerified(location);
  },
  validateSearch: (search: Record<string, unknown>): { chat?: string; share?: boolean } => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
    share: search.share === true || search.share === "1" || search.share === 1,
  }),
  component: MessengerRoute,
  pendingComponent: MessengerPageSkeleton,
});

function MessengerRoute() {
  const guestBlocked = useGuestRouteBlocked("route.messenger");
  if (guestBlocked) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[720px] px-[16px] py-[48px]">
          <GuestSectionStub
            icon={MessageSquare}
            title="Чтобы общаться, войдите в аккаунт"
            description="Личные и категорийные чаты доступны зарегистрированным пользователям."
          />
        </div>
      </AppLayout>
    );
  }
  return <MessengerPage />;
}

type ChatScope = "all" | "direct" | "rooms" | "deals";

/** Chats split into the three sections of the left panel. */
function dialogScope(d: Dialog): Exclude<ChatScope, "all"> {
  if (d.type === "room") return "rooms";
  if (d.listing) return "deals";
  return "direct";
}

function dialogIdentity(d: Dialog): { name: string; avatar?: string; communitySlug?: string } {
  if (d.type === "community") {
    return { name: d.title || "Сообщество", avatar: d.avatar, communitySlug: d.communitySlug };
  }
  if (d.type === "room") {
    return { name: d.title || "Чат направления" };
  }
  const u = userById(d.userId);
  return { name: u.name, avatar: u.avatar };
}


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
  const { t } = useTranslation();
  if (!status) return null;
  // sent = one tick, delivered = two muted ticks, read = highlighted two ticks.
  if (status === "sent")
    return <Check size={13} style={{ color: "rgba(255,255,255,0.65)" }} aria-label={t("pages.messenger.statusSent")} />;
  if (status === "delivered")
    return <CheckCheck size={13} style={{ color: "rgba(255,255,255,0.65)" }} aria-label={t("pages.messenger.statusDelivered")} />;
  return (
    <CheckCheck
      size={13}
      style={{ color: "#8fe3ff", filter: "drop-shadow(0 0 1px rgba(143,227,255,0.6))" }}
      aria-label={t("pages.messenger.statusRead")}
    />
  );
}

const IMAGE_MAX_W = 240;
const IMAGE_MAX_H = 240;

function fitImageSize(naturalW: number, naturalH: number): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { w: IMAGE_MAX_W, h: IMAGE_MAX_H };
  }
  const scale = Math.min(IMAGE_MAX_W / naturalW, IMAGE_MAX_H / naturalH, 1);
  return {
    w: Math.max(120, Math.round(naturalW * scale)),
    h: Math.max(90, Math.round(naturalH * scale)),
  };
}

function resolveImageFrame(naturalWidth?: number, naturalHeight?: number): { w: number; h: number } {
  if (naturalWidth && naturalHeight) return fitImageSize(naturalWidth, naturalHeight);
  return { w: IMAGE_MAX_W, h: IMAGE_MAX_H };
}

function MessageImage({
  src,
  naturalWidth,
  naturalHeight,
}: {
  src: string;
  naturalWidth?: number;
  naturalHeight?: number;
}) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const frame = useMemo(
    () => resolveImageFrame(naturalWidth, naturalHeight),
    [naturalWidth, naturalHeight],
  );
  const hasExactFrame = Boolean(naturalWidth && naturalHeight);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setLoaded(true);
    };
    img.onerror = () => {
      if (!alive) return;
      setBroken(true);
    };
    img.src = src;
    return () => {
      alive = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  if (broken) {
    return (
      <div
        className="mb-[6px] grid place-items-center"
        style={{
          width: frame.w,
          maxWidth: "100%",
          height: frame.h,
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
        aria-label={t("pages.messenger.openPhotoFullscreen")}
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
          }}
        >
          {!loaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <div
                className="absolute inset-0 animate-pulse"
                style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }}
              />
              <div
                className="relative h-[28px] w-[28px] animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: "var(--accent)", borderRightColor: "var(--accent)" }}
              />
            </div>
          )}
          <img
            src={src}
            width={frame.w}
            height={frame.h}
            loading="lazy"
            decoding="async"
            alt=""
            draggable={false}
            className="h-full w-full"
            style={{
              borderRadius: 12,
              objectFit: hasExactFrame ? "cover" : "contain",
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

function ListingMessageCard({ listing }: { listing: NonNullable<Message["listing"]> }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/ads/$id"
      params={{ id: listing.id }}
      className="block overflow-hidden rounded-[12px] border transition-colors hover:opacity-95"
      style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
    >
      <div className="flex items-center gap-[10px] p-[10px]">
        {listing.image ? (
          <img src={listing.image} width={52} height={52} loading="lazy" decoding="async" alt="" className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover" />
        ) : (
          <div className="h-[52px] w-[52px] shrink-0 rounded-[10px]" style={{ background: "var(--background-surface)" }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
            {t("pages.messenger.listingLabel")}
          </div>
          <div className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{listing.title}</div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
            {listing.price.toLocaleString("ru")} ₽
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostMessageCard({ post }: { post: NonNullable<Message["post"]> }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      className="block overflow-hidden rounded-[12px] border transition-colors hover:opacity-95"
      style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
    >
      <div className="flex items-center gap-[10px] p-[10px]">
        {post.image ? (
          <img src={post.image} width={52} height={52} loading="lazy" decoding="async" alt="" className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover" />
        ) : (
          <div className="h-[52px] w-[52px] shrink-0 rounded-[10px]" style={{ background: "var(--background-surface)" }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
            {t("pages.messenger.postLabel")}
          </div>
          <div className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{post.title}</div>
          {post.excerpt && (
            <div className="truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>{post.excerpt}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MessageBubble({
  msg, prev, allMessages, onReply, onCopy, onForward, onPin, onDelete, onDeleteForEveryone, onReport, onMediaResize,
  searchHighlightId, searchQuery,
}: {
  msg: Message; prev?: Message; allMessages: Message[];
  onReply: (m: Message) => void;
  onCopy: (m: Message) => void;
  onForward: (m: Message) => void;
  onPin: (m: Message) => void;
  onDelete: (m: Message) => void;
  onDeleteForEveryone: (m: Message) => void;
  onReport: (m: Message) => void;
  onMediaResize?: () => void;
  searchHighlightId?: string | null;
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const meId = useStore((s) => s.currentUserId);
  const isMe = msg.authorId === meId;
  const author = userById(msg.authorId);
  const isFirstInGroup = !prev || prev.authorId !== msg.authorId;
  const hasMedia = Boolean(msg.image || msg.file || msg.voice || msg.listing);
  const reply = msg.replyTo ? allMessages.find((m) => m.id === msg.replyTo) : null;
  const replyAuthor = reply ? userById(reply.authorId) : null;
  const forwardedAuthor = msg.forwardedFrom ? userById(msg.forwardedFrom) : null;
  const isSearchHit = searchHighlightId === msg.id;

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
        onContextMenu={(e) => {
          e.preventDefault();
          menuRef.current?.open();
        }}
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
            onDeleteForEveryone={() => onDeleteForEveryone(msg)}
            onReport={() => onReport(msg)}
          />
        </div>
        <div
          className="px-[14px] py-[10px] transition-shadow duration-300"
          style={{
            background: isMe ? "var(--accent)" : "var(--background-surface)",
            color: isMe ? "white" : "var(--foreground)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            boxShadow: isSearchHit ? "0 0 0 2px var(--accent), 0 0 0 6px color-mix(in oklab, var(--accent) 25%, transparent)" : undefined,
          }}
        >
          {forwardedAuthor && (
            <div
              className="mb-[6px] text-[11px] font-semibold italic"
              style={{ color: isMe ? "rgba(255,255,255,0.75)" : "var(--foreground-50)" }}
            >
              {t("pages.messenger.forwardedFrom", { name: forwardedAuthor.name })}
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
              <div className="font-semibold">{reply.authorId === meId ? t("pages.shared.you") : replyAuthor?.name}</div>
              <div className="truncate">{reply.text}</div>
            </div>
          )}
          {msg.listing && <ListingMessageCard listing={msg.listing} />}
          {msg.post && <PostMessageCard post={msg.post} />}
          {msg.image && (
            <MessageImage
              src={msg.image}
              naturalWidth={msg.imageSize?.w}
              naturalHeight={msg.imageSize?.h}
            />
          )}
          {msg.file && <MessageFileBubble file={msg.file} isMe={isMe} />}
          {msg.voice && <VoiceBubble voice={msg.voice} isMe={isMe} onResize={onMediaResize} />}
          {msg.text && (
            <div className="text-[14px] leading-[1.4]" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {isSearchHit && searchQuery ? (
                <HighlightedText
                  text={msg.text}
                  query={searchQuery}
                  matchClassName={
                    isMe
                      ? "rounded-[3px] bg-[#ffe066] px-[1px] text-[#1a1a1a]"
                      : "rounded-[3px] bg-[var(--accent-soft)] px-[1px] text-[inherit]"
                  }
                />
              ) : (
                msg.text
              )}
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
  const { guardAction } = useGuestAccess();
  const dlgs = useStore(selectors.dialogsList);
  const meId = useStore((s) => s.currentUserId);
  const dialogMetaMap = useStore((s) => s.dialogMeta);
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const isPartnerBlocked = (dialogUserId: string) => blockedUserIds.includes(dialogUserId);
  const onlineSet = useOnlineSet();
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPresenceTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const { chat, share: shareOpen } = Route.useSearch();
  const navigate = useNavigate();
  const [sharePayload, setSharePayload] = useState<ShareLinkPayload | null>(null);
  const [activeId, setActiveId] = useState<string | null>(chat ?? dlgs[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">(chat ? "chat" : "list");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [listTab, setListTab] = useState<"chats" | "channels" | "calls">("chats");
  const [chatScope, setChatScope] = useState<ChatScope>("all");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null);
  const [searchHighlightQuery, setSearchHighlightQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const sendingRef = useRef(false);
  const openingChatRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleMediaResize = useCallback(() => {
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  const getMeta = (id: string) => dialogMetaMap[id] ?? { archived: false, muted: false, blocked: false };


  // Respond to ?chat= search-param changes (e.g. "Написать" from another page).
  // Value is normally a conversation uuid; legacy links may pass a user uuid.
  // Deps include `dlgs`, whose reference changes on every store dispatch
  // (useStore's snapshot memo), not just when dialogs actually change — so
  // this can re-fire for unrelated updates while `chat` is still set to a
  // dialog the user just deleted (deselectDialog's navigate() clearing the
  // URL is async and can lose the race). Guard against re-selecting a
  // dialog that's been locally deleted.
  useEffect(() => {
    if (!chat) return;

    const selectDialog = (dialogId: string, dlg: (typeof dlgs)[number]) => {
      if (dialogMetaMap[dialogId]?.deletedLocally) restoreDialog(dlg);
      setActiveId(dialogId);
      setMobileView("chat");
      if (dlg.unread) actions.markRead(dialogId);
    };

    const byConversation = dlgs.find((d) => d.id === chat);
    if (byConversation) {
      openingChatRef.current = null;
      selectDialog(chat, byConversation);
      if (byConversation.type === "community") setListTab("channels");
      return;
    }

    const byPartner = dlgs.find((d) => d.userId === chat);
    if (byPartner) {
      openingChatRef.current = null;
      selectDialog(byPartner.id, byPartner);
      void navigate({ to: "/messenger", search: { chat: byPartner.id }, replace: true });
      return;
    }

    if (loading || meId === GUEST_USER.id) return;
    if (openingChatRef.current === chat) return;
    openingChatRef.current = chat;

    let alive = true;
    void (async () => {
      try {
        if (isDemoMode()) {
          const partner = userById(chat);
          const dialogId = openOrCreateDialogWith(partner.id);
          const dlg = getState().dialogs[dialogId];
          if (!alive || !dlg) return;
          selectDialog(dialogId, dlg);
          void navigate({ to: "/messenger", search: { chat: dialogId }, replace: true });
          return;
        }
        try {
          const dialog = await fetchConversation(chat, meId);
          if (!alive) return;
          restoreDialog(dialog);
          selectDialog(dialog.id, dialog);
          return;
        } catch {
          // Legacy links pass a user uuid in ?chat= instead of a conversation uuid.
        }
        const partner = userById(chat);
        if (!partner.numericId) {
          throw new Error("unknown chat");
        }
        const dialog = await openConversation(partner.numericId, meId, partner.id);
        if (!alive) return;
        selectDialog(dialog.id, dialog);
        void navigate({ to: "/messenger", search: { chat: dialog.id }, replace: true });
      } catch {
        if (alive) {
          openingChatRef.current = null;
          toast.error(t("pages.messenger.dialogOpenFailed"));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [chat, dlgs, dialogMetaMap, loading, meId, navigate]);

  // Открыть выбор получателя после «Поделиться → Отправить другу» (?share=1).
  useEffect(() => {
    if (!shareOpen) return;

    const pending = readPendingShare();
    if (!pending) {
      toast.error(t("pages.messenger.shareOpenFailed"));
      void navigate({ to: "/messenger", search: { chat }, replace: true });
      return;
    }

    setSharePayload(pending);
  }, [shareOpen, chat, navigate]);

  const closeShareDialog = useCallback(() => {
    clearPendingShare();
    setSharePayload(null);
    void navigate({ to: "/messenger", search: { chat }, replace: true });
  }, [chat, navigate]);

  const handleShareSent = useCallback(
    (dialogId: string) => {
      clearPendingShare();
      setSharePayload(null);
      setActiveId(dialogId);
      setMobileView("chat");
      void navigate({ to: "/messenger", search: { chat: dialogId }, replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    let alive = true;
    fetchConversations(meId)
      .then((list) => {
        if (!alive) return;
        setDialogs(list);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [meId]);

  useEffect(() => {
    setWatchingDialog(activeId);
    return () => setWatchingDialog(null);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    actions.markRead(activeId);
  }, [activeId]);

  // Refresh dialog list for unread counts and partner presence (last_seen_at).
  useEffect(() => {
    if (meId === GUEST_USER.id) return;
    const tick = () => {
      fetchConversations(meId)
        .then((list) => setDialogs(list))
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, isEchoConnected() ? 45_000 : 20_000);
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
          actions.clearPendingMessage(activeId);
          try {
            const saved = await apiSendMessage(activeId, pending);
            if (alive) actions.addMessage(activeId, saved);
          } catch (err) {
            if (!alive) return;
            const message = formatApiErrorMessage(err, t("pages.messenger.sendFailed"));
            if (message) toast.error(message);
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setChatLoading(false); });
    return () => { alive = false; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId || meId === GUEST_USER.id) {
      setHubConversation(null);
      return;
    }
    setHubConversation(
      activeId,
      (m) => upsertMessage(activeId, m),
      (messageUuid) => actions.removeMessage(activeId, messageUuid),
    );
    return () => setHubConversation(null);
  }, [activeId, meId]);

  const active = useMemo(() => dlgs.find((d) => d.id === activeId) ?? null, [dlgs, activeId]);
  const partner = active && active.type !== "community" && active.type !== "room"
    ? userById(active.userId)
    : null;
  const activeIdentity = active ? dialogIdentity(active) : null;

  // Upgrade sent → delivered when partner is online (realtime, before next API poll).
  useEffect(() => {
    if (!activeId || !partner) return;
    if (isUserOnline(partner.id, onlineSet, partner)) {
      markOwnMessagesDelivered(activeId);
    }
  }, [activeId, partner, onlineSet, presenceTick]);

  // Sync delivery/read ticks while chat is open (WebSocket carries new messages, not status changes).
  useEffect(() => {
    if (!activeId || meId === GUEST_USER.id) return;
    const id = activeId;
    const syncStatuses = () => {
      fetchMessages(id)
        .then((msgs) => mergeDialogMessages(id, msgs))
        .catch(() => {});
    };
    syncStatuses();
    const interval = window.setInterval(syncStatuses, isEchoConnected() ? 20_000 : 10_000);
    return () => window.clearInterval(interval);
  }, [activeId, meId]);

  const pinnedMessage = active?.messages.find((m) => m.pinned && !m.deletedForMe) ?? null;

  const scrollToMessage = useCallback((id: string, attempt = 0) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (attempt < 8) {
      window.setTimeout(() => scrollToMessage(id, attempt + 1), 60);
    }
  }, []);

  const handleSearchJump = (messageId: string, query: string) => {
    setSearchHighlightId(messageId);
    setSearchHighlightQuery(query);
    setChatSearchOpen(false);
    window.setTimeout(() => scrollToMessage(messageId), 80);
  };

  useEffect(() => {
    if (!searchHighlightId) return;
    const t = window.setTimeout(() => setSearchHighlightId(null), 8000);
    return () => window.clearTimeout(t);
  }, [searchHighlightId]);

  useEffect(() => {
    setChatSearchOpen(false);
    setSearchHighlightId(null);
    setSearchHighlightQuery("");
  }, [activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = dlgs.filter((d) => {
      if (d.type === "community") return false;
      if (chatScope !== "all" && dialogScope(d) !== chatScope) return false;
      const m = getMeta(d.id);
      if (m.deletedLocally) return false;
      return showArchived ? m.archived : !m.archived;
    });
    const searched = !q
      ? base
      : base.filter((d) => {
          const identity = dialogIdentity(d);
          return identity.name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q);
        });
    if (showArchived) return searched;
    return [...searched].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      return pb - pa;
    });
  }, [dlgs, query, dialogMetaMap, showArchived, chatScope]);

  const communityDialogs = useMemo(
    () => dlgs.filter((d) => d.type === "community" && !getMeta(d.id).deletedLocally),
    [dlgs, dialogMetaMap],
  );

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
    if (!text.trim() || !active || sendingRef.current) return;
    let allowed = false;
    guardAction("messenger.send", () => { allowed = true; });
    if (!allowed) return;
    if (isPartnerBlocked(active.userId)) {
      toast.error(t("pages.messenger.userBlocked"), { description: t("pages.messenger.unblockToSend") });
      return;
    }
    sendingRef.current = true;
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
    } catch (err) {
      actions.removeMessage(dialogId, tempId);
      setText((current) => current || body);
      const message = formatApiErrorMessage(err, t("pages.messenger.sendFailed"));
      if (message) toast.error(message);
    } finally {
      sendingRef.current = false;
    }
  };

  const sendVoice = async (blob: Blob, durationSec: number) => {
    if (!active) return;
    let allowed = false;
    guardAction("messenger.send", () => { allowed = true; });
    if (!allowed) return;
    if (isPartnerBlocked(active.userId)) {
      toast.error(t("pages.messenger.userBlocked"), { description: t("pages.messenger.unblockToSend") });
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
    } catch (err) {
      actions.removeMessage(dialogId, tempId);
      URL.revokeObjectURL(localUrl);
      const message = formatApiErrorMessage(err, t("pages.messenger.voiceSendFailed"));
      if (message) toast.error(message);
    }
  };

  const handleAttachment = async (file: File, kind: AttachmentKind) => {
    if (!active) return;
    let allowed = false;
    guardAction("messenger.send", () => { allowed = true; });
    if (!allowed) return;
    const tooLarge = chatAttachmentTooLargeMessage(file);
    if (tooLarge) {
      toast.error(t("pages.messenger.fileTooLarge"), { description: tooLarge });
      return;
    }
    if (isPartnerBlocked(active.userId)) {
      toast.error(t("pages.messenger.userBlocked"), { description: t("pages.messenger.unblockToSend") });
      return;
    }

    let readyFile: File;
    let convertedFromHeic = false;
    try {
      ({ file: readyFile, convertedFromHeic } = await prepareChatAttachmentFile(file, kind));
    } catch (err) {
      toast.error(formatChatAttachmentError(err));
      return;
    }

    const imageSize = kind === "image" ? await readImageDimensions(readyFile) : null;

    const dialogId = active.id;
    const url = URL.createObjectURL(readyFile);
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
      kind === "image"
        ? { ...base, image: url, imageSize: imageSize ?? undefined }
        : { ...base, file: { name: readyFile.name, size: readyFile.size, kind, url } };
    actions.addMessage(dialogId, optimistic);
    setReplyTo(null);
    if (isDemoMode()) {
      toast(t("pages.messenger.attachmentSentDemo"), {
        description: convertedFromHeic ? t("pages.messenger.heicConvertedDemo") : t("pages.messenger.uploadLater"),
      });
      return;
    }
    try {
      const uploaded = await uploadChatAttachment(dialogId, readyFile);
      const saved = await sendAttachmentMessage(
        dialogId,
        uploaded.media_uuid,
        chatAttachmentMessageType(kind),
        replyId,
      );
      replaceMessage(dialogId, tempId, saved);
      if (saved.file?.url && !saved.file.url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      } else if (saved.image && !saved.image.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      actions.removeMessage(dialogId, tempId);
      URL.revokeObjectURL(url);
      toast.error(formatChatAttachmentError(err));
    }
  };

  const insertEmoji = useCallback((emoji: string) => {
    const el = composerRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }, [text]);

  const handleCopy = (m: Message) => {
    const copyText = m.text || (m.file ? m.file.name : m.image ? t("pages.messenger.image") : t("pages.messenger.attachment"));
    navigator.clipboard.writeText(copyText).then(
      () => toast.success(t("pages.messenger.copied")),
      () => toast.error(t("pages.messenger.copyFailed")),
    );
  };

  const handlePinMessage = async (m: Message) => {
    if (!active) return;
    actions.pinMessage(active.id, m.id);
    if (!isDemoMode()) {
      try {
        await apiPinMessage(active.id, m.id);
      } catch {
        toast.error(t("pages.messenger.pinFailed"));
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
        toast.error(t("pages.messenger.deleteFailed"));
      }
    }
  };

  const handleDeleteForEveryone = async (m: Message) => {
    if (!active) return;
    if (!window.confirm(t("pages.messenger.deleteForAllConfirm"))) return;

    const dialogId = active.id;
    actions.removeMessage(dialogId, m.id);

    if (!isDemoMode()) {
      try {
        await deleteMessageForEveryone(dialogId, m.id);
      } catch {
        toast.error(t("pages.messenger.deleteFailed"));
        fetchMessages(dialogId)
          .then((msgs) => setDialogMessages(dialogId, msgs))
          .catch(() => {});
      }
    }
  };

  const handleReportMessage = (m: Message) => {
    if (!partner) return;
    const snippet = m.text?.trim()
      || (m.voice ? t("pages.messenger.voiceMessage") : "")
      || (m.image ? t("pages.messenger.image") : "")
      || (m.file ? t("pages.messenger.filePrefix", { name: m.file.name }) : "");
    setMessageComplaint({
      target: partner,
      messageId: m.id,
      contextNote: snippet ? t("pages.messenger.messageContext", { snippet: snippet.slice(0, 500) }) : undefined,
    });
  };

  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [messageComplaint, setMessageComplaint] = useState<{
    target: ReturnType<typeof userById>;
    messageId: string;
    contextNote?: string;
  } | null>(null);

  return (
    <AppLayout rightColumn={false} hideMobileHeader hideBottomNav={mobileView === "chat"}>
      <div
        className={`grid overflow-hidden ${
          mobileView === "chat"
            ? "h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-24px)]"
            : "h-[calc(100dvh-var(--safe-top)-var(--bottom-nav-space)-28px)]"
        } md:grid-cols-[380px_1fr] lg:h-[calc(100vh-var(--desktop-topbar-h)-var(--mobile-header-h)-28px)] lg:grid-cols-[400px_1fr]`}
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
                  placeholder={t("pages.messenger.searchDialog")}
                  aria-label={t("pages.messenger.searchDialog")}
                />
              </div>
            </div>
            <div
              className="grid w-full grid-cols-4 gap-[4px]"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {([
                { key: "chats-active" as const, label: t("pages.messenger.tabActive") },
                { key: "channels" as const, label: t("pages.messenger.tabChannels") },
                { key: "chats-archive" as const, label: `${t("pages.messenger.tabArchive")}${archivedCount ? ` · ${archivedCount}` : ""}` },
                { key: "calls" as const, label: t("pages.messenger.tabCalls") },
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
                    className="min-w-0 px-[2px] text-center text-[12px] transition-colors sm:text-[13px]"
                    title={tabItem.label}
                    style={{
                      height: 32,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--accent)" : "var(--foreground-50)",
                      borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    <span className="block truncate">{tabItem.label}</span>
                  </button>
                );
              })}
            </div>
            {listTab === "chats" && (
              <div className="flex gap-[6px] overflow-x-auto px-[12px] py-[8px]">
                {([
                  { key: "all" as const, label: t("pages.messenger.scopeAll") },
                  { key: "direct" as const, label: t("pages.messenger.scopeDirect") },
                  { key: "rooms" as const, label: t("pages.messenger.scopeCategory") },
                  { key: "deals" as const, label: t("pages.messenger.scopeDeal") },
                ]).map((scope) => {
                  const on = chatScope === scope.key;
                  return (
                    <button
                      key={scope.key}
                      type="button"
                      onClick={() => setChatScope(scope.key)}
                      className="shrink-0 rounded-full px-[10px] py-[4px] text-[11.5px] font-medium transition-colors"
                      style={{
                        background: on ? "var(--accent-soft)" : "transparent",
                        color: on ? "var(--accent)" : "var(--foreground-50)",
                        border: `1px solid ${on ? "var(--border-accent)" : "var(--border)"}`,
                      }}
                    >
                      {scope.label}
                    </button>
                  );
                })}
              </div>
            )}
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
              <ChannelsList query={query} communityDialogs={communityDialogs} onSelect={handleSelect} activeId={activeId} />
            ) : loading ? (
              <DialogListSkeleton />


            ) : filtered.length === 0 ? (
              <EmptyDialogs />
            ) : (
              <ul>
                {filtered.map((d) => {
                  const u = d.type === "room"
                    ? { ...userById(d.userId), name: dialogIdentity(d).name, avatar: undefined }
                    : userById(d.userId);
                  const isActive = d.id === activeId;
                  const isUnread = !!d.unread && !getMeta(d.id).muted;
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
                        <ChatAvatar src={u.avatar} name={u.name} size={48} online={isUserOnline(d.userId, onlineSet, u)} />
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
                            <span className="flex min-w-0 flex-1 items-center gap-[6px] font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                              {d.pinned && <Pin size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                              <span className="min-w-0 flex-1 truncate" title={u.name}>{u.name}</span>
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
                          aria-label={t("pages.messenger.chatActions")}
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
                  aria-label={t("pages.messenger.back")}
                >
                  <ArrowLeft size={20} />
                </Button>
                <Link
                  to={
                    active.type === "community" && activeIdentity?.communitySlug
                      ? "/communities/$id"
                      : active.type === "room" && active.room?.rootId
                        ? "/categories/$id/$subId"
                        : "/user/$id"
                  }
                  params={
                    active.type === "community" && activeIdentity?.communitySlug
                      ? { id: activeIdentity.communitySlug }
                      : active.type === "room" && active.room?.rootId
                        ? { id: active.room.rootId, subId: active.room.categoryId }
                        : { id: partner?.slug ?? partner?.id ?? active.userId }
                  }
                  className="flex min-w-0 items-center gap-[12px]"
                >
                  <ChatAvatar src={activeIdentity?.avatar ?? partner?.avatar} name={activeIdentity?.name ?? partner?.name ?? ""} size={40} />
                    <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }} title={activeIdentity?.name}>{activeIdentity?.name ?? partner?.name}</div>
                    <div className="flex min-w-0 items-center gap-[6px] text-[12px] leading-tight">
                      {active.type === "community" || active.type === "room" ? (
                        <span style={{ color: "var(--foreground-50)" }}>{t("pages.communityDetail.tabChat")}</span>
                      ) : partner ? (() => {
                        void presenceTick;
                        const { online, text, title } = presenceLabel(partner.id, onlineSet, partner, { compact: true });
                        return online ? (
                          <>
                            <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: "var(--success)" }} />
                            <span style={{ color: "var(--success)" }}>{text}</span>
                          </>
                        ) : (
                          <span title={title} style={{ color: "var(--foreground-50)" }}>{text}</span>
                        );
                      })() : null}
                    </div>
                  </div>
                </Link>
                <div className="ml-auto flex items-center gap-[4px]">
                  {partner && (
                    <ChatHeaderActions
                      partnerId={partner.id}
                      partnerName={partner.name}
                      partnerAvatar={partner.avatar}
                      dialogId={active.id}
                      pinned={Boolean(active.pinned)}
                      onSearch={() => setChatSearchOpen(true)}
                      onDeleted={() => deselectDialog(active.id)}
                    />
                  )}
                </div>


              </header>
              </div>

              {pinnedMessage && (
                <button
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  className="flex w-full items-center gap-[10px] border-b px-[20px] py-[8px] text-left"
                  style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
                >
                  <Pin size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>
                    {pinnedMessage.text || (pinnedMessage.file ? pinnedMessage.file.name : t("pages.messenger.attachmentLabel"))}
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
                    aria-label={t("pages.messenger.unpinMessage")}
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
                          onDeleteForEveryone={handleDeleteForEveryone}
                          onReport={handleReportMessage}
                          onMediaResize={handleMediaResize}
                          searchHighlightId={searchHighlightId}
                          searchQuery={searchHighlightQuery}
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
                            {t("pages.messenger.replyTo", { name: replyTo.authorId === meId ? t("pages.shared.you") : userById(replyTo.authorId).name })}
                          </div>
                          <div className="truncate" style={{ color: "var(--foreground-50)" }}>{replyTo.text}</div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="grid h-[20px] w-[20px] place-items-center rounded-full" style={{ color: "var(--foreground-50)" }} aria-label={t("pages.messenger.cancelReply")}>
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Composer: attach · emoji · input · mic/send — one optical
                    line (items-end), equal 44px tap targets, equal gaps. Attach
                    controls live outside the pill so the row reads as one set. */}
                <div className="relative flex items-end gap-[4px] px-[8px] py-[8px]" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
                  <AttachmentMenu onPick={handleAttachment} />
                  <EmojiPicker onPick={insertEmoji} />
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
                      ref={composerRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={t("pages.messenger.messagePlaceholder")}
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
                      aria-label={t("pages.messenger.send")}
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
      <ShareLinkDialog payload={sharePayload} onClose={closeShareDialog} onSent={handleShareSent} />
      {active && (
        <ChatMessageSearch
          open={chatSearchOpen}
          dialogId={active.id}
          messages={active.messages.filter((m) => !m.deletedForMe)}
          meId={meId}
          onClose={() => setChatSearchOpen(false)}
          onJumpTo={handleSearchJump}
          onMessagesLoaded={(all) => setDialogMessages(active.id, all)}
        />
      )}
      <ComplaintDialog
        target={messageComplaint?.target ?? null}
        onClose={() => setMessageComplaint(null)}
        page="/messenger"
        subjectSuffix={t("pages.messenger.reportSuffix")}
        contextNote={messageComplaint?.contextNote}
        report={messageComplaint ? { type: "message", targetId: messageComplaint.messageId } : undefined}
      />
      <DialogContextMenu
        point={dialogCtxMenu?.point ?? null}
        onClose={() => setDialogCtxMenu(null)}
        pinned={Boolean(dlgs.find((x) => x.id === dialogCtxMenu?.dialogId)?.pinned)}
        muted={Boolean(dialogCtxMenu && getMeta(dialogCtxMenu.dialogId).muted)}
        archived={Boolean(dialogCtxMenu && getMeta(dialogCtxMenu.dialogId).archived)}
        blocked={Boolean(
          dialogCtxMenu &&
            blockedUserIds.includes(dlgs.find((x) => x.id === dialogCtxMenu.dialogId)?.userId ?? ""),
        )}
        onMarkUnread={() => dialogCtxMenu && actions.markUnread(dialogCtxMenu.dialogId)}
        onGoProfile={() => {
          if (!dialogCtxMenu) return;
          const dlg = dlgs.find((x) => x.id === dialogCtxMenu.dialogId);
          if (!dlg) return;
          const partner = userById(dlg.userId);
          navigate({ to: "/user/$id", params: { id: partner?.slug ?? dlg.userId } });
        }}
        onToggleArchive={() => {
          if (!dialogCtxMenu) return;
          const archived = getMeta(dialogCtxMenu.dialogId).archived;
          actions.setDialogMeta(dialogCtxMenu.dialogId, { archived: !archived });
          toast.success(archived ? t("pages.messenger.chatRestored") : t("pages.messenger.chatArchived"));
        }}
        onToggleBlock={async () => {
          if (!dialogCtxMenu) return;
          const dlg = dlgs.find((x) => x.id === dialogCtxMenu.dialogId);
          if (!dlg) return;
          const partner = userById(dlg.userId);
          const blocked = blockedUserIds.includes(dlg.userId);
          if (blocked) {
            if (!isDemoMode() && partner.numericId) {
              try {
                await unblockUser(partner.numericId);
              } catch {
                toast.error(t("pages.messenger.unblockFailed"));
                return;
              }
            }
            actions.unblockUser(dlg.userId);
            toast.success(t("pages.messenger.userUnblocked", { name: partner.name }));
          } else {
            if (!window.confirm(t("pages.messenger.blockConfirm", { name: partner.name }))) return;
            if (!isDemoMode() && partner.numericId) {
              try {
                await blockUser(partner.numericId);
              } catch {
                toast.error(t("pages.messenger.blockFailed"));
                return;
              }
            }
            actions.blockUser(dlg.userId);
            toast.success(t("pages.messenger.userBlockedToast", { name: partner.name }));
          }
        }}
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
        onClearHistory={async () => {
          if (!dialogCtxMenu) return;
          if (!window.confirm(t("pages.messenger.clearHistoryConfirm"))) return;
          const dialogId = dialogCtxMenu.dialogId;
          if (!isDemoMode()) {
            try {
              await clearConversationHistory(dialogId);
            } catch {
              toast.error(t("pages.messenger.clearHistoryFailed"));
              return;
            }
          }
          actions.clearHistory(dialogId);
          toast.success(t("pages.messenger.historyCleared"));
        }}
        onDeleteChat={async () => {
          if (!dialogCtxMenu) return;
          if (!window.confirm(t("pages.messenger.deleteChatConfirm"))) return;
          const dialogId = dialogCtxMenu.dialogId;
          const dlg = dlgs.find((d) => d.id === dialogId);
          const partnerId = dlg?.userId ?? "";
          if (!isDemoMode()) {
            try {
              await clearConversationHistory(dialogId);
              await deleteConversation(dialogId);
            } catch {
              toast.error(t("pages.messenger.deleteChatFailed"));
              return;
            }
          }
          actions.clearHistory(dialogId);
          if (partnerId) markDialogDeleted(dialogId, partnerId);
          if (activeId === dialogId) deselectDialog(dialogId);
          toast.success(t("pages.messenger.chatDeleted"));
        }}
      />
    </AppLayout>
  );
}

function EmptyChat() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={MessageSquare}
      title={t("pages.messenger.selectDialogTitle")}
      description={t("pages.messenger.selectDialogDesc")}
      variant="bare"
      className="flex-1"
    />
  );
}

function EmptyDialogs() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Users}
      title={t("pages.messenger.noDialogsTitle")}
      description={t("pages.messenger.noDialogsDesc")}
      variant="bare"
    >
      <Button asChild size="lg" className="rounded-full px-[28px]">
        <Link to="/friends">{t("pages.messenger.findFriends")}</Link>
      </Button>
    </EmptyState>
  );
}

function ChannelsList({ query, communityDialogs, onSelect, activeId }: {
  query: string;
  communityDialogs: Dialog[];
  onSelect: (id: string) => void;
  activeId: string | null;
}) {
  const { t } = useTranslation();
  const { channels: all } = useChannels();
  const q = query.trim().toLowerCase();
  const chats = q
    ? communityDialogs.filter((d) => dialogIdentity(d).name.toLowerCase().includes(q) || d.lastMessage.toLowerCase().includes(q))
    : communityDialogs;
  const list = (q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    : all
  ).slice().sort((a, b) => {
    const sa = a.isSubscribed ? 1 : 0;
    const sb = b.isSubscribed ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.subscribers - a.subscribers;
  });

  if (list.length === 0 && chats.length === 0) {
    return <EmptyState icon={Radio} title={t("pages.messenger.channelsNotFound")} variant="bare" />;
  }

  return (
    <ul>
      {chats.map((d) => {
        const identity = dialogIdentity(d);
        const isActive = d.id === activeId;
        return (
          <li key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left"
              style={{ background: isActive ? "var(--accent-soft)" : "transparent" }}
            >
              <ChatAvatar src={identity.avatar} name={identity.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  <span className="truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{identity.name}</span>
                  {d.unread ? (
                    <span className="rounded-full px-[6px] py-[1px] text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>{d.unread}</span>
                  ) : null}
                </div>
                <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{d.lastMessage || t("pages.communityDetail.tabChat")}</div>
              </div>
            </button>
          </li>
        );
      })}
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
                  <Check size={11} /> {t("pages.messenger.channelSubscribed")}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
