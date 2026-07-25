import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BadgeCheck, Ban, FileText, Mail, MapPin, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
  Camera, Trash2, Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import type { User, Post, Ad, Community } from "@/lib/mock";
import { useStore, actions, selectors, setCurrentUser } from "@/lib/store";
import type { AdStatusKey } from "@/lib/store";
import { PostCard } from "@/components/PostCard";
import { AdCard } from "@/components/AdCard";
import { toast } from "@/lib/toast";
import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { fetchMe } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchFeed } from "@/lib/api/feed";
import { fetchMyListings } from "@/lib/api/listings";
import { fetchFriends, updateOwnProfile, syncOwnInterests, applyOwnProfilePatch } from "@/lib/api/social";
import { categoryIdByName, fetchPostCategories } from "@/lib/api/categories";
import { openConversation } from "@/lib/api/chat";
import { uploadMedia } from "@/lib/api/media";
import { CitySelect } from "@/components/ads/CitySelect";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageCropDialog } from "@/components/profile/ImageCropDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { prepareProfileImageFile, PROFILE_IMAGE_ACCEPT, PROFILE_COVER_MAX_BYTES } from "@/lib/profile-image";
import { ApiError } from "@/lib/api/client";
import { firstFieldError } from "@/lib/api/validationErrors";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Профиль — МоДелизМ" }] }),
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!getToken()) return;
    void fetchMe().then((me) => {
      if (active && me) setCurrentUser(me);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentUser?.id) return;
    setLoading(true);
    const settle = Promise.allSettled([
      fetchMyListings().then((list) => active && setMyAds(list.map((x) => ({ ad: x.ad, status: toAdStatus(x.status) })))),
      fetchCommunities().then((cs) => active && setMyCommunities(cs.filter((c) => c.joined))),
      fetchFeed({ perPage: 50 }).then((r) => active && setMyPosts(r.posts.filter((p) => p.authorId === currentUser.id))),
      fetchFriends().then((fr) => active && setFriendsCount(fr.length)),
    ]);
    settle.finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const removePost = (id: string) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const saveProfile = async (draft: User, cityId?: number) => {
    if (!currentUser) return;
    const resolvedCityId = cityId ?? draft.cityId ?? null;
    const profile = await updateOwnProfile({
      display_name: draft.name,
      bio: draft.bio ?? "",
      city_id: resolvedCityId,
    });

    await fetchPostCategories();
    const interestNames = (draft.interests || "").split(",").map((s) => s.trim()).filter(Boolean);
    const categoryIds = interestNames
      .map((name) => categoryIdByName(name))
      .filter((id): id is number => id !== undefined);
    const interests = await syncOwnInterests(categoryIds);

    setCurrentUser({
      ...applyOwnProfilePatch(currentUser, profile),
      city: profile.city?.name ?? draft.city,
      interests,
    });
  };

  return (
    <ProfileView
      user={currentUser}
      isOwn
      stats={{ friends: friendsCount }}
      postsOverride={myPosts}
      adsOverride={myAds}
      communitiesOverride={myCommunities}
      loading={loading}
      onSaveProfile={saveProfile}
      onDeletePost={removePost}
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
  /** First-load flag for own profile — shows a content skeleton instead of a false-empty flash. */
  loading?: boolean;
  isFriendInitial?: boolean;
  friendRequestStatusInitial?: "outgoing" | "incoming" | null;
  isFollowingInitial?: boolean;
  onToggleFriend?: () => void | Promise<void>;
  onToggleFollow?: (next: boolean) => void | Promise<void>;
  onWrite?: () => void | Promise<void>;
  onSaveProfile?: (draft: User, cityId?: number) => void | Promise<void>;
  onDeletePost?: (id: string) => void;
}

export function ProfileView({
  user, isOwn, stats, postsOverride, adsOverride, communitiesOverride, loading = false,
  isFriendInitial, friendRequestStatusInitial, isFollowingInitial, onToggleFriend, onToggleFollow, onWrite, onSaveProfile, onDeletePost,
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
  const [friendRequestStatus, setFriendRequestStatus] = useState(friendRequestStatusInitial ?? null);
  const [subscribed, setSubscribed] = useState(isFollowingInitial ?? false);
  const [draft, setDraft] = useState<User>(user);

  useEffect(() => { setDraft(user); }, [user]);
  useEffect(() => { if (isFriendInitial !== undefined) setIsFriend(isFriendInitial); }, [isFriendInitial]);
  useEffect(() => { if (friendRequestStatusInitial !== undefined) setFriendRequestStatus(friendRequestStatusInitial); }, [friendRequestStatusInitial]);
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
            className="relative shrink-0 overflow-visible"
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
                ) : friendRequestStatus === "outgoing" ? (
                  <Button
                    variant="outline"
                    disabled
                    className="h-[40px] flex-1 rounded-[10px] disabled:opacity-100 md:flex-none"
                  >
                    <Clock size={14} /> Запрос отправлен
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      try {
                        await onToggleFriend?.();
                        toast.success("Заявка отправлена");
                      } catch {
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
                      const dialog = await openConversation(user.numericId, currentUser.id, user.id);
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
          <ReducedMotionSwitch
            switchKey={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
              {tab === "posts" && (
                loading ? <ProfileTabSkeleton /> :
                userPosts.length === 0 ? <EmptyTab text="Нет публикаций" /> : (
                  <div className="space-y-[16px]">{userPosts.map((p) => <PostCard key={p.id} post={p} onDelete={onDeletePost} />)}</div>
                )
              )}
              {tab === "ads" && (
                loading ? <ProfileTabSkeleton /> :
                userAds.length === 0 ? (
                  <EmptyTab text="Нет объявлений">
                    {isOwn && (
                      <Button asChild className="mt-[16px]">
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
                      <div className="grid grid-cols-2 gap-[10px] sm:gap-[16px] lg:grid-cols-3">
                        {filteredUserAds.map(({ ad, status }) => {
                          const badge = AD_STATUS_BADGE[status];
                          const cardState: "default" | "moderation" | "rejected" =
                            status === "moderation" ? "moderation" : status === "rejected" ? "rejected" : "default";
                          return (
                            <div key={ad.id} style={{ opacity: status === "archived" ? 0.65 : 1 }}>
                              {/* Normal-flow badge above the card, not overlaid on the image:
                                  AdCard's own top-left status pill (Продаю/Куплю/Обменяю) plus
                                  an overlaid moderation badge don't both fit at 2-up mobile
                                  width. AdCard's own bottom banner already covers moderation/
                                  rejected ("На проверке"/"Отклонено"), so this only needs to
                                  add information for active/archived. */}
                              {cardState === "default" && (
                                <Badge variant={badge.variant} withIcon={false} className="mb-[6px] rounded-full">
                                  {badge.label}
                                </Badge>
                              )}
                              <AdCard ad={ad} state={cardState} compact />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
              {tab === "communities" && (
                loading ? <ProfileTabSkeleton /> :
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
          </ReducedMotionSwitch>
        </div>
      </div>

      <AnimatePresence>
        {editOpen && (
          <EditSheet
            key="profile-edit"
            draft={draft}
            setDraft={setDraft}
            onClose={() => setEditOpen(false)}
            onSave={async (cityId) => {
              try {
                if (onSaveProfile) {
                  await onSaveProfile(draft, cityId);
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
      <div className="font-display text-[16px] font-bold leading-none tabular-nums md:text-[18px]" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-[3px] truncate text-[10px] md:text-[11px]" style={{ color: "var(--foreground-50)" }}>{label}</div>
    </div>
  );
}

function Tabs({ tab, setTab, isOwn }: { tab: TabKey; setTab: (k: TabKey) => void; isOwn: boolean }) {
  const tabs = TABS_BASE.filter((t) => isOwn || !t.ownOnly);

  return (
    <div
      className="sticky top-0 z-10 px-[16px] py-[6px] md:px-[32px] md:py-[8px]"
      style={{ background: "var(--background)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex min-h-[52px] flex-wrap items-stretch gap-[2px] md:min-h-[56px] md:gap-[6px]">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="inline-flex shrink-0 items-center gap-[8px] whitespace-nowrap rounded-[8px] px-[12px] py-[14px] font-display transition-colors duration-200 md:px-[18px] md:py-[16px]"
              style={{
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--accent)" : "var(--foreground-50)",
                boxShadow: active ? "inset 0 -3px 0 var(--accent)" : "inset 0 -3px 0 transparent",
              }}
            >
              <Icon size={17} aria-hidden /> {label}
            </button>
          );
        })}
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

/** First-load placeholder for profile tab content — avoids a false-empty flash
 *  before the async posts/ads/communities fetches resolve. */
function ProfileTabSkeleton() {
  return (
    <div className="space-y-[16px]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{ height: 120, background: "var(--background-surface)", borderRadius: "var(--r-card)" }}
        />
      ))}
    </div>
  );
}

function EditSheet({ draft, setDraft, onClose, onSave }: {
  draft: User; setDraft: (u: User) => void; onClose: () => void; onSave: (cityId?: number) => void | Promise<void>;
}) {
  const isMobile = useIsMobile();
  const [newInterest, setNewInterest] = useState("");
  const [cityId, setCityId] = useState<number | undefined>(draft.cityId);
  const interestList = (draft.interests || "").split(",").map((s) => s.trim()).filter(Boolean);

  useEffect(() => {
    setCityId(draft.cityId);
  }, [draft.cityId]);

  const addInterest = () => {
    if (!newInterest.trim()) return;
    setDraft({ ...draft, interests: [...interestList, newInterest.trim()].join(", ") });
    setNewInterest("");
  };
  const removeInterest = (i: string) => {
    setDraft({ ...draft, interests: interestList.filter((x) => x !== i).join(", ") });
  };

  const panelTransition = isMobile
    ? { type: "spring" as const, stiffness: 300, damping: 35 }
    : { duration: 0.2 };

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
        exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
        transition={panelTransition}
        className={
          isMobile
            ? "absolute inset-x-0 bottom-0 overflow-y-auto"
            : "absolute left-1/2 top-1/2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px]"
        }
        style={{
          background: "var(--background)",
          borderRadius: isMobile ? "20px 20px 0 0" : undefined,
          maxHeight: "85vh",
          padding: 24,
          paddingBottom: "max(24px, calc(env(safe-area-inset-bottom) + 24px))",
          border: "1px solid var(--border)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
      >
        <div className="mx-auto h-[4px] w-[36px] rounded-[2px] md:hidden" style={{ background: "var(--foreground-30)", marginBottom: 20 }} />
        <h3 id="profile-edit-title" className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>Редактирование профиля</h3>

        <div className="mt-[20px] space-y-[20px]">
          <Field label="Имя">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11" />
          </Field>
          <Field label="Город">
            <CitySelect value={draft.city} onChange={(name, id) => { setDraft({ ...draft, city: name }); setCityId(id); }} placeholder="Город" />
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
              <Button type="button" size="icon" onClick={addInterest} className="h-11 w-11 shrink-0">
                <Plus size={18} />
              </Button>
            </div>
          </Field>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <Button variant="outline" onClick={onClose} className="h-[48px] flex-1 rounded-[12px]">
            Отмена
          </Button>
          <Button onClick={() => onSave(cityId)} className="h-[48px] flex-1 rounded-[12px]">
            Сохранить
          </Button>
        </div>
      </motion.div>
    </motion.div>
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
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pickingFile, setPickingFile] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickingFile(true);
    try {
      const prepared = await prepareProfileImageFile(file);
      setPendingFile(prepared);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
    } finally {
      setPickingFile(false);
    }
  };

  const uploadCropped = async (blob: Blob) => {
    setPendingFile(null);
    setUploading(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "avatar");
      const profile = await updateOwnProfile({ avatar_media_id: media.uuid });
      if (currentUser) {
        setCurrentUser(applyOwnProfilePatch(currentUser, profile));
      }
      toast.success("Фото профиля обновлено");
    } catch (err) {
      const description =
        err instanceof ApiError
          ? firstFieldError(err.errors, err.message || "Проверьте формат и размер файла")
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error("Не удалось загрузить фото", { description });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!currentUser) return;
    try {
      const profile = await updateOwnProfile({ avatar_media_id: null });
      setCurrentUser(applyOwnProfilePatch({ ...currentUser, avatar: "" }, profile));
      toast.success("Фото удалено");
    } catch {
      toast.error("Не удалось удалить фото");
    }
  };

  return (
    <div className="group relative h-[88px] w-[88px] overflow-visible md:h-[112px] md:w-[112px]">
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
          <input
            ref={fileRef}
            type="file"
            accept={PROFILE_IMAGE_ACCEPT}
            className="hidden"
            onChange={onFile}
          />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Изменить фото"
                disabled={uploading || pickingFile}
                className="absolute bottom-0 right-0 grid h-[30px] w-[30px] place-items-center rounded-full border-2 transition-colors md:h-[36px] md:w-[36px]"
                style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--background)" }}
              >
                <Camera size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              side="bottom"
              sideOffset={8}
              className="z-[200] w-[190px] overflow-hidden rounded-[12px] border p-0 shadow-[var(--shadow-float)]"
              style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
            >
              <DropdownMenuItem
                className="cursor-pointer gap-[10px] rounded-none px-[14px] py-[11px] text-[13px] focus:bg-[var(--background-surface)]"
                disabled={pickingFile}
                onSelect={() => fileRef.current?.click()}
              >
                <Camera className="h-[16px] w-[16px]" />
                {pickingFile ? "Обработка…" : "Загрузить фото"}
              </DropdownMenuItem>
              {hasSrc && (
                <DropdownMenuItem
                  className="cursor-pointer gap-[10px] rounded-none px-[14px] py-[11px] text-[13px] focus:bg-[var(--background-surface)]"
                  style={{ color: "var(--error)" }}
                  onSelect={removePhoto}
                >
                  <Trash2 className="h-[16px] w-[16px]" />
                  Удалить
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <ImageCropDialog
        file={pendingFile}
        aspect={1}
        outputWidth={480}
        outputHeight={480}
        title="Обрезка фото профиля"
        onCancel={() => setPendingFile(null)}
        onCropped={uploadCropped}
        onDelete={() => {
          if (hasSrc) removePhoto();
        }}
      />
    </div>
  );
}

/** Cover image with a gradient fallback for empty/broken URLs. Owner can upload. */
function CoverImage({ src, editable }: { src?: string; editable?: boolean }) {
  const [broken, setBroken] = useState(false);
  const currentUser = useStore(selectors.currentUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const showImg = Boolean(src && src.trim()) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareProfileImageFile(file, PROFILE_COVER_MAX_BYTES);
      setPendingFile(prepared);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
    }
  };

  const uploadCropped = async (blob: Blob) => {
    setPendingFile(null);
    setUploading(true);
    try {
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "cover");
      const profile = await updateOwnProfile({ cover_media_id: media.uuid });
      if (currentUser) {
        const patched = applyOwnProfilePatch(currentUser, profile);
        setCurrentUser({
          ...patched,
          coverImage: patched.coverImage || media.url || currentUser.coverImage,
        });
      }
      toast.success("Обложка обновлена");
    } catch (err) {
      const description =
        err instanceof ApiError
          ? firstFieldError(err.errors, err.message || "Проверьте формат и размер файла")
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error("Не удалось загрузить обложку", { description });
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
          <input ref={fileRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={onFile} />
          {/* Always visible — same reasoning as the avatar badge above,
              a hover-only reveal never shows up on touch. */}
          <button
            type="button"
            aria-label="Изменить обложку"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute right-[12px] top-[12px] inline-flex items-center gap-[6px] rounded-full px-[12px] py-[7px] text-[12px] font-medium transition-colors hover:brightness-110"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
          >
            <Camera size={14} /> Изменить обложку
          </button>
        </>
      )}
      <ImageCropDialog
        file={pendingFile}
        aspect={3.5}
        outputWidth={1400}
        outputHeight={400}
        title="Обрезка обложки профиля"
        onCancel={() => setPendingFile(null)}
        onCropped={uploadCropped}
      />
    </div>
  );
}
