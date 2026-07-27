import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User, Post, Ad } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import {
  fetchPublicProfile, fetchFriends, sendFriendRequest, removeFriend, followUser, unfollowUser,
  type PublicProfile,
} from "@/lib/api/social";
import { openConversation } from "@/lib/api/chat";
import { getToken } from "@/lib/api/client";
import { fetchFeed } from "@/lib/api/feed";
import { fetchUserListings } from "@/lib/api/listings";
import { recordView } from "@/lib/view-history";
import { ProfileView } from "./profile";
import { toast } from "@/lib/toast";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/user/$id")({
  head: () => ({ meta: [{ title: i18n.t("pages.user.metaTitle") }] }),
  component: UserPage,
});

function UserPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const me = useStore(selectors.currentUser);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userAds, setUserAds] = useState<{ ad: Ad; status: "active" }[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setContentLoading(true);
    setNotFound(false);
    fetchPublicProfile(id)
      .then(async (p) => {
        if (!active) return;
        let next = p;
        if (getToken() && !p.isFriend) {
          try {
            const friends = await fetchFriends();
            const isFriend = friends.some(
              (f) => f.id === p.user.id || f.slug === id || f.slug === p.user.slug,
            );
            if (isFriend) next = { ...p, isFriend: true, friendRequestStatus: null };
          } catch {
            /* friends list optional */
          }
        }
        setProfile(next);
        setLoading(false);
        recordView({ id: next.user.slug ?? next.user.id, kind: "profile", title: next.user.name, thumb: next.user.avatar });

        Promise.all([
          next.user.numericId
            ? fetchFeed({ authorId: next.user.numericId, perPage: 50 }).then((r) => r.posts)
            : Promise.resolve([] as Post[]),
          fetchUserListings(id),
        ])
          .then(([posts, ads]) => {
            if (!active) return;
            setUserPosts(posts);
            setUserAds(ads.map((ad) => ({ ad, status: "active" as const })));
          })
          .catch(() => {})
          .finally(() => { if (active) setContentLoading(false); });
      })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); setContentLoading(false); } });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex items-center justify-center py-[120px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.user.loading")}
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>{t("pages.user.notFound")}</div>
          <Link to="/friends" className="mt-[16px] inline-flex font-semibold" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14, alignItems: "center" }}>
            {t("pages.user.toFriends")}
          </Link>
        </div>
      </AppLayout>
    );
  }

  const user: User = {
    ...profile.user,
    city: profile.city || profile.user.city,
    bio: profile.bio || profile.user.bio,
  };

  const toggleFriend = async () => {
    if (!user.numericId) return;
    if (profile.isFriend) {
      await removeFriend(user.numericId);
      setProfile((p) => (p ? { ...p, isFriend: false, friendRequestStatus: null } : p));
      return;
    }
    const result = await sendFriendRequest(user.numericId);
    if (result.status === "accepted") {
      setProfile((p) => (p ? { ...p, isFriend: true, friendRequestStatus: null } : p));
    } else {
      setProfile((p) => (p ? { ...p, friendRequestStatus: "outgoing" } : p));
    }
  };

  const toggleFollow = async (next: boolean) => {
    if (!user.numericId) return;
    if (next) await followUser(user.numericId);
    else await unfollowUser(user.numericId);
  };

  const write = async () => {
    if (!user.numericId || !me) {
      toast.error(t("pages.user.dialogOpenFailed"));
      return;
    }
    const dialog = await openConversation(user.numericId, me.id, user.id);
    navigate({ to: "/messenger", search: { chat: dialog.id } });
  };

  return (
    <ProfileView
      user={user}
      isOwn={false}
      stats={{
        publications: profile.stats.publications,
        ads: profile.stats.listings,
        friends: profile.stats.friends,
        communities: profile.stats.communities,
      }}
      postsOverride={userPosts}
      adsOverride={userAds}
      loading={contentLoading}
      isFriendInitial={profile.isFriend}
      friendRequestStatusInitial={profile.friendRequestStatus}
      isFollowingInitial={profile.isFollowing}
      onToggleFriend={toggleFriend}
      onToggleFollow={toggleFollow}
      onWrite={write}
    />
  );
}
