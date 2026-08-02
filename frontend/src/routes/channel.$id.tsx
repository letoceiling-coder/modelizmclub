import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Users, Check, BadgeCheck, Heart, Eye, Clock, ShieldCheck, AlertTriangle, Radio, Newspaper, Star, Megaphone, Tag, Send, Calendar, MessageSquareOff, FileCheck2, Ban, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useChannel, useChannelPosts, setChannelSubscription, createChannelPost, deleteChannelPost, isChannelOwner,
  formatCount, formatDate,
  type Channel, type ChannelPost, type ChannelPostMediaItem, type PostStatus, type PostKind, type ChannelKind,
} from "@/lib/channels";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploadGrid } from "@/components/ads/wizard/ImageUploadGrid";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import { VideoUploadField } from "@/components/reviews/VideoUploadField";
import { uploadMedia } from "@/lib/api/media";
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
import { ChatAvatar } from "@/components/messenger/ChatAvatar";
import { ChannelBrandingHeader } from "@/components/channels/ChannelBrandingHeader";
import { ChannelSettingsSheet } from "@/components/channels/ChannelSettingsSheet";
import { EntitySettingsButton } from "@/components/entity/EntitySettingsButton";
import { PostGallery } from "@/components/feed/PostGallery";
import { useStore, selectors } from "@/lib/store";


import i18n from "@/lib/i18n";

export const Route = createFileRoute("/channel/$id")({
  head: () => ({ meta: [{ title: i18n.t("pages.channelDetail.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>): {
    tab?: ChannelTab | "manage";
    section?: "stats" | "manage";
    settings?: boolean;
  } => ({
    tab:
      search.tab === "about" || search.tab === "manage"
        ? (search.tab as ChannelTab | "manage")
        : undefined,
    section: search.section === "stats" || search.section === "manage" ? search.section : undefined,
    settings: search.settings === true || search.settings === "1" || search.settings === 1,
  }),
  component: ChannelPage,
});

type PostFilter = "all" | "mine";
type ChannelTab = "posts" | "about";

function channelKindLabel(kind: ChannelKind, tr: (key: string) => string): string {
  const map: Record<ChannelKind, string> = {
    official: "pages.channels.kindOfficial",
    brand: "pages.channels.kindBrand",
    shop: "pages.channels.kindShop",
    author: "pages.channels.kindAuthor",
    expert: "pages.channels.kindExpert",
  };
  return tr(map[kind] ?? "pages.channels.kindDefault");
}

function postKindLabel(tr: (key: string) => string, kind: PostKind): string {
  const map: Record<PostKind, string> = {
    news: "pages.channels.postKindNews",
    review: "pages.channels.postKindReview",
    announce: "pages.channels.postKindAnnounce",
    promo: "pages.channels.postKindPromo",
  };
  return tr(map[kind]);
}

const POST_KINDS: PostKind[] = ["news", "review", "announce", "promo"];

function NotFoundView() {
  const { t } = useTranslation();
  return (
    <AppLayout rightColumn={false} footer>
      <div className="py-[40px]">
        <EmptyState
          icon={Radio}
          title={t("pages.channelDetail.notFoundTitle")}
          description={t("pages.channelDetail.notFoundDesc")}
        >
          <Button asChild className=" px-[20px]">
            <Link to="/channels">{t("pages.channelDetail.allChannels")}</Link>
          </Button>
        </EmptyState>
      </div>
    </AppLayout>
  );
}

function ChannelPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { tab: tabSearch, section: sectionSearch, settings: settingsSearch } = Route.useSearch();
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const { channel, loading, notFound, reload: reloadChannel } = useChannel(id);
  const { posts, reload: reloadPosts } = useChannelPosts(id);
  const [tab, setTab] = useState<ChannelTab>(tabSearch === "about" ? "about" : "posts");
  const [showOwnerView, setShowOwnerView] = useState<boolean>(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (tabSearch === "about") {
      setTab("about");
    } else if (tabSearch !== "manage") {
      setTab("posts");
    }
    if (settingsSearch || tabSearch === "manage" || sectionSearch === "manage") {
      setSettingsOpen(true);
    }
  }, [tabSearch, sectionSearch, settingsSearch]);

  if (loading) {
    return (
      <AppLayout rightColumn={false} footer>
        <div className="space-y-4 pb-8">
          <Card className="overflow-hidden shadow-none" style={{ borderColor: "var(--border)", borderRadius: 16, background: "var(--background)" }}>
            <Skeleton className="h-28 sm:h-36 rounded-none" />
            <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
              <Skeleton className="h-[64px] w-[64px] rounded-[16px]" />
              <Skeleton className="mt-3 h-[28px] w-[55%] rounded-[8px]" />
              <Skeleton className="mt-2 h-[16px] w-[35%] rounded-[6px]" />
              <Skeleton className="mt-4 h-[44px] w-full rounded-[12px]" />
            </div>
          </Card>
          <Skeleton className="h-[52px] w-full rounded-[12px]" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[96px] w-full rounded-[var(--r-card)]" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }
  if (notFound || !channel) return <NotFoundView />;

  const isOwner = isChannelOwner(channel, me.id);
  const subscribed = Boolean(channel.isSubscribed);
  const visiblePublic = posts.filter((p: ChannelPost) => p.status === "published");
  const list = isOwner && showOwnerView ? posts : visiblePublic;

  const onToggle = async () => {
    if (isOwner) return;
    try {
      // Quiet inline toggle — button state flips, no intrusive top toast.
      await setChannelSubscription(channel.slug, !subscribed);
      reloadChannel();
    } catch {
      toast.error(t("pages.channelDetail.subscribeFailed"));
    }
  };

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-4 pb-8">
        {/* back */}
        <Link
          to="/channels"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--foreground-70)" }}
        >
          <ArrowLeft size={14} /> {t("pages.channelDetail.allChannels")}
        </Link>

        {/* header card */}
        <Card
          className="overflow-hidden shadow-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}
        >
          <ChannelBrandingHeader
            channel={channel}
            editable={false}
            onUpdated={() => reloadChannel()}
          />

          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="font-display text-[20px] sm:text-[24px] font-bold" style={{ color: "var(--foreground)" }}>
                    {channel.name}
                  </h1>
                  {channel.kind === "official" && <BadgeCheck size={18} style={{ color: "var(--accent)" }} />}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[11px] font-medium"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 8px", borderRadius: 6 }}
                  >
                    {channelKindLabel(channel.kind, t)}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {channel.category}
                  </span>
                </div>
              </div>
              {isOwner && (
                <EntitySettingsButton onClick={() => setSettingsOpen(true)} title={t("pages.channelDetail.settingsTitle")} />
              )}
            </div>
              <p className="mt-3 text-[14px]" style={{ color: "var(--foreground-70)" }}>
                {channel.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]" style={{ color: "var(--foreground-50)" }}>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} /> {t("pages.channelDetail.subscribersCount", { count: formatCount(channel.subscribers) })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} /> {t("pages.channelDetail.ownerOnlyPublish")}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!isOwner && (
                  <Button
                    variant={subscribed ? "outline" : "default"}
                    onClick={onToggle}
                    className="flex-1 rounded-[12px] gap-2"
                    size="lg"
                  >
                    {subscribed ? (<><Check size={16} /> {t("pages.shared.youSubscribed")}</>) : t("pages.shared.subscribe")}
                  </Button>
                )}
                {isOwner && (
                  <div
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] px-5 text-[13px] font-semibold sm:w-auto"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)", flex: 1 }}
                  >
                    {t("pages.channelDetail.youAreOwner")}
                  </div>
                )}
              </div>

              {!isOwner && (
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[12px] border text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
                >
                  {t("pages.channelDetail.wantOwnChannel")}
                </button>
              )}

              {/* explanation strip */}
              <div
                className="mt-3 flex items-start gap-2 p-3 text-[12px]"
                style={{ background: "var(--background-surface)", borderRadius: 10, color: "var(--foreground-70)" }}
              >
                <Radio size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <span>
                  {t("pages.channelDetail.publicChannelNote")}
                </span>
              </div>
          </div>
        </Card>

        {/* tabs */}
        <div
          className="sticky top-[48px] z-10 -mx-3 flex items-center gap-1 px-3 py-2 lg:static lg:top-auto lg:mx-0 lg:px-0"
          style={{ background: "color-mix(in oklab, var(--background) 92%, transparent)", backdropFilter: "saturate(180%) blur(8px)" }}
        >
          <div className="flex w-full items-center gap-1" style={{ background: "var(--background-surface)", borderRadius: 12, padding: 4 }}>
            {([
              ["posts", `${t("pages.channelDetail.tabPosts")}${visiblePublic.length ? ` · ${visiblePublic.length}` : ""}`],
              ["about", t("pages.channelDetail.tabAbout")],
            ] as const).map(([k, l]) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className="flex-1 text-[13px] font-medium transition"
                  style={{
                    padding: "9px 14px",
                    borderRadius: 9,
                    background: active ? "var(--background)" : "transparent",
                    color: active ? "var(--foreground)" : "var(--foreground-50)",
                    fontWeight: active ? 600 : 500,
                    boxShadow: active ? "var(--shadow-card)" : "none",
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "posts" ? (
          <>
            {/* owner toggle */}
            {isOwner && (
              <div
                className="flex items-center justify-between gap-3 p-3"
                style={{ background: "var(--background-surface)", borderRadius: 12 }}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {t("pages.channelDetail.ownerViewTitle")}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {t("pages.channelDetail.ownerViewDesc")}
                  </div>
                </div>
                <Segmented
                  value={showOwnerView ? "mine" : "all"}
                  onChange={(v) => setShowOwnerView(v === "mine")}
                />
              </div>
            )}

            {/* composer (owner only) */}
            {isOwner && (
              <Composer
                channelSlug={channel.slug}
                requiresModeration={Boolean(channel.postsRequireModeration)}
                onPosted={() => {
                  setShowOwnerView(true);
                  reloadPosts();
                }}
              />
            )}

            {list.length === 0 ? (
              <div className="grid place-items-center gap-2 py-12 text-center" style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-card)" }}>
                <div className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("pages.channelDetail.emptyPostsChannel")}</div>
              </div>
            ) : (
              <ul className="space-y-3">
                {list.map((p: ChannelPost) => (
                  <PostItem key={p.id} post={p} isOwner={isOwner} channelSlug={channel.slug} onDeleted={reloadPosts} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <AboutPanel
            channel={channel}
            publishedCount={visiblePublic.length}
            requiresModeration={Boolean(channel.postsRequireModeration)}
            scrollSection={sectionSearch === "stats" ? "stats" : undefined}
          />
        )}


      </div>
      {isOwner && (
        <ChannelSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          channel={channel}
          onUpdated={() => reloadChannel()}
          onDeleted={() => navigate({ to: "/channels" })}
        />
      )}
      {requestOpen && (
        <EntityRequestForm
          kind="channel"
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => setRequestOpen(false)}
        />
      )}
    </AppLayout>
  );
}

function Segmented({ value, onChange }: { value: PostFilter; onChange: (v: PostFilter) => void }) {
  const { t } = useTranslation();
  const opts: [PostFilter, string][] = [[ "all", t("pages.channelDetail.filterPublished") ], [ "mine", t("pages.channelDetail.filterAll") ]];
  return (
    <div className="flex shrink-0" style={{ background: "var(--background)", borderRadius: 9, padding: 3 }}>
      {opts.map(([k, l]) => {
        const active = value === k;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="text-[12px]"
            style={{
              padding: "6px 10px",
              borderRadius: 7,
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--accent)" : "var(--foreground-50)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function postStatusMeta(t: (key: string) => string): Record<PostStatus, { label: string; bg: string; color: string; Icon: typeof Clock }> {
  return {
    published: { label: t("pages.channelDetail.statusPublished"), bg: "rgba(16,185,129,0.12)", color: "rgb(16,185,129)", Icon: ShieldCheck },
    moderation: { label: t("pages.channelDetail.statusModeration"), bg: "rgba(245,158,11,0.14)", color: "rgb(217,119,6)", Icon: Clock },
    rejected: { label: t("pages.channelDetail.statusRejected"), bg: "rgba(239,68,68,0.12)", color: "rgb(239,68,68)", Icon: AlertTriangle },
  };
}

const CHANNEL_MEDIA_MAX_W = 520;
const CHANNEL_MEDIA_MAX_H = 420;
const CHANNEL_IMAGE_MAX_H = 360;

function fitChannelMediaSize(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { w: Math.min(maxW, 280), h: Math.min(maxH, 200) };
  }
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return {
    w: Math.max(1, Math.round(naturalW * scale)),
    h: Math.max(1, Math.round(naturalH * scale)),
  };
}

function ChannelPostVideo({ item }: { item: ChannelPostMediaItem }) {
  const initialFrame = useMemo(
    () => fitChannelMediaSize(item.width ?? 0, item.height ?? 0, CHANNEL_MEDIA_MAX_W, CHANNEL_MEDIA_MAX_H),
    [item.width, item.height],
  );
  const [frame, setFrame] = useState(initialFrame);

  useEffect(() => {
    setFrame(initialFrame);
  }, [initialFrame, item.url]);

  return (
    <div
      className="overflow-hidden rounded-[10px] bg-black"
      style={{ width: frame.w, maxWidth: "100%", height: frame.h }}
    >
      <video
        src={item.url}
        controls
        preload="metadata"
        playsInline
        className="h-full w-full object-contain"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
          setFrame(fitChannelMediaSize(video.videoWidth, video.videoHeight, CHANNEL_MEDIA_MAX_W, CHANNEL_MEDIA_MAX_H));
        }}
      />
    </div>
  );
}

function ChannelPostImage({ item }: { item: ChannelPostMediaItem }) {
  const initialFrame = useMemo(
    () => fitChannelMediaSize(item.width ?? 0, item.height ?? 0, CHANNEL_MEDIA_MAX_W, CHANNEL_IMAGE_MAX_H),
    [item.width, item.height],
  );
  const [frame, setFrame] = useState(initialFrame);

  useEffect(() => {
    setFrame(initialFrame);
  }, [initialFrame, item.url]);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-[10px]"
      style={{ width: frame.w, maxWidth: "100%", background: "var(--background-surface)" }}
    >
      <div style={{ width: "100%", height: frame.h }}>
        <img
          src={item.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          onLoad={(event) => {
            if (item.width && item.height) return;
            const img = event.currentTarget;
            if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
            setFrame(
              fitChannelMediaSize(img.naturalWidth, img.naturalHeight, CHANNEL_MEDIA_MAX_W, CHANNEL_IMAGE_MAX_H),
            );
          }}
        />
      </div>
    </a>
  );
}

function ChannelPostMedia({ post }: { post: ChannelPost }) {
  const { t } = useTranslation();
  const items = post.media ?? [];
  if (items.length === 0) return null;

  const videos = items.filter((item) => item.type === "video");
  const imageItems = items.filter((item) => item.type !== "video");
  const images = imageItems.map((item) => item.url);

  return (
    <div className="mt-2 flex max-w-[520px] flex-col gap-2">
      {videos.map((item, index) => (
        <ChannelPostVideo key={`${post.id}-video-${index}`} item={item} />
      ))}
      {imageItems.length === 1 && videos.length === 0 ? (
        <ChannelPostImage item={imageItems[0]} />
      ) : images.length > 0 ? (
        <div className="overflow-hidden rounded-[10px]">
          <PostGallery images={images} alt={post.text.slice(0, 40) || t("pages.channelDetail.postAlt")} />
        </div>
      ) : null}
    </div>
  );
}

function PostItem({
  post,
  isOwner,
  channelSlug,
  onDeleted,
}: {
  post: ChannelPost;
  isOwner: boolean;
  channelSlug: string;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const s = postStatusMeta(t)[post.status];
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t("pages.channelDetail.deletePostConfirm"))) return;
    setDeleting(true);
    try {
      await deleteChannelPost(channelSlug, post.id);
      toast.success(t("pages.channelDetail.deletePostSuccess"));
      onDeleted();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("pages.channelDetail.deletePostFailed")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li
      className="p-4"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        opacity: post.status === "rejected" ? 0.7 : 1,
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
            {post.authorName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {formatDate(post.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={t("pages.channelDetail.deletePost")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity disabled:opacity-50"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "rgb(185,28,28)",
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <Trash2 size={11} /> {t("pages.channelDetail.deletePost")}
            </button>
          )}
          {post.kind && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ background: "var(--background-surface)", color: "var(--foreground-70)", padding: "4px 8px", borderRadius: 6 }}
            >
              <KindIcon kind={post.kind} /> {postKindLabel(t, post.kind)}
            </span>
          )}
          {(isOwner || post.status !== "published") && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ background: s.bg, color: s.color, padding: "4px 8px", borderRadius: 6 }}
            >
              <s.Icon size={11} /> {s.label}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
        {post.text}
      </p>
      <ChannelPostMedia post={post} />
      {post.status === "rejected" && post.rejectionReason && (
        <div
          className="mt-3 rounded-[10px] p-3 text-[12px] leading-relaxed"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "rgb(185,28,28)" }}
        >
          <div className="font-semibold">{t("pages.channelDetail.rejectionReasonTitle")}</div>
          <div className="mt-1">{post.rejectionReason}</div>
        </div>
      )}
      {post.status === "published" && (
        <div className="mt-4 flex items-center gap-4 border-t pt-3 text-[12px]" style={{ borderColor: "var(--border)", color: "var(--foreground-50)" }}>
          <span className="inline-flex items-center gap-1"><Heart size={13} /> {post.likes}</span>
          <span className="inline-flex items-center gap-1"><Eye size={13} /> {post.views}</span>
        </div>
      )}
    </li>
  );
}

const POST_KIND_ICON: Record<PostKind, typeof Newspaper> = {
  news: Newspaper,
  review: Star,
  announce: Megaphone,
  promo: Tag,
};

function KindIcon({ kind }: { kind: PostKind }) {
  const Icon = POST_KIND_ICON[kind];
  return <Icon size={11} />;
}

const MAX_PHOTOS = 10;

function Composer({ channelSlug, requiresModeration, onPosted }: { channelSlug: string; requiresModeration: boolean; onPosted: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<PostKind>("news");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<null | { id: string }>(null);
  const MAX = 800;
  const canSend = text.trim().length >= 4 && text.length <= MAX && !sending;

  const addPhotos = (picked: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const files = picked.slice(0, room);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPhotos((p) => [...p, ...urls]);
    setPhotoFiles((f) => [...f, ...files]);
  };
  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, j) => j !== i));
    setPhotoFiles((f) => f.filter((_, j) => j !== i));
  };
  const reorderPhotos = (next: string[]) => {
    setPhotoFiles(next.map((url) => photoFiles[photos.indexOf(url)]));
    setPhotos(next);
  };
  const replacePhoto = (i: number, blob: Blob) => {
    const oldUrl = photos[i];
    const oldFile = photoFiles[i];
    const newFile = new File([blob], oldFile?.name ?? `photo-${i}.jpg`, { type: blob.type || "image/jpeg" });
    const newUrl = URL.createObjectURL(blob);
    setPhotos((p) => p.map((u, idx) => (idx === i ? newUrl : u)));
    setPhotoFiles((f) => f.map((file, idx) => (idx === i ? newFile : file)));
    if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
  };

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const mediaIds: string[] = [];
      for (const file of photoFiles) {
        const m = await uploadMedia(file, "post");
        mediaIds.push(m.uuid);
      }
      if (videoFile) {
        const m = await uploadMedia(videoFile, "post_video");
        mediaIds.push(m.uuid);
      }
      const post = await createChannelPost({
        channelSlug,
        text: text.trim(),
        kind,
        mediaIds,
        demoImages: photos,
        demoVideo: videoUrl ?? undefined,
      });
      setText("");
      setPhotos([]);
      setPhotoFiles([]);
      setVideoUrl(null);
      setVideoFile(null);
      setJustSent({ id: post.id });
      toast.success(
        post.status === "moderation"
          ? t("pages.channelDetail.postSentModeration")
          : t("pages.channelDetail.postPublished"),
      );
      onPosted();
      window.setTimeout(() => setJustSent(null), 6000);
    } catch {
      toast.error(t("pages.channelDetail.publishFailed"));
    } finally {
      setSending(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--background-surface)]"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
        }}
      >
        <span className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.channelDetail.createPostPlaceholder")}
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            padding: "6px 10px",
            borderRadius: 8,
          }}
        >
          <Send size={12} /> {t("pages.channelDetail.newPost")}
        </span>
      </button>
    );
  }

  return (
    <section
      className="p-4"
      style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.channelDetail.newPost")}
        </h3>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{
            background: requiresModeration ? "rgba(245,158,11,0.14)" : "rgba(16,185,129,0.12)",
            color: requiresModeration ? "rgb(217,119,6)" : "rgb(16,185,129)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {requiresModeration ? <Clock size={11} /> : <ShieldCheck size={11} />}
          {requiresModeration ? t("pages.channelDetail.moderationAfterSend") : t("pages.channelDetail.publishesImmediately")}
        </span>
      </div>

      {/* type picker */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {POST_KINDS.map((k) => {
          const active = kind === k;
          const Icon = POST_KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(k)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
              style={{
                padding: "7px 11px",
                borderRadius: 9,
                background: active ? "var(--accent-soft)" : "var(--background-surface)",
                color: active ? "var(--accent)" : "var(--foreground-70)",
                border: active ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)" : "1px solid transparent",
              }}
            >
              <Icon size={12} /> {postKindLabel(t, k)}
            </button>
          );
        })}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={4}
        placeholder={t("pages.channelDetail.postTextPlaceholder", { kind: postKindLabel(t, kind).toLowerCase() })}
        className="mt-3 w-full resize-y text-[14px] outline-none"
        style={{
          minHeight: 96,
          padding: "10px 12px",
          background: "var(--background-surface)",
          borderRadius: 10,
          border: "1.5px solid transparent",
          color: "var(--foreground)",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
      />

      <div className="mt-3">
        <ImageUploadGrid
          photos={photos}
          max={MAX_PHOTOS}
          controls="minimal"
          onAdd={addPhotos}
          onRemove={removePhoto}
          onMakeMain={() => {}}
          onReorder={reorderPhotos}
          onEdit={(i) => setEditingPhotoIndex(i)}
        />
      </div>

      <PhotoEditorDialog
        open={editingPhotoIndex != null}
        src={editingPhotoIndex != null ? (photoFiles[editingPhotoIndex] ?? photos[editingPhotoIndex] ?? null) : null}
        title="Редактирование фото"
        onCancel={() => setEditingPhotoIndex(null)}
        onSave={(blob) => {
          if (editingPhotoIndex != null) replacePhoto(editingPhotoIndex, blob);
          setEditingPhotoIndex(null);
        }}
        onDelete={() => {
          if (editingPhotoIndex != null) removePhoto(editingPhotoIndex);
          setEditingPhotoIndex(null);
        }}
      />

      <div className="mt-3">
        <VideoUploadField
          fileUrl={videoUrl}
          accept="video/*"
          label={t("pages.channelDetail.addVideo")}
          onPick={(file) => {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
          }}
          onClear={() => {
            setVideoFile(null);
            setVideoUrl(null);
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px]" style={{ color: text.length > MAX - 80 ? "rgb(217,119,6)" : "var(--foreground-50)" }}>
          {text.length} / {MAX}
        </span>
        <Button
          onClick={submit}
          disabled={!canSend}
          className="rounded-[10px] gap-1.5"
          size="sm"
        >
          <Send size={14} /> {sending ? t("pages.channelDetail.publishing") : t("pages.channelDetail.publish")}
        </Button>
      </div>

      {justSent && (
        <div
          className="mt-3 flex items-start gap-2 p-3 text-[12px]"
          style={{
            background: requiresModeration ? "rgba(245,158,11,0.10)" : "rgba(16,185,129,0.10)",
            border: requiresModeration ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(16,185,129,0.35)",
            borderRadius: 10,
            color: requiresModeration ? "rgb(146,64,14)" : "rgb(6,95,70)",
          }}
        >
          {requiresModeration ? <Clock size={14} className="mt-0.5 shrink-0" /> : <ShieldCheck size={14} className="mt-0.5 shrink-0" />}
          <div>
            <div className="font-semibold">
              {requiresModeration ? t("pages.channelDetail.postSentModeration") : t("pages.channelDetail.postPublished")}
            </div>
            <div style={{ color: requiresModeration ? "rgb(180,83,9)" : "rgb(4,120,87)" }}>
              {requiresModeration
                ? t("pages.channelDetail.moderationPendingDesc")
                : t("pages.channelDetail.publishedDesc")}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AboutPanel({
  channel,
  publishedCount,
  requiresModeration,
  scrollSection,
}: {
  channel: Channel;
  publishedCount: number;
  requiresModeration: boolean;
  scrollSection?: "stats";
}) {
  const { t } = useTranslation();
  const created = new Date(channel.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const ownerProfileId = channel.ownerSlug ?? channel.ownerId;
  const ownerNameEl = ownerProfileId ? (
    <Link
      to="/user/$id"
      params={{ id: ownerProfileId }}
      className="truncate text-[14px] font-semibold hover:underline"
      style={{ color: "var(--foreground)" }}
    >
      {channel.ownerName}
    </Link>
  ) : (
    <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
      {channel.ownerName}
    </span>
  );

  useEffect(() => {
    if (scrollSection !== "stats") return;
    document.getElementById("channel-stats")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollSection]);

  const rules: { Icon: typeof FileCheck2; titleKey: string; textKey: string }[] = [
    {
      Icon: FileCheck2,
      titleKey: requiresModeration ? "pages.channelDetail.rulePremodTitle" : "pages.channelDetail.rulePublishTitle",
      textKey: requiresModeration ? "pages.channelDetail.rulePremodText" : "pages.channelDetail.rulePublishText",
    },
    { Icon: MessageSquareOff, titleKey: "pages.channelDetail.ruleNoChatTitle", textKey: "pages.channelDetail.ruleNoChatText" },
    { Icon: Ban, titleKey: "pages.channelDetail.ruleNoSpamTitle", textKey: "pages.channelDetail.ruleNoSpamText" },
  ];

  return (
    <div className="space-y-3">
      {/* description */}
      <section
        className="p-4 sm:p-5"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.channelDetail.aboutTitle")}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          {channel.description}
          {"\n\n"}{t("pages.channelDetail.aboutExtra", { kind: channelKindLabel(channel.kind, t).toLowerCase() })}
        </p>

        {/* stats grid */}
        <div id="channel-stats" className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={Users} label={t("pages.channelDetail.statSubscribers")} value={formatCount(channel.subscribers)} />
          <Stat icon={FileCheck2} label={t("pages.channelDetail.statPosts")} value={String(publishedCount)} />
          <Stat icon={Calendar} label={t("pages.channelDetail.statSince")} value={created.replace(/\s\d{4}.*/, "")} />
        </div>
      </section>

      {/* owner card */}
      <section
        className="p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.channelDetail.ownerSection")}
        </h3>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          {ownerProfileId ? (
            <Link to="/user/$id" params={{ id: ownerProfileId }} aria-label={t("pages.channelDetail.ownerProfileAria", { name: channel.ownerName })}>
              <ChatAvatar src={channel.ownerAvatar} name={channel.ownerName} size={44} className="rounded-[12px]" />
            </Link>
          ) : (
            <ChatAvatar src={channel.ownerAvatar} name={channel.ownerName} size={44} className="rounded-[12px]" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {ownerNameEl}
              {channel.kind === "official" && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}
            </div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.channelDetail.ownerLeads", { kind: channelKindLabel(channel.kind, t), name: channel.name })}
            </div>
          </div>
          <span
            className="shrink-0 text-[11px] font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "4px 8px", borderRadius: 6 }}
          >
            {t("pages.shared.author")}
          </span>
        </div>
        <div className="mt-3 text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.channelDetail.channelCreated", { date: created })}
        </div>
      </section>

      {/* rules */}
      <section
        className="p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.channelDetail.publicationRules")}
        </h3>
        <ul className="mt-3 space-y-2.5">
          {rules.map(({ Icon, titleKey, textKey }) => (
            <li key={titleKey} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center"
                style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 8 }}
              >
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{t(titleKey)}</div>
                <div className="text-[12px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t(textKey)}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div
      className="grid place-items-center gap-1 p-3 text-center"
      style={{ background: "var(--background-surface)", borderRadius: 10 }}
    >
      <Icon size={14} style={{ color: "var(--foreground-50)" }} />
      <div className="font-display text-[15px] font-bold leading-none" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>{label}</div>
    </div>
  );
}


