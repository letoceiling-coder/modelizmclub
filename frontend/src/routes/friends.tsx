import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, UserPlus, MessageSquare, Check, X, Clock, Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime, type User } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";
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
import { FriendActionsMenu } from "@/components/friends/FriendActionsMenu";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Друзья — МоДелизМ" }] }),
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
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const hiddenUserIds = useStore((s) => s.hiddenUserIds);
  const isBlockedUser = (id: string) => blockedUserIds.includes(id);

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
      if (blockedUserIds.includes(u.id)) return false;
      if (hiddenUserIds.includes(u.id)) return false;
      if (tab === "online" && !isOnline(u)) return false;
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, tab, allUsers, me, blockedUserIds, hiddenUserIds]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Все", count: allUsers.length },
    { key: "online", label: "Онлайн", count: allUsers.filter((u) => isOnline(u)).length },
    { key: "requests", label: "Заявки", count: requests.length },
  ];

  const accept = async (id: number) => {
    const req = requests.find((r) => r.id === id);
    try {
      await acceptFriendRequest(id);
      setRequests((rs) => rs.filter((r) => r.id !== id));
      // Optimistically move the requester into the friends list so the change
      // is visible immediately (demo has no server round-trip to re-fetch).
      if (req) {
        setFriends((fs) => (fs.some((f) => f.id === req.from.id) ? fs : [req.from, ...fs]));
      }
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
        // Inline feedback only: the button itself flips to "Заявка отправлена".
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

  const viewProfile = (u: User) => {
    navigateMessenger({ to: "/user/$id", params: { id: u.slug ?? u.id } });
  };

  const removeFriendVia = async (u: User) => {
    if (!u.numericId) return;
    try {
      await removeFriend(u.numericId);
      setFriends((fs) => fs.filter((f) => f.id !== u.id));
      toast.success("Удалён из друзей");
    } catch {
      toast.error("Не удалось удалить из друзей");
    }
  };

  const hideUserFromList = (u: User) => {
    actions.hideUser(u.id);
    toast.success("Скрыто из рекомендаций");
  };

  const reportUser = () => {
    toast("Жалоба: будет доступно позже");
  };

  const blockUserVia = (u: User) => {
    actions.blockUser(u.id);
    setFriends((fs) => fs.filter((f) => f.id !== u.id));
    setRequests((rs) => rs.filter((r) => r.from.id !== u.id));
    toast.success(`${u.name} заблокирован`, { description: "Пропал из друзей и списков — можно разблокировать в разделе «Заблокированные» в профиле" });
  };

  return (
    <AppLayout footer>
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
              <div className="flex flex-col gap-[10px]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card
                    key={i}
                    className="flex items-center gap-[16px] p-[20px] shadow-none"
                    style={{ borderColor: "var(--border)", borderRadius: 14 }}
                  >
                    <Skeleton className="h-[56px] w-[56px] shrink-0 rounded-full" />
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
                <div className="flex flex-col gap-[10px]">
                  {requests.filter((r) => !isBlockedUser(r.from.id)).map((r) => {
                    const u = r.from;
                    return (
                      <Card
                        key={r.id}
                        className="flex items-start gap-[14px] p-[20px] shadow-none"
                        style={{ borderColor: "var(--border)", borderRadius: 14 }}
                      >
                        <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="shrink-0">
                          <Avatar className="h-[52px] w-[52px]">
                            <AvatarImage src={u.avatar} alt="" />
                            <AvatarFallback
                              className="text-[14px] font-semibold"
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
                            className="block truncate font-semibold text-[15px]"
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
                          <div className="mt-[12px] flex gap-[8px]">
                            <Button
                              size="sm"
                              onClick={() => accept(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <Check size={13} /> Принять
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decline(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <X size={13} /> Отклонить
                            </Button>
                          </div>
                        </div>
                        <FriendActionsMenu
                          isFriend={false}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => {}}
                          onHide={() => hideUserFromList(u)}
                          onReport={reportUser}
                          onBlock={() => {
                            blockUserVia(u);
                            decline(r.id);
                          }}
                        />
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
              <div className="flex flex-col gap-[10px]">
                {filteredUsers.map((u) => {
                  const isAdded = added.has(u.id);
                  const isPending = !isAdded && pending.has(u.id);
                  const interests = u.interests.split(",").slice(0, 3).join(", ");
                  return (
                    <Card
                      key={u.id}
                      className="flex items-center gap-[16px] p-[20px] shadow-none"
                      style={{ borderColor: "var(--border)", borderRadius: 14 }}
                    >
                      <Link to="/user/$id" params={{ id: u.slug ?? u.id }} className="relative shrink-0">
                        <Avatar className="h-[56px] w-[56px]">
                          <AvatarImage src={u.avatar} alt="" />
                          <AvatarFallback
                            className="text-[15px] font-semibold"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                          >
                            {userInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline(u) && (
                          <span
                            className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full"
                            style={{ background: "var(--success)", border: "2px solid var(--background)" }}
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/user/$id"
                          params={{ id: u.slug ?? u.id }}
                          className="block truncate font-semibold text-[15px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          {u.name}
                        </Link>
                        <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                          <MapPin size={11} /> <span className="truncate">{u.city}</span>
                        </div>
                        <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-[8px]">
                        <Button
                          size="sm"
                          variant={isAdded || isPending ? "outline" : "default"}
                          disabled={isPending}
                          onClick={() => toggleFriend(u)}
                          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                        >
                          {isAdded
                            ? <><Check size={13} /> В друзьях</>
                            : isPending
                            ? <><Clock size={13} /> Заявка отправлена</>
                            : <><UserPlus size={13} /> Добавить</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => writeTo(u)}
                          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                        >
                          <MessageSquare size={13} /> Написать
                        </Button>
                        <FriendActionsMenu
                          isFriend={isAdded}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => removeFriendVia(u)}
                          onHide={() => hideUserFromList(u)}
                          onReport={reportUser}
                          onBlock={() => blockUserVia(u)}
                        />
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
