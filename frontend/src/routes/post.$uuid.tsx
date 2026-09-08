import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, SearchX } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/post/PostCard";
import { PostCardSkeleton } from "@/components/feed/Skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { API_ORIGIN, ApiError, getToken } from "@/lib/api/client";
import { fetchPost } from "@/lib/api/feed";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { variantUrl } from "@/lib/media/variants";
import { GC, STALE, qk } from "@/lib/queries/keys";
import { ROUTES } from "@/lib/routes";
import type { Post } from "@/lib/mock";
import i18n from "@/lib/i18n";

const SITE_ORIGIN = "https://modelizmclub.ru";

/** Медиа приходит с домена API; og:image обязан быть абсолютным. */
function absoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, API_ORIGIN).href;
  } catch {
    return undefined;
  }
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function excerpt(text: string | null | undefined, max: number): string {
  const s = collapse(text ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/**
 * Заголовок записи. У репостов и у большинства записей ленты поля `title`
 * нет вовсе — тогда берём начало текста, а если пуст и он (запись из одних
 * фотографий), остаётся имя автора.
 */
function postTitle(post: Post): string {
  const own = collapse(post.title ?? "");
  if (own) return own;
  const fromText = excerpt(post.text, 70);
  if (fromText) return fromText;
  const author = post.author?.name ?? post.channel?.name;
  return author
    ? i18n.t("pages.post.metaTitleByAuthor", { author })
    : i18n.t("pages.post.metaTitleFallback");
}

function postDescription(post: Post): string {
  const body = excerpt(post.text, 180);
  if (body) return body;
  const author = post.author?.name ?? post.channel?.name;
  return author
    ? i18n.t("pages.post.metaDescriptionByAuthor", { author })
    : i18n.t("pages.post.metaDescriptionFallback");
}

/**
 * Картинка предпросмотра — вариант `card` (640 px) первого изображения.
 * JPEG идёт первым намеренно: сборщики предпросмотра во «ВКонтакте» и в
 * мессенджерах читают webp не везде, а лишнего веса на 640 px нет. У записи
 * с одним видео берём кадр-постер, у записи без медиа не отдаём ничего —
 * тогда ссылку представляет og:image корня, общая картинка сайта.
 */
function postImage(post: Post): string | undefined {
  const items = post.mediaItems ?? [];
  const image = items.find((m) => m.type === "image" && m.url);
  if (image) {
    const card = image.variants?.card;
    return absoluteUrl(card?.jpeg ?? card?.webp ?? variantUrl(image.url, "card", "jpg"));
  }
  const poster = items.find((m) => m.type === "video")?.video?.poster;
  if (poster) return absoluteUrl(poster);
  const fallback = post.image ?? post.images?.[0];
  return fallback ? absoluteUrl(variantUrl(fallback, "card", "jpg")) : undefined;
}

export const Route = createFileRoute("/post/$uuid")({
  loader: async ({ params }) => {
    await ensurePublicBootstrap();
    try {
      return { post: await fetchPost(params.uuid) };
    } catch (e) {
      /*
       * 404 — обычный случай «записи нет»: страница отвечает 404, чтобы
       * поисковик не держал её в выдаче. Но на сервере токена нет и быть не
       * может (он в localStorage), а своя неопубликованная запись отвечает
       * автору с токеном 200 и тем же запросом без токена — 404 (замерено
       * на стенде 08.09). Поэтому 404-страница не тупик: notFoundComponent
       * ниже пробует достать запись на клиенте, и автор видит свою.
       */
      if (e instanceof ApiError && e.status === 404) throw notFound();
      /*
       * Остальные отказы (401/403 у закрытой записи) 404 не заслуживают:
       * страница остаётся собой и дотягивает запись на клиенте с токеном.
       */
      return { post: null as Post | null };
    }
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post ?? null;
    const canonical = `${SITE_ORIGIN}/post/${params.uuid}`;
    const title = post
      ? `${postTitle(post)} — ${i18n.t("common.appName")}`
      : i18n.t("pages.post.metaTitleFallback");
    const description = post ? postDescription(post) : i18n.t("pages.post.metaDescriptionFallback");
    const image = post ? postImage(post) : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image" as const, content: image },
              { name: "twitter:image" as const, content: image },
              { name: "twitter:card" as const, content: "summary_large_image" },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: PostPage,
  notFoundComponent: PostNotFound,
});

function PostPage() {
  const { uuid } = Route.useParams();
  const { post } = Route.useLoaderData();
  return <PostView uuid={uuid} initial={post} />;
}

/** 404 от API. Для гостя это конец, для автора — повод спросить с токеном. */
function PostNotFound() {
  const { uuid } = Route.useParams();
  return <PostView uuid={uuid} initial={null} />;
}

function PostView({ uuid, initial }: { uuid: string; initial: Post | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /*
   * Повторная попытка — только после монтирования и только при наличии
   * токена. «После монтирования» здесь не осторожность, а условие
   * совпадения разметки: на сервере токена нет, и первый кадр клиента
   * обязан выглядеть так же, иначе React пересобирает поддерево.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const retrying = mounted && !initial && Boolean(getToken());

  /*
   * Тот же приём, что в ленте: серверная выдача анонимна и для вошедшего
   * врёт про права (`can.react: false`). Помечаем её просроченной, если
   * токен есть, — react-query показывает серверную разметку сразу и молча
   * заменяет её ответом с токеном.
   */
  const initialDataUpdatedAt = initial && getToken() ? 0 : undefined;

  const query = useQuery<Post, Error>({
    queryKey: qk.post(uuid),
    queryFn: () => fetchPost(uuid),
    enabled: Boolean(initial) || retrying,
    staleTime: STALE.post,
    gcTime: GC.post,
    initialData: initial ?? undefined,
    initialDataUpdatedAt,
    retry: false,
  });

  const post = query.data ?? null;
  const backToFeed = () => navigate({ to: ROUTES.feed });

  return (
    <AppLayout rightColumn={false} narrowCenter>
      <div className="px-0 py-[12px] sm:px-[16px]">
        <div className="px-[16px] sm:px-0">
          <Button
            variant="ghost"
            className="mb-[8px] h-[36px] gap-[6px] px-[8px] text-[14px]"
            onClick={backToFeed}
          >
            <ChevronLeft className="h-[16px] w-[16px]" />
            {t("pages.post.backToFeed")}
          </Button>
        </div>

        {post ? (
          <PostCard post={post} variant="post" />
        ) : retrying && !query.isError ? (
          <PostCardSkeleton />
        ) : (
          <EmptyState
            icon={SearchX}
            title={t("pages.post.notFoundTitle")}
            description={t("pages.post.notFoundDesc")}
            action={{ label: t("pages.post.backToFeed"), onClick: backToFeed }}
          />
        )}
      </div>
    </AppLayout>
  );
}
