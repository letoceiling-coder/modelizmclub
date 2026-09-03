import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  MapPin, UserPlus, MessageSquare, Check, X, Clock, Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { userById, type User } from "@/lib/mock";
import { useStore, actions } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { groupCalls } from "@/lib/groupCall";
import { useOnlineSet } from "@/lib/realtime/presence";
import { isUserOnline } from "@/lib/presence-status";
import {
  fetchFriends, fetchIncomingRequests, fetchOutgoingRequests, searchUsers,
  sendFriendRequest, removeFriend, acceptFriendRequest, declineFriendRequest, cancelFriendRequest,
  blockUser, formatSocialActionError,
  type IncomingRequest,
} from "@/lib/api/social";
import { ApiError } from "@/lib/api/client";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { openConversation } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";
import { toast } from "@/lib/toast";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FriendActionsMenu } from "@/components/friends/FriendActionsMenu";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { FriendRequiredDialog } from "@/components/friends/FriendRequiredDialog";

import i18n from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: i18n.t("pages.friends.metaTitle") }] }),
  beforeLoad: async ({ location }) => {
    const { requireVerified } = await import("@/lib/auth/verification");
    await requireVerified(location);
  },
  component: FriendsPage,
});

type Tab = "all" | "online" | "requests";

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function FriendCard({
  user, isAdded, isPending, online,
  onToggleFriend, onWriteTo, onViewProfile, onRemoveFriend, onHide, onReport, onBlock,
}: {
  user: User;
  isAdded: boolean;
  isPending: boolean;
  online: boolean;
  onToggleFriend: () => void;
  onWriteTo: () => void;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const { t } = useTranslation();
  const interests = user.interests.split(",").slice(0, 3).join(", ");
  return (
    <Card
      className="flex flex-col gap-[12px] p-[16px] shadow-none sm:flex-row sm:items-center sm:gap-[16px] sm:p-[20px]"
      style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
    >
      {/* Identity (avatar + text) — its own full-width row on mobile so the
          text never collapses under the action buttons; beside them on desktop. */}
      <div className="flex min-w-0 items-center gap-[12px] sm:flex-1 sm:gap-[16px]">
        <Link to="/user/$id" params={{ id: user.slug ?? user.id }} className="relative shrink-0">
          <Avatar className="h-[56px] w-[56px]">
            <AvatarImage src={user.avatar} alt="" />
            <AvatarFallback
              className="text-[15px] font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {userInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {online && (
            <span
              className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full"
              style={{ background: "var(--success)", border: "2px solid var(--background)" }}
            />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/user/$id"
            params={{ id: user.slug ?? user.id }}
            className="block truncate font-semibold text-[15px]"
            style={{ color: "var(--foreground)" }}
          >
            {user.name}
          </Link>
          <div className="mt-[2px] flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {user.city ? (
              <>
                <MapPin size={11} /> <span className="truncate">{user.city}</span>
              </>
            ) : null}
          </div>
          <div className="mt-[2px] truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{interests}</div>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-[8px] sm:w-auto sm:flex-nowrap sm:shrink-0">
        <Button
          size="sm"
          variant={isAdded || isPending ? "outline" : "default"}
          onClick={onToggleFriend}
          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
        >
          {isAdded
            ? <><Check size={13} /> {t("pages.friends.inFriends")}</>
            : isPending
            ? <><Clock size={13} /> {t("pages.friends.requestSent")}</>
            : <><UserPlus size={13} /> {t("pages.friends.add")}</>}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onWriteTo}
          className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
        >
          <MessageSquare size={13} /> {t("pages.friends.write")}
        </Button>
        <FriendActionsMenu
          isFriend={isAdded}
          onViewProfile={onViewProfile}
          onRemoveFriend={onRemoveFriend}
          onHide={onHide}
          onReport={onReport}
          onBlock={onBlock}
        />
      </div>
    </Card>
  );
}

function FriendsPage() {
  const { t } = useTranslation();
  const { requireAccount } = useGuestAccess();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const me = useCurrentUser();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [complaintTarget, setComplaintTarget] = useState<User | null>(null);
  const [friendPrompt, setFriendPrompt] = useState<User | null>(null);
  const [friendPromptBusy, setFriendPromptBusy] = useState(false);
  const navigateMessenger = useNavigate();
  const onlineSet = useOnlineSet();
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPresenceTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const presenceUser = (u: User): User => {
    const live = userById(u.id);
    if (live.name === "Пользователь" && !live.lastSeenAt && live.online == null) return u;
    return {
      ...u,
      online: live.online ?? u.online,
      lastSeenAt: live.lastSeenAt ?? u.lastSeenAt,
    };
  };
  const isOnline = (u: User) => isUserOnline(u.id, onlineSet, presenceUser(u));
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const hiddenUserIds = useStore((s) => s.hiddenUserIds);
  const isBlockedUser = (id: string) => blockedUserIds.includes(id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchFriends().catch(() => [] as User[]),
      fetchIncomingRequests().catch(() => [] as IncomingRequest[]),
      fetchOutgoingRequests().catch(() => []),
      searchUsers("").catch(() => [] as User[]),
    ]).then(([fr, rq, out, us]) => {
      if (!active) return;
      setFriends(fr);
      setRequests(rq);
      setAllUsers(us);
      setPending(new Map(out.map((r) => [r.to.id, r.id])));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Keep friend last_seen_at fresh (same cadence as messenger dialog list).
  useEffect(() => {
    if (isDemoMode()) return;
    let active = true;
    const refresh = () => {
      fetchFriends()
        .then((fr) => { if (active) setFriends(fr); })
        .catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 45_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
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
      const ql = q.toLowerCase();
      if (!ql) return true;
      return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
    });
  }, [q, allUsers, me, blockedUserIds, hiddenUserIds]);

  const added = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const onlineFriends = useMemo(() => {
    void presenceTick;
    return friends
      .filter((u) => {
        if (me && u.id === me.id) return false;
        if (blockedUserIds.includes(u.id) || hiddenUserIds.includes(u.id)) return false;
        if (!isOnline(u)) return false;
        const ql = q.toLowerCase();
        if (!ql) return true;
        return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [friends, me, blockedUserIds, hiddenUserIds, q, onlineSet, presenceTick]);

  const connected = useMemo(() => {
    void presenceTick;
    const byId = new Map(allUsers.map((u) => [u.id, u]));
    return friends
      .map((f) => byId.get(f.id) ?? f)
      .filter((u) => {
        if (blockedUserIds.includes(u.id) || hiddenUserIds.includes(u.id)) return false;
        const ql = q.toLowerCase();
        if (!ql) return true;
        return u.name.toLowerCase().includes(ql) || u.interests.toLowerCase().includes(ql);
      })
      .sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));
  }, [friends, allUsers, blockedUserIds, hiddenUserIds, q, onlineSet, presenceTick]);

  const recommended = useMemo(() => {
    return filteredUsers.filter((u) => !added.has(u.id));
  }, [filteredUsers, added]);

  const searchWrapRef = useRef<HTMLDivElement>(null);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("pages.friends.tabAll"), count: allUsers.length },
    { key: "online", label: t("pages.friends.tabOnline"), count: friends.filter((u) => isOnline(u)).length },
    { key: "requests", label: t("pages.friends.tabRequests"), count: requests.length },
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
      toast.success(t("pages.friends.requestAccepted"));
    } catch {
      toast.error(t("pages.friends.requestAcceptFailed"));
    }
  };
  const decline = async (id: number) => {
    try {
      await declineFriendRequest(id);
      setRequests((rs) => rs.filter((r) => r.id !== id));
      toast.success(t("pages.friends.requestDeclined"));
    } catch {
      toast.error(t("pages.friends.requestDeclineFailed"));
    }
  };
  const toggleFriend = async (u: User) => {
    if (!u.numericId) {
      toast.error(t("pages.friends.userUnknown"));
      return;
    }
    const isAdded = added.has(u.id);
    const pendingId = pending.get(u.id);
    try {
      if (isAdded) {
        await removeFriend(u.numericId);
        setFriends((fs) => fs.filter((f) => f.id !== u.id));
        toast.success(t("pages.friends.removedFromFriends"));
        return;
      }
      if (pendingId != null) {
        if (pendingId > 0) {
          await cancelFriendRequest(pendingId);
        }
        setPending((p) => {
          const next = new Map(p);
          next.delete(u.id);
          return next;
        });
        toast.success(t("pages.friends.requestCancelled"));
        return;
      }
      const result = await sendFriendRequest(u.numericId);
      if (result.status === "accepted") {
        setFriends((fs) => (fs.some((f) => f.id === u.id) ? fs : [u, ...fs]));
        toast.success(t("pages.friends.addedToFriends"));
        return;
      }
      setPending((p) => new Map(p).set(u.id, result.id));
      toast.success(t("pages.friends.requestSent"));
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldMsg = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
        const msg = fieldMsg || err.message;
        if (err.status === 422 && msg.includes("уже отправлена")) {
          setPending((p) => new Map(p).set(u.id, p.get(u.id) ?? 0));
          void fetchOutgoingRequests()
            .then((out) => setPending(new Map(out.map((r) => [r.to.id, r.id]))))
            .catch(() => {});
          toast.success(t("pages.friends.requestAlreadySent"));
          return;
        }
        toast.error(msg);
        return;
      }
      toast.error(formatSocialActionError(err, t("pages.friends.sendRequestFailed")));
    }
  };

  const writeTo = async (u: User) => {
    if (!u.numericId || !me) return;
    let allowed = false;
    requireAccount(() => { allowed = true; });
    if (!allowed) return;
    if (!added.has(u.id)) {
      setFriendPrompt(u);
      return;
    }
    try {
      const dialog = await openConversation(u.numericId, me.id, u.id);
      navigateMessenger({ to: "/messenger", search: { chat: dialog.id } });
    } catch (err) {
      const message = formatApiErrorMessage(err, t("pages.friends.dialogOpenFailed"));
      if (message) toast.error(message);
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
      toast.success(t("pages.friends.removedFromFriends"));
    } catch {
      toast.error(t("pages.friends.removeFailed"));
    }
  };

  const hideUserFromList = (u: User) => {
    actions.hideUser(u.id);
    toast.success(t("pages.friends.hiddenFromRecommendations"));
  };

  const reportUser = (u: User) => setComplaintTarget(u);

  const blockUserVia = async (u: User) => {
    if (!isDemoMode() && u.numericId) {
      try { await blockUser(u.numericId); } catch { toast.error(t("pages.friends.blockFailed")); return; }
    }
    actions.blockUser(u.id);
    setFriends((fs) => fs.filter((f) => f.id !== u.id));
    setRequests((rs) => rs.filter((r) => r.from.id !== u.id));
    toast.success(t("pages.friends.userBlocked", { name: u.name }), { description: t("pages.friends.userBlockedDesc") });
  };

  return (
    <AppLayout>
      <div className="space-y-[16px]">
        <header className="flex flex-col gap-[12px] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>{t("pages.friends.title")}</h1>
            <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("pages.friends.subtitle")}</p>
          </div>
          {/* Full-width split on mobile so "Групповой звонок" never runs off the
              right edge; natural row on desktop. */}
          <div className="flex w-full items-center justify-end gap-[8px] sm:w-auto sm:shrink-0">
            <Button
              type="button"
              onClick={() => groupCalls.openPicker("start")}
              className="flex-1 rounded-[10px] gap-[6px] sm:flex-none"
              size="sm"
            >
              <Users size={16} /> {t("pages.friends.groupCall")}
            </Button>
          </div>
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
                      borderRadius: "var(--r-pill)",
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
          <div ref={searchWrapRef}>
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClear={() => setQ("")}
              placeholder={t("pages.friends.searchPlaceholder")}
            />
          </div>
        )}

        <ReducedMotionSwitch
          switchKey={tab}
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
                    style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
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
                  title={t("pages.friends.requestsEmpty")}
                  description={t("pages.friends.requestsEmptyDesc")}
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
                        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
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
                            {t("pages.friends.wantsToAdd")}
                          </p>
                          <p className="mt-[2px] flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
                            <Clock size={10} /> {formatDate(r.date, "relative")}
                          </p>
                          <div className="mt-[12px] flex flex-wrap gap-[8px]">
                            <Button
                              size="sm"
                              onClick={() => accept(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <Check size={13} /> {t("pages.friends.accept")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decline(r.id)}
                              className="h-[44px] rounded-[8px] px-[14px] text-[13px] gap-[6px] sm:h-[36px]"
                            >
                              <X size={13} /> {t("pages.friends.decline")}
                            </Button>
                          </div>
                        </div>
                        <FriendActionsMenu
                          isFriend={false}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => {}}
                          onHide={() => hideUserFromList(u)}
                          onReport={() => reportUser(u)}
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
            ) : tab === "online" ? (
              onlineFriends.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("pages.friends.onlineEmpty")}
                  description={t("pages.friends.onlineEmptyDesc")}
                  variant="compact"
                />
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {onlineFriends.map((u) => (
                      <FriendCard
                        key={u.id}
                        user={u}
                        isAdded={true}
                        isPending={false}
                        online={true}
                        onToggleFriend={() => toggleFriend(u)}
                        onWriteTo={() => writeTo(u)}
                        onViewProfile={() => viewProfile(u)}
                        onRemoveFriend={() => removeFriendVia(u)}
                        onHide={() => hideUserFromList(u)}
                        onReport={() => reportUser(u)}
                        onBlock={() => blockUserVia(u)}
                      />
                  ))}
                </div>
              )
            ) : connected.length === 0 && recommended.length === 0 ? (
              <EmptyState
                icon={Users}
                title={q ? t("pages.friends.searchEmpty") : t("pages.friends.emptyTitle")}
                description={q ? t("pages.friends.searchEmptyDesc") : t("pages.friends.emptyDesc")}
                variant="compact"
              />
            ) : (
              <div className="flex flex-col gap-[24px]">
                {connected.length > 0 && (
                  <div className="flex flex-col gap-[10px]">
                    <div className="flex items-center gap-[6px] px-[2px]">
                      <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.friends.myFriends")}</h2>
                      <span className="text-[13px] font-semibold" style={{ color: "var(--foreground-50)" }}>{connected.length}</span>
                    </div>
                    {connected.map((u) => (
                      <FriendCard
                        key={u.id}
                        user={u}
                        isAdded={true}
                        isPending={false}
                        online={isOnline(u)}
                        onToggleFriend={() => toggleFriend(u)}
                        onWriteTo={() => writeTo(u)}
                        onViewProfile={() => viewProfile(u)}
                        onRemoveFriend={() => removeFriendVia(u)}
                        onHide={() => hideUserFromList(u)}
                        onReport={() => reportUser(u)}
                        onBlock={() => blockUserVia(u)}
                      />
                    ))}
                  </div>
                )}
                {recommended.length > 0 && (
                  <div className="flex flex-col gap-[10px]">
                    <h2 className="px-[2px] text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.friends.recommendations")}</h2>
                    {recommended.map((u) => {
                      const isPending = pending.has(u.id);
                      return (
                        <FriendCard
                          key={u.id}
                          user={u}
                          isAdded={false}
                          isPending={isPending}
                          online={isOnline(u)}
                          onToggleFriend={() => toggleFriend(u)}
                          onWriteTo={() => writeTo(u)}
                          onViewProfile={() => viewProfile(u)}
                          onRemoveFriend={() => removeFriendVia(u)}
                          onHide={() => hideUserFromList(u)}
                          onReport={() => reportUser(u)}
                          onBlock={() => blockUserVia(u)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        </ReducedMotionSwitch>
      </div>
      <ComplaintDialog target={complaintTarget} onClose={() => setComplaintTarget(null)} report={complaintTarget ? { type: "user", targetId: complaintTarget.id } : undefined} />
      <FriendRequiredDialog
        open={friendPrompt !== null}
        onOpenChange={(open) => { if (!open) setFriendPrompt(null); }}
        adding={friendPromptBusy}
        onAdd={() => {
          const u = friendPrompt;
          if (!u) return;
          setFriendPromptBusy(true);
          void toggleFriend(u).finally(() => {
            setFriendPromptBusy(false);
            setFriendPrompt(null);
          });
        }}
      />
    </AppLayout>
  );
}
