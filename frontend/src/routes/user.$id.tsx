import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User, Post, Ad } from "@/lib/mock";
import { useCurrentUser } from "@/lib/session";
import {
  fetchPublicProfile,
  fetchFriends,
  sendFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
  type PublicProfile,
} from "@/lib/api/social";
import { openConversation } from "@/lib/api/chat";
import { getToken } from "@/lib/api/client";
import { fetchFeed } from "@/lib/api/feed";
import { fetchUserListings } from "@/lib/api/listings";
import { recordView } from "@/lib/view-history";
import { ProfileView } from "@/components/profile/ProfileView";
import { toast } from "@/lib/toast";

import i18n from "@/lib/i18n";
import { useActionGate } from "@/lib/gate";
import { reportReadFailure } from "@/lib/errors/handle";
import {
  absoluteImage,
  absoluteUrl,
  jsonLdScript,
  metaDescription,
  pageHead,
} from "@/lib/seo/head";

/**
 * Загрузчик нужен метаданным, а не отрисовке.
 *
 * Было: у любого профиля заголовок «Профиль — МоДелизМ» и общее описание
 * площадки (замер 07.10 запросом без браузера). Имя человека в заголовке
 * страницы о человеке — то, что промпт 2 и просит.
 *
 * Срок и `catch` — как у соседних загрузчиков `/ads/{id}` и `/post/{uuid}`.
 * Содержимое страницы НЕ засевается: компонент грузит профиль сам, и первый
 * кадр браузера совпадает с серверным.
 *
 * Описание профиля (`bio`) — свободный текст, который человек о себе
 * написал. Если он пуст, тега description не будет: подставлять вместо него
 * рассказ про площадку значит обещать поисковику не то, что на странице.
 */
async function loadProfileForHead({ params }: { params: { id: string } }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), 1500);
  });
  try {
    const profile = await Promise.race([fetchPublicProfile(params.id), deadline]);
    return { profile: (profile as PublicProfile | null) ?? null };
  } catch {
    return { profile: null as PublicProfile | null };
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/user/$id")({
  loader: loadProfileForHead,
  head: ({
    loaderData,
    params,
  }: {
    loaderData?: { profile: PublicProfile | null };
    params: { id: string };
  }) => {
    const profile = loaderData?.profile ?? null;
    const path = `/user/${params.id}`;
    const { meta, links } = pageHead({
      title: profile?.user?.name ?? null,
      description: profile?.bio ?? null,
      path,
      image: profile?.user?.avatar ?? null,
      type: "profile",
      fallbackTitle: i18n.t("pages.user.metaTitle"),
    });

    return {
      meta,
      links,
      scripts: profile?.user?.name
        ? jsonLdScript([
            {
              "@type": "ProfilePage",
              url: absoluteUrl(path),
              mainEntity: {
                "@type": "Person",
                name: profile.user.name,
                ...(metaDescription(profile.bio, 300)
                  ? { description: metaDescription(profile.bio, 300) }
                  : {}),
                ...(absoluteImage(profile.user.avatar)
                  ? { image: absoluteImage(profile.user.avatar) }
                  : {}),
                ...(profile.city
                  ? { address: { "@type": "PostalAddress", addressLocality: profile.city } }
                  : {}),
              },
            },
          ])
        : [],
    };
  },
  component: UserPage,
});

function UserPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const me = useCurrentUser();
  const { requireAction } = useActionGate();
  const navigate = useNavigate();
  /*
   * Профиль с сервера, а не только после гидрации.
   *
   * Замер 07.10 запросом без браузера: в разметке `/user/{uuid}` имени
   * человека не было вовсе — 532 знака, из них «Загрузка…» и боковые
   * колонки. Публичный профиль открывается гостю (API отвечает 200 без
   * токена), и промпт 2 требует, чтобы публичная страница без скриптов
   * отдавала основное содержимое.
   *
   * Загрузчик здесь уже есть — он появился ради заголовка и превью. Этот
   * же ответ засевает состояние: лишнего запроса нет, а первый кадр
   * браузера совпадает с серверным, потому что данные у них одни.
   */
  const { profile: profileFromServer } = Route.useLoaderData();
  const [profile, setProfile] = useState<PublicProfile | null>(profileFromServer);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userAds, setUserAds] = useState<{ ad: Ad; status: "active" }[]>([]);
  const [loading, setLoading] = useState(!profileFromServer);
  const [contentLoading, setContentLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    /*
     * «Загрузка…» показывается только если показывать больше нечего.
     * С засеянным профилем мигать ею незачем: запрос уходит, чтобы
     * дополнить ответ дружбой и содержимым, а имя и шапка уже на экране.
     */
    setLoading((prev) => prev && !profileFromServer);
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
        recordView({
          id: next.user.slug ?? next.user.id,
          kind: "profile",
          title: next.user.name,
          thumb: next.user.avatar,
        });

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
          .catch((e) => reportReadFailure(e, "профиль пользователя"))
          .finally(() => {
            if (active) setContentLoading(false);
          });
      })
      .catch(() => {
        if (active) {
          /*
           * Отказ повторного запроса не стирает то, что пришло с сервера:
           * «нет такого человека» показывается, только если профиля нет и
           * у нас. Иначе страница, открытая и отрисованная, превращалась бы
           * в 404 из-за одного неудачного запроса.
           */
          if (!profileFromServer) setNotFound(true);
          setLoading(false);
          setContentLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div
          className="flex items-center justify-center py-[120px] text-[14px]"
          style={{ color: "var(--foreground-50)" }}
        >
          {t("pages.user.loading")}
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div
            className="font-display text-[24px] font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {t("pages.user.notFound")}
          </div>
          <Link
            to="/friends"
            className="mt-[16px] inline-flex font-semibold"
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              background: "var(--accent-fill)",
              color: "white",
              fontSize: 14,
              alignItems: "center",
            }}
          >
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
    await requireAction("messenger.send", async () => {
      if (!user.numericId || !me) {
        toast.error(t("pages.user.dialogOpenFailed"));
        return;
      }
      const dialog = await openConversation(user.numericId, me.id, user.id);
      navigate({ to: "/messenger", search: { chat: dialog.id } });
    });
  };

  return (
    <ProfileView
      user={user}
      // Владельца определяет сервер: can_edit в ресурсе профиля. Раньше здесь
      // стояла жёсткая ложь — «чужой маршрут, значит чужой профиль», — и на
      // /profile жила такая же жёсткая правда. Гость, попавший на /profile,
      // получал «Изменить обложку» и три запроса к /users/me/*.
      isOwn={profile.canEdit}
      stats={{
        publications: profile.stats.publications,
        ads: profile.stats.listings,
        friends: profile.stats.friends,
        communities: profile.stats.communities,
        rating: profile.stats.rating,
        reviews: profile.stats.reviews,
        trusted: profile.stats.trusted,
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
