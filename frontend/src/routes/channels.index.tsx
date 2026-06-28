import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Radio, Users, Check, BadgeCheck, Store, Briefcase, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useChannels, setChannelSubscription,
  formatCount, kindLabel,
  type Channel, type ChannelKind,
} from "@/lib/channels";
import { toast } from "sonner";

export const Route = createFileRoute("/channels/")({
  head: () => ({
    meta: [
      { title: "Каналы — МоДелизМ Форум" },
      { name: "description", content: "Подпишитесь на каналы брендов, магазинов, авторов и экспертов: новости, обзоры и спецпредложения." },
    ],
  }),
  component: ChannelsPage,
});

type Tab = "popular" | "new" | "subs";

const KIND_ICON: Record<ChannelKind, typeof BadgeCheck> = {
  official: BadgeCheck,
  brand: Briefcase,
  shop: Store,
  author: Sparkles,
  expert: Sparkles,
};

function ChannelsPage() {
  const { channels: all, reload } = useChannels();
  const [tab, setTab] = useState<Tab>("popular");
  const [q, setQ] = useState("");

  const subsCount = all.filter((c) => c.isSubscribed).length;

  const list = useMemo(() => {
    let arr: Channel[] = [...all];
    if (tab === "popular") arr.sort((a, b) => b.subscribers - a.subscribers);
    else if (tab === "new") arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else arr = arr.filter((c) => c.isSubscribed);
    const query = q.trim().toLowerCase();
    if (query) arr = arr.filter((c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query));
    return arr;
  }, [all, tab, q]);

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] sm:text-[28px] font-bold truncate" style={{ color: "var(--foreground)" }}>
              Каналы
            </h1>
            <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: "var(--foreground-50)" }}>
              Новости, обзоры и анонсы — только от владельцев каналов
            </p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--accent-soft)" }}>
            <Radio size={20} style={{ color: "var(--accent)" }} />
          </div>
        </header>

        {/* search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск канала"
            className="w-full text-[14px] outline-none"
            style={{
              height: 44, paddingLeft: 38, paddingRight: 12,
              background: "var(--background-surface)", borderRadius: 12,
              border: "1.5px solid transparent", color: "var(--foreground)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
          />
        </div>

        {/* segmented tabs */}
        <div
          className="flex items-center gap-1 overflow-x-auto"
          style={{ background: "var(--background-surface)", borderRadius: 12, padding: 4 }}
        >
          {([
            ["popular", "Популярные"],
            ["new", "Новые"],
            ["subs", `Подписки${subsCount ? ` · ${subsCount}` : ""}`],
          ] as const).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="shrink-0 text-[13px] font-medium transition-all"
                style={{
                  flex: 1,
                  minWidth: 100,
                  padding: "9px 14px",
                  borderRadius: 9,
                  background: active ? "var(--background)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--foreground-50)",
                  fontWeight: active ? 600 : 500,
                  boxShadow: active ? "var(--shadow-card)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          <div className="grid place-items-center gap-2 py-14 text-center" style={{ border: "1px dashed var(--border-strong)", borderRadius: 14 }}>
            <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}>
              <Radio size={22} />
            </div>
            <div className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
              {tab === "subs" ? "Вы пока ни на что не подписаны" : "Ничего не найдено"}
            </div>
            {tab === "subs" && (
              <button
                onClick={() => setTab("popular")}
                className="mt-1 inline-flex h-9 items-center px-4 text-[13px] font-semibold"
                style={{ background: "var(--accent)", color: "white", borderRadius: 10 }}
              >
                К популярным каналам
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <ChannelCard key={c.id} channel={c} subscribed={Boolean(c.isSubscribed)} onChanged={reload} />
            ))}
          </ul>
        )}

        <p className="pt-2 text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Канал — это односторонняя витрина контента: публикует только владелец, подписчики читают. Это не сообщество и не чат.
        </p>
      </div>
    </AppLayout>
  );
}

function ChannelCard({ channel: c, subscribed, onChanged }: { channel: Channel; subscribed: boolean; onChanged: () => void }) {
  const KindIcon = KIND_ICON[c.kind];
  const onToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await setChannelSubscription(c.slug, !subscribed);
      toast.success(subscribed ? `Отписка от «${c.name}»` : `Подписка на «${c.name}»`);
      onChanged();
    } catch {
      toast.error("Не удалось обновить подписку");
    }
  };
  return (
    <li>
      <Link
        to="/channel/$id"
        params={{ id: c.id }}
        className="flex h-full flex-col gap-3 p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center font-display text-[18px] font-bold text-white"
            style={{ background: c.avatarColor, borderRadius: 12 }}
          >
            {c.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                {c.name}
              </span>
              {c.kind === "official" && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}
            </div>
            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--foreground-70)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {c.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)", padding: "3px 7px", borderRadius: 6 }}
              >
                <KindIcon size={11} /> {kindLabel(c.kind)}
              </span>
              <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>
                <Users size={12} /> {formatCount(c.subscribers)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 text-[13px] font-semibold transition-colors"
          style={{
            borderRadius: 10,
            background: subscribed ? "transparent" : "var(--accent)",
            color: subscribed ? "var(--foreground-70)" : "white",
            border: subscribed ? "1px solid var(--border)" : "none",
          }}
        >
          {subscribed ? (<><Check size={14} /> Вы подписаны</>) : "Подписаться"}
        </button>
      </Link>
    </li>
  );
}
