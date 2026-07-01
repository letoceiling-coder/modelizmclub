import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, UserPlus, MessageSquare, Check, X, Clock, Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, type User } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { groupCalls } from "@/lib/groupCall";
import { useOnlineSet } from "@/lib/realtime/presence";
import {
  fetchFriends, fetchIncomingRequests, searchUsers,
  sendFriendRequest, removeFriend, acceptFriendRequest, declineFriendRequest,
  type IncomingRequest,
} from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Друзья — МоДелизМ Форум" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: FriendsPage,
});

type Tab = "all" | "online" | "requests";

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function FriendsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const me = useStore(selectors.currentUser);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const navigateMessenger = useNavigate();
  const onlineSet = useOnlineSet();
  const isOnline = (u: User) => onlineSet.has(u.id) || !!u.online;

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
      if (tab === "online" && !isOnline(u)) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab, allUsers, me]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Все", count: allUsers.length },
    { key: "online", label: "Онлайн", count: allUsers.filter((u) => isOnline(u)).length },
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
    if (!u.numericId) {
      toast.error("Не удалось определить пользователя");
      return;
    }
    const isAdded = added.has(u.id);
    if (!isAdded && pending.has(u.id)) return;
    try {
      if (isAdded) {
        await removeFriend(u.numericId);
        setFriends((fs) => fs.filter((f) => f.id !== u.id));
        toast.success("Удалён из друзей");
      } else {
        await sendFriendRequest(u.numericId);
        setPending((p) => new Set(p).add(u.id));
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
        <header className="flex items-start justify-between gap-[12px]">
          <div>
            <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>Друзья</h1>
            <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>Найдите единомышленников</p>
          </div>
          <Button
            type="button"
            onClick={() => groupCalls.openPicker("start")}
            className="shrink-0 rounded-[10px] gap-[6px]"
            size="sm"
          >
            <Users size={16} /> Групповой звонок
          </Button>
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
                  className="inline-flex shrink-0 items-center gap-[6px] font-display transition-colors duration-200"
                  style={{
                    height: 48, padding: "0 16px", fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--foreground)" : "var(--foreground-50)",
                  }}
                >
                  {t.label}
                  <span
                    className="inline-flex h-[20px] min-w-[20px] items-center justify-center px-[6px] text-[11px] font-bold"
                    style={{
                      background: active ? "var(--accent-soft)" : "var(--background-surface)",
                      color: active ? "var(--accent)" : "var(--foreground-50)",
                      borderRadius: 999,
                    }}
                  >
                    {t.count}
                  </span>
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
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ("")}
            placeholder="Поиск по имени, интересам"
          />
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card
                    key={i}
                    className="flex items-center gap-[12px] p-[16px] shadow-none"
                    style={{ borderColor: "var(--border)", borderRadius: 14 }}
                  >
                    <Skeleton className="h-[48px] w-[48px] shrink-0 rounded-full" />
                    <div className="flex-1 space-y-[8px]">
                      <Skeleton className="h-[12px] rounded-[6px]" style={{ width: `${40 + (i * 13) % 40}%` }} />
                      <Skeleton className="h-[10px] rounded-[6px]" style={{ width: `${30 + (i * 11) % 30}%` }} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : tab === "requests" ? (
              requests.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="Нет входящих заявок"
                  description="Заявки в друзья будут отображаться здесь"
                  variant="compact"
                />
              ) : (
                <div className="grid gap-[12px] sm:grid-cols-2">
                  {requests.map((r) => {
                    const u = r.from;
                    return (
                      <Card
                        key={r.id}
                        className="flex items-start gap-[12px] p-[16px] shadow-none"
                        style={{ borderColor: "var(--border)", borderRadius: 14 }}
                      >
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="shrink-0">
                          <Avatar className="h-[48px] w-[48px]">
                            <AvatarImage src={u.avatar} alt="" />
                            <AvatarFallback
                              className="text-[13px] font-semibold"
                              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                              {userInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/user/$id"
                            params={{ id: u.slug ?? u.id }}
                            className="block truncate font-semibold text-[14px]"
                            style={{ color: "var(--foreground)" }}
                          >
                            {u.name}
                          </Link>
                          <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                            Хочет добавить вас в друзья
                          </p>
                          <p className="mt-[2px] flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={10} /> {formatRelativeTime(r.date)}
                          </p>
                          <div className="mt-[10px] flex gap-[8px]">
                            <Button
                              size="sm"
                              onClick={() => accept(r.id)}
                              className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                            >
                              <Check size={12} /> Принять
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decline(r.id)}
                              className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                            >
                              <X size={12} /> Отклонить
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={q ? "Никого не найдено" : tab === "online" ? "Никто не в сети" : "Список пуст"}
                description={
                  q
                    ? "Попробуйте изменить запрос"
                    : tab === "online"
                    ? "Загляните позже — онлайн-участники появятся здесь"
                    : "Найдите интересных участников сообщества"
                }
                variant="compact"
              />
            ) : (
              <div className="grid gap-[12px] sm:grid-cols-2">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <Card
                      key={u.id}
                      className="flex gap-[12px] p-[16px] shadow-none"
                      style={{ borderColor: "var(--border)", borderRadius: 14 }}
                    >
                      <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="relative shrink-0">
                        <Avatar className="h-[48px] w-[48px]">
                          <AvatarImage src={u.avatar} alt="" />
                          <AvatarFallback
                            className="text-[13px] font-semibold"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                          >
                            {userInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline(u) && (
                          <span
                            className="absolute bottom-0 right-0 h-[12px] w-[12px] rounded-full"
                            style={{ background: "var(--success)", border: "2px solid var(--background)" }}
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/user/$id"
                          params={{ id: u.slug ?? u.id }}
                          className="block truncate font-semibold text-[14px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          {u.name}
                        </Link>
                        <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> <span className="truncate">{u.city}</span>
                        </div>
                        <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                        <div className="mt-[10px] flex flex-wrap gap-[8px]">
                          <Button
                            size="sm"
                            variant={isAdded || isPending ? "outline" : "default"}
                            disabled={isPending}
                            onClick={() => toggleFriend(u)}
                            className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                          >
                            {isAdded
                              ? <><Check size={12} /> В друзьях</>
                              : isPending
                              ? <><Clock size={12} /> Заявка отправлена</>
                              : <><UserPlus size={12} /> Добавить</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => writeTo(u)}
                            className="h-[32px] rounded-[8px] px-[12px] text-[12px] gap-[4px]"
                          >
                            <MessageSquare size={12} /> Написать
                          </Button>
                        </div>
                      </div>
                    </Card>
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
