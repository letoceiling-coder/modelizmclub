import { useTranslation } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Paperclip,
  Reply,
  Search,
  Send,
  Smile,
  Tag,
  Users,
  X,
} from "lucide-react";
import * as Icons from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdCard } from "@/components/AdCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { categoryById, ads, users, me, userById } from "@/lib/mock";
import type { Category, Message, User } from "@/lib/mock";

type Tab = "chat" | "ads" | "members";

export const Route = createFileRoute("/categories/$id/$subId")({
  head: ({ params }) => {
    const c = categoryById(params.id);
    const sub = c?.subcategories.find((s) => s.id === params.subId);
    const title = c && sub ? `${sub.name} · ${c.name}` : "Подкатегория";
    return { meta: [{ title: `${title} — МоДелизМ Форум` }] };
  },
  component: SubcategoryRoomPage,
});

function seedFrom(s: string): number {
  return s.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

interface RoomMessage extends Message {
  replyToId?: string;
  attachments?: string[];
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

function buildMessages(c: Category, subName: string): RoomMessage[] {
  const base = `Привет всем в чате «${subName}»! Кто сейчас в теме?`;
  const seed = seedFrom(c.id + subName);
  const pool = users.slice(0, 5);
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
      text: `Привет! Я по ${subName.toLowerCase()} давно. Что обсуждаем сегодня?`,
      status: "read",
      replyToId: "m1",
    },
    {
      id: "m3",
      authorId: pick(2).id,
      time: "11:02",
      text: "Кто-нибудь пробовал новые настройки подвески после последнего обновления?",
      status: "read",
    },
    {
      id: "m4",
      authorId: pick(3).id,
      time: "11:10",
      text: "Да, поставил мягче спереди — стало лучше на буграх. Скину фото вечером.",
      status: "read",
      replyToId: "m3",
    },
    {
      id: "m5",
      authorId: pick(0).id,
      time: "11:18",
      text: "Кстати, у нас в выходные встреча клуба. Подтянитесь, кто рядом.",
      status: "read",
    },
    {
      id: "m6",
      authorId: pick(4).id,
      time: "11:24",
      text: "Подскажите по моторам под этот класс — что брать в бюджете?",
      status: "read",
    },
  ];
}

function buildMembers(c: Category, subId: string): Array<User & { role?: string; isOnline: boolean }> {
  const seed = seedFrom(c.id + subId);
  return users.map((u, i) => ({
    ...u,
    isOnline: ((seed + i) % 3) !== 0,
    role: i === 0 ? "Модератор" : i === 1 ? "Эксперт" : undefined,
  }));
}

function SubcategoryRoomPage() {
  const { id, subId } = Route.useParams();
  const c = categoryById(id);
  const sub = c?.subcategories.find((s) => s.id === subId);

  const [tab, setTab] = useState<Tab>("chat");
  const [subSheetOpen, setSubSheetOpen] = useState(false);

  if (!c || !sub) {
    return (
      <AppLayout rightColumn={false}>
        <p className="text-sm" style={{ color: "var(--foreground-50)" }}>
          Подкатегория не найдена.
        </p>
      </AppLayout>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ??
    Icons.Hash;

  const subAds = useMemo(
    () => ads.filter((a) => a.category === c.name && a.subcategory === sub.name),
    [c.name, sub.name],
  );
  const members = useMemo(() => buildMembers(c, sub.id), [c, sub.id]);
  const onlineCount = members.filter((m) => m.isOnline).length;

  return (
    <AppLayout rightColumn={false}>
      <div className="mb-[10px]">
        <Breadcrumbs
          items={[
            { label: "Категории", to: "/categories" },
            { label: c.name, to: "/categories/$id", params: { id: c.id } },
            { label: sub.name },
          ]}
        />
      </div>
      <div
        className="flex h-[calc(100vh-200px)] flex-col overflow-hidden rounded-[14px] border lg:h-[calc(100vh-136px)]"
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
            aria-label="Назад к категории"
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
                <ChevronDown className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--foreground-50)" }} />
              </div>
              <p className="truncate text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
                {c.name} · <span style={{ color: "#22c55e" }}>●</span> {onlineCount} онлайн
              </p>
            </div>
          </button>
          <div className="ml-auto shrink-0">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Tabs */}
        <div
          className="flex shrink-0 border-b"
          style={{ borderColor: "var(--border)" }}
          role="tablist"
        >
          <TabBtn label="Чат" icon={<MessageCircle className="h-[14px] w-[14px]" />} active={tab === "chat"} onClick={() => setTab("chat")} />
          <TabBtn label="Объявления" icon={<Tag className="h-[14px] w-[14px]" />} active={tab === "ads"} onClick={() => setTab("ads")} badge={subAds.length || undefined} />
          <TabBtn label="Участники" icon={<Users className="h-[14px] w-[14px]" />} active={tab === "members"} onClick={() => setTab("members")} badge={members.length} />
        </div>

        {/* Tab content */}
        <div className="min-h-0 flex-1">
          {tab === "chat" && <ChatTab category={c} subId={sub.id} subName={sub.name} />}
          {tab === "ads" && <AdsTab ads={subAds} subName={sub.name} />}
          {tab === "members" && <MembersTab members={members} />}
        </div>
      </div>

      {/* Subcategory switcher sheet */}
      {subSheetOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setSubSheetOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-[18px] border-t"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between px-[16px] py-[14px] border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                  Комнаты «{c.name}»
                </h3>
                <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  Выберите подкатегорию
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubSheetOpen(false)}
                aria-label={t("common.close")}
                className="grid h-[32px] w-[32px] place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)]"
              >
                <X className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
              </button>
            </div>
            <ul className="max-h-[calc(80vh-72px)] overflow-y-auto p-[8px]">
              {c.subcategories.map((s) => {
                const active = s.id === sub.id;
                return (
                  <li key={s.id}>
                    <Link
                      to="/categories/$id/$subId"
                      params={{ id: c.id, subId: s.id }}
                      onClick={() => setSubSheetOpen(false)}
                      className="flex items-center gap-[10px] rounded-[10px] px-[12px] py-[10px] transition-colors hover:bg-[var(--background-surface)]"
                      style={{
                        background: active ? "var(--background-surface)" : "transparent",
                        color: active ? "var(--accent)" : "var(--foreground)",
                      }}
                    >
                      <span className="grid h-[28px] w-[28px] place-items-center rounded-[8px] text-[12px] font-semibold"
                        style={{ background: "var(--background)", color: active ? "var(--accent)" : "var(--foreground-70)" }}>#</span>
                      <span className="flex-1 text-[14px] font-medium">{s.name}</span>
                      {active && <span className="text-[11px]" style={{ color: "var(--accent)" }}>Сейчас здесь</span>}
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
          className="ml-[2px] inline-flex min-w-[18px] items-center justify-center rounded-[999px] px-[6px] py-[1px] text-[10.5px]"
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

function ChatTab({ category, subId, subName }: { category: Category; subId: string; subName: string }) {
  const [messages, setMessages] = useState<RoomMessage[]>(() => buildMessages(category, subName));
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // reset when room changes
  useEffect(() => {
    setMessages(buildMessages(category, subName));
    setText("");
    setReplyTo(null);
    setPendingAttachments((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
    setQuery("");
    setSearchOpen(false);
    setActiveMatch(0);
  }, [category, subId, subName]);

  const trimmedQuery = query.trim();
  const matchIds = useMemo(() => {
    if (!trimmedQuery) return [] as string[];
    return messages.filter((m) => {
      if (!m.text) return false;
      if (exactMatch) {
        const msg = m.text.trim();
        return caseSensitive ? msg === trimmedQuery : msg.toLowerCase() === trimmedQuery.toLowerCase();
      }
      return caseSensitive
        ? m.text.includes(trimmedQuery)
        : m.text.toLowerCase().includes(trimmedQuery.toLowerCase());
    }).map((m) => m.id);
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
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 6)
      .map((f) => URL.createObjectURL(f));
    setPendingAttachments((prev) => [...prev, ...urls].slice(0, 6));
  };

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((u) => u !== url));
    URL.revokeObjectURL(url);
  };

  const send = () => {
    const v = text.trim();
    if (!v && pendingAttachments.length === 0) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        authorId: me.id,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        text: v,
        status: "sent",
        replyToId: replyTo?.id,
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
      },
    ]);
    setText("");
    setReplyTo(null);
    setPendingAttachments([]);
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
            Поиск по чату
          </button>
        ) : (
          <>
            <Search className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--foreground-50)" }} />
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
              placeholder="Найти в сообщениях…"
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
              title="Учитывать регистр"
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
              title="Точное совпадение"
            >
              =
            </button>
            <span
              className="shrink-0 text-[11.5px] tabular-nums"
              style={{ color: "var(--foreground-50)" }}
            >
              {trimmedQuery ? (matchIds.length ? `${activeMatch + 1}/${matchIds.length}` : "0/0") : ""}
            </span>
            <button
              type="button"
              onClick={() => stepMatch(-1)}
              disabled={matchIds.length === 0}
              aria-label="Предыдущее совпадение"
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)] disabled:opacity-40"
            >
              <ChevronUp className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
            </button>
            <button
              type="button"
              onClick={() => stepMatch(1)}
              disabled={matchIds.length === 0}
              aria-label="Следующее совпадение"
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)] disabled:opacity-40"
            >
              <ChevronDown className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Закрыть поиск"
              className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-elevated)]"
            >
              <X className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
            </button>
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-[10px] overflow-y-auto px-[14px] py-[14px]">
        {messages.map((m) => {
          const u = userById(m.authorId);
          const mine = m.authorId === me.id;
          const replied = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
          const isActive = trimmedQuery && m.id === activeMsgId;
          return (
            <div
              key={m.id}
              ref={(el) => {
                if (el) msgRefs.current.set(m.id, el);
                else msgRefs.current.delete(m.id);
              }}
              className={`flex gap-[10px] ${mine ? "flex-row-reverse" : ""}`}
            >
              <img src={u.avatar} alt={u.name} className="h-[32px] w-[32px] shrink-0 rounded-full" />
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div className="mb-[2px] flex items-center gap-[6px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
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
                      <span className="block text-[10.5px] font-medium">{userById(replied.authorId).name}</span>
                      <span className="line-clamp-1">{highlightNodes(replied.text, trimmedQuery, undefined, `r-${m.id}`, caseSensitive)}</span>
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
                            alt="Вложение"
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
                    aria-label={t("categories.reply")}
                    className={`absolute -top-[8px] ${mine ? "left-[6px]" : "right-[6px]"} hidden h-[22px] w-[22px] place-items-center rounded-full border bg-[var(--background-elevated)] group-hover:grid`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Reply className="h-[12px] w-[12px]" style={{ color: "var(--foreground-70)" }} />
                  </button>
                </div>
                {!mine && (
                  <Link
                    to="/messenger"
                    search={{ chat: u.id }}
                    className="mt-[2px] text-[10.5px] hover:underline"
                    style={{ color: "var(--accent)" }}
                  >{t("categories.dm")}</Link>
                )}
              </div>
            </div>
          );
        })}
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
              Ответ: {userById(replyTo.authorId).name}
            </div>
            <div className="truncate text-[12px]" style={{ color: "var(--foreground-70)" }}>
              {replyTo.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Отменить ответ"
            className="grid h-[26px] w-[26px] place-items-center rounded-[8px] hover:bg-[var(--background-elevated)]"
          >
            <X className="h-[14px] w-[14px]" style={{ color: "var(--foreground-70)" }} />
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {pendingAttachments.length > 0 && (
        <div
          className="flex gap-[8px] overflow-x-auto border-t px-[12px] py-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          {pendingAttachments.map((src) => (
            <div
              key={src}
              className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[10px] border"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <img src={src} alt="Превью" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAttachment(src)}
                aria-label="Удалить вложение"
                className="absolute right-[2px] top-[2px] grid h-[18px] w-[18px] place-items-center rounded-full"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                <X className="h-[10px] w-[10px]" />
              </button>
            </div>
          ))}
        </div>
      )}

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
          aria-label="Прикрепить фото"
          disabled={pendingAttachments.length >= 6}
        >
          <Paperclip className="h-[16px] w-[16px]" style={{ color: "var(--foreground-50)" }} />
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
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (imgs.length > 0) {
              e.preventDefault();
              const dt = new DataTransfer();
              imgs.forEach((f) => dt.items.add(f));
              onPickFiles(dt.files);
            }
          }}
          placeholder={`Написать в «${subName}»…`}
          rows={1}
          className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-[10px] border px-[12px] py-[8px] text-[14px] outline-none focus:border-[var(--accent)]"
          style={{
            background: "var(--background-surface)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
        <button
          type="button"
          className="hidden h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)] sm:grid"
          aria-label="Эмодзи"
        >
          <Smile className="h-[16px] w-[16px]" style={{ color: "var(--foreground-50)" }} />
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() && pendingAttachments.length === 0}
          className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
          aria-label={t("messenger.send")}
        >
          <Send className="h-[16px] w-[16px]" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- ADS TAB --------------------------- */

function AdsTab({ ads: subAds, subName }: { ads: typeof ads; subName: string }) {
  if (subAds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[8px] px-[24px] py-[40px] text-center">
        <Tag className="h-[28px] w-[28px]" style={{ color: "var(--foreground-30)" }} />
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          В «{subName}» пока нет объявлений
        </h3>
        <p className="text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
          Это локальная доска именно этой подкатегории. Будьте первым.
        </p>
        <Link
          to="/ads/new"
          className="mt-[6px] inline-flex items-center rounded-[10px] px-[14px] py-[8px] text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Подать объявление
        </Link>
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

function MembersTab({ members }: { members: Array<User & { role?: string; isOnline: boolean }> }) {
  const sorted = [...members].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
  return (
    <div className="h-full overflow-y-auto px-[10px] py-[10px]">
      <ul className="space-y-[2px]">
        {sorted.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-[12px] rounded-[12px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
          >
            <div className="relative shrink-0">
              <img src={u.avatar} alt={u.name} className="h-[40px] w-[40px] rounded-full" />
              <span
                className="absolute -bottom-[1px] -right-[1px] h-[11px] w-[11px] rounded-full border-[2px]"
                style={{
                  background: u.isOnline ? "#22c55e" : "var(--foreground-30)",
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
                {u.role && (
                  <span
                    className="shrink-0 rounded-[6px] px-[6px] py-[1px] text-[10.5px] font-medium"
                    style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                  >
                    {u.role}
                  </span>
                )}
              </div>
              <p className="truncate text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
                {u.isOnline ? "онлайн" : "не в сети"} · {u.city}
              </p>
            </div>
            <Link
              to="/messenger"
              search={{ chat: u.id }}
              className="shrink-0 rounded-[8px] px-[10px] py-[6px] text-[12px] font-medium transition-colors"
              style={{ background: "var(--accent)", color: "#fff" }}
            >{t("friends.message")}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
