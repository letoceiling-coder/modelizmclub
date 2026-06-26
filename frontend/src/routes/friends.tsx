import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, UserPlus, MessageSquare, Check, X, Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { users, me, userById, formatRelativeTime } from "@/lib/mock";
import { useStore, actions, selectors, openOrCreateDialogWith } from "@/lib/store";
import { toast } from "sonner";
import { useFriendsApi } from "@/lib/api/useFriends";
import type { FriendRequestItem } from "@/lib/api/friends";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: tStatic("friends.metaTitle") }] }),
  component: FriendsPage,
});

type Tab = "all" | "online" | "requests";

const pulse = {
  animate: { opacity: [0.4, 0.7, 0.4] },
  transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
};

function formatRequestDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatRelativeTime(new Date(iso).toISOString());
  } catch {
    return "";
  }
}

function FriendsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const mockFriendIds = useStore(selectors.friendsOf(me.id));
  const mockRequests = useStore(selectors.pendingRequests(me.id));
  const api = useFriendsApi();
  const [mockLoading, setMockLoading] = useState(true);
  const navigateMessenger = useNavigate();

  const loading = api.enabled ? api.loading : mockLoading;
  const friendIds = api.enabled ? api.friendIds : new Set(mockFriendIds.map(Number));
  const requests: { id: string | number; fromId: string; date: string; api?: FriendRequestItem }[] = api.enabled
    ? api.requests.map((r) => ({
        id: r.id,
        fromId: String(r.from.id),
        date: r.created_at ?? "",
        api: r,
      }))
    : mockRequests.map((r) => ({ id: r.id, fromId: r.fromId, date: r.date }));

  useEffect(() => {
    if (api.enabled) return;
    const timer = setTimeout(() => setMockLoading(false), 450);
    return () => clearTimeout(timer);
  }, [api.enabled]);

  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  useEffect(() => {
    const el = refs.current[tab];
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab, loading]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.id === me.id) return false;
      if (tab === "online" && !u.online) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("friends.tabAll"), count: users.length - 1 },
    { key: "online", label: t("friends.tabOnline"), count: users.filter((u) => u.id !== me.id && u.online).length },
    { key: "requests", label: t("friends.tabRequests"), count: requests.length },
  ];

  const accept = async (id: string | number) => {
    if (api.enabled) {
      try {
        await api.accept(Number(id));
        toast.success(t("friends.requestAccepted"));
      } catch {
        toast.error(t("common.error"));
      }
      return;
    }
    actions.acceptFriendRequest(String(id));
    toast.success(t("friends.requestAccepted"));
  };
  const decline = async (id: string | number) => {
    if (api.enabled) {
      try {
        await api.decline(Number(id));
        toast.success(t("friends.requestDeclined"));
      } catch {
        toast.error(t("common.error"));
      }
      return;
    }
    actions.declineFriendRequest(String(id));
    toast.success(t("friends.requestDeclined"));
  };
  const added = friendIds;


  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        <header>
          <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>{t("friends.title")}</h1>
          <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.subtitle")}</p>
        </header>

        {/* Tabs */}
        <div className="overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative flex">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  ref={(el) => { refs.current[t.key] = el; }}
                  onClick={() => setTab(t.key)}
                  className="inline-flex shrink-0 items-center gap-[8px] font-display transition-colors duration-200"
                  style={{
                    height: 48, padding: "0 20px", fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--accent)" : "var(--foreground-50)",
                  }}
                >
                  {t.label}
                  <span className="font-mono text-[11px]" style={{ color: "var(--foreground-50)" }}>{t.count}</span>
                </button>
              );
            })}
            <motion.div
              className="absolute bottom-0 h-[3px]"
              style={{ background: "var(--accent)", borderRadius: "3px 3px 0 0" }}
              animate={{ x: indicator.x, width: indicator.w }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {tab !== "requests" && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("friends.searchPlaceholder")}
              className="w-full text-[14px] outline-none"
              style={{
                height: 40, paddingLeft: 36, paddingRight: 12,
                background: "var(--background-surface)", borderRadius: 10,
                border: "1.5px solid transparent", color: "var(--foreground)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab + String(loading)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                    <motion.div {...pulse} className="h-[48px] w-[48px] rounded-full" style={{ background: "var(--background-surface)" }} />
                    <div className="flex-1 space-y-[8px]">
                      <motion.div {...pulse} className="h-[12px] rounded-[6px]" style={{ background: "var(--background-surface)", width: `${40 + (i * 13) % 40}%` }} />
                      <motion.div {...pulse} className="h-[10px] rounded-[6px]" style={{ background: "var(--background-surface)", width: `${30 + (i * 11) % 30}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : tab === "requests" ? (
              requests.length === 0 ? (
                <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.emptyRequestsIncoming")}</div>
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {requests.map((r) => {
                    const apiFrom = r.api?.from;
                    const mockUser = userById(r.fromId);
                    const userId = apiFrom ? String(apiFrom.id) : mockUser.id;
                    const userName = apiFrom?.display_name ?? mockUser.name;
                    const userAvatar = apiFrom?.avatar?.url ?? mockUser.avatar;
                    return (
                      <article key={r.id} className="flex items-start gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                        <Link to="/user/$id" params={{ id: userId }} className="shrink-0">
                          <img src={userAvatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to="/user/$id" params={{ id: userId }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{userName}</Link>
                          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("friends.wantsToAdd")}</div>
                          <div className="mt-[2px] inline-flex items-center gap-[4px] font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={11} /> {apiFrom ? formatRequestDate(r.date) : formatRelativeTime(r.date)}
                          </div>
                          <div className="mt-[10px] flex gap-[8px]">
                            <button onClick={() => accept(r.id)} className="inline-flex items-center gap-[4px] font-semibold" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "var(--accent)", color: "white", fontSize: 12 }}>
                              <Check size={12} />{t("friends.accept")}</button>
                            <button onClick={() => decline(r.id)} className="inline-flex items-center gap-[4px] font-medium" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "transparent", color: "var(--foreground-70)", fontSize: 12, border: "1px solid var(--border)" }}>
                              <X size={12} />{t("friends.decline")}</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(Number(u.id));
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <article key={u.id} className="flex gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                      <Link to="/user/$id" params={{ id: u.id }} className="relative shrink-0">
                        <img src={u.avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        {u.online && <span className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full" style={{ background: "var(--success)", border: "2px solid var(--background)" }} />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to="/user/$id" params={{ id: u.id }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{u.name}</Link>
                        <div className="mt-[2px] inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> {u.city}
                        </div>
                        <div className="mt-[2px] line-clamp-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                        <div className="mt-[10px] flex flex-wrap gap-[8px]">
                          <button
                            onClick={async () => {
                              if (api.enabled) {
                                try {
                                  if (isAdded) {
                                    await api.remove(Number(u.id));
                                    toast.success(t("friends.removedFromFriends"));
                                  } else {
                                    await api.sendRequest(Number(u.id));
                                    toast.success(t("friends.pending"));
                                  }
                                } catch {
                                  toast.error(t("common.error"));
                                }
                                return;
                              }
                              if (isAdded) {
                                actions.removeFriend(me.id, u.id);
                                toast.success(t("friends.removedFromFriends"));
                              } else {
                                actions.sendFriendRequest(me.id, u.id);
                                toast.success(t("friends.pending"));
                              }
                            }}

                            className="inline-flex items-center gap-[4px] font-semibold"
                            style={{
                              height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                              background: isAdded ? "transparent" : "var(--accent)",
                              color: isAdded ? "var(--foreground-70)" : "white",
                              border: isAdded ? "1px solid var(--border)" : "none",
                            }}
                          >
                            {isAdded ? <><Check size={12} />{t("friends.inFriends")}</> : <><UserPlus size={12} />{t("friends.addFriend")}</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const dialogId = openOrCreateDialogWith(u.id);
                              navigateMessenger({ to: "/messenger", search: { chat: dialogId } });
                            }}
                            className="inline-flex items-center gap-[4px] font-medium"
                            style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "transparent", color: "var(--foreground-70)", fontSize: 12, border: "1px solid var(--border)" }}
                          >
                            <MessageSquare size={12} />{t("friends.message")}</button>

                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
