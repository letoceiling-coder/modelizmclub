import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BadgeCheck, FileText, MapPin, MessageSquare, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User, Post, Ad, Community } from "@/lib/mock";
import { useStore, actions, selectors, setCurrentUser } from "@/lib/store";
import type { AdStatusKey } from "@/lib/store";
import { PostCard } from "@/components/PostCard";
import { AdCard } from "@/components/AdCard";
import { toast } from "sonner";
import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { fetchMyListings } from "@/lib/api/listings";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchFeed } from "@/lib/api/feed";
import { fetchFriends, updateOwnProfile } from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Профиль — МоДелизМ Форум" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: ProfilePage,
});

function toAdStatus(k: AdStatusKey): AdStatus {
  switch (k) {
    case "active":
      return "active";
    case "moderation":
    case "draft":
      return "moderation";
    case "rejected":
      return "rejected";
    default:
      return "archived";
  }
}

function ProfilePage() {
  const currentUser = useStore(selectors.currentUser);
  const [myAds, setMyAds] = useState<{ ad: Ad; status: AdStatus }[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (!currentUser?.id) return;
    fetchMyListings()
      .then((list) => active && setMyAds(list.map((x) => ({ ad: x.ad, status: toAdStatus(x.status) }))))
      .catch(() => {});
    fetchCommunities()
      .then((cs) => active && setMyCommunities(cs.filter((c) => c.joined)))
      .catch(() => {});
    fetchFeed({ perPage: 50 })
      .then((r) => active && setMyPosts(r.posts.filter((p) => p.authorId === currentUser.id)))
      .catch(() => {});
    fetchFriends()
      .then((fr) => active && setFriendsCount(fr.length))
      .catch(() => {});
    return () => { active = false; };
  }, [currentUser?.id]);

  const saveProfile = async (draft: User) => {
    await updateOwnProfile({ display_name: draft.name, bio: draft.bio ?? "" });
    setCurrentUser({ ...currentUser, name: draft.name, bio: draft.bio, city: draft.city, interests: draft.interests });
  };

  return (
    <ProfileView
      user={currentUser}
      isOwn
      stats={{ friends: friendsCount }}
      postsOverride={myPosts}
      adsOverride={myAds}
      communitiesOverride={myCommunities}
      onSaveProfile={saveProfile}
    />
  );
}

type TabKey = "posts" | "ads" | "communities" | "invited" | "about";

const TABS_BASE: { key: TabKey; label: string; Icon: typeof FileText; ownOnly?: boolean }[] = [
  { key: "posts", label: "Публикации", Icon: FileText },
  { key: "ads", label: "Объявления", Icon: Tag },
  { key: "communities", label: "Сообщества", Icon: Users },
  { key: "invited", label: "Приглашённые", Icon: UserPlus, ownOnly: true },
  { key: "about", label: "О себе", Icon: UserIcon },
];


const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send: SendIcon, Code2, Wrench, Cpu, BatteryCharging,
};

type AdStatus = "active" | "moderation" | "rejected" | "archived";
const AD_STATUS_FILTERS: { key: AdStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "moderation", label: "На модерации" },
  { key: "rejected", label: "Отклонённые" },
  { key: "archived", label: "Архив" },
];
const AD_STATUS_STYLE: Record<AdStatus, { label: string; bg: string; color: string }> = {
  active: { label: "Активно", bg: "var(--success-soft)", color: "var(--success)" },
  moderation: { label: "На модерации", bg: "var(--warning-soft)", color: "var(--warning)" },
  rejected: { label: "Отклонено", bg: "var(--error-soft)", color: "var(--error)" },
  archived: { label: "В архиве", bg: "var(--background-surface)", color: "var(--foreground-50)" },
};

export interface ProfileViewProps {
  user: User;
  isOwn: boolean;
  stats?: { publications?: number; ads?: number; friends?: number; communities?: number };
  postsOverride?: Post[];
  adsOverride?: { ad: Ad; status: AdStatus }[];
  communitiesOverride?: Community[];
  isFriendInitial?: boolean;
  isFollowingInitial?: boolean;
  onToggleFriend?: (next: boolean) => void | Promise<void>;
  onToggleFollow?: (next: boolean) => void | Promise<void>;
  onWrite?: () => void | Promise<void>;
  onSaveProfile?: (draft: User) => void | Promise<void>;
}

export function ProfileView({
  user, isOwn, stats, postsOverride, adsOverride, communitiesOverride,
  isFriendInitial, isFollowingInitial, onToggleFriend, onToggleFollow, onWrite, onSaveProfile,
}: ProfileViewProps) {
  const [tab, setTab] = useState<TabKey>("posts");
  const [adFilter, setAdFilter] = useState<AdStatus | "all">("all");
  const [editOpen, setEditOpen] = useState(false);
  const navigateToMessenger = useNavigate();
  const currentUser = useStore(selectors.currentUser);
  const storeFriendIds = useStore(selectors.friendsOf(currentUser?.id ?? user.id));

  const [isFriend, setIsFriend] = useState(
    isFriendInitial ?? (!isOwn && storeFriendIds.includes(user.id)),
  );
  const [subscribed, setSubscribed] = useState(isFollowingInitial ?? false);
  const [draft, setDraft] = useState<User>(user);

  useEffect(() => { setDraft(user); }, [user]);
  useEffect(() => { if (isFriendInitial !== undefined) setIsFriend(isFriendInitial); }, [isFriendInitial]);
  useEffect(() => { if (isFollowingInitial !== undefined) setSubscribed(isFollowingInitial); }, [isFollowingInitial]);

  const userPosts = postsOverride ?? [];
  const userAdsWithStatus = adsOverride ?? [];
  const userAds = userAdsWithStatus;
  const filteredUserAds = useMemo(
    () => (adFilter === "all" ? userAdsWithStatus : userAdsWithStatus.filter((x) => x.status === adFilter)),
    [userAdsWithStatus, adFilter],
  );
  const storeUserCommunities = useStore(selectors.userCommunities(user.id));
  const userCommunities = communitiesOverride ?? storeUserCommunities;
  const friendsCountDerived = stats?.friends ?? (isOwn ? storeFriendIds.length : (user.friendIds?.length ?? 0));
  const interestList = (user.interests || "").split(",").map((s) => s.trim()).filter(Boolean);


  return (
    <AppLayout>
      <div className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}>
        {/* Cover */}
        <div className="relative">
          {user.coverImage ? (
            <img src={user.coverImage} alt="" className="w-full object-cover" style={{ height: "clamp(120px, 22vw, 220px)" }} />
          ) : (
            <div className="w-full" style={{ height: "clamp(120px, 22vw, 220px)", background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56px]" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--background) 85%, transparent))" }} />
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-[12px] px-[16px] pb-[16px] md:flex-row md:items-end md:gap-[24px] md:px-[32px]">
          <div
            className="relative shrink-0"
            style={{ marginTop: "clamp(-44px, -10vw, -56px)", zIndex: 2 }}
          >
            <img
              src={user.avatar}
              alt=""
              className="h-[88px] w-[88px] rounded-full object-cover md:h-[112px] md:w-[112px]"
              style={{
                border: "4px solid var(--background)",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,.45), 0 0 0 1px var(--border)",
                background: "var(--background)",
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[6px]">
              <h1 className="min-w-0 truncate font-display text-[18px] font-bold md:text-[24px]" style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}>{user.name}</h1>
              {user.subscription && (
                <span
                  className="inline-flex items-center gap-[3px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10, padding: "2px 7px", borderRadius: 999 }}
                >
                  <BadgeCheck size={10} /> Pro
                </span>
              )}
              {user.firstHundred && (
                <span
                  className="inline-flex items-center gap-[3px] font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #FBBF24, #B45309)",
                    color: "#1F1300",
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                  title="Один из первых 100 участников клуба"
                >
                  ★ Первые 100
                </span>
              )}
            </div>
            <div className="mt-[3px] flex items-center gap-[6px] text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
              <MapPin size={12} /> {user.city}
            </div>
            {user.status && <div className="mt-[2px] text-[12.5px] italic" style={{ color: "var(--foreground-50)" }}>{user.status}</div>}
          </div>

          <div className="flex w-full gap-[8px] md:w-auto">
            {isOwn ? (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="inline-flex flex-1 items-center justify-center gap-[8px] font-medium transition-colors duration-150 md:flex-none"
                  style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-70)", fontSize: 14 }}
                >
                  <Pencil size={14} /> Редактировать
                </button>
                <LogoutButton variant="profile" />
              </>
            ) : (
              <>
                {isFriend ? (
                  <span
                    className="inline-flex flex-1 items-center justify-center gap-[6px] font-medium md:flex-none"
                    style={{ height: 40, padding: "0 16px", borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", fontSize: 14 }}
                  >
                    <BadgeCheck size={14} style={{ color: "var(--success)" }} /> В друзьях
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setIsFriend(true);
                      try {
                        await onToggleFriend?.(true);
                        toast.success("Заявка отправлена");
                      } catch {
                        setIsFriend(false);
                        toast.error("Не удалось отправить заявку");
                      }
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-[6px] font-semibold transition-colors duration-150 md:flex-none"
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}
                  >
                    <UserPlus size={14} /> В друзья
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (onWrite) { await onWrite(); return; }
                    if (!user.numericId || !currentUser?.id) {
                      toast.error("Не удалось открыть диалог");
                      return;
                    }
                    try {
                      const dialog = await createConversation(user.numericId, currentUser.id);
                      navigateToMessenger({ to: "/messenger", search: { chat: dialog.id } });
                    } catch {
                      toast.error("Не удалось открыть диалог");
                    }
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-[6px] font-medium transition-colors duration-150 md:flex-none"
                  style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-70)", fontSize: 14 }}
                >
                  <MessageSquare size={14} /> Написать
                </button>

                <button
                  onClick={async () => {
                    const next = !subscribed;
                    setSubscribed(next);
                    try {
                      await onToggleFollow?.(next);
                      toast.success(next ? "Вы подписались" : "Вы отписались");
                    } catch {
                      setSubscribed(!next);
                      toast.error("Не удалось изменить подписку");
                    }
                  }}
                  className="grid h-[40px] w-[40px] shrink-0 place-items-center transition-colors duration-150"
                  style={{ borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: subscribed ? "var(--accent)" : "var(--foreground-70)" }}
                  aria-label="Подписаться"
                >
                  <Bell size={14} />
                </button>
              </>
            )}
          </div>
        </div>


        {/* Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <Counter label="Публикаций" value={stats?.publications ?? userPosts.length} divider />
          <Counter label="Объявлений" value={stats?.ads ?? userAds.length} divider />
          <Counter label="Друзей" value={friendsCountDerived} divider />
          <Counter label="Сообществ" value={stats?.communities ?? userCommunities.length} />
        </div>

        {/* Tabs */}
        <Tabs tab={tab} setTab={setTab} isOwn={isOwn} />

        {/* Tab content */}
        <div className="px-[16px] py-[24px] md:px-[32px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "posts" && (
                userPosts.length === 0 ? <EmptyTab text="Нет публикаций" /> : (
                  <div className="space-y-[16px]">{userPosts.map((p) => <PostCard key={p.id} post={p} />)}</div>
                )
              )}
              {tab === "ads" && (
                userAds.length === 0 ? (
                  <EmptyTab text="Нет объявлений">
                    {isOwn && (
                      <Link to="/ads/new" className="mt-[16px] inline-flex items-center gap-[6px] font-semibold" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}>
                        <Plus size={14} /> Создать объявление
                      </Link>
                    )}
                  </EmptyTab>
                ) : (
                  <div className="space-y-[16px]">
                    {isOwn && (
                      <div className="-mx-1 flex gap-[6px] overflow-x-auto px-[4px] pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {AD_STATUS_FILTERS.map((f) => {
                          const count = f.key === "all" ? userAdsWithStatus.length : userAdsWithStatus.filter((x) => x.status === f.key).length;
                          const active = adFilter === f.key;
                          return (
                            <button
                              key={f.key}
                              onClick={() => setAdFilter(f.key)}
                              className="shrink-0 inline-flex items-center gap-[6px] text-[13px] transition-colors"
                              style={{
                                height: 32,
                                padding: "0 14px",
                                borderRadius: 999,
                                background: active ? "var(--accent)" : "var(--background-surface)",
                                color: active ? "#fff" : "var(--foreground-70)",
                                fontWeight: active ? 600 : 500,
                                border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                              }}
                            >
                              {f.label}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 999,
                                  background: active ? "rgba(255,255,255,0.22)" : "var(--background)",
                                  color: active ? "#fff" : "var(--foreground-50)",
                                }}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {filteredUserAds.length === 0 ? (
                      <EmptyTab text="Нет объявлений с этим статусом" />
                    ) : (
                      <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
                        {filteredUserAds.map(({ ad, status }) => {
                          const badge = AD_STATUS_STYLE[status];
                          const cardState: "default" | "moderation" | "rejected" =
                            status === "moderation" ? "moderation" : status === "rejected" ? "rejected" : "default";
                          return (
                            <div key={ad.id} className="relative" style={{ opacity: status === "archived" ? 0.65 : 1 }}>
                              <AdCard ad={ad} state={cardState} />
                              <span
                                className="absolute right-[12px] top-[12px] z-[2] inline-flex items-center text-[11px] font-semibold"
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  backdropFilter: "blur(6px)",
                                }}
                              >
                                {badge.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
              {tab === "communities" && (
                userCommunities.length === 0 ? <EmptyTab text="Не состоит в сообществах" /> : (
                  <div className="grid gap-[12px] md:grid-cols-2">
                    {userCommunities.map((c) => {
                      const Icon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                      return (
                        <Link
                          key={c.id}
                          to="/communities/$id"
                          params={{ id: c.id }}
                          className="flex items-center gap-[12px] p-[14px] transition-colors duration-150"
                          style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--background)" }}
                        >
                          <div className="grid h-[48px] w-[48px] place-items-center" style={{ background: "var(--accent-soft)", borderRadius: 10 }}>
                            <Icon size={24} style={{ color: "var(--accent)" }} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</div>
                            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{c.members.toLocaleString("ru")} участников</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )
              )}
              {tab === "invited" && isOwn && <InvitedFriendsSection />}
              {tab === "about" && (
                <div className="max-w-[600px]">
                  {user.bio ? (
                    <p className="text-[15px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>{user.bio}</p>
                  ) : (
                    <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Пользователь ещё не заполнил раздел «О себе»</p>
                  )}
                  {interestList.length > 0 && (
                    <div className="mt-[20px] flex flex-wrap gap-[8px]">
                      {interestList.map((p) => (
                        <span
                          key={p}
                          className="font-medium"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, padding: "6px 14px", borderRadius: 999 }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {editOpen && (
          <EditSheet
            draft={draft}
            setDraft={setDraft}
            onClose={() => setEditOpen(false)}
            onSave={async () => {
              try {
                if (onSaveProfile) {
                  await onSaveProfile(draft);
                } else if (isOwn) {
                  actions.updateProfile(user.id, draft);
                }
                setEditOpen(false);
                toast.success("Профиль обновлён");
              } catch {
                toast.error("Не удалось сохранить профиль");
              }
            }}

          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function Counter({ label, value, divider }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className="px-[16px] py-[20px] text-center md:px-[24px]" style={{ borderRight: divider ? "1px solid var(--border)" : undefined }}>
      <div className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>{label}</div>
    </div>
  );
}

function Tabs({ tab, setTab, isOwn }: { tab: TabKey; setTab: (k: TabKey) => void; isOwn: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });
  const tabs = TABS_BASE.filter((t) => isOwn || !t.ownOnly);

  useEffect(() => {
    const el = refs.current[tab];
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab]);

  return (
    <div
      className="sticky top-0 z-10 overflow-x-auto"
      style={{ background: "var(--background)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
    >
      {/* min-w-max lets the scroll container measure total content width */}
      <div className="relative flex min-w-max">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              ref={(el) => { refs.current[key] = el; }}
              onClick={() => setTab(key)}
              className="inline-flex shrink-0 items-center gap-[8px] whitespace-nowrap font-display transition-colors duration-200"
              style={{
                height: 48, padding: "0 20px", fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--accent)" : "var(--foreground-50)",
              }}
            >
              <Icon size={16} /> {label}
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
  );
}

function EmptyTab({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <EmptyState variant="compact" title={text}>
      {children}
    </EmptyState>
  );
}

function EditSheet({ draft, setDraft, onClose, onSave }: {
  draft: User; setDraft: (u: User) => void; onClose: () => void; onSave: () => void;
}) {
  const [newInterest, setNewInterest] = useState("");
  const interestList = (draft.interests || "").split(",").map((s) => s.trim()).filter(Boolean);

  const addInterest = () => {
    if (!newInterest.trim()) return;
    setDraft({ ...draft, interests: [...interestList, newInterest.trim()].join(", ") });
    setNewInterest("");
  };
  const removeInterest = (i: string) => {
    setDraft({ ...draft, interests: interestList.filter((x) => x !== i).join(", ") });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto"
        style={{ background: "var(--background)", borderRadius: "20px 20px 0 0", maxHeight: "85vh", padding: 24 }}
      >
        <div className="mx-auto h-[4px] w-[36px] rounded-[2px]" style={{ background: "var(--foreground-30)", marginBottom: 20 }} />
        <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>Редактирование профиля</h3>

        <div className="mt-[20px] space-y-[20px]">
          <Field label="Имя">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} className="w-full outline-none" />
          </Field>
          <Field label="Город">
            <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Город" style={inputStyle} className="w-full outline-none" />
          </Field>
          <Field label="О себе">
            <textarea
              value={draft.bio ?? ""}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              placeholder="Расскажите о себе"
              rows={4}
              style={{ ...inputStyle, height: "auto", minHeight: 100, padding: 14, resize: "vertical" }}
              className="w-full outline-none"
            />
          </Field>
          <Field label="Интересы">
            <div className="flex flex-wrap gap-[8px]">
              {interestList.map((i) => (
                <span key={i} className="inline-flex items-center gap-[6px]" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>
                  {i}
                  <button onClick={() => removeInterest(i)} aria-label="Убрать"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="mt-[10px] flex gap-[8px]">
              <input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                placeholder="Добавить интерес"
                style={inputStyle}
                className="flex-1 outline-none"
              />
              <button onClick={addInterest} className="grid place-items-center font-bold" style={{ width: 48, height: 48, background: "var(--accent)", color: "white", borderRadius: 10 }}>
                <Plus size={18} />
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <button
            onClick={onClose}
            className="flex-1 font-medium transition-colors duration-150"
            style={{ height: 48, border: "1px solid var(--border)", borderRadius: 12, background: "transparent", color: "var(--foreground-70)" }}
          >
            Отмена
          </button>
          <button
            onClick={onSave}
            className="flex-1 font-semibold transition-colors duration-150"
            style={{ height: 48, background: "var(--accent)", color: "white", borderRadius: 12 }}
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  height: 48, border: "1px solid var(--border)", borderRadius: 10,
  padding: "0 14px", fontSize: 16, background: "var(--background-surface)", color: "var(--foreground)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-[8px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</label>
      {children}
    </div>
  );
}
