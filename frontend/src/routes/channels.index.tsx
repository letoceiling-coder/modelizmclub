import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Radio, Users, Check, BadgeCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Community } from "@/lib/types";
import { fetchCommunities, joinCommunity, leaveCommunity } from "@/lib/api/communities";
import { formatCount } from "@/lib/utils/format";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/channels/")({
  head: () => ({
    meta: [
      { title: tStatic("channels.metaTitle") },
      { name: "description", content: tStatic("channels.metaDescription") },
    ],
  }),
  component: ChannelsPage,
});

type Tab = "popular" | "new" | "subs";

function ChannelsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [channels, setChannels] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("popular");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchCommunities({ official: true, per_page: 50 })
      .then((items) => {
        if (!cancelled) setChannels(items);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const subs = useMemo(() => new Set(channels.filter((c) => c.joined).map((c) => c.id)), [channels]);

  const list = useMemo(() => {
    let arr: Community[] = [...channels];
    if (tab === "popular") arr.sort((a, b) => b.members - a.members);
    else if (tab === "subs") arr = arr.filter((c) => subs.has(c.id));
    const query = q.trim().toLowerCase();
    if (query) arr = arr.filter((c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query));
    return arr;
  }, [channels, tab, q, subs]);

  const toggleSub = async (c: Community) => {
    if (!isAuthenticated) {
      toast.error(t("auth.loginRequired"));
      return;
    }
    try {
      if (c.joined) {
        await leaveCommunity(c.id);
        setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: false, members: Math.max(0, x.members - 1) } : x)));
        toast.success(t("channels.unsubscribed", { name: c.name }));
      } else {
        await joinCommunity(c.id);
        setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: true, members: x.members + 1 } : x)));
        toast.success(t("channels.subscribedToast", { name: c.name }));
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] sm:text-[28px] font-bold truncate" style={{ color: "var(--foreground)" }}>{t("nav.channels")}</h1>
            <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("channels.subtitle")}</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--accent-soft)" }}>
            <Radio size={20} style={{ color: "var(--accent)" }} />
          </div>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("channels.searchPlaceholder")}
            className="w-full text-[14px] outline-none"
            style={{ height: 44, paddingLeft: 38, paddingRight: 12, background: "var(--background-surface)", borderRadius: 12, border: "1.5px solid transparent", color: "var(--foreground)" }}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto" style={{ background: "var(--background-surface)", borderRadius: 12, padding: 4 }}>
          {([
            ["popular", t("channels.tabPopular")],
            ["new", t("channels.tabNew")],
            ["subs", t("channels.tabSubsCount", { suffix: subs.size ? ` · ${subs.size}` : "" })],
          ] as const).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="shrink-0 text-[13px] font-medium transition-all"
                style={{
                  flex: 1, minWidth: 100, padding: "9px 14px", borderRadius: 9,
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

        {loading ? (
          <div className="py-14 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div>
        ) : list.length === 0 ? (
          <div className="grid place-items-center gap-2 py-14 text-center" style={{ border: "1px dashed var(--border-strong)", borderRadius: 14 }}>
            <Radio size={22} style={{ color: "var(--foreground-50)" }} />
            <div className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
              {tab === "subs" ? t("channels.emptySubs") : t("channels.emptySearch")}
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <ChannelCard key={c.id} channel={c} subscribed={subs.has(c.id)} onToggle={() => toggleSub(c)} />
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function ChannelCard({ channel: c, subscribed, onToggle }: { channel: Community; subscribed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to="/channel/$id"
        params={{ id: c.id }}
        className="flex h-full flex-col gap-3 p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center font-display text-[18px] font-bold text-white" style={{ background: "var(--accent)", borderRadius: 12 }}>
            {c.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</span>
              {c.isOfficial && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}
            </div>
            <p className="mt-1 text-[13px]" style={{ color: "var(--foreground-70)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {c.description}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>
              <Users size={12} /> {formatCount(c.members)}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          className="mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 text-[13px] font-semibold"
          style={{
            borderRadius: 10,
            background: subscribed ? "transparent" : "var(--accent)",
            color: subscribed ? "var(--foreground-70)" : "white",
            border: subscribed ? "1px solid var(--border)" : "none",
          }}
        >
          {subscribed ? (<><Check size={14} />{t("channels.subscribed")}</>) : t("channels.subscribe")}
        </button>
      </Link>
    </li>
  );
}
