import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BadgeCheck, Ban, FileText, Mail, MapPin, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
  Camera, Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User, Post, Ad, Community } from "@/lib/mock";
import { useStore, actions, selectors, setCurrentUser } from "@/lib/store";
import type { AdStatusKey } from "@/lib/store";
import { PostCard } from "@/components/PostCard";
import { AdCard } from "@/components/AdCard";
import { toast } from "@/lib/toast";
import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { fetchMyListings } from "@/lib/api/listings";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchFeed } from "@/lib/api/feed";
import { fetchFriends, updateOwnProfile } from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { uploadMedia } from "@/lib/api/media";
import { CitySelect } from "@/components/ads/CitySelect";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Профиль — МоДелизМ" }] }),
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

type TabKey = "posts" | "ads" | "communities" | "invited" | "blocked" | "about";

const TABS_BASE: { key: TabKey; label: string; Icon: typeof FileText; ownOnly?: boolean }[] = [
  { key: "posts", label: "Публикации", Icon: FileText },
  { key: "ads", label: "Объявления", Icon: Tag },
  { key: "communities", label: "Сообщества", Icon: Users },
  { key: "invited", label: "Приглашённые", Icon: UserPlus, ownOnly: true },
  { key: "blocked", label: "Заблокированные", Icon: Ban, ownOnly: true },
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
const AD_STATUS_BADGE: Record<AdStatus, { label: string; variant: "published" | "moderation" | "warning" | "draft" }> = {
  active: { label: "Активно", variant: "published" },
  moderation: { label: "На модерации", variant: "moderation" },
  rejected: { label: "Отклонено", variant: "warning" },
  archived: { label: "В архиве", variant: "draft" },
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
    <AppLayout footer>
      <div className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}>
        {/* Cover */}
        <div className="relative">
          <CoverImage src={user.coverImage} editable={isOwn} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56px]" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--background) 85%, transparent))" }} />
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-[12px] px-[16px] pb-[16px] md:flex-row md:items-end md:gap-[24px] md:px-[32px]">
          <div
            className="relative shrink-0"
            style={{ marginTop: "clamp(-44px, -10vw, -56px)", zIndex: 2 }}
          >
            <ProfileAvatar src={user.avatar} name={user.name} editable={isOwn} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[6px]">
              <h1 className="min-w-0 truncate font-display text-[18px] font-bold md:text-[24px]" style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}>{user.name}</h1>
              {user.subscription && (
                <Badge variant="top-outline" withIcon={false} className="gap-[3px] rounded-full px-[7px] py-[2px] text-[10px]">
                  <BadgeCheck size={10} /> Pro
                </Badge>
              )}
              {user.firstHundred && (
                <Badge
                  withIcon={false}
                  className="gap-[3px] rounded-full border-transparent px-[8px] py-[2px] text-[10px]"
                  style={{ background: "linear-gradient(135deg, var(--gold-1, #FBBF24), var(--gold-2, #B45309))", color: "#1F1300" }}
                  title="Один из первых 100 участников клуба"
                >
                  ★ Первые 100
                </Badge>
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
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="h-[40px] flex-1 rounded-[10px] md:flex-none"
                >
                  <Pencil size={14} /> Редактировать
                </Button>
                <LogoutButton variant="profile" />
              </>
            ) : (
              <>
                {isFriend ? (
                  <Button
                    variant="secondary"
                    disabled
                    className="h-[40px] flex-1 rounded-[10px] disabled:opacity-100 md:flex-none"
                  >
                    <BadgeCheck size={14} style={{ color: "var(--success)" }} /> В друзьях
                  </Button>
                ) : (
                  <Button
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
                    className="h-[40px] flex-1 rounded-[10px] md:flex-none"
                  >
                    <UserPlus size={14} /> В друзья
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Написать сообщение"
                  aria-label="Написать сообщение"
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
                  className="h-[40px] w-[40px] shrink-0 rounded-[10px]"
                >
                  <Mail size={16} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
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
                  className="h-[40px] w-[40px] shrink-0 rounded-[10px]"
                  style={{ color: subscribed ? "var(--accent)" : "var(--foreground-70)" }}
                  aria-label="Подписаться"
                >
                  <Bell size={14} />
                </Button>
              </>
            )}
          </div>
        </div>


        {/* Counters */}
        <div className="grid grid-cols-4" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
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
                      <Button asChild className="mt-[16px] rounded-[10px]">
                        <Link to="/ads/new"><Plus size={14} /> Создать объявление</Link>
                      </Button>
                    )}
                  </EmptyTab>
                ) : (
                  <div className="space-y-[16px]">
                    {isOwn && (
                      <div className="-mx-1 flex gap-[6px] overflow-x-auto px-[4px] pb-[2px] no-scrollbar">
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
                                borderRadius: "var(--r-pill)",
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
                                  borderRadius: "var(--r-pill)",
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
                          const badge = AD_STATUS_BADGE[status];
                          const cardState: "default" | "moderation" | "rejected" =
                            status === "moderation" ? "moderation" : status === "rejected" ? "rejected" : "default";
                          return (
                            <div key={ad.id} className="relative" style={{ opacity: status === "archived" ? 0.65 : 1 }}>
                              <AdCard ad={ad} state={cardState} />
                              <Badge
                                variant={badge.variant}
                                withIcon={false}
                                className="absolute right-[12px] top-[12px] z-[2] rounded-full"
                              >
                                {badge.label}
                              </Badge>
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
                        <Card key={c.id} className="rounded-[var(--r-card)] transition-colors hover:border-[var(--border-strong)]">
                          <Link
                            to="/communities/$id"
                            params={{ id: c.id }}
                            className="flex items-center gap-[12px] p-[14px]"
                          >
                            <div className="grid h-[48px] w-[48px] shrink-0 place-items-center" style={{ background: "var(--accent-soft)", borderRadius: 10 }}>
                              <Icon size={24} style={{ color: "var(--accent)" }} />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</div>
                              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{c.members.toLocaleString("ru")} участников</div>
                            </div>
                          </Link>
                        </Card>
                      );
                    })}
                  </div>
                )
              )}
              {tab === "invited" && isOwn && <InvitedFriendsSection />}
              {tab === "blocked" && isOwn && <BlockedUsersSection />}
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
                        <Badge
                          key={p}
                          withIcon={false}
                          className="rounded-full border-transparent px-[14px] py-[6px] text-[13px] font-medium"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                        >
                          {p}
                        </Badge>
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
    <div className="min-w-0 px-[6px] py-[10px] text-center md:px-[24px] md:py-[12px]" style={{ borderRight: divider ? "1px solid var(--border)" : undefined }}>
      <div className="font-display text-[16px] font-bold leading-none md:text-[18px]" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-[3px] truncate text-[10px] md:text-[11px]" style={{ color: "var(--foreground-50)" }}>{label}</div>
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
        className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto md:inset-x-auto md:left-1/2 md:bottom-auto md:top-1/2 md:w-[560px] md:max-w-[calc(100vw-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[20px]"
        style={{ background: "var(--background)", borderRadius: "20px 20px 0 0", maxHeight: "85vh", padding: 24, paddingBottom: "max(24px, calc(env(safe-area-inset-bottom) + 24px))", border: "1px solid var(--border)" }}
      >
        <div className="mx-auto h-[4px] w-[36px] rounded-[2px] md:hidden" style={{ background: "var(--foreground-30)", marginBottom: 20 }} />
        <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>Редактирование профиля</h3>

        <div className="mt-[20px] space-y-[20px]">
          <Field label="Имя">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11" />
          </Field>
          <Field label="Город">
            <CitySelect value={draft.city} onChange={(name) => setDraft({ ...draft, city: name })} placeholder="Город" />
          </Field>
          <Field label="О себе">
            <Textarea
              value={draft.bio ?? ""}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              placeholder="Расскажите о себе"
              rows={4}
            />
          </Field>
          <Field label="Интересы">
            <div className="flex flex-wrap gap-[8px]">
              {interestList.map((i) => (
                <Badge
                  key={i}
                  withIcon={false}
                  className="gap-[6px] rounded-full border-transparent px-[12px] py-[6px] text-[13px]"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {i}
                  <button type="button" onClick={() => removeInterest(i)} aria-label="Убрать" className="inline-flex"><X size={12} /></button>
                </Badge>
              ))}
            </div>
            <div className="mt-[10px] flex gap-[8px]">
              <Input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                placeholder="Добавить интерес"
                className="h-11 flex-1"
              />
              <Button type="button" size="icon" onClick={addInterest} className="h-11 w-11 shrink-0 rounded-[10px]">
                <Plus size={18} />
              </Button>
            </div>
          </Field>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <Button variant="outline" onClick={onClose} className="h-[48px] flex-1 rounded-[12px]">
            Отмена
          </Button>
          <Button onClick={onSave} className="h-[48px] flex-1 rounded-[12px]">
            Сохранить
          </Button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-[8px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</label>
      {children}
    </div>
  );
}

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Profile avatar on the shared Radix Avatar — initials fallback when the
 *  image is missing or fails to load. Never renders <img src="">. */
function ProfileAvatar({ src, name, editable }: { src?: string; name: string; editable?: boolean }) {
  const hasSrc = Boolean(src && src.trim());
  const currentUser = useStore(selectors.currentUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой", { description: "Максимум 5 МБ" });
      return;
    }
    setUploading(true);
    try {
      const media = await uploadMedia(file, "avatar");
      const url = media.url ?? "";
      setCurrentUser({ ...currentUser, avatar: url });
      void updateOwnProfile({ avatar_media_id: media.uuid });
      toast.success("Фото профиля обновлено");
    } catch {
      toast.error("Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setMenuOpen(false);
    setCurrentUser({ ...currentUser, avatar: "" });
    void updateOwnProfile({ avatar_media_id: null });
    toast.success("Фото удалено");
  };

  return (
    <div className="group relative h-[88px] w-[88px] md:h-[112px] md:w-[112px]">
      <Avatar
        className="h-full w-full"
        style={{
          border: "4px solid var(--background)",
          boxShadow: "0 10px 30px -10px rgba(0,0,0,.45), 0 0 0 1px var(--border)",
          background: "var(--background)",
        }}
      >
        {hasSrc && <AvatarImage src={src} alt="" className="object-cover" />}
        <AvatarFallback
          className="font-display text-[28px] font-bold md:text-[36px]"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            aria-label="Изменить фото"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={uploading}
            className="absolute inset-0 grid place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            style={{ background: "rgba(0,0,0,0.45)", color: "#fff", border: "4px solid transparent" }}
          >
            <Camera size={22} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute left-1/2 top-full z-[60] mt-[8px] w-[190px] -translate-x-1/2 overflow-hidden rounded-[12px] border"
              style={{ background: "var(--background-elevated)", borderColor: "var(--border)", boxShadow: "var(--shadow-float)" }}
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
                className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground)" }}
              >
                <Camera className="h-[16px] w-[16px]" /> Загрузить фото
              </button>
              {hasSrc && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={removePhoto}
                  className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--error)" }}
                >
                  <Trash2 className="h-[16px] w-[16px]" /> Удалить
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Cover image with a gradient fallback for empty/broken URLs. Owner can upload. */
function CoverImage({ src, editable }: { src?: string; editable?: boolean }) {
  const [broken, setBroken] = useState(false);
  const currentUser = useStore(selectors.currentUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const showImg = Boolean(src && src.trim()) && !broken;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой", { description: "Максимум 5 МБ" });
      return;
    }
    setUploading(true);
    try {
      const media = await uploadMedia(file, "cover");
      const url = media.url ?? "";
      setCurrentUser({ ...currentUser, coverImage: url });
      void updateOwnProfile({ cover_media_id: media.uuid });
      toast.success("Обложка обновлена");
    } catch {
      toast.error("Не удалось загрузить обложку");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="group relative">
      {showImg ? (
        <img src={src} alt="" className="w-full object-cover" style={{ height: "clamp(120px, 22vw, 220px)" }} onError={() => setBroken(true)} />
      ) : (
        <div className="w-full" style={{ height: "clamp(120px, 22vw, 220px)", background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
      )}
      {editable && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            aria-label="Изменить обложку"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute right-[12px] top-[12px] inline-flex items-center gap-[6px] rounded-full px-[12px] py-[7px] text-[12px] font-medium opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
          >
            <Camera size={14} /> Обложка
          </button>
        </>
      )}
    </div>
  );
}
