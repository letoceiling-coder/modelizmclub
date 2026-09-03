import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell, BadgeCheck, Ban, FileText, Mail, MapPin, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging,
  Camera, Trash2, Clock, Repeat2, Star, ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import type { User, Post, Ad, Community, Category } from "@/lib/mock";
import { useStore, actions, selectors, setCurrentUser } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import type { AdStatusKey } from "@/lib/store";
import { PostCard } from "@/components/PostCard";
import { AdCard } from "@/components/AdCard";
import { toast } from "@/lib/toast";
import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { SubscriptionBlock } from "@/components/profile/SubscriptionBlock";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { fetchMe } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";
import { isPhoneVerified, isPhoneVerificationRequired } from "@/lib/auth/verification";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchFeed } from "@/lib/api/feed";
import { fetchMyListings } from "@/lib/api/listings";
import { fetchFriends, updateOwnProfile, syncOwnInterests, applyOwnProfilePatch } from "@/lib/api/social";
import { fetchUserRating, fetchUserReviews, replyToUserReview, type UserReviewApi, type UserReviewSort } from "@/lib/api/rating";
import { categoryIdByName, fetchPostCategories } from "@/lib/api/categories";
import { openConversation } from "@/lib/api/chat";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { FriendRequiredDialog } from "@/components/friends/FriendRequiredDialog";
import { uploadMedia } from "@/lib/api/media";
import { CitySelect } from "@/components/ads/CitySelect";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { prepareProfileImageFile, PROFILE_IMAGE_ACCEPT, PROFILE_COVER_MAX_BYTES } from "@/lib/profile-image";
import { ApiError } from "@/lib/api/client";
import { firstFieldError } from "@/lib/api/validationErrors";

import i18n from "@/lib/i18n";
import { ProfilePageSkeleton } from "@/components/boot/PageSkeletons";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: i18n.t("pages.profile.metaTitle") }] }),
  pendingComponent: ProfilePageSkeleton,
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
  const { t } = useTranslation();
  const currentUser = useCurrentUser();
  const [myAds, setMyAds] = useState<{ ad: Ad; status: AdStatus }[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [rating, setRating] = useState({ average: 0, count: 0 });
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
      currentUser.numericId
        ? fetchFeed({ authorId: currentUser.numericId, perPage: 50 }).then((r) => active && setMyPosts(r.posts))
        : fetchFeed({ perPage: 50 }).then((r) => active && setMyPosts(r.posts.filter((p) => p.authorId === currentUser.id))),
      fetchFriends().then((fr) => active && setFriendsCount(fr.length)),
      currentUser.numericId
        ? fetchUserRating(currentUser.numericId).then((r) => active && setRating(r))
        : Promise.resolve(),
    ]);
    settle.finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const removePost = (id: string) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const saveProfile = async (draft: User, cityId?: number) => {
    if (!currentUser) return;
    const trimmedName = draft.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > PROFILE_NAME_MAX) {
      throw new Error(t("pages.profile.nameLengthError", { max: PROFILE_NAME_MAX }));
    }
    if (!PROFILE_NAME_REGEX.test(trimmedName)) {
      throw new Error(t("pages.profile.nameFormatError"));
    }
    const bio = (draft.bio ?? "").trim();
    if (bio.length > PROFILE_BIO_MAX) {
      throw new Error(t("pages.profile.bioLengthError", { max: PROFILE_BIO_MAX }));
    }

    const resolvedCityId = cityId ?? draft.cityId ?? null;
    const profile = await updateOwnProfile({
      display_name: trimmedName,
      bio,
      city_id: resolvedCityId,
    });

    await fetchPostCategories();
    const interestNames = (draft.interests || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (interestNames.length > PROFILE_INTERESTS_MAX) {
      throw new Error(t("pages.profile.interestsLimitError", { max: PROFILE_INTERESTS_MAX }));
    }
    const categoryIds = interestNames
      .map((name) => categoryIdByName(name))
      .filter((id): id is number => id !== undefined);
    if (categoryIds.length !== interestNames.length) {
      throw new Error(t("pages.profile.interestsUnknownError"));
    }
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
      stats={{
        friends: friendsCount,
        rating: rating.average,
        reviews: rating.count,
        trusted: rating.average >= 4.5 && rating.count >= 10,
      }}
      postsOverride={myPosts}
      adsOverride={myAds}
      communitiesOverride={myCommunities}
      loading={loading}
      onSaveProfile={saveProfile}
      onDeletePost={removePost}
    />
  );
}

type TabKey = "posts" | "reposts" | "ads" | "reviews" | "communities" | "invited" | "blocked" | "about";

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  posts: "pages.profile.tabPosts",
  reposts: "pages.profile.tabReposts",
  ads: "pages.profile.tabAds",
  reviews: "pages.profile.tabReviews",
  communities: "pages.profile.tabCommunities",
  invited: "pages.profile.tabInvited",
  blocked: "pages.profile.tabBlocked",
  about: "pages.profile.tabAbout",
};

const TABS_BASE: { key: TabKey; Icon: typeof FileText; ownOnly?: boolean }[] = [
  { key: "posts", Icon: FileText },
  { key: "reposts", Icon: Repeat2 },
  { key: "ads", Icon: Tag },
  { key: "reviews", Icon: Star },
  { key: "communities", Icon: Users },
  { key: "invited", Icon: UserPlus, ownOnly: true },
  { key: "blocked", Icon: Ban, ownOnly: true },
  { key: "about", Icon: UserIcon },
];


const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send: SendIcon, Code2, Wrench, Cpu, BatteryCharging,
};

const PROFILE_NAME_MAX = 40;
const PROFILE_BIO_MAX = 2000;
const PROFILE_INTERESTS_MAX = 10;
const PROFILE_NAME_REGEX = /^[\p{L}\s-]+$/u;

type AdStatus = "active" | "moderation" | "rejected" | "archived";
const AD_STATUS_FILTER_KEYS: { key: AdStatus | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "pages.profile.adFilterAll" },
  { key: "active", labelKey: "pages.profile.adFilterActive" },
  { key: "moderation", labelKey: "pages.profile.adFilterModeration" },
  { key: "rejected", labelKey: "pages.profile.adFilterRejected" },
  { key: "archived", labelKey: "pages.profile.adFilterArchived" },
];

export interface ProfileViewProps {
  user: User;
  isOwn: boolean;
  stats?: {
    publications?: number;
    ads?: number;
    friends?: number;
    communities?: number;
    rating?: number;
    reviews?: number;
    trusted?: boolean;
  };
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
  const { t } = useTranslation();
  const { requireAccount } = useGuestAccess();
  const [tab, setTab] = useState<TabKey>("posts");
  const [adFilter, setAdFilter] = useState<AdStatus | "all">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [friendPromptOpen, setFriendPromptOpen] = useState(false);
  const [friendPromptBusy, setFriendPromptBusy] = useState(false);
  const navigateToMessenger = useNavigate();
  const currentUser = useCurrentUser();
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
  const originalPosts = useMemo(() => userPosts.filter((p) => !p.repostOf), [userPosts]);
  const repostedPosts = useMemo(() => userPosts.filter((p) => Boolean(p.repostOf)), [userPosts]);
  const userAdsWithStatus = adsOverride ?? [];
  const userAds = userAdsWithStatus;
  const filteredUserAds = useMemo(
    () => (adFilter === "all" ? userAdsWithStatus : userAdsWithStatus.filter((x) => x.status === adFilter)),
    [userAdsWithStatus, adFilter],
  );
  const storeUserCommunities = useStore(selectors.userCommunities(user.id));
  const userCommunities = communitiesOverride ?? storeUserCommunities;
  const friendsCountDerived = stats?.friends ?? (isOwn ? storeFriendIds.length : (user.friendIds?.length ?? 0));
  const tabs = useMemo(
    () => TABS_BASE.filter((x) => isOwn || !x.ownOnly).map((x) => ({
      ...x,
      label: t(TAB_LABEL_KEYS[x.key]),
    })),
    [isOwn, t],
  );
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
                  title={t("pages.profile.earlyMemberBadge")}
                >
                  {t("pages.profile.earlyMember100", { count: 100 })}
                </Badge>
              )}
              {isOwn && isPhoneVerificationRequired(user) && (
                <Link to="/settings/account">
                  <Badge
                    variant={isPhoneVerified(user) ? "published" : "draft"}
                    withIcon={false}
                    className="rounded-full px-[8px] py-[2px] text-[10px]"
                    title={isPhoneVerified(user) ? t("pages.profile.phoneVerifiedBadge") : t("pages.profile.phoneUnverifiedBadge")}
                  >
                    {isPhoneVerified(user) ? t("pages.profile.phoneVerifiedBadge") : t("pages.profile.phoneUnverifiedBadge")}
                  </Badge>
                </Link>
              )}
            </div>
            <div className="mt-[3px] flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
              <span className="inline-flex items-center gap-[6px]">
                <MapPin size={12} /> {user.city}
              </span>
              {(stats?.rating ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("reviews")}
                  className="inline-flex items-center gap-[4px] hover:underline"
                >
                  <Star size={12} fill="currentColor" style={{ color: "var(--warning)" }} />
                  <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{(stats?.rating ?? 0).toFixed(1)}</span>
                  {(stats?.reviews ?? 0) > 0 && (
                    <span>{t("pages.profile.reviewsCount", { count: stats?.reviews ?? 0 })}</span>
                  )}
                </button>
              )}
              {stats?.trusted && (
                <span
                  className="inline-flex items-center gap-[3px] px-[6px] py-[1px] text-[11px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}
                >
                  <ShieldCheck size={11} /> {t("pages.profile.trustedSeller")}
                </span>
              )}
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
                  <Pencil size={14} /> {t("pages.profile.editProfile")}
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
                    <BadgeCheck size={14} style={{ color: "var(--success)" }} /> {t("pages.profile.inFriends")}
                  </Button>
                ) : friendRequestStatus === "outgoing" ? (
                  <Button
                    variant="outline"
                    disabled
                    className="h-[40px] flex-1 rounded-[10px] disabled:opacity-100 md:flex-none"
                  >
                    <Clock size={14} /> {t("pages.profile.requestSent")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      requireAccount(() => {
                        void (async () => {
                          try {
                            await onToggleFriend?.();
                            toast.success(t("pages.profile.requestSent"));
                          } catch {
                            toast.error(t("pages.profile.requestFailed"));
                          }
                        })();
                      });
                    }}
                    className="h-[40px] flex-1 rounded-[10px] md:flex-none"
                  >
                    <UserPlus size={14} /> {t("pages.profile.addFriend")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t("pages.profile.writeMessage")}
                  aria-label={t("pages.profile.writeMessageAria")}
                  onClick={() => {
                    requireAccount(() => {
                      if (!isFriend) {
                        setFriendPromptOpen(true);
                        return;
                      }
                      void (async () => {
                        if (onWrite) { await onWrite(); return; }
                        if (!user.numericId || !currentUser?.id) {
                          toast.error(t("pages.profile.dialogOpenFailed"));
                          return;
                        }
                        try {
                          const dialog = await openConversation(user.numericId, currentUser.id, user.id);
                          navigateToMessenger({ to: "/messenger", search: { chat: dialog.id } });
                        } catch (err) {
                          const message = formatApiErrorMessage(err, t("pages.profile.dialogOpenFailed"));
                          if (message) toast.error(message);
                        }
                      })();
                    });
                  }}
                  className="h-[40px] w-[40px] shrink-0 rounded-[10px]"
                >
                  <Mail size={16} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    requireAccount(() => {
                      void (async () => {
                        const next = !subscribed;
                        setSubscribed(next);
                        try {
                          await onToggleFollow?.(next);
                          toast.success(next ? t("pages.profile.followed") : t("pages.profile.unfollowed"));
                        } catch {
                          setSubscribed(!next);
                          toast.error(t("pages.profile.followFailed"));
                        }
                      })();
                    });
                  }}
                  className="h-[40px] w-[40px] shrink-0 rounded-[10px]"
                  style={{ color: subscribed ? "var(--accent)" : "var(--foreground-70)" }}
                  aria-label={t("pages.profile.followAria")}
                >
                  <Bell size={14} />
                </Button>
              </>
            )}
          </div>
        </div>


        {/* Counters */}
        <div className="grid grid-cols-4" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <Counter label={t("pages.profile.counterPosts")} value={stats?.publications ?? userPosts.length} divider />
          <Counter label={t("pages.profile.counterAds")} value={stats?.ads ?? userAds.length} divider />
          <Counter label={t("pages.profile.counterFriends")} value={friendsCountDerived} divider />
          <Counter label={t("pages.profile.counterCommunities")} value={stats?.communities ?? userCommunities.length} />
        </div>

        {/* Tabs */}
        <Tabs tab={tab} setTab={setTab} isOwn={isOwn} />

        {isOwn && (
          <div className="px-[16px] pt-[16px] md:px-[32px]">
            <SubscriptionBlock />
          </div>
        )}

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
                originalPosts.length === 0 ? <EmptyTab text={t("pages.profile.emptyPostsShort")} /> : (
                  <div className="space-y-[16px]">{originalPosts.map((p) => <PostCard key={p.id} post={p} onDelete={onDeletePost} />)}</div>
                )
              )}
              {tab === "reposts" && (
                loading ? <ProfileTabSkeleton /> :
                repostedPosts.length === 0 ? <EmptyTab text={t("pages.profile.emptyReposts")} /> : (
                  <div className="space-y-[16px]">{repostedPosts.map((p) => <PostCard key={p.id} post={p} onDelete={onDeletePost} />)}</div>
                )
              )}
              {tab === "reviews" && <ProfileReviewsTab numericUserId={user.numericId} isOwn={isOwn} />}
              {tab === "ads" && (
                loading ? <ProfileTabSkeleton /> :
                userAds.length === 0 ? (
                  <EmptyTab bare text={t("pages.profile.emptyAdsShort")}>
                    {isOwn && (
                      <Button
                        className="mt-[16px]"
                        onClick={() => requireAccount(() => { void navigateToMessenger({ to: "/ads/new" }); })}
                      >
                        <Plus size={14} /> {t("pages.profile.createListing")}
                      </Button>
                    )}
                  </EmptyTab>
                ) : (
                  <div className="space-y-[16px]">
                    {isOwn && (
                      <div className="-mx-1 flex gap-[6px] overflow-x-auto px-[4px] pb-[2px] no-scrollbar">
                        {AD_STATUS_FILTER_KEYS.map((f) => {
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
                              {t(f.labelKey)}
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
                      <EmptyTab bare text={t("pages.profile.emptyAdsFiltered")} />
                    ) : (
                      <div className="grid grid-cols-2 gap-[10px] sm:gap-[16px] lg:grid-cols-3">
                        {filteredUserAds.map(({ ad, status }) => {
                          const cardState: "default" | "moderation" | "rejected" =
                            status === "moderation" ? "moderation" : status === "rejected" ? "rejected" : "default";
                          return (
                            <div key={ad.id} style={{ opacity: status === "archived" ? 0.65 : 1 }}>
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
                userCommunities.length === 0 ? <EmptyTab text={t("pages.profile.emptyCommunitiesShort")} /> : (
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
                              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{t("pages.shared.members", { count: c.members.toLocaleString("ru") })}</div>
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
                    <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("pages.profile.emptyAbout")}</p>
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
                toast.success(t("pages.profile.profileUpdated"));
              } catch (err) {
                const msg = err instanceof Error ? err.message : t("pages.profile.profileSaveFailed");
                toast.error(msg || t("pages.profile.profileSaveFailed"));
              }
            }}
          />
        )}
      </AnimatePresence>
      <FriendRequiredDialog
        open={friendPromptOpen}
        onOpenChange={setFriendPromptOpen}
        adding={friendPromptBusy}
        onAdd={() => {
          setFriendPromptBusy(true);
          void (async () => {
            try {
              await onToggleFriend?.();
              toast.success(t("pages.profile.requestSent"));
              setFriendPromptOpen(false);
            } catch {
              toast.error(t("pages.profile.requestFailed"));
            } finally {
              setFriendPromptBusy(false);
            }
          })();
        }}
      />
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
  const { t } = useTranslation();
  const visibleTabs = TABS_BASE.filter((item) => isOwn || !item.ownOnly);

  return (
    <div
      className="sticky top-0 z-10 px-[16px] py-[6px] md:px-[32px] md:py-[8px]"
      style={{ background: "var(--background)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="-mx-[16px] overflow-x-auto px-[16px] md:mx-0 md:overflow-visible md:px-0">
        <div className="flex min-h-[44px] w-max min-w-full flex-nowrap items-stretch gap-[2px] md:min-h-0 md:w-full md:flex-wrap md:gap-[4px]">
        {visibleTabs.map(({ key, Icon }) => {
          const active = tab === key;
          const label = t(TAB_LABEL_KEYS[key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[8px] px-[8px] py-[10px] font-display transition-colors duration-200 md:gap-[6px] md:px-[14px] md:py-[12px]"
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--accent)" : "var(--foreground-50)",
                boxShadow: active ? "inset 0 -3px 0 var(--accent)" : "inset 0 -3px 0 transparent",
              }}
            >
              <Icon size={16} aria-hidden /> {label}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function EmptyTab({ text, children, bare }: { text: string; children?: React.ReactNode; bare?: boolean }) {
  return (
    <EmptyState variant={bare ? "bare" : "compact"} title={text}>
      {children}
    </EmptyState>
  );
}

function ProfileReviewsTab({ numericUserId, isOwn }: { numericUserId?: number; isOwn: boolean }) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<UserReviewSort>("new");
  const [reviews, setReviews] = useState<UserReviewApi[] | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!numericUserId) {
      setReviews([]);
      return;
    }
    let active = true;
    setReviews(null);
    fetchUserReviews(numericUserId, sort)
      .then((list) => active && setReviews(list))
      .catch(() => active && setReviews([]));
    return () => { active = false; };
  }, [numericUserId, sort]);

  const submitReply = async (reviewId: string) => {
    setSaving(true);
    try {
      await replyToUserReview(reviewId, replyText);
      setReviews((prev) =>
        prev?.map((r) => (r.id === reviewId ? { ...r, reply: replyText.trim() || null, replied_at: new Date().toISOString() } : r)) ?? prev,
      );
      setReplyTo(null);
      setReplyText("");
      toast.success(t("pages.profile.replySaved"));
    } catch {
      toast.error(t("pages.profile.replyFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (reviews === null) return <ProfileTabSkeleton />;
  if (reviews.length === 0) return <EmptyTab text={t("pages.profile.emptyReviews")} />;

  return (
    <div className="space-y-[16px]">
      <div className="flex gap-[6px]">
        {(["new", "high", "low"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className="inline-flex items-center text-[13px] transition-colors"
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: "var(--r-pill)",
              background: sort === key ? "var(--accent)" : "var(--background-surface)",
              color: sort === key ? "#fff" : "var(--foreground-70)",
              fontWeight: sort === key ? 600 : 500,
              border: `1px solid ${sort === key ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {t(`pages.profile.reviewSort.${key}`)}
          </button>
        ))}
      </div>

      {reviews.map((review) => (
        <Card key={review.id} className="space-y-[8px] p-[14px]">
          <div className="flex items-center justify-between gap-[8px]">
            <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {review.author.display_name ?? t("pages.profile.reviewAnonymous")}
            </span>
            <span className="inline-flex shrink-0 items-center gap-[2px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={13}
                  fill={i < review.rating ? "currentColor" : "none"}
                  style={{ color: i < review.rating ? "var(--warning)" : "var(--foreground-30)" }}
                />
              ))}
            </span>
          </div>
          {review.text && (
            <p className="text-[14px] leading-[1.5]" style={{ color: "var(--foreground-70)" }}>{review.text}</p>
          )}
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {formatDate(review.date, "date")}
          </div>

          {review.reply && (
            <div
              className="rounded-[10px] p-[10px] text-[13px]"
              style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
            >
              <div className="mb-[2px] text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("pages.profile.sellerReply")}
              </div>
              {review.reply}
            </div>
          )}

          {isOwn && (
            replyTo === review.id ? (
              <div className="space-y-[8px]">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder={t("pages.profile.replyPlaceholder")}
                />
                <div className="flex gap-[8px]">
                  <Button size="sm" disabled={saving} onClick={() => void submitReply(review.id)}>
                    {t("pages.profile.replySubmit")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText(""); }}>
                    {t("pages.profile.replyCancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setReplyTo(review.id); setReplyText(review.reply ?? ""); }}
              >
                {review.reply ? t("pages.profile.replyEdit") : t("pages.profile.replyAdd")}
              </Button>
            )
          )}
        </Card>
      ))}
    </div>
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
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [newInterest, setNewInterest] = useState("");
  const [cityId, setCityId] = useState<number | undefined>(draft.cityId);
  const [interestOptions, setInterestOptions] = useState<Category[]>([]);
  const interestList = (draft.interests || "").split(",").map((s) => s.trim()).filter(Boolean);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    fetchPostCategories()
      .then((list) => { if (alive) setInterestOptions(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    setCityId(draft.cityId);
  }, [draft.cityId]);

  const addInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed) return;
    if (interestList.length >= PROFILE_INTERESTS_MAX) {
      toast.error(t("pages.profile.interestsLimitError", { max: PROFILE_INTERESTS_MAX }));
      return;
    }
    if (interestList.includes(trimmed)) return;
    setDraft({ ...draft, interests: [...interestList, trimmed].join(", ") });
    setNewInterest("");
  };
  const removeInterest = (i: string) => {
    setDraft({ ...draft, interests: interestList.filter((x) => x !== i).join(", ") });
  };

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : isMobile
      ? { type: "spring" as const, stiffness: 300, damping: 35 }
      : { duration: 0.2 };

  const panelInitial = reduceMotion
    ? { opacity: 1, y: 0, scale: 1 }
    : isMobile
      ? { y: "100%" }
      : { opacity: 0, scale: 0.96 };

  const panelAnimate = reduceMotion
    ? { opacity: 1, y: 0, scale: 1 }
    : isMobile
      ? { y: 0 }
      : { opacity: 1, scale: 1 };

  const panelExit = reduceMotion
    ? { opacity: 1, y: 0, scale: 1 }
    : isMobile
      ? { y: "100%" }
      : { opacity: 0, scale: 0.96 };

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={panelInitial}
        animate={panelAnimate}
        exit={panelExit}
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
        <h3 id="profile-edit-title" className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>{t("pages.profile.editProfileTitle")}</h3>

        <div className="mt-[20px] space-y-[20px]">
          <Field label={t("pages.profile.fieldName")} hint={`${draft.name.length}/${PROFILE_NAME_MAX}`}>
            <Input
              value={draft.name}
              maxLength={PROFILE_NAME_MAX}
              onChange={(e) => {
                const next = e.target.value;
                if (next && !PROFILE_NAME_REGEX.test(next)) return;
                setDraft({ ...draft, name: next });
              }}
              className="h-11"
            />
          </Field>
          <Field label={t("pages.profile.fieldCity")}>
            <CitySelect value={draft.city} onChange={(name, id) => { setDraft({ ...draft, city: name }); setCityId(id); }} placeholder={t("pages.profile.cityPlaceholder")} />
          </Field>
          <Field label={t("pages.profile.fieldBio")} hint={`${(draft.bio ?? "").length}/${PROFILE_BIO_MAX}`}>
            <Textarea
              value={draft.bio ?? ""}
              maxLength={PROFILE_BIO_MAX}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              placeholder={t("pages.profile.bioPlaceholder")}
              rows={4}
            />
          </Field>
          <Field label={t("pages.profile.fieldInterests")} hint={`${interestList.length}/${PROFILE_INTERESTS_MAX}`}>
            <div className="flex flex-wrap gap-[8px]">
              {interestList.map((i) => (
                <Badge
                  key={i}
                  withIcon={false}
                  className="gap-[6px] rounded-full border-transparent px-[12px] py-[6px] text-[13px]"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {i}
                  <button type="button" onClick={() => removeInterest(i)} aria-label={t("pages.profile.removeInterest")} className="inline-flex"><X size={12} /></button>
                </Badge>
              ))}
            </div>
            <div className="mt-[10px] flex gap-[8px]">
              <NativeSelect
                value={newInterest}
                onChange={setNewInterest}
                options={[
                  { label: t("pages.profile.pickInterest"), value: "" },
                  ...interestOptions
                    .filter((c) => !interestList.includes(c.name))
                    .map((c) => ({ label: c.name, value: c.name })),
                ]}
                className="h-11 flex-1"
                disabled={interestList.length >= PROFILE_INTERESTS_MAX}
              />
              <Button type="button" size="icon" onClick={addInterest} className="h-11 w-11 shrink-0" disabled={interestList.length >= PROFILE_INTERESTS_MAX || !newInterest}>
                <Plus size={18} />
              </Button>
            </div>
          </Field>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <Button variant="outline" onClick={onClose} className="h-[48px] flex-1 rounded-[12px]">
            {t("pages.profile.cancel")}
          </Button>
          <Button onClick={() => onSave(cityId)} className="h-[48px] flex-1 rounded-[12px]">
            {t("pages.profile.save")}
          </Button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-[8px] flex items-center justify-between gap-[8px]">
        <label className="block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</label>
        {hint && <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>{hint}</span>}
      </div>
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
  const { t } = useTranslation();
  const hasSrc = Boolean(src && src.trim());
  const currentUser = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pickingFile, setPickingFile] = useState(false);
  const [shownSrc, setShownSrc] = useState(src);

  useEffect(() => {
    if (!src?.trim()) {
      setShownSrc(undefined);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setShownSrc(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickingFile(true);
    try {
      const prepared = await prepareProfileImageFile(file);
      setPendingFile(prepared);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.profile.fileProcessFailed"));
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
      toast.success(t("pages.profile.avatarUpdated"));
    } catch (err) {
      const description =
        err instanceof ApiError
          ? firstFieldError(err.errors, err.message || t("pages.profile.checkFileFormat"))
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(t("pages.profile.avatarUploadFailed"), { description });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!currentUser) return;
    try {
      const profile = await updateOwnProfile({ avatar_media_id: null });
      setCurrentUser(applyOwnProfilePatch({ ...currentUser, avatar: "" }, profile));
      toast.success(t("pages.profile.photoRemoved"));
    } catch {
      toast.error(t("pages.profile.photoRemoveFailed"));
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
        {shownSrc && <AvatarImage src={shownSrc} alt="" className="object-cover" />}
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
                aria-label={t("pages.profile.changePhoto")}
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
                {pickingFile ? t("pages.profile.processing") : t("pages.profile.uploadPhoto")}
              </DropdownMenuItem>
              {hasSrc && (
                <DropdownMenuItem
                  className="cursor-pointer gap-[10px] rounded-none px-[14px] py-[11px] text-[13px] focus:bg-[var(--background-surface)]"
                  style={{ color: "var(--error)" }}
                  onSelect={removePhoto}
                >
                  <Trash2 className="h-[16px] w-[16px]" />
                  {t("pages.profile.deletePhoto")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <PhotoEditorDialog
        file={pendingFile}
        aspect={1}
        lockAspect
        shape="circle"
        lockShape
        outputWidth={480}
        outputHeight={480}
        title={t("pages.profile.cropAvatarTitle")}
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
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const currentUser = useCurrentUser();
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
      toast.error(err instanceof Error ? err.message : t("pages.profile.fileProcessFailed"));
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
      toast.success(t("pages.profile.coverUpdated"));
    } catch (err) {
      const description =
        err instanceof ApiError
          ? firstFieldError(err.errors, err.message || t("pages.profile.checkFileFormat"))
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(t("pages.profile.coverUploadFailed"), { description });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="group relative">
      {showImg ? (
        <img src={src} width={1200} height={420} loading="lazy" decoding="async" alt="" className="w-full object-cover" style={{ height: "clamp(120px, 22vw, 220px)" }} onError={() => setBroken(true)} />
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
            aria-label={t("pages.profile.changeCover")}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute right-[12px] top-[12px] inline-flex items-center gap-[6px] rounded-full px-[12px] py-[7px] text-[12px] font-medium transition-colors hover:brightness-110"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
          >
            <Camera size={14} /> {t("pages.profile.changeCover")}
          </button>
        </>
      )}
      <PhotoEditorDialog
        file={pendingFile}
        aspect={3.5}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={1400}
        outputHeight={400}
        title={t("pages.profile.cropCoverTitle")}
        safeZonePreset="cover-wide"
        onCancel={() => setPendingFile(null)}
        onCropped={uploadCropped}
      />
    </div>
  );
}
