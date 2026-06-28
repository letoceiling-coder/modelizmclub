import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, UserPlus, MessageSquare, Check, X, Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, type User } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import {
  fetchFriends, fetchIncomingRequests, searchUsers,
  sendFriendRequest, removeFriend, acceptFriendRequest, declineFriendRequest,
  type IncomingRequest,
} from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { toast } from "sonner";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Друзья — МоДелизМ Форум" }] }),
  component: FriendsPage,
});

type Tab = "all" | "online" | "requests";

const pulse = {
  animate: { opacity: [0.4, 0.7, 0.4] },
  transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
};

function FriendsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const me = useStore(selectors.currentUser);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigateMessenger = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchFriends().catch(() => [] as User[]),
      fetchIncomingRequests().catch(() => [] as IncomingRequest[]),
      searchUsers("").catch(() => [] as User[]),
    ]).then(([fr, rq, us]) => {
      if (!active) return;
      setFriends(fr);
      setRequests(rq);
      setAllUsers(us);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  useEffect(() => {
    const el = refs.current[tab];
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab, loading]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (me && u.id === me.id) return false;
      if (tab === "online" && !u.online) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab, allUsers, me]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Все", count: allUsers.length },
    { key: "online", label: "Онлайн", count: allUsers.filter((u) => u.online).length },
    { key: "requests", label: "Заявки", count: requests.length },
  ];

  const accept = async (id: number) => {
    try {
      await acceptFriendRequest(id);
      setRequests((rs) => rs.filter((r) => r.id !== id));
      setFriends(await fetchFriends());
      toast.success("Заявка принята");
    } catch {
      toast.error("Не удалось принять заявку");
    }
  };
  const decline = async (id: number) => {
    try {
      await declineFriendRequest(id);
      setRequests((rs) => rs.filter((r) => r.id !== id));
      toast.success("Заявка отклонена");
    } catch {
      toast.error("Не удалось отклонить заявку");
    }
  };
  const added = new Set(friends.map((f) => f.id));

  const toggleFriend = async (u: User) => {
    if (!u.numericId) return;
    const isAdded = added.has(u.id);
    try {
      if (isAdded) {
        await removeFriend(u.numericId);
        setFriends((fs) => fs.filter((f) => f.id !== u.id));
        toast.success("Удалён из друзей");
      } else {
        await sendFriendRequest(u.numericId);
        toast.success("Заявка отправлена");
      }
    } catch {
      toast.error("Не удалось выполнить действие");
    }
  };

  const writeTo = async (u: User) => {
    if (!u.numericId || !me) return;
    try {
      const dialog = await createConversation(u.numericId, me.id);
      navigateMessenger({ to: "/messenger", search: { chat: dialog.id } });
    } catch {
      toast.error("Не удалось открыть диалог");
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        <header>
          <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>Друзья</h1>
          <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>Найдите единомышленников</p>
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
              placeholder="Поиск по имени, интересам"
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
                <div className="py-[60px] text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>Нет входящих заявок</div>
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {requests.map((r) => {
                    const u = r.from;
                    return (
                      <article key={r.id} className="flex items-start gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="shrink-0">
                          <img src={u.avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{u.name}</Link>
                          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Хочет добавить вас в друзья</div>
                          <div className="mt-[2px] inline-flex items-center gap-[4px] font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={11} /> {formatRelativeTime(r.date)}
                          </div>
                          <div className="mt-[10px] flex gap-[8px]">
                            <button onClick={() => accept(r.id)} className="inline-flex items-center gap-[4px] font-semibold" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "var(--accent)", color: "white", fontSize: 12 }}>
                              <Check size={12} /> Принять
                            </button>
                            <button onClick={() => decline(r.id)} className="inline-flex items-center gap-[4px] font-medium" style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "transparent", color: "var(--foreground-70)", fontSize: 12, border: "1px solid var(--border)" }}>
                              <X size={12} /> Отклонить
                            </button>
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
                  const isAdded = added.has(u.id);
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <article key={u.id} className="flex gap-[12px] p-[16px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
                      <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="relative shrink-0">
                        <img src={u.avatar} alt="" className="h-[48px] w-[48px] rounded-full object-cover" />
                        {u.online && <span className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full" style={{ background: "var(--success)", border: "2px solid var(--background)" }} />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="font-medium text-[14px]" style={{ color: "var(--foreground)" }}>{u.name}</Link>
                        <div className="mt-[2px] inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> {u.city}
                        </div>
                        <div className="mt-[2px] line-clamp-1 text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                        <div className="mt-[10px] flex flex-wrap gap-[8px]">
                          <button
                            onClick={() => toggleFriend(u)}
                            className="inline-flex items-center gap-[4px] font-semibold"
                            style={{
                              height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12,
                              background: isAdded ? "transparent" : "var(--accent)",
                              color: isAdded ? "var(--foreground-70)" : "white",
                              border: isAdded ? "1px solid var(--border)" : "none",
                            }}
                          >
                            {isAdded ? <><Check size={12} />В друзьях</> : <><UserPlus size={12} />Добавить</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => writeTo(u)}
                            className="inline-flex items-center gap-[4px] font-medium"
                            style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "transparent", color: "var(--foreground-70)", fontSize: 12, border: "1px solid var(--border)" }}
                          >
                            <MessageSquare size={12} /> Написать
                          </button>

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
