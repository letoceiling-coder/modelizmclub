import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Tag,
  Users,
  X,
} from "lucide-react";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import * as Icons from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdCard } from "@/components/AdCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { userById } from "@/lib/mock";
import type { Category, CategoryChild, Message, User, Ad } from "@/lib/mock";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { setHubConversation } from "@/lib/realtime/hub";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import { GUEST_USER } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { searchUsers } from "@/lib/api/social";
import { fetchListings } from "@/lib/api/listings";
import {
  fetchRoomMessages,
  fetchRoomMembers,
  mapMessageToRoom,
  resolveRoomConversation,
  sendRoomMessage,
  uploadRoomAttachment,
  type RoomMember,
  type RoomMessage,
} from "@/lib/api/room-chat";
import { useOnlineSet } from "@/lib/realtime/presence";
import { isUserOnline, presenceLabel } from "@/lib/presence-status";
import { navigateToPartnerChat } from "@/lib/api/chat";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { findDescendant } from "@/lib/taxonomy";

type Tab = "chat" | "ads" | "members";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/categories/$id/$subId")({
  head: () => ({ meta: [{ title: i18n.t("pages.subcategoryDetail.metaTitle") }] }),
  component: SubcategoryRoomPage,
});

function seedFrom(s: string): number {
  return s.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

interface PendingAttachment {
  file: File;
  preview: string;
}

/** Превращает URL в кликабельные ссылки. Безопасно для XSS — рендер через React. */
function renderTextWithLinks(text: string): React.ReactNode {
  const re = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0].replace(/[),.!?;:]+$/, "");
    const trailing = m[0].slice(raw.length);
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`l-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-dotted underline-offset-2 hover:opacity-90"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>,
    );
    if (trailing) parts.push(trailing);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

/** Подсвечивает совпадения query в строковых частях. Не трогает уже отрендеренные ссылки. */
function highlightNodes(
  nodes: React.ReactNode,
  query: string,
  activeKey?: string,
  keyPrefix = "h",
  caseSensitive = false,
): React.ReactNode {
  const q = query.trim();
  if (!q) return nodes;
  const wrap = (text: string, kp: string): React.ReactNode => {
    const out: React.ReactNode[] = [];
    let i = 0;
    let from = 0;
    const src = caseSensitive ? text : text.toLowerCase();
    const needle = caseSensitive ? q : q.toLowerCase();
    while (true) {
      const idx = src.indexOf(needle, from);
      if (idx === -1) {
        if (from < text.length) out.push(text.slice(from));
        break;
      }
      if (idx > from) out.push(text.slice(from, idx));
      const matchKey = `${kp}-m-${i}`;
      const isActive = activeKey === matchKey;
      out.push(
        <mark
          key={matchKey}
          data-match-key={matchKey}
          className="rounded-[3px] px-[1px]"
          style={{
            background: isActive ? "#facc15" : "rgba(250,204,21,0.45)",
            color: isActive ? "#111" : "inherit",
            outline: isActive ? "1.5px solid #f59e0b" : "none",
          }}
        >
          {text.slice(idx, idx + q.length)}
        </mark>,
      );
      from = idx + q.length;
      i++;
    }
    return out;
  };
  const list = Array.isArray(nodes) ? nodes : [nodes];
  return list.map((n, i) =>
    typeof n === "string" ? (
      <span key={`${keyPrefix}-${i}`}>{wrap(n, `${keyPrefix}-${i}`)}</span>
    ) : (
      n
    ),
  );
}

function buildMessages(c: Category, subName: string, pool: User[]): RoomMessage[] {
  if (pool.length === 0) return [];
  const base = i18n.t("pages.subcategoryDetail.demoIntro", { name: subName });
  const seed = seedFrom(c.id + subName);
  const pick = (i: number) => pool[(seed + i) % pool.length];

  return [
    {
      id: "m1",
      authorId: pick(0).id,
      time: "10:42",
      text: base,
      status: "read",
    },
    {
      id: "m2",
      authorId: pick(1).id,
      time: "10:45",
      text: i18n.t("pages.subcategoryDetail.demoReply", { name: subName.toLowerCase() }),
      status: "read",
      replyToId: "m1",
    },
    {
      id: "m3",
      authorId: pick(2).id,
      time: "11:02",
      text: i18n.t("pages.subcategoryDetail.demoMsg1"),
      status: "read",
    },
    {
      id: "m4",
      authorId: pick(3).id,
      time: "11:10",
      text: i18n.t("pages.subcategoryDetail.demoMsg2"),
      status: "read",
      replyToId: "m3",
    },
    {
      id: "m5",
      authorId: pick(0).id,
      time: "11:18",
      text: i18n.t("pages.subcategoryDetail.demoMsg3"),
      status: "read",
    },
    {
      id: "m6",
      authorId: pick(4).id,
      time: "11:24",
      text: i18n.t("pages.subcategoryDetail.demoMsg4"),
      status: "read",
    },
  ];
}

/** Depth-first list of every room under a category (levels 2 and 3). */
function flattenRooms(nodes: CategoryChild[], depth = 0): { node: CategoryChild; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenRooms(node.children ?? [], depth + 1),
  ]);
}

function SubcategoryRoomPage() {
  const { t } = useTranslation();
  const { id, subId } = Route.useParams();
  const categories = usePostCategories();
  const c = categories.find((x) => x.id === id);
  // Rooms exist on levels 2 and 3, so the id can sit anywhere in the subtree.
  const sub = c ? findDescendant(c.subcategories, subId) : null;
  const onlineSet = useOnlineSet();
  const me = useCurrentUser();

  const [tab, setTab] = useState<Tab>("chat");
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [pool, setPool] = useState<User[]>([]);
  const [subAds, setSubAds] = useState<Ad[]>([]);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(!isDemoMode() && me.id !== GUEST_USER.id);

  useEffect(() => {
    let active = true;
    searchUsers("")
      .then((u) => active && setPool(u.slice(0, 12)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!c || !sub || isDemoMode() || me.id === GUEST_USER.id) {
      setRoomMembers([]);
      setMembersLoading(false);
      return;
    }
    let active = true;
    setMembersLoading(true);
    fetchRoomMembers(c.id, sub.id)
      .then(({ members }) => active && setRoomMembers(members))
      .catch(() => active && setRoomMembers([]))
      .finally(() => active && setMembersLoading(false));
    return () => {
      active = false;
    };
  }, [c, sub, me.id]);

  useEffect(() => {
    if (!c || !sub) return;
    let active = true;
    fetchListings()
      .then(
        (all) =>
          active &&
          setSubAds(all.filter((a) => a.category === c.name && a.subcategory === sub.name)),
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [c, sub]);

  const onlineCount = useMemo(
    () => roomMembers.filter((m) => isUserOnline(m.user.id, onlineSet, m.user)).length,
    [roomMembers, onlineSet],
  );

  if (!c || !sub) {
    return (
      <AppLayout rightColumn={false}>
        <p className="text-sm" style={{ color: "var(--foreground-50)" }}>
          {categories.length === 0
            ? t("pages.subcategoryDetail.loading")
            : t("pages.subcategoryDetail.notFound")}
        </p>
      </AppLayout>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ??
    Icons.Hash;

  return (
    <AppLayout rightColumn={false}>
      <div className="mb-[10px]">
        <Breadcrumbs
          items={[
            { label: t("pages.subcategoryDetail.breadcrumbs"), to: "/categories" },
            { label: c.name, to: "/categories/$id", params: { id: c.id } },
            { label: sub.name },
          ]}
        />
      </div>
      <div
        className="flex h-[calc(100vh-200px)] flex-col overflow-hidden rounded-[var(--r-card)] border lg:h-[calc(100vh-136px)]"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
      >
        {/* Room header */}
        <header
          className="flex items-center gap-[10px] border-b px-[14px] py-[10px]"
          style={{ borderColor: "var(--border)" }}
        >
          <Link
            to="/categories/$id"
            params={{ id: c.id }}
            aria-label={t("pages.subcategoryDetail.backAria")}
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)]"
          >
            <ArrowLeft className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
          </Link>
          <span
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]"
            style={{ background: "var(--background-surface)", color: "var(--accent)" }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <button
            type="button"
            onClick={() => setSubSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-[6px] text-left transition-opacity hover:opacity-80"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-[6px]">
                <span
                  className="truncate text-[15px] font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {sub.name}
                </span>
                <ChevronDown
                  className="h-[14px] w-[14px] shrink-0"
                  style={{ color: "var(--foreground-50)" }}
                />
              </div>
              <p className="truncate text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
                {c.name} · <span style={{ color: "#22c55e" }}>●</span>{" "}
                {t("pages.subcategoryDetail.online", { count: onlineCount })}
              </p>
            </div>
          </button>
        </header>

        {/* Tabs */}
        <div
          className="flex shrink-0 border-b"
          style={{ borderColor: "var(--border)" }}
          role="tablist"
        >
          <TabBtn
            label={t("pages.subcategoryDetail.tabChat")}
            icon={<MessageCircle className="h-[14px] w-[14px]" />}
            active={tab === "chat"}
            onClick={() => setTab("chat")}
          />
          <TabBtn
            label={t("pages.subcategoryDetail.tabAds")}
            icon={<Tag className="h-[14px] w-[14px]" />}
            active={tab === "ads"}
            onClick={() => setTab("ads")}
            badge={subAds.length || undefined}
          />
          <TabBtn
            label={t("pages.subcategoryDetail.tabMembers")}
            icon={<Users className="h-[14px] w-[14px]" />}
            active={tab === "members"}
            onClick={() => setTab("members")}
            badge={roomMembers.length || undefined}
          />
        </div>

        {/* Tab content */}
        <div className="min-h-0 flex-1">
          {tab === "chat" && <ChatTab category={c} subId={sub.id} subName={sub.name} pool={pool} />}
          {tab === "ads" && <AdsTab ads={subAds} subName={sub.name} />}
          {tab === "members" && (
            <MembersTab members={roomMembers} loading={membersLoading} onlineSet={onlineSet} />
          )}
        </div>
      </div>

      {/* Subcategory switcher sheet */}
      {subSheetOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("pages.subcategoryDetail.closeAria")}
            onClick={() => setSubSheetOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-[18px] border-t"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-[16px] py-[14px] border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t("pages.subcategoryDetail.roomsOf", { name: c.name })}
                </h3>
                <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {t("pages.subcategoryDetail.pickSubcategory")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubSheetOpen(false)}
                aria-label={t("pages.subcategoryDetail.closeAria")}
                className="grid h-[32px] w-[32px] place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)]"
              >
                <X className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
              </button>
            </div>
            <ul className="max-h-[calc(80vh-72px)] overflow-y-auto p-[8px]">
              {flattenRooms(c.subcategories).map(({ node, depth }) => {
                const active = node.id === sub.id;
                return (
                  <li key={node.id}>
                    <Link
                      to="/categories/$id/$subId"
                      params={{ id: c.id, subId: node.id }}
                      onClick={() => setSubSheetOpen(false)}
                      className="flex items-center gap-[10px] rounded-[10px] px-[12px] py-[10px] transition-colors hover:bg-[var(--background-surface)]"
                      style={{
                        background: active ? "var(--background-surface)" : "transparent",
                        color: active ? "var(--accent)" : "var(--foreground)",
                        marginLeft: depth * 16,
                      }}
                    >
                      <span
                        className="grid h-[28px] w-[28px] place-items-center rounded-[8px] text-[12px] font-semibold"
                        style={{
                          background: "var(--background)",
                          color: active ? "var(--accent)" : "var(--foreground-70)",
                        }}
                      >
                        #
                      </span>
                      <span className="flex-1 text-[14px] font-medium">{node.name}</span>
                      {active && (
                        <span className="text-[11px]" style={{ color: "var(--accent)" }}>
                          {t("pages.subcategoryDetail.hereNow")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function TabBtn({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-[6px] py-[11px] text-[13px] font-medium transition-colors"
      style={{
        color: active ? "var(--accent)" : "var(--foreground-70)",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}>{icon}</span>
      {label}
      {typeof badge === "number" && (
        <span
          className="ml-[2px] inline-flex min-w-[18px] items-center justify-center rounded-[var(--r-pill)] px-[6px] py-[1px] text-[10.5px]"
          style={{
            background: active ? "var(--accent)" : "var(--background-surface)",
            color: active ? "#fff" : "var(--foreground-70)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* --------------------------- CHAT TAB --------------------------- */

function dedupeRoomMessages(messages: RoomMessage[]): RoomMessage[] {
  const out: RoomMessage[] = [];
  const seenIds = new Set<string>();
  for (const m of messages) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    out.push(m);
  }
  return out;
}

function ChatTab({
  category,
  subId,
  subName,
  pool,
}: {
  category: Category;
  subId: string;
  subName: string;
  pool: User[];
}) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const openPrivateChat = useCallback(
    async (partner: User) => {
      try {
        await navigateToPartnerChat(navigate, partner, me.id);
      } catch {
        toast.error(t("pages.subcategoryDetail.dialogOpenFailed"));
      }
    },
    [me.id, navigate, t],
  );
  const [messages, setMessages] = useState<RoomMessage[]>(() =>
    isDemoMode() ? buildMessages(category, subName, pool) : [],
  );
  const [conversationUuid, setConversationUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemoMode());
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const upsertRoomMessage = useCallback((incoming: RoomMessage) => {
    setMessages((prev) => {
      const merged: RoomMessage = {
        ...incoming,
        clientKey:
          prev.find((m) => m.id === incoming.id || m.clientKey === incoming.clientKey)?.clientKey ??
          prev.find(
            (m) =>
              Boolean(m.clientKey) &&
              m.authorId === incoming.authorId &&
              (m.text || "") === (incoming.text || "") &&
              m.id.startsWith("local-"),
          )?.clientKey ??
          incoming.clientKey,
      };

      if (prev.some((m) => m.id === incoming.id)) {
        return dedupeRoomMessages(prev.map((m) => (m.id === incoming.id ? merged : m)));
      }

      const byClientKey =
        incoming.clientKey != null ? prev.findIndex((m) => m.clientKey === incoming.clientKey) : -1;
      if (byClientKey >= 0) {
        const next = [...prev];
        next[byClientKey] = merged;
        return dedupeRoomMessages(next);
      }

      const pendingIdx = prev.findIndex(
        (m) =>
          Boolean(m.clientKey) &&
          m.authorId === incoming.authorId &&
          (m.text || "") === (incoming.text || "") &&
          m.id.startsWith("local-"),
      );
      if (pendingIdx >= 0) {
        const next = [...prev];
        next[pendingIdx] = merged;
        return dedupeRoomMessages(next);
      }

      return dedupeRoomMessages([...prev, merged]);
    });
  }, []);

  // Load room conversation + history from API (prod only).
  useEffect(() => {
    if (isDemoMode()) {
      setMessages(buildMessages(category, subName, pool));
      setConversationUuid(null);
      setLoading(false);
      return;
    }
    if (me.id === GUEST_USER.id) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setConversationUuid(null);
    setMessages([]);

    resolveRoomConversation(category.id, subId)
      .then((uuid) => {
        if (!alive) return uuid;
        setConversationUuid(uuid);
        return fetchRoomMessages(uuid);
      })
      .then((msgs) => {
        if (alive && msgs) setMessages(msgs);
      })
      .catch(() => {
        if (alive) toast.error(t("pages.subcategoryDetail.chatLoadFailed"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [category.id, subId, subName, pool, me.id]);

  // Realtime: new messages from other users in the same room.
  useEffect(() => {
    if (isDemoMode() || !conversationUuid || me.id === GUEST_USER.id) {
      setHubConversation(null);
      return;
    }
    setHubConversation(conversationUuid, (m) => upsertRoomMessage(mapMessageToRoom(m)));
    return () => setHubConversation(null);
  }, [conversationUuid, me.id, upsertRoomMessage]);

  // reset local UI when room changes
  useEffect(() => {
    setText("");
    setReplyTo(null);
    setPendingAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
    setQuery("");
    setSearchOpen(false);
    setActiveMatch(0);
  }, [category.id, subId]);

  const insertEmoji = useCallback(
    (emoji: string) => {
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
    },
    [text],
  );

  const trimmedQuery = query.trim();
  const matchIds = useMemo(() => {
    if (!trimmedQuery) return [] as string[];
    return messages
      .filter((m) => {
        if (!m.text) return false;
        if (exactMatch) {
          const msg = m.text.trim();
          return caseSensitive
            ? msg === trimmedQuery
            : msg.toLowerCase() === trimmedQuery.toLowerCase();
        }
        return caseSensitive
          ? m.text.includes(trimmedQuery)
          : m.text.toLowerCase().includes(trimmedQuery.toLowerCase());
      })
      .map((m) => m.id);
  }, [messages, trimmedQuery, caseSensitive, exactMatch]);

  useEffect(() => {
    if (activeMatch >= matchIds.length) setActiveMatch(0);
  }, [matchIds.length, activeMatch]);

  useEffect(() => {
    setActiveMatch(0);
  }, [caseSensitive, exactMatch]);

  useEffect(() => {
    if (!trimmedQuery) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, trimmedQuery]);

  useEffect(() => {
    if (!trimmedQuery || matchIds.length === 0) return;
    const id = matchIds[activeMatch];
    const node = msgRefs.current.get(id);
    if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatch, matchIds, trimmedQuery]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6 - pendingAttachments.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPendingAttachments((prev) => [...prev, ...picked].slice(0, 6));
  };

  const removeAttachment = (preview: string) => {
    setPendingAttachments((prev) => {
      const item = prev.find((a) => a.preview === preview);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((a) => a.preview !== preview);
    });
  };

  const [editingAttachment, setEditingAttachment] = useState<string | null>(null);
  const replaceAttachment = (preview: string, blob: Blob) => {
    setPendingAttachments((prev) =>
      prev.map((a) => {
        if (a.preview !== preview) return a;
        URL.revokeObjectURL(a.preview);
        const file = new File([blob], a.file.name, { type: blob.type || "image/jpeg" });
        return { file, preview: URL.createObjectURL(file) };
      }),
    );
  };

  const send = async () => {
    const v = text.trim();
    if (!v && pendingAttachments.length === 0) return;
    if (sending) return;

    if (isDemoMode() || !conversationUuid) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          authorId: me.id,
          time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
          text: v,
          status: "sent",
          replyToId: replyTo?.id,
          attachments: pendingAttachments.length
            ? pendingAttachments.map((a) => a.preview)
            : undefined,
        },
      ]);
      setText("");
      setReplyTo(null);
      pendingAttachments.forEach((a) => URL.revokeObjectURL(a.preview));
      setPendingAttachments([]);
      return;
    }

    const clientKey = `local-${Date.now()}`;
    const previewUrls = pendingAttachments.map((a) => a.preview);
    const optimistic: RoomMessage = {
      id: clientKey,
      clientKey,
      authorId: me.id,
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      text: v,
      status: "sent",
      replyToId: replyTo?.id,
      attachments: previewUrls.length ? previewUrls : undefined,
    };

    setSending(true);
    upsertRoomMessage(optimistic);
    setText("");
    const replyUuid = replyTo?.id;
    setReplyTo(null);
    const files = pendingAttachments.map((a) => a.file);
    setPendingAttachments([]);

    try {
      const mediaUuids: string[] = [];
      for (const file of files) {
        mediaUuids.push(await uploadRoomAttachment(conversationUuid, file));
      }
      const saved = await sendRoomMessage(
        conversationUuid,
        v,
        replyUuid,
        mediaUuids.length ? mediaUuids : undefined,
      );
      upsertRoomMessage({ ...saved, clientKey });
    } catch {
      setMessages((prev) => prev.filter((m) => m.clientKey !== clientKey));
      toast.error(t("pages.subcategoryDetail.sendFailed"));
    } finally {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setSending(false);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setActiveMatch(0);
  };
  const stepMatch = (dir: 1 | -1) => {
    if (matchIds.length === 0) return;
    setActiveMatch((i) => (i + dir + matchIds.length) % matchIds.length);
  };

  const activeMsgId = matchIds[activeMatch];

  return (
    <div className="flex h-full flex-col">
      {/* Search toolbar */}
      <div
        className="flex items-center gap-[8px] border-b px-[12px] py-[8px]"
        style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
      >
        {!searchOpen ? (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12.5px] font-medium transition-colors hover:bg-[var(--background-elevated)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Search className="h-[14px] w-[14px]" />
            {t("pages.subcategoryDetail.searchInChat")}
          </button>
        ) : (
          <>
            <Search
              className="h-[14px] w-[14px] shrink-0"
              style={{ color: "var(--foreground-50)" }}
            />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveMatch(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  stepMatch(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") {
                  closeSearch();
                }
              }}
              placeholder={t("pages.subcategoryDetail.searchInMessages")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: "var(--foreground)" }}
            />
            <button
              type="button"
              onClick={() => setCaseSensitive((v) => !v)}
              aria-pressed={caseSensitive}
              className="shrink-0 rounded-[6px] px-[5px] py-[2px] text-[10px] font-bold transition-colors"
              style={{
                background: caseSensitive ? "var(--accent)" : "var(--background-elevated)",
                color: caseSensitive ? "#fff" : "var(--foreground-50)",
              }}
              title={t("pages.subcategoryDetail.matchCase")}
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setExactMatch((v) => !v)}
              aria-pressed={exactMatch}
              className="shrink-0 rounded-[6px] px-[5px] py-[2px] text-[10px] font-bold transition-colors"
              style={{
                background: exactMatch ? "var(--accent)" : "var(--background-elevated)",
                color: exactMatch ? "#fff" : "var(--foreground-50)",
              }}
              title={t("pages.subcategoryDetail.exactMatch")}
            >
              =
            </button>
            <span
              className="shrink-0 text-[11.5px] tabular-nums"
              style={{ color: "var(--foreground-50)" }}
            >
              {trimmedQuery
                ? matchIds.length
                  ? `${activeMatch + 1}/${matchIds.length}`
                  : "0/0"
                : ""}
            </span>
            <button
              type="button"
              onClick={() => stepMatch(-1)}
              disabled={matchIds.length === 0}
              aria-label={t("pages.subcategoryDetail.prevMatch")}
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)] disabled:opacity-40"
            >
              <ChevronUp className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
            </button>
            <button
              type="button"
              onClick={() => stepMatch(1)}
              disabled={matchIds.length === 0}
              aria-label={t("pages.subcategoryDetail.nextMatch")}
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)] disabled:opacity-40"
            >
              <ChevronDown
                className="h-[14px] w-[14px]"
                style={{ color: "var(--foreground-70)" }}
              />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              aria-label={t("pages.subcategoryDetail.closeSearch")}
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)]"
            >
              <X className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
            </button>
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-[10px] overflow-y-auto px-[14px] py-[14px]">
        {loading ? (
          <div
            className="flex h-full items-center justify-center py-[40px] text-[13px]"
            style={{ color: "var(--foreground-50)" }}
          >
            {t("pages.subcategoryDetail.chatLoading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-[8px] py-[40px] text-center">
            <MessageCircle
              className="h-[28px] w-[28px]"
              style={{ color: "var(--foreground-30)" }}
            />
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.subcategoryDetail.emptyChat")}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const u = userById(m.authorId);
            const mine = m.authorId === me.id;
            const replied = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
            const isActive = trimmedQuery && m.id === activeMsgId;
            return (
              <div
                key={m.clientKey ?? m.id}
                ref={(el) => {
                  if (el) msgRefs.current.set(m.id, el);
                  else msgRefs.current.delete(m.id);
                }}
                className={`flex gap-[10px] ${mine ? "flex-row-reverse" : ""}`}
              >
                <UserAvatar src={u.avatar} name={u.name} size={40} />
                <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className="mb-[2px] flex items-center gap-[6px] text-[11px]"
                    style={{ color: "var(--foreground-50)" }}
                  >
                    {!mine && (
                      <Link
                        to="/user/$id"
                        params={{ id: u.id }}
                        className="font-medium hover:underline"
                        style={{ color: "var(--foreground-70)" }}
                      >
                        {u.name}
                      </Link>
                    )}
                    <span>{m.time}</span>
                  </div>
                  <div
                    className="group relative rounded-[12px] px-[12px] py-[8px] text-[14px] leading-[1.4] transition-shadow"
                    style={{
                      background: mine ? "var(--accent)" : "var(--background-surface)",
                      color: mine ? "#fff" : "var(--foreground)",
                      boxShadow: isActive ? "0 0 0 2px #f59e0b" : "none",
                    }}
                  >
                    {replied && (
                      <div
                        className="mb-[6px] rounded-[8px] border-l-[3px] px-[8px] py-[4px] text-[12px]"
                        style={{
                          borderColor: mine ? "rgba(255,255,255,0.5)" : "var(--accent)",
                          background: mine ? "rgba(255,255,255,0.12)" : "var(--background)",
                          color: mine ? "rgba(255,255,255,0.85)" : "var(--foreground-70)",
                        }}
                      >
                        <span className="block text-[10.5px] font-medium">
                          {userById(replied.authorId).name}
                        </span>
                        <span className="line-clamp-1">
                          {highlightNodes(
                            replied.text,
                            trimmedQuery,
                            undefined,
                            `r-${m.id}`,
                            caseSensitive,
                          )}
                        </span>
                      </div>
                    )}
                    {m.attachments && m.attachments.length > 0 && (
                      <div
                        className={`mb-[6px] grid gap-[4px] ${m.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                      >
                        {m.attachments.map((src, idx) => (
                          <a
                            key={`${m.id}-att-${idx}`}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-[8px]"
                            style={{ background: "var(--background)" }}
                          >
                            <img
                              src={src}
                              width={800}
                              height={600}
                              decoding="async"
                              alt={t("pages.subcategoryDetail.attachmentAlt")}
                              className="h-full max-h-[220px] w-full object-cover"
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.text && (
                      <div className="whitespace-pre-wrap break-words">
                        {highlightNodes(
                          renderTextWithLinks(m.text),
                          trimmedQuery,
                          isActive ? "h-0-m-0" : undefined,
                          isActive ? "h" : `t-${m.id}`,
                          caseSensitive,
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setReplyTo(m)}
                      aria-label={t("pages.subcategoryDetail.replyAria")}
                      className={`absolute -top-[8px] ${mine ? "left-[6px]" : "right-[6px]"} hidden h-[22px] w-[22px] place-items-center rounded-full border bg-[var(--background-elevated)] group-hover:grid`}
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Reply
                        className="h-[12px] w-[12px]"
                        style={{ color: "var(--foreground-70)" }}
                      />
                    </button>
                  </div>
                  {!mine && (
                    <button
                      type="button"
                      onClick={() => void openPrivateChat(u)}
                      aria-label={t("pages.subcategoryDetail.writePrivateAria")}
                      title={t("pages.subcategoryDetail.writePrivateAria")}
                      className="mt-[2px] grid h-[22px] w-[22px] place-items-center rounded-full transition-colors hover:bg-[var(--accent-soft)]"
                      style={{ color: "var(--accent)" }}
                    >
                      <MessageCircle size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div
          className="flex items-center gap-[8px] border-t px-[12px] py-[8px]"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          <Reply className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--accent)" }} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
              {t("pages.subcategoryDetail.replyTo", { name: userById(replyTo.authorId).name })}
            </div>
            <div className="truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>
              {replyTo.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label={t("pages.subcategoryDetail.cancelReplyAria")}
            className="grid h-[26px] w-[26px] place-items-center rounded-[8px] hover:bg-[var(--background-elevated)]"
          >
            <X className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {pendingAttachments.length > 0 && (
        <div
          className="flex gap-[8px] overflow-x-auto border-t px-[12px] py-[10px] no-scrollbar"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          {pendingAttachments.map((item) => (
            <div
              key={item.preview}
              className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[10px] border"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <img
                src={item.preview}
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                alt={t("pages.subcategoryDetail.previewAlt")}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setEditingAttachment(item.preview)}
                aria-label="Редактировать фото"
                className="absolute left-[2px] top-[2px] grid h-[18px] w-[18px] place-items-center rounded-full"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                <Pencil className="h-[10px] w-[10px]" />
              </button>
              <button
                type="button"
                onClick={() => removeAttachment(item.preview)}
                aria-label={t("pages.subcategoryDetail.removeAttachmentAria")}
                className="absolute right-[2px] top-[2px] grid h-[18px] w-[18px] place-items-center rounded-full"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                <X className="h-[10px] w-[10px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PhotoEditorDialog
        open={editingAttachment != null}
        src={
          editingAttachment
            ? (pendingAttachments.find((a) => a.preview === editingAttachment)?.file ?? null)
            : null
        }
        title="Редактирование фото"
        onCancel={() => setEditingAttachment(null)}
        onSave={(blob) => {
          if (editingAttachment) replaceAttachment(editingAttachment, blob);
          setEditingAttachment(null);
        }}
      />

      {/* Composer */}
      <div
        className="flex items-end gap-[8px] border-t px-[12px] py-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)] disabled:opacity-40"
          aria-label={t("pages.subcategoryDetail.attachPhotoAria")}
          disabled={pendingAttachments.length >= 6}
        >
          <Paperclip className="h-[16px] w-[16px]" style={{ color: "var(--foreground-50)" }} />
        </button>
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
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (imgs.length > 0) {
              e.preventDefault();
              const dt = new DataTransfer();
              imgs.forEach((f) => dt.items.add(f));
              onPickFiles(dt.files);
            }
          }}
          placeholder={t("pages.subcategoryDetail.writeInSub", { name: subName })}
          rows={1}
          className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-[10px] border px-[12px] py-[8px] text-[14px] outline-none focus:border-[var(--accent)]"
          style={{
            background: "var(--background-surface)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
        <EmojiPicker onPick={insertEmoji} align="end" compact />
        <button
          type="button"
          onClick={() => void send()}
          disabled={
            sending ||
            (!text.trim() && pendingAttachments.length === 0) ||
            (!isDemoMode() && !conversationUuid)
          }
          className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
          aria-label={t("common.send")}
        >
          <Send className="h-[16px] w-[16px]" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- ADS TAB --------------------------- */

function AdsTab({ ads: subAds, subName }: { ads: Ad[]; subName: string }) {
  const { t } = useTranslation();
  if (subAds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[8px] px-[24px] py-[40px] text-center">
        <Tag className="h-[28px] w-[28px]" style={{ color: "var(--foreground-30)" }} />
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.subcategoryDetail.noAds", { name: subName })}
        </h3>
        <p className="text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.subcategoryDetail.noAdsDesc")}
        </p>
        <GuestGuardLink
          actionKey="layout.nav.ad_create"
          to="/ads/new"
          className="mt-[6px] inline-flex items-center rounded-[10px] px-[14px] py-[8px] text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {t("pages.subcategoryDetail.postAd")}
        </GuestGuardLink>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-[14px] py-[14px]">
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
        {subAds.map((a) => (
          <AdCard key={a.id} ad={a} compact />
        ))}
      </div>
    </div>
  );
}

/* --------------------------- MEMBERS TAB --------------------------- */

function MembersTab({
  members,
  loading,
  onlineSet,
}: {
  members: RoomMember[];
  loading: boolean;
  onlineSet: Set<string>;
}) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const openPrivateChat = useCallback(
    async (partner: User) => {
      try {
        await navigateToPartnerChat(navigate, partner, me.id);
      } catch {
        toast.error(t("pages.subcategoryDetail.dialogOpenFailed"));
      }
    },
    [me.id, navigate, t],
  );

  const roleLabel = (role?: string) => {
    if (!role || role === "member") return undefined;
    if (role === "admin") return t("pages.communityDetail.roleAdmin");
    if (role === "moderator") return t("pages.subcategoryDetail.roleModerator");
    return role;
  };

  const sorted = [...members].sort(
    (a, b) =>
      Number(isUserOnline(b.user.id, onlineSet, b.user)) -
      Number(isUserOnline(a.user.id, onlineSet, a.user)),
  );

  if (loading) {
    return (
      <div
        className="flex h-full items-center justify-center px-[14px] py-[24px] text-[13px]"
        style={{ color: "var(--foreground-50)" }}
      >
        {t("pages.subcategoryDetail.loading")}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center px-[14px] py-[24px] text-center text-[13px]"
        style={{ color: "var(--foreground-50)" }}
      >
        {t("pages.subcategoryDetail.membersEmpty")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-[10px] py-[10px]">
      <ul className="space-y-[2px]">
        {sorted.map(({ user: u, role }) => {
          const online = isUserOnline(u.id, onlineSet, u);
          const status = presenceLabel(u.id, onlineSet, u);
          const badge = roleLabel(role);
          return (
            <li
              key={u.id}
              className="flex items-center gap-[12px] rounded-[12px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
            >
              <div className="relative shrink-0">
                <UserAvatar src={u.avatar} name={u.name} size={40} />
                <span
                  className="absolute -bottom-[1px] -right-[1px] h-[11px] w-[11px] rounded-full border-[2px]"
                  style={{
                    background: online ? "#22c55e" : "var(--foreground-30)",
                    borderColor: "var(--background-elevated)",
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  <Link
                    to="/user/$id"
                    params={{ id: u.id }}
                    className="truncate text-[14px] font-medium hover:underline"
                    style={{ color: "var(--foreground)" }}
                  >
                    {u.name}
                  </Link>
                  {badge && (
                    <span
                      className="shrink-0 rounded-[6px] px-[6px] py-[1px] text-[10.5px] font-medium"
                      style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
                  {status.text}
                  {u.city ? ` · ${u.city}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openPrivateChat(u)}
                className="shrink-0 rounded-[8px] px-[10px] py-[6px] text-[12px] font-medium transition-colors"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {t("pages.subcategoryDetail.writeMessage")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
