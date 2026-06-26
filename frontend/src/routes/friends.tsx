import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, UserPlus, MessageSquare, Check, X, Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, avatarUrl } from "@/lib/utils/time";
import { toast } from "sonner";
import { useFriendsApi } from "@/lib/api/useFriends";
import { searchUsers, type FriendRequestItem, type FriendUser } from "@/lib/api/friends";
import { createConversation } from "@/lib/api/chat";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: tStatic("friends.metaTitle") }] }),
  component: FriendsPage,
});

type Tab = "all" | "discover" | "requests";

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
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const api = useFriendsApi();
  const navigateMessenger = useNavigate();

  const loading = api.loading;
  const friendIds = api.friendIds;
  const requests: { id: number; fromId: string; date: string; api: FriendRequestItem }[] = api.requests.map((r) => ({
    id: r.id,
    fromId: String(r.from.id),
    date: r.created_at ?? "",
    api: r,
  }));

  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });
  const [discoverResults, setDiscoverResults] = useState<FriendUser[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    const el = refs.current[tab];
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab, loading]);

  useEffect(() => {
    if (tab !== "discover") return;
    let cancelled = false;
    setDiscovering(true);
    const handle = setTimeout(() => {
      void searchUsers(q.trim())
        .then((users) => { if (!cancelled) setDiscoverResults(users); })
        .catch(() => { if (!cancelled) setDiscoverResults([]); })
        .finally(() => { if (!cancelled) setDiscovering(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [tab, q]);

  const filteredFriends = useMemo(() => {
    const ql = q.toLowerCase();
    return api.friends.filter((u) => {
      if (!ql) return true;
      const name = u.display_name ?? "";
      return name.toLowerCase().includes(ql) || (u.slug ?? "").toLowerCase().includes(ql);
    });
  }, [api.friends, q]);

  const addFriend = async (userId: number) => {
    try {
      await api.sendRequest(userId);
      toast.success(t("friends.requestSent"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("friends.tabAll"), count: api.friends.length },
    { key: "discover", label: t("friends.tabDiscover"), count: 0 },
    { key: "requests", label: t("friends.tabRequests"), count: requests.length },
  ];

  const accept = async (id: number) => {
    try {
      await api.accept(id);
      toast.success(t("friends.requestAccepted"));
    } catch {
      toast.error(t("common.error"));
    }
  };
  const decline = async (id: number) => {
    try {
      await api.decline(id);
      toast.success(t("friends.requestDeclined"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const openChat = async (userId: number) => {
    try {
      const conv = await createConversation(userId);
      navigateMessenger({ to: "/messenger", search: { chat: conv.id } });
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (!isAuthenticated) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-[80px] text-center">
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.loginRequired")}</p>
          <Link to="/login" className="mt-[16px] inline-flex font-semibold" style={{ color: "var(--accent)" }}>{t("auth.login")}</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        <header>
          <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>{t("friends.title")}</h1>
          <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.subtitle")}</p>
        </header>

        <div className="overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative flex">
            {tabs.map((tabItem) => {
              const active = tab === tabItem.key;
              return (
                <button
                  key={tabItem.key}
                  ref={(el) => { refs.current[tabItem.key] = el; }}
                  onClick={() => setTab(tabItem.key)}
                  className="inline-flex shrink-0 items-center gap-[8px] font-display transition-colors duration-200"
                  style={{
                    height: 48, padding: "0 20px", fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--accent)" : "var(--foreground-50)",
                  }}
                >
                  {tabItem.label}
                  <span className="font-mono text-[11px]" style={{ color: "var(--foreground-50)" }}>{tabItem.count}</span>
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                    <motion.div {...pulse} className="h-[48px] w-[48px] rounded-full" style={{ background: "var(--background-surface)" }} />
                  </div>
                ))}
              </div>
            ) : tab === "requests" ? (
              requests.length === 0 ? (
                <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.emptyRequestsIncoming")}</div>
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {requests.map((r) => {
                    const apiFrom = r.api.from;
                    const userId = String(apiFrom.id);
                    const userName = apiFrom.display_name ?? "User";
                    const userAvatar = apiFrom.avatar?.url ?? avatarUrl(userName);
                    return (
                      <article key={r.id} className="flex items-start gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                        <Link to="/user/$id" params={{ id: userId }} className="shrink-0">
                          <img src={userAvatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to="/user/$id" params={{ id: userId }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{userName}</Link>
                          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("friends.wantsToAdd")}</div>
                          <div className="mt-[2px] inline-flex items-center gap-[4px] font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={11} /> {formatRequestDate(r.date)}
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
            ) : tab === "discover" ? (
              discovering ? (
                <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div>
              ) : discoverResults.length === 0 ? (
                <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.emptyDiscover")}</div>
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {discoverResults.map((u) => {
                    const name = u.display_name ?? "User";
                    const avatar = u.avatar?.url ?? avatarUrl(name);
                    const isAdded = friendIds.has(u.id);
                    return (
                      <article key={u.id} className="flex gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                        <Link to="/user/$id" params={{ id: String(u.id) }} className="shrink-0">
                          <img src={avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to="/user/$id" params={{ id: String(u.id) }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{name}</Link>
                          <div className="mt-[10px] flex flex-wrap gap-[8px]">
                            {isAdded ? (
                              <span className="inline-flex items-center gap-[4px] font-medium" style={{ height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12, color: "var(--foreground-50)", border: "1px solid var(--border)" }}>
                                <Check size={12} />{t("friends.inFriends")}
                              </span>
                            ) : (
                              <button onClick={() => void addFriend(u.id)} className="inline-flex items-center gap-[4px] font-semibold" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "var(--accent)", color: "white", fontSize: 12 }}>
                                <UserPlus size={12} />{t("friends.addFriend")}
                              </button>
                            )}
                            <button type="button" onClick={() => openChat(u.id)} className="inline-flex items-center gap-[4px] font-medium" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "transparent", color: "var(--foreground-70)", fontSize: 12, border: "1px solid var(--border)" }}>
                              <MessageSquare size={12} />{t("friends.message")}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : filteredFriends.length === 0 ? (
              <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("friends.emptyAll")}</div>
            ) : (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {filteredFriends.map((u) => {
                  const isAdded = friendIds.has(u.id);
                  const name = u.display_name ?? "User";
                  const avatar = u.avatar?.url ?? avatarUrl(name);
                  return (
                    <article key={u.id} className="flex gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                      <Link to="/user/$id" params={{ id: String(u.id) }} className="shrink-0">
                        <img src={avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to="/user/$id" params={{ id: String(u.id) }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{name}</Link>
                        <div className="mt-[10px] flex flex-wrap gap-[8px]">
                          <button
                            onClick={async () => {
                              try {
                                if (isAdded) {
                                  await api.remove(u.id);
                                  toast.success(t("friends.removedFromFriends"));
                                }
                              } catch {
                                toast.error(t("common.error"));
                              }
                            }}
                            className="inline-flex items-center gap-[4px] font-semibold"
                            style={{
                              height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                              background: "transparent",
                              color: "var(--foreground-70)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <Check size={12} />{t("friends.inFriends")}
                          </button>
                          <button
                            type="button"
                            onClick={() => openChat(u.id)}
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
