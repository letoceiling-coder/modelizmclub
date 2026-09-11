import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { User as UserIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User, Post, Ad, Community } from "@/lib/mock";
import { setCurrentUser } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import type { AdStatusKey } from "@/lib/store";
import { fetchMe } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchFeed } from "@/lib/api/feed";
import { fetchMyListings } from "@/lib/api/listings";
import {
  fetchFriends,
  updateOwnProfile,
  syncOwnInterests,
  applyOwnProfilePatch,
} from "@/lib/api/social";
import { fetchUserRating } from "@/lib/api/rating";
import { categoryIdByName, fetchPostCategories } from "@/lib/api/categories";
import i18n from "@/lib/i18n";
import { ProfilePageSkeleton } from "@/components/boot/PageSkeletons";
import {
  ProfileView,
  PROFILE_NAME_MAX,
  PROFILE_BIO_MAX,
  PROFILE_INTERESTS_MAX,
  PROFILE_NAME_REGEX,
  type AdStatus,
} from "@/components/profile/ProfileView";

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
  // Гостю здесь показывать нечего: своего профиля у него нет. До 05.09
  // страница рисовала ему «Изменить обложку» и «Редактировать профиль» на
  // пустой карточке «Гость» — обещание о данных, которых не существует, — и
  // попутно отправляла три запроса к /users/me/*, каждый из которых
  // отвечал 401.
  const guestBlocked = useGuestRouteBlocked("route.profile");
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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // Без токена все три запроса ниже уходят к /users/me/* и возвращают 401.
    if (!currentUser?.id || !getToken()) return;
    setLoading(true);
    const settle = Promise.allSettled([
      fetchMyListings().then(
        (list) => active && setMyAds(list.map((x) => ({ ad: x.ad, status: toAdStatus(x.status) }))),
      ),
      fetchCommunities().then((cs) => active && setMyCommunities(cs.filter((c) => c.joined))),
      currentUser.numericId
        ? fetchFeed({ authorId: currentUser.numericId, perPage: 50 }).then(
            (r) => active && setMyPosts(r.posts),
          )
        : fetchFeed({ perPage: 50 }).then(
            (r) => active && setMyPosts(r.posts.filter((p) => p.authorId === currentUser.id)),
          ),
      fetchFriends().then((fr) => active && setFriendsCount(fr.length)),
      currentUser.numericId
        ? fetchUserRating(currentUser.numericId).then((r) => active && setRating(r))
        : Promise.resolve(),
    ]);
    settle.finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
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
    const interestNames = (draft.interests || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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

  if (guestBlocked) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto w-full max-w-[720px] px-[16px] py-[48px]">
          <GuestSectionStub
            icon={UserIcon}
            title={t("guestAuth.profileTitle")}
            description={t("guestAuth.profileDescription")}
          />
        </div>
      </AppLayout>
    );
  }

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
