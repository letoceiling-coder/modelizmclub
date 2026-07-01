import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Users, Check, BadgeCheck, Heart, Eye, Clock, ShieldCheck, AlertTriangle, Radio, Newspaper, Star, Megaphone, Tag, Send, Calendar, MessageSquareOff, FileCheck2, Ban } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useChannel, useChannelPosts, setChannelSubscription, createChannelPost,
  formatCount, formatDate, kindLabel,
  POST_KIND_LABEL,
  type Channel, type ChannelPost, type PostStatus, type PostKind,
} from "@/lib/channels";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";


export const Route = createFileRoute("/channel/$id")({
  head: () => ({ meta: [{ title: "Канал — МоДелизМ Форум" }] }),
  component: ChannelPage,
});

type PostFilter = "all" | "mine";
type ChannelTab = "posts" | "about";

function NotFoundView() {
  return (
    <AppLayout rightColumn={false}>
      <div className="py-[40px]">
        <EmptyState
          icon={Radio}
          title="Канал не найден"
          description="Возможно, он был удалён или ссылка некорректна"
        >
          <Button asChild className="rounded-[10px] px-[20px]">
            <Link to="/channels">Все каналы</Link>
          </Button>
        </EmptyState>
      </div>
    </AppLayout>
  );
}

function ChannelPage() {
  const { id } = Route.useParams();
  const { channel, loading, notFound, reload: reloadChannel } = useChannel(id);
  const { posts, reload: reloadPosts } = useChannelPosts(id);
  const [tab, setTab] = useState<ChannelTab>("posts");
  const [showOwnerView, setShowOwnerView] = useState<boolean>(false);

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="space-y-4">
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
              <Skeleton key={i} className="h-[96px] w-full rounded-[14px]" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }
  if (notFound || !channel) return <NotFoundView />;

  const subscribed = Boolean(channel.isSubscribed);
  const visiblePublic = posts.filter((p: ChannelPost) => p.status === "published");
  const list = channel.isOwner && showOwnerView ? posts : visiblePublic;

  const onToggle = async () => {
    try {
      await setChannelSubscription(channel.slug, !subscribed);
      toast.success(subscribed ? `Отписка от «${channel.name}»` : `Подписка на «${channel.name}»`);
      reloadChannel();
    } catch {
      toast.error("Не удалось обновить подписку");
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-4">
        {/* back */}
        <Link
          to="/channels"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--foreground-70)" }}
        >
          <ArrowLeft size={14} /> Все каналы
        </Link>

        {/* header card */}
        <Card
          className="overflow-hidden shadow-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}
        >
          <div className="h-28 sm:h-36" style={{ background: channel.bannerColor }} />
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="-mt-8 sm:-mt-10 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
              <div
                className="grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center font-display text-[24px] sm:text-[28px] font-bold text-white"
                style={{ background: channel.avatarColor, borderRadius: 16, border: "3px solid var(--background)" }}
              >
                {channel.name.slice(0, 1)}
              </div>
            </div>

            <div className="mt-3">
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
                  {kindLabel(channel.kind)}
                </span>
                <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {channel.category}
                </span>
              </div>
              <p className="mt-3 text-[14px]" style={{ color: "var(--foreground-70)" }}>
                {channel.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]" style={{ color: "var(--foreground-50)" }}>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} /> <b style={{ color: "var(--foreground)" }}>{formatCount(channel.subscribers)}</b> подписчиков
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Публикует только владелец
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {!channel.isOwner && (
                  <Button
                    variant={subscribed ? "outline" : "default"}
                    onClick={onToggle}
                    className="flex-1 rounded-[12px] gap-2"
                    size="lg"
                  >
                    {subscribed ? (<><Check size={16} /> Вы подписаны</>) : "Подписаться"}
                  </Button>
                )}
                {channel.isOwner && (
                  <div
                    className="inline-flex h-11 items-center justify-center gap-2 px-5 text-[13px] font-semibold"
                    style={{ borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", flex: 1 }}
                  >
                    Вы — владелец канала
                  </div>
                )}
              </div>

              {/* explanation strip */}
              <div
                className="mt-3 flex items-start gap-2 p-3 text-[12px]"
                style={{ background: "var(--background-surface)", borderRadius: 10, color: "var(--foreground-70)" }}
              >
                <Radio size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <span>
                  Это публичный канал: посты публикует только владелец. Подписчики читают и не могут писать в ленту канала.
                </span>
              </div>
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
              ["posts", `Посты${visiblePublic.length ? ` · ${visiblePublic.length}` : ""}`],
              ["about", "О канале"],
            ] as const).map(([k, l]) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className="flex-1 text-[13px] font-medium transition-all"
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
            {channel.isOwner && (
              <div
                className="flex items-center justify-between gap-3 p-3"
                style={{ background: "var(--background-surface)", borderRadius: 12 }}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    Вид владельца
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    Видны посты на модерации и отклонённые
                  </div>
                </div>
                <Segmented
                  value={showOwnerView ? "mine" : "all"}
                  onChange={(v) => setShowOwnerView(v === "mine")}
                />
              </div>
            )}

            {/* composer (owner only) */}
            {channel.isOwner && <Composer channelSlug={channel.slug} onPosted={reloadPosts} />}

            {list.length === 0 ? (
              <div className="grid place-items-center gap-2 py-12 text-center" style={{ border: "1px dashed var(--border-strong)", borderRadius: 14 }}>
                <div className="text-[14px]" style={{ color: "var(--foreground-50)" }}>В этом канале пока нет постов</div>
              </div>
            ) : (
              <ul className="space-y-3">
                {list.map((p: ChannelPost) => (
                  <PostItem key={p.id} post={p} isOwner={!!channel.isOwner} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <AboutPanel
            channel={channel}
            publishedCount={visiblePublic.length}
          />
        )}


      </div>
    </AppLayout>
  );
}

function Segmented({ value, onChange }: { value: PostFilter; onChange: (v: PostFilter) => void }) {
  const opts: [PostFilter, string][] = [["all", "Только опубл."], ["mine", "Все"]];
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

const STATUS: Record<PostStatus, { label: string; bg: string; color: string; Icon: typeof Clock }> = {
  published: { label: "Опубликовано", bg: "rgba(16,185,129,0.12)", color: "rgb(16,185,129)", Icon: ShieldCheck },
  moderation: { label: "На проверке", bg: "rgba(245,158,11,0.14)", color: "rgb(217,119,6)", Icon: Clock },
  rejected: { label: "Отклонено", bg: "rgba(239,68,68,0.12)", color: "rgb(239,68,68)", Icon: AlertTriangle },
};

function PostItem({ post, isOwner }: { post: ChannelPost; isOwner: boolean }) {
  const s = STATUS[post.status];
  return (
    <li
      className="p-4"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: 14,
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
          {post.kind && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ background: "var(--background-surface)", color: "var(--foreground-70)", padding: "4px 8px", borderRadius: 6 }}
            >
              <KindIcon kind={post.kind} /> {POST_KIND_LABEL[post.kind]}
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
      {post.status === "published" && (
        <div className="mt-3 flex items-center gap-4 text-[12px]" style={{ color: "var(--foreground-50)" }}>
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

function Composer({ channelSlug, onPosted }: { channelSlug: string; onPosted: () => void }) {
  const [kind, setKind] = useState<PostKind>("news");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<null | { id: string }>(null);
  const MAX = 800;
  const canSend = text.trim().length >= 4 && text.length <= MAX && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const post = await createChannelPost({ channelSlug, text: text.trim(), kind });
      setText("");
      setJustSent({ id: post.id });
      toast.success("Пост опубликован");
      onPosted();
      window.setTimeout(() => setJustSent(null), 6000);
    } catch {
      toast.error("Не удалось опубликовать пост");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="p-4"
      style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Новый пост
        </h3>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ background: "rgba(16,185,129,0.12)", color: "rgb(16,185,129)", padding: "4px 8px", borderRadius: 6 }}
        >
          <ShieldCheck size={11} /> Публикуется сразу
        </span>
      </div>

      {/* type picker */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => {
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
              <Icon size={12} /> {POST_KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={4}
        placeholder={`Текст ${POST_KIND_LABEL[kind].toLowerCase()}а для подписчиков…`}
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
          <Send size={14} /> {sending ? "Публикуем…" : "Опубликовать"}
        </Button>
      </div>

      {justSent && (
        <div
          className="mt-3 flex items-start gap-2 p-3 text-[12px]"
          style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 10, color: "rgb(6,95,70)" }}
        >
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Пост опубликован</div>
            <div style={{ color: "rgb(4,120,87)" }}>
              Публикация уже видна подписчикам в ленте канала.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AboutPanel({ channel, publishedCount }: { channel: Channel; publishedCount: number }) {
  const created = new Date(channel.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const ownerInitial = channel.ownerName.slice(0, 1).toUpperCase();
  const rules: { Icon: typeof FileCheck2; title: string; text: string }[] = [
    { Icon: FileCheck2, title: "Премодерация", text: "Каждый пост проходит проверку модератором перед публикацией." },
    { Icon: MessageSquareOff, title: "Без чата", text: "Подписчики не могут писать в ленту — это односторонний канал." },
    { Icon: Ban, title: "Без спама и рекламы вне правил", text: "Сторонние ссылки и реклама без согласования отклоняются." },
  ];

  return (
    <div className="space-y-3">
      {/* description */}
      <section
        className="p-4 sm:p-5"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Описание
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          {channel.description}
          {"\n\n"}Здесь публикуются {kindLabel(channel.kind).toLowerCase()} материалы: новости, обзоры, анонсы и спецпредложения для подписчиков. Подпишитесь, чтобы получать новые посты в ленте.
        </p>

        {/* stats grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={Users} label="Подписчики" value={formatCount(channel.subscribers)} />
          <Stat icon={FileCheck2} label="Постов" value={String(publishedCount)} />
          <Stat icon={Calendar} label="С нами с" value={created.replace(/\s\d{4}.*/, "")} />
        </div>
      </section>

      {/* owner card */}
      <section
        className="p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Владелец
        </h3>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center font-display text-[16px] font-bold text-white"
            style={{ background: channel.avatarColor, borderRadius: 12 }}
          >
            {ownerInitial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                {channel.ownerName}
              </span>
              {channel.kind === "official" && <BadgeCheck size={14} style={{ color: "var(--accent)" }} />}
            </div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {kindLabel(channel.kind)} · ведёт канал «{channel.name}»
            </div>
          </div>
          <span
            className="shrink-0 text-[11px] font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "4px 8px", borderRadius: 6 }}
          >
            Автор
          </span>
        </div>
        <div className="mt-3 text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Канал создан {created}.
        </div>
      </section>

      {/* rules */}
      <section
        className="p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}
      >
        <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Правила публикаций
        </h3>
        <ul className="mt-3 space-y-2.5">
          {rules.map(({ Icon, title, text }) => (
            <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center"
                style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 8 }}
              >
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
                <div className="text-[12px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>{text}</div>
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


