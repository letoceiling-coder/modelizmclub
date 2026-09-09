import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { variantUrl } from "@/lib/media/variants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car,
  Plane,
  Ship,
  Send as SendIcon,
  Code2,
  Wrench,
  Cpu,
  BatteryCharging,
  Users,
  Share2,
  Globe,
  Phone,
  FilePlus,
  ImageOff,
  ArrowLeft,
  Check,
  Plus,
  CalendarDays,
  MapPin,
  MessagesSquare,
  ChevronRight,
  Settings2,
  Flag,
  Info,
  Link2,
  LogOut,
  Bell,
  BellOff,
  Star,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById } from "@/lib/user-registry";
import type { Community, CommunityContacts, Post, User } from "@/lib/mock";
import {
  fetchCommunity,
  fetchCommunityPosts,
  joinCommunity,
  leaveCommunity,
  fetchCommunityMembers,
  fetchCommunityEvents,
  attendCommunityEvent,
  createCommunityEvent,
  fetchCommunityChat,
  fetchSimilarCommunities,
  setCommunityFavorite,
  setCommunityNotifications,
  banCommunityMember,
  type CommunityMember,
  type CommunityEvent,
} from "@/lib/api/communities";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { recordView } from "@/lib/view-history";
import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import type { DemoDiscussion, DemoCommunityEvent, DemoCommunityMember } from "@/lib/demo-data";
import { ShareSheet } from "@/components/communities/ShareSheet";
import { SubmitPostSheet } from "@/components/communities/SubmitPostSheet";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/post/PostCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { CreatePostRow } from "@/components/feed/CreatePostMenu";
import { useCurrentUser } from "@/lib/session";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";
import { CommunityDetailsDialog } from "@/components/communities/CommunityDetailsDialog";
import { EntityHeader, type EntityAction } from "@/components/entity/EntityHeader";
import { EntityTabs } from "@/components/entity/EntityTabs";
import { EntityMoreMenu, type MoreMenuItem } from "@/components/entity/EntityMoreMenu";
import { CommunitySettingsSheet } from "@/components/communities/CommunitySettingsSheet";
import { EntitySettingsButton } from "@/components/entity/EntitySettingsButton";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { InviteFriendsDialog } from "@/components/communities/InviteFriendsDialog";
import { SimilarCommunitiesList } from "@/components/communities/SimilarCommunitiesList";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVisibleOnce } from "@/hooks/use-visible";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { CommunityManagePanel } from "@/components/communities/CommunityManagePanel";
import { toast } from "@/lib/toast";

import i18n from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";
import { askConfirm } from "@/lib/ui/ask";

/**
 * Загрузчик вынесен из объекта маршрута с явным типом ответа.
 *
 * `head` читает `loaderData`, а загрузчик читает `params` — вместе они
 * замыкают вывод типов в кольцо, и TypeScript отдаёт `never` там и там.
 * Явный тип разрывает кольцо, ничего не меняя в поведении.
 */
type CommunityLoaderData = { community: Community | null; posts: Post[] };

async function loadCommunity({ params }: { params: { id: string } }): Promise<CommunityLoaderData> {
  await ensurePublicBootstrap();
  // Стена — вместе с сообществом: иначе первый кадр показывает два
  // скелетона по 120 px, а следом более короткое «постов нет», и всё, что
  // ниже, прыгает на 86 px. Ровно это давало CLS 0,028 при пороге 0,01.
  //
  // Параллельно, а не следом: записи ищутся по тому же ключу, что и само
  // сообщество, — адрес принимает и slug, и id. Последовательный вызов
  // добавлял к ответу сервера целый круг до API впустую.
  const [community, posts] = await Promise.all([
    fetchCommunity(params.id).catch(() => null),
    fetchCommunityPosts(params.id).catch(() => [] as Post[]),
  ]);

  return { community, posts };
}

export const Route = createFileRoute("/communities/$id")({
  head: ({ loaderData }: { loaderData?: CommunityLoaderData }) => {
    // Обложка — самая большая картинка первого экрана. Без preload браузер
    // узнаёт о ней только разобрав разметку и вычислив вёрстку; с preload
    // тянет одновременно с документом. Тот же приём, что для баннера ленты.
    const cover = loaderData?.community?.coverImage;
    return {
      meta: [{ title: i18n.t("pages.communityDetail.metaTitle") }],
      links: cover
        ? [
            {
              rel: "preload",
              as: "image",
              href: variantUrl(cover, "medium"),
              fetchPriority: "high",
            },
          ]
        : [],
    };
  },
  /**
   * Сообщество приходит с сервера, как и канал рядом.
   *
   * Без загрузчика страница красила пустую оболочку и добирала данные после
   * гидрации: первая отрисовка на 3,8 с, LCP 6,6 с — худшая пара среди всех
   * страниц, и содержимое доезжало кусками, двигая соседние блоки.
   */
  loader: loadCommunity,
  staleTime: 30_000,
  component: CommunityDetailPage,
});

const ICON_MAP: Record<string, typeof Car> = {
  Car,
  Plane,
  Ship,
  Send: SendIcon,
  Code2,
  Wrench,
  Cpu,
  BatteryCharging,
};

function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

type TabKey = "posts" | "chat" | "events" | "members" | "about" | "settings";

/**
 * Вкладки сообщества. «Настройки» здесь больше нет: это действие владельца, и
 * живёт оно в кнопке «Управление» рядом с остальными действиями. Вкладка —
 * это раздел содержимого, а не команда.
 */
function communityTabs(t: (key: string) => string): { key: TabKey; label: string }[] {
  return [
    { key: "posts", label: t("pages.communityDetail.tabPosts") },
    { key: "chat", label: t("pages.communityDetail.tabChat") },
    { key: "events", label: t("pages.communityDetail.tabEvents") },
    { key: "members", label: t("pages.communityDetail.tabMembers") },
    { key: "about", label: t("pages.communityDetail.tabAbout") },
  ];
}

/* ============================ Contacts block ============================ */

function ContactsBlock({ contacts, compact }: { contacts?: CommunityContacts; compact?: boolean }) {
  const { t } = useTranslation();
  if (!contacts) return null;
  const rows: {
    icon: typeof Globe;
    label: string;
    value: string;
    href: string;
    external?: boolean;
  }[] = [];
  if (contacts.telegram)
    rows.push({
      icon: SendIcon,
      label: t("pages.shared.telegram"),
      value: contacts.telegram.replace(/^https?:\/\/(t\.me\/)?/, "@"),
      href: contacts.telegram.startsWith("http")
        ? contacts.telegram
        : `https://t.me/${contacts.telegram.replace(/^@/, "")}`,
      external: true,
    });
  if (contacts.website)
    rows.push({
      icon: Globe,
      label: t("pages.shared.website"),
      value: siteLabel(contacts.website),
      href: contacts.website,
      external: true,
    });
  if (contacts.phone)
    rows.push({
      icon: Phone,
      label: t("pages.shared.phone"),
      value: contacts.phone,
      href: `tel:${contacts.phone.replace(/\s/g, "")}`,
    });
  if (rows.length === 0) return null;

  return (
    <Card
      className="overflow-hidden shadow-none"
      style={{
        background: "var(--background)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
      }}
    >
      <h3
        className="px-[16px] pt-[16px] font-display text-[12px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--foreground-50)" }}
      >
        {t("pages.shared.contacts")}
      </h3>
      <div className="mt-[8px] flex flex-col">
        {rows.map((r) => (
          <a
            key={r.label}
            href={r.href}
            target={r.external ? "_blank" : undefined}
            rel={r.external ? "noopener noreferrer" : undefined}
            className="flex items-center gap-[12px] px-[16px] py-[12px] transition-colors hover:bg-[var(--background-surface)]"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span
              className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <r.icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)" }}
              >
                {r.label}
              </div>
              <div
                className="truncate text-[14px] font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {r.value}
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

/* ============================ Loading skeleton ============================ */

function LoadingSkeleton() {
  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        <Card
          className="overflow-hidden shadow-none"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            borderRadius: 16,
          }}
        >
          <Skeleton className="h-[200px] w-full rounded-none" />
          <div className="px-[16px] pb-[16px] pt-[16px] sm:px-[24px]">
            <Skeleton className="h-[72px] w-[72px] rounded-[18px]" />
            <Skeleton className="mt-[12px] h-[28px] w-[60%] rounded-[8px]" />
            <Skeleton className="mt-[8px] h-[16px] w-[40%] rounded-[6px]" />
            <Skeleton className="mt-[12px] h-[48px] w-full rounded-[10px]" />
            <div className="mt-[16px] flex gap-[8px]">
              <Skeleton className="h-[44px] flex-1 rounded-[12px]" />
              <Skeleton className="h-[44px] flex-1 rounded-[12px]" />
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

/* ============================ Tab content ============================ */

function DiscussionRow({ d }: { d: DemoDiscussion }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-[12px] px-[16px] py-[12px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <span
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <MessagesSquare size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
          {d.title}
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.communityDetail.repliesCount", { count: d.replies, activity: d.lastActivity })}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: "var(--foreground-30)" }} />
    </div>
  );
}

function HubEventCard({
  e,
  onToggle,
  busy,
}: {
  e: CommunityEvent;
  onToggle: (e: CommunityEvent) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const when = e.startsAt ? formatDate(e.startsAt, "absolute") : "";
  return (
    <Card
      className="overflow-hidden shadow-none"
      style={{
        background: "var(--background)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
      }}
    >
      <div
        className="relative h-[140px] w-full overflow-hidden"
        style={{ background: "var(--background-surface)" }}
      >
        {e.coverUrl && !broken ? (
          <img
            src={e.coverUrl}
            width={1200}
            height={420}
            decoding="async"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
              color: "#fff",
            }}
          >
            <CalendarDays size={30} />
          </div>
        )}
        <span
          className="absolute left-[12px] top-[12px] inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[12px] font-semibold text-white"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        >
          <CalendarDays size={13} /> {when}
        </span>
      </div>
      <div className="p-[16px]">
        <h3
          className="font-display text-[16px] font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          {e.title}
        </h3>
        {e.locationName && (
          <div
            className="mt-[6px] flex items-center gap-[6px] text-[13px]"
            style={{ color: "var(--foreground-50)" }}
          >
            <MapPin size={13} />{" "}
            {e.mapUrl ? (
              <a href={e.mapUrl} target="_blank" rel="noreferrer" className="underline">
                {e.locationName}
              </a>
            ) : (
              e.locationName
            )}
          </div>
        )}
        <div className="mt-[12px] flex items-center justify-between gap-[8px]">
          <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.communityDetail.attendeesGoing", { count: e.attendeesCount })}
          </span>
          <Button
            onClick={() => onToggle(e)}
            size="sm"
            disabled={busy}
            variant={e.going ? "outline" : "default"}
            className="gap-[6px]"
          >
            <CalendarDays size={14} />{" "}
            {e.going ? t("pages.communityDetail.going") : t("pages.communityDetail.signUp")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EventCard({
  e,
  onSignup,
}: {
  e: DemoCommunityEvent;
  onSignup: (e: DemoCommunityEvent) => void;
}) {
  return (
    <HubEventCard
      e={{
        uuid: e.id,
        title: e.title,
        startsAt: e.date,
        locationName: e.place,
        coverUrl: e.cover,
        attendeesCount: e.attendees,
        going: false,
      }}
      onToggle={() => onSignup(e)}
    />
  );
}

function MemberRow({
  m,
  onBan,
}: {
  m: CommunityMember | DemoCommunityMember;
  onBan?: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const { user, role } = m;
  const roleKey = "roleKey" in m ? m.roleKey : undefined;
  const isAdmin =
    roleKey === "owner" ||
    role === "Администратор" ||
    role === t("pages.communityDetail.roleAdmin") ||
    role === t("pages.communityDetail.roleCreator");
  const roleLabel =
    roleKey === "owner"
      ? t("pages.communityDetail.roleCreator")
      : roleKey === "moderator"
        ? t("pages.communityDetail.roleModerator")
        : role === "Администратор"
          ? t("pages.communityDetail.roleAdmin")
          : role;
  const uuid = "uuid" in user ? user.uuid : undefined;
  return (
    <div
      className="flex items-center gap-[12px] px-[16px] py-[10px]"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <Link
        to="/user/$id"
        params={{ id: user.id }}
        className="flex min-w-0 flex-1 items-center gap-[12px] transition-colors hover:opacity-80"
      >
        <div className="relative">
          <Avatar className="h-[42px] w-[42px]">
            <AvatarImage src={user.avatar} alt="" />
            <AvatarFallback
              className="text-[13px] font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          {user.online && (
            <span
              className="absolute -bottom-[1px] -right-[1px] h-[12px] w-[12px] rounded-full"
              style={{ background: "#22c55e", border: "2px solid var(--background)" }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
            {user.name}
          </div>
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {user.city}
          </div>
        </div>
      </Link>
      <span
        className="shrink-0 rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
        style={{
          background: isAdmin ? "var(--accent-soft)" : "var(--background-surface)",
          color: isAdmin ? "var(--accent)" : "var(--foreground-50)",
        }}
      >
        {roleLabel}
      </span>
      {onBan && uuid && roleKey !== "owner" && (
        <button
          type="button"
          onClick={() => onBan(uuid)}
          className="text-[12px] font-medium"
          style={{ color: "var(--error, #dc2626)" }}
        >
          {t("pages.communityDetail.banMember")}
        </button>
      )}
    </div>
  );
}

/* ============================ Right rail ============================ */

function CommunityRightRail({
  community,
  members,
  events,
  similar,
  onSignup,
  containerRef,
}: {
  community: Community;
  /**
   * Минимальная форма участника вместо демо-типа: карточке нужны только имя,
   * аватар и признак «в сети», а приходить она может и из демоданных, и из
   * настоящего списка.
   */
  members: Array<{ user: { id: string; name: string; avatar?: string; online?: boolean } }>;
  events: DemoCommunityEvent[];
  /** Похожие приходят готовыми: страница грузит их, когда колонка показалась. */
  similar: Community[];
  onSignup: (e: DemoCommunityEvent) => void;
  /**
   * Колонка спрятана до 1024 через `display: none`, но в разметке есть всегда.
   * Ссылку вешаем на неё саму: наблюдатель пересечений у скрытого узла не
   * срабатывает, и на телефоне запросов не будет вовсе.
   */
  containerRef: (node: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  // Сначала те, кто в сети; если в сети никого — просто первые из списка,
  // иначе карточка «Участники» пропадала бы ночью.
  const onlineFirst = members.filter((m) => m.user.online);
  const online = (onlineFirst.length > 0 ? onlineFirst : members).slice(0, 8);

  return (
    <aside ref={containerRef} className="hidden w-72 shrink-0 lg:block">
      <div
        className="flex h-full flex-col gap-[14px] overflow-y-auto py-[2px] pr-[2px]"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Online members */}
        {online.length > 0 && (
          <Card
            className="p-[14px] shadow-none"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              borderRadius: "var(--r-card)",
            }}
          >
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {onlineFirst.length > 0
                ? t("pages.communityDetail.membersOnline")
                : t("pages.communityDetail.membersCard")}
            </h3>
            <div className="mt-[10px] flex flex-wrap gap-[8px]">
              {online.map((m) => (
                <Link key={m.user.id} to="/user/$id" params={{ id: m.user.id }} title={m.user.name}>
                  <Avatar className="h-[40px] w-[40px]">
                    <AvatarImage src={m.user.avatar} alt="" />
                    <AvatarFallback
                      className="text-[12px] font-semibold"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      {initials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Upcoming events */}
        {events.length > 0 && (
          <Card
            className="p-[14px] shadow-none"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              borderRadius: "var(--r-card)",
            }}
          >
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityDetail.upcomingEvents")}
            </h3>
            <div className="mt-[10px] flex flex-col gap-[10px]">
              {events.slice(0, 2).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSignup(e)}
                  className="flex items-start gap-[10px] text-left"
                >
                  <span
                    className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    <CalendarDays size={16} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block truncate text-[13px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {e.title}
                    </span>
                    <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {e.date}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* О сообществе — первая из трёх карточек раздела 5.6 */}
        <Card
          className="p-[14px] shadow-none"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            borderRadius: "var(--r-card)",
          }}
        >
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
            {t("pages.communityDetail.aboutCard")}
          </h3>
          {community.description && (
            <p
              className="mt-[8px] text-[13px] leading-relaxed"
              style={{ color: "var(--foreground-70)" }}
            >
              {community.description}
            </p>
          )}
          <dl className="mt-[10px] flex flex-col gap-[6px] text-[12px]">
            {community.category && (
              <div className="flex justify-between gap-[8px]">
                <dt style={{ color: "var(--foreground-50)" }}>
                  {t("pages.communityDetail.categoryLabel")}
                </dt>
                <dd className="truncate" style={{ color: "var(--foreground)" }}>
                  {community.category}
                </dd>
              </div>
            )}
            {/* Стиль «date», а не «relative»: относительная запись считается от
                текущего времени, и сервер с браузером расходятся на секунды —
                React отвечает на это ошибкой гидрации. */}
            {community.createdAt && (
              <div className="flex justify-between gap-[8px]">
                <dt style={{ color: "var(--foreground-50)" }}>
                  {t("pages.communityDetail.createdAt")}
                </dt>
                <dd style={{ color: "var(--foreground)" }}>
                  {formatDate(community.createdAt, "date")}
                </dd>
              </div>
            )}
            {community.owner && (
              <div className="flex justify-between gap-[8px]">
                <dt style={{ color: "var(--foreground-50)" }}>
                  {t("pages.communityDetail.ownerLabel")}
                </dt>
                <dd className="min-w-0 truncate" style={{ color: "var(--foreground)" }}>
                  {community.owner.slug ? (
                    <Link
                      to="/user/$id"
                      params={{ id: community.owner.slug }}
                      className="hover:underline"
                    >
                      {community.owner.name}
                    </Link>
                  ) : (
                    community.owner.name
                  )}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Похожие сообщества — теперь из эндпоинта, а не из демоданных */}
        {similar.length > 0 && (
          <Card
            className="p-[14px] shadow-none"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              borderRadius: "var(--r-card)",
            }}
          >
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.communityDetail.similarCommunities")}
            </h3>
            <div className="mt-[10px]">
              <SimilarCommunitiesList items={similar} />
            </div>
          </Card>
        )}

        {/* Contacts */}
        <ContactsBlock contacts={community.contacts} />
      </div>
    </aside>
  );
}

/* ============================ Event signup modal ============================ */

function EventSignupModal({
  event,
  onClose,
}: {
  event: DemoCommunityEvent | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[var(--z-popover)] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full rounded-t-[20px] p-[22px] sm:max-w-[420px] sm:rounded-[18px]"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
          >
            <div
              className="grid h-[44px] w-[44px] place-items-center rounded-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <CalendarDays size={22} />
            </div>
            <h3
              className="mt-[14px] text-[18px] font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              {t("pages.communityDetail.requestSent")}
            </h3>
            <p
              className="mt-[6px] text-[14px] leading-relaxed"
              style={{ color: "var(--foreground-70)" }}
            >
              {event.title} · {event.date}
            </p>
            <p className="mt-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.communityDetail.demoSignupNote")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-[18px] h-[44px] w-full rounded-[12px] text-[14px] font-semibold text-white transition-transform active:scale-[0.99]"
              style={{ background: "var(--accent)" }}
            >
              {t("pages.communityDetail.gotIt")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================ Page ============================ */

function CommunityDetailPage() {
  const { t } = useTranslation();
  const { requirePremium, requireAccount } = useGuestAccess();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const loaded = Route.useLoaderData();
  const primedRef = useRef(true);
  const [community, setCommunity] = useState<Community | null>(loaded.community);
  const tabs = useMemo(() => communityTabs(t), [t]);
  const [loading, setLoading] = useState(loaded.community === null);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("posts");
  const [joined, setJoined] = useState(Boolean(loaded.community?.joined));
  const [joinPending, setJoinPending] = useState(Boolean(loaded.community?.joinRequestPending));
  const [members, setMembers] = useState<number>(loaded.community?.members ?? 0);
  const [busy, setBusy] = useState(false);
  const [signupEvent, setSignupEvent] = useState<DemoCommunityEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Переключатели держим локально и правим по ответу сервера: до ответа
  // кнопка должна отзываться, после — показывать то, что действительно
  // сохранилось.
  // У гостя и у не-участника ключа нет вовсе — это «неприменимо», а не
  // «включено». Показывать им галочку значило бы обещать уведомления,
  // которых никто не шлёт.
  const [notificationsOn, setNotificationsOn] = useState(
    loaded.community?.notificationsEnabled ?? false,
  );
  const [favorite, setFavorite] = useState(Boolean(loaded.community?.isFavorite));
  const [togglingNotifications, setTogglingNotifications] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [similar, setSimilar] = useState<Community[]>([]);
  // Правая колонка сама сообщает, что показалась: до 1024 её нет, и грузить
  // для неё нечего.
  const { ref: railRef, visible: railVisible } = useVisibleOnce<HTMLElement>();
  const [similarOpen, setSimilarOpen] = useState(false);
  const [memberList, setMemberList] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>(loaded.posts ?? []);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsPrimedRef = useRef(true);
  const [hubEvents, setHubEvents] = useState<CommunityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const me = useCurrentUser();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventWhen, setEventWhen] = useState("");
  const [eventPlace, setEventPlace] = useState("");
  const [composerSelection] = useState<ComposerSelection>({ kind: "photo", source: "profile" });

  useEffect(() => {
    let alive = true;
    // Данные от загрузчика уже отрисованы: повторный запрос за тем же самым
    // только мигнул бы содержимым.
    const first = primedRef.current;

    if (first) {
      primedRef.current = false;
      const c = loaded.community;
      if (c) {
        recordView({ id: c.id, kind: "community", title: c.name, thumb: c.avatarImage });
      }
      // Загрузчик работает на сервере, а токен лежит в localStorage — значит,
      // с сервера карточка всегда приходит гостевой: can, is_favorite,
      // notifications_enabled и даже is_member посчитаны для «никого».
      // Разметка уже отрисована и не мигнёт, но состояние надо уточнить.
      if (!getToken()) return;
    } else {
      setLoading(true);
      setTab("posts");
    }

    fetchCommunity(id)
      .then((c) => {
        if (!alive) return;
        setCommunity(c);
        setJoined(Boolean(c.joined));
        setJoinPending(Boolean(c.joinRequestPending));
        setMembers(c.members);
        setNotificationsOn(c.notificationsEnabled ?? false);
        setFavorite(Boolean(c.isFavorite));
        if (!first) {
          recordView({ id: c.id, kind: "community", title: c.name, thumb: c.avatarImage });
        }
      })
      .catch(() => alive && !first && setCommunity(null))
      .finally(() => alive && !first && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, loaded.community]);

  /*
   * Похожие грузятся по требованию, а не при открытии страницы.
   *
   * Раньше запрос уходил из useEffect на монтировании — на каждый заход, в
   * том числе с телефона, где правой колонки нет вовсе и показать их негде.
   * Замер на проде: 776 мс на ответ, начало на 8,4 с, то есть ровно в момент
   * гидрации, когда полоса нужна другому.
   *
   * Теперь зовут двое: правая колонка, когда действительно показалась, и
   * пункт меню «Похожие сообщества». Повторно не запрашиваем.
   */
  const similarRequested = useRef(false);
  const loadSimilar = useCallback(() => {
    if (similarRequested.current) return;
    similarRequested.current = true;
    fetchSimilarCommunities(id)
      .then(setSimilar)
      .catch(() => setSimilar([]));
  }, [id]);

  useEffect(() => {
    if (railVisible) loadSimilar();
  }, [railVisible, loadSimilar]);

  // Demo content for tabs without backend wiring.
  const demo = isDemoMode();
  /*
   * Демоданные приезжают отдельным куском, а не вместе со страницей.
   *
   * Маршрут не ленивый, поэтому его статические импорты попадают в главный
   * чанк — вместе с ними туда уезжали 47 КБ выдуманных постов, сообществ и
   * пользователей, которые в бою не показываются никогда. Здесь единственное
   * место, где они нужны синхронно, поэтому вместо useMemo — состояние.
   */
  const [discussions, setDiscussions] = useState<DemoDiscussion[]>([]);
  const [events, setEvents] = useState<DemoCommunityEvent[]>([]);
  const [demoMemberList, setDemoMemberList] = useState<DemoCommunityMember[]>([]);

  useEffect(() => {
    if (!community || !demo) {
      setDiscussions([]);
      setEvents([]);
      setDemoMemberList([]);
      return;
    }
    let alive = true;
    void import("@/lib/demo-data").then((m) => {
      if (!alive) return;
      setDiscussions(m.demoCommunityDiscussions(community.id));
      setEvents(m.demoCommunityEvents(community.id));
      setDemoMemberList(m.demoCommunityMembers(community.id));
    });
    return () => {
      alive = false;
    };
  }, [community, demo]);

  useEffect(() => {
    if (!community || tab !== "posts") return;
    if (demo) {
      void import("@/lib/demo-data").then((m) => setPosts(m.demoCommunityPosts(community.id)));
      return;
    }
    // Записи от загрузчика уже отрисованы.
    if (postsPrimedRef.current) {
      postsPrimedRef.current = false;
      return;
    }
    setPostsLoading(true);
    fetchCommunityPosts(community.id)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }, [community, tab, demo]);

  /*
   * Участники нужны в двух местах, и объёмы там разные: карточке правой
   * колонки хватает восьми аватаров, вкладке — всего списка.
   *
   * Раньше на монтировании тянулись сразу сто записей — на карточку, которая
   * показывает восемь, и на телефоне, где карточки нет. Теперь короткий
   * список запрашивает сама колонка, когда показалась, а полный — вкладка,
   * когда её открыли.
   */
  const membersScope = tab === "members" ? "full" : railVisible ? "card" : "none";

  useEffect(() => {
    if (!community || membersScope === "none") return;
    if (demo) {
      setMemberList(
        demoMemberList.map((m) => ({
          user: m.user,
          role: m.role,
          roleKey: m.role === "Администратор" ? "owner" : "member",
        })),
      );
      return;
    }
    setMembersLoading(true);
    fetchCommunityMembers(community.id, membersScope === "full" ? 100 : 8)
      .then(setMemberList)
      .catch(() => setMemberList([]))
      .finally(() => setMembersLoading(false));
  }, [community, demo, demoMemberList, membersScope]);

  useEffect(() => {
    if (!community || tab !== "events" || demo) return;
    setEventsLoading(true);
    fetchCommunityEvents(community.id)
      .then(setHubEvents)
      .catch(() => setHubEvents([]))
      .finally(() => setEventsLoading(false));
  }, [community, tab, demo]);

  if (loading) return <LoadingSkeleton />;

  if (!community) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-[40px]">
          <EmptyState
            icon={Users}
            title={t("pages.communityDetail.notFoundTitle")}
            description={t("pages.communityDetail.notFoundDesc")}
          >
            <Button asChild className=" px-[20px]">
              <Link to="/communities">{t("pages.communityDetail.allCommunities")}</Link>
            </Button>
          </EmptyState>
        </div>
      </AppLayout>
    );
  }

  const Icon = ICON_MAP[community.avatarIcon ?? "Users"] ?? Users;
  const admin = community.adminId ? userById(community.adminId) : null;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const isOwner = Boolean(community.isOwner);
  const canManage = Boolean(community.canManage || isOwner);
  const canCreatePost = isOwner || community.role === "moderator" || joined;

  const toggleJoin = () => {
    if (busy || isOwner || joinPending) return;
    requirePremium(() => {
      void (async () => {
        setBusy(true);
        try {
          if (joined) {
            await leaveCommunity(community.id);
            setJoined(false);
            setMembers((m) => Math.max(0, m - 1));
          } else {
            const result = await joinCommunity(community.id);
            if (result.status === "pending") {
              setJoinPending(true);
              toast.success(t("pages.communityDetail.requestPending"));
            } else {
              setJoined(true);
              setMembers((m) => m + 1);
            }
          }
        } catch {
          toast.error(t("pages.shared.retry"));
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  const toggleNotifications = () => {
    requireAccount(() => {
      if (togglingNotifications) return;
      const next = !notificationsOn;
      setTogglingNotifications(true);
      // Показываем сразу, но правим по ответу: сервер — источник истины.
      setNotificationsOn(next);
      setCommunityNotifications(id, next)
        .then((saved) => {
          setNotificationsOn(saved);
          setCommunity((c) => (c ? { ...c, notificationsEnabled: saved } : c));
          toast.success(
            saved
              ? t("pages.communityDetail.notificationsOn")
              : t("pages.communityDetail.notificationsOff"),
          );
        })
        .catch(() => {
          setNotificationsOn(!next);
          toast.error(t("pages.communityDetail.notificationsFailed"));
        })
        .finally(() => setTogglingNotifications(false));
    });
  };

  const toggleFavorite = () => {
    requireAccount(() => {
      if (togglingFavorite) return;
      const next = !favorite;
      setTogglingFavorite(true);
      setFavorite(next);
      setCommunityFavorite(id, next)
        .then((saved) => {
          setFavorite(saved);
          setCommunity((c) => (c ? { ...c, isFavorite: saved } : c));
          toast.success(
            saved
              ? t("pages.communityDetail.favoriteAdded")
              : t("pages.communityDetail.favoriteRemoved"),
          );
        })
        .catch(() => {
          setFavorite(!next);
          toast.error(t("pages.communityDetail.favoriteFailed"));
        })
        .finally(() => setTogglingFavorite(false));
    });
  };

  /**
   * Восемь пунктов «Ещё».
   *
   * Что показывать, решает поле `can` из ресурса, а не наличие сессии: гость
   * видит те же пункты и получает окно входа, а не пустое меню. Единственное
   * исключение — «Покинуть»: предлагать выход тому, кто не внутри, незачем,
   * и `can.leave` у него как раз false.
   */
  const moreMenuItems: MoreMenuItem[] = (() => {
    const can = community.can;
    const items: MoreMenuItem[] = [];

    // Уведомления настраивает участник: строка настройки живёт в
    // community_members, и вне участия её нет. Гостю пункт всё равно показан —
    // он ведёт в окно входа. Прячем только от вошедшего постороннего: ему
    // сервер ответил бы 403.
    if (joined || !getToken()) {
      items.push({
        id: "notifications",
        icon: notificationsOn ? Bell : BellOff,
        label: notificationsOn
          ? t("pages.communityDetail.notificationsDisable")
          : t("pages.communityDetail.notificationsEnable"),
        checked: notificationsOn,
        disabled: togglingNotifications,
        onSelect: toggleNotifications,
      });
    }

    items.push({
      id: "favorite",
      icon: Star,
      label: favorite
        ? t("pages.communityDetail.favoriteRemove")
        : t("pages.communityDetail.favoriteAdd"),
      checked: favorite,
      disabled: togglingFavorite,
      onSelect: toggleFavorite,
    });

    items.push({
      id: "invite",
      icon: UserPlus,
      label: t("pages.communityDetail.inviteFriends"),
      onSelect: () => requireAccount(() => setInviteOpen(true)),
    });

    items.push({
      id: "similar",
      icon: Sparkles,
      label: t("pages.communityDetail.similarCommunities"),
      // На телефоне правой колонки нет, и до этого нажатия похожих никто не
      // запрашивал. Грузим здесь же; повторно запрос не уйдёт.
      onSelect: () => {
        loadSimilar();
        setSimilarOpen(true);
      },
    });

    items.push({
      id: "details",
      icon: Info,
      label: t("pages.communityDetail.detailsTitle"),
      onSelect: () => setDetailsOpen(true),
    });

    items.push({
      id: "copy",
      icon: Link2,
      label: t("components.postActionMenu.copyLink"),
      onSelect: () => {
        void navigator.clipboard
          .writeText(url)
          .then(() => toast.success(t("components.postActionMenu.linkCopied")))
          .catch(() => toast.error(t("components.postActionMenu.copyFailed")));
      },
    });

    if (!isOwner) {
      items.push({
        id: "report",
        icon: Flag,
        label: t("components.postActionMenu.report"),
        onSelect: () => requireAccount(() => setReportOpen(true)),
      });
    }

    if (can?.leave) {
      items.push({
        id: "leave",
        icon: LogOut,
        danger: true,
        label: t("pages.communityDetail.leaveCommunity"),
        onSelect: async () => {
          if (
            !(await askConfirm({ title: t("pages.communityDetail.leaveConfirm"), danger: true }))
          ) {
            return;
          }
          toggleJoin();
        },
      });
    }

    return items;
  })();

  const openChat = () => {
    requirePremium(() => {
      void (async () => {
        try {
          const { conversationUuid } = await fetchCommunityChat(community.id);
          void navigate({ to: "/messenger", search: { chat: conversationUuid } });
        } catch {
          toast.error(t("pages.communityDetail.chatOpenFailed"));
        }
      })();
    });
  };

  /*
   * Порядок — это важность: первые два действия остаются с подписью, дальше
   * значки. Владельцу главное — управление, гостю и постороннему — вступить;
   * «Поделиться» замыкает список, потому что то же самое есть в меню «Ещё».
   */
  const headerActions: EntityAction[] = [
    !isOwner && {
      id: "join",
      label: joined
        ? t("pages.communityDetail.youSubscribed")
        : joinPending
          ? t("pages.communityDetail.requestPending")
          : community.accessType === "request"
            ? t("pages.communityDetail.requestJoin")
            : t("pages.communityDetail.subscribe"),
      icon: joined ? Check : UserPlus,
      onClick: toggleJoin,
      variant: joined || joinPending ? ("outline" as const) : ("default" as const),
      disabled: busy || joinPending,
    },
    canManage && {
      id: "manage",
      label: t("pages.communityDetail.manageTitle"),
      icon: Settings2,
      onClick: () => setSettingsOpen(true),
      variant: "default" as const,
    },
    (joined || isOwner) && {
      id: "chat",
      label: t("pages.communityDetail.openChat"),
      icon: MessagesSquare,
      onClick: openChat,
    },
    community.allowSubmitPost && {
      id: "submit",
      label: t("pages.communityDetail.proposeProject"),
      icon: FilePlus,
      onClick: () => setSubmitOpen(true),
    },
    {
      id: "share",
      label: t("pages.communityDetail.share"),
      icon: Share2,
      onClick: () => setShareOpen(true),
    },
  ].filter(Boolean) as EntityAction[];

  const toggleEvent = (event: CommunityEvent) => {
    if (!joined && !isOwner) {
      toast.error(t("pages.communityDetail.chatMembersOnly"));
      return;
    }
    void attendCommunityEvent(community.id, event.uuid)
      .then((updated) =>
        setHubEvents((prev) => prev.map((item) => (item.uuid === updated.uuid ? updated : item))),
      )
      .catch(() => toast.error(t("pages.communityDetail.eventFailed")));
  };

  const submitEvent = () => {
    if (eventTitle.trim().length < 3 || !eventWhen) {
      toast.error(t("pages.communityDetail.eventFailed"));
      return;
    }
    void createCommunityEvent(community.id, {
      title: eventTitle.trim(),
      startsAt: new Date(eventWhen).toISOString(),
      locationName: eventPlace.trim() || undefined,
    })
      .then((created) => {
        setHubEvents((prev) => [...prev, created]);
        setEventFormOpen(false);
        setEventTitle("");
        setEventWhen("");
        setEventPlace("");
        toast.success(t("pages.communityDetail.eventCreated"));
      })
      .catch(() => toast.error(t("pages.communityDetail.eventFailed")));
  };

  const handleBan = async (uuid: string) => {
    if (!(await askConfirm({ title: t("pages.communityDetail.banMember"), danger: true }))) return;
    void banCommunityMember(community.id, uuid)
      .then(() => {
        setMemberList((prev) => prev.filter((m) => m.user.uuid !== uuid));
        toast.success(t("pages.communityDetail.banned"));
      })
      .catch(() => toast.error(t("pages.communityDetail.banFailed")));
  };

  // Правая колонка теперь есть и на боевых данных: «Похожие» получили
  // эндпоинт, участники приходят из списка сообщества, а «О сообществе»
  // собирается из самой карточки. События остаются демонстрационными —
  // у них своя форма, и в правую колонку они попадают только в демо.
  const rail = (
    <CommunityRightRail
      community={community}
      members={demo ? demoMemberList : memberList}
      events={demo ? events : []}
      similar={similar}
      onSignup={setSignupEvent}
      containerRef={railRef}
    />
  );

  return (
    <AppLayout narrowCenter rightColumn={rail}>
      <div className="space-y-[16px]">
        {/*
          Хлебная крошка над обложкой. Раньше «Все сообщества» стояли под
          стеной: чтобы вернуться к списку, надо было пролистать все записи
          сообщества до самого низа — то есть возврат находился дальше всего
          от того места, где о нём вспоминают.
        */}
        <Link
          to="/communities"
          className="hit-target -mb-1 inline-flex items-center gap-1 text-[13px] transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ color: "var(--foreground-50)" }}
        >
          <ArrowLeft size={14} /> {t("pages.communityDetail.allCommunities")}
        </Link>

        {/* Hero: cover + avatar + identity + actions */}
        <Card
          className="overflow-hidden shadow-none"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            borderRadius: 16,
          }}
        >
          <EntityHeader
            coverUrl={community.coverImage}
            avatarUrl={community.avatarImage}
            avatarFallback={<Icon size={30} />}
            name={community.name}
            badges={
              <>
                {community.isOfficial && (
                  <span
                    className="shrink-0 rounded-[var(--r-pill)] px-[6px] py-[1px] text-[11px] font-semibold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {t("pages.communities.badgeOfficial")}
                  </span>
                )}
                {isOwner && (
                  <span
                    className="shrink-0 rounded-[var(--r-pill)] px-[6px] py-[1px] text-[11px] font-semibold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {t("pages.shared.owner")}
                  </span>
                )}
              </>
            }
            meta={
              <>
                {t("pages.communityDetail.members", { count: members })}
                {community.category ? ` \u00b7 ${community.category}` : ""}
                {community.city?.name ? ` \u00b7 ${community.city.name}` : ""}
              </>
            }
            description={community.description}
            actions={headerActions}
            menu={
              <EntityMoreMenu
                ariaLabel={t("pages.communityDetail.moreAria")}
                title={t("pages.communityDetail.moreTitle")}
                items={moreMenuItems}
              />
            }
          />
        </Card>

        {/* Tabs */}
        <EntityTabs
          layoutId="community-tab-underline"
          active={tab}
          onChange={setTab}
          tabs={tabs.map((tabItem) => ({
            key: tabItem.key,
            label: tabItem.label,
            count:
              tabItem.key === "posts"
                ? posts.length
                : tabItem.key === "events"
                  ? demo
                    ? events.length
                    : hubEvents.length
                  : tabItem.key === "members"
                    ? // Число берём из ресурса, а не из длины загруженного
                      // списка: карточке правой колонки хватает восьми, и
                      // счётчик показывал бы «8» вместо настоящего числа.
                      (community.members ?? memberList.length)
                    : 0,
          }))}
        />

        {/* Tab panels */}
        {tab === "posts" && (
          <>
            {/* Поле создания вместо кнопки «Создать пост» в углу: кнопка
                говорила, что произойдёт, но не показывала, где окажется
                запись. Строка стоит там же, где появится пост, и это та же
                строка, что в ленте.

                Она показывается и на пустой стене. Прежний запрет — «на
                пустой стене только одно предложение» — был про две кнопки
                с одинаковой подписью «Создать первый пост»: одно действие,
                два одинаковых предложения. Поле и призыв в пустом состоянии
                разного рода: первое всегда на своём месте, второй объясняет,
                почему здесь пусто. */}
            {canCreatePost && (
              <div className="mb-3">
                <CreatePostRow
                  me={me}
                  onSelectKind={() => requirePremium(() => setCreatePostOpen(true))}
                  onCompose={() => requirePremium(() => setCreatePostOpen(true))}
                />
              </div>
            )}
            {postsLoading ? (
              <div className="space-y-[16px]">
                <Skeleton className="h-[120px] w-full rounded-[var(--r-card)]" />
                <Skeleton className="h-[120px] w-full rounded-[var(--r-card)]" />
              </div>
            ) : posts.length > 0 ? (
              /* Восемь между карточками, а не шестнадцать: подсветка при
                 наведении сама отделяет одну запись от другой, и лишний
                 воздух только удлиняет стену. */
              <div className="space-y-2">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    variant="community"
                    post={p}
                    context={{ community }}
                    onDelete={(id) => setPosts((list) => list.filter((x) => x.id !== id))}
                    onEdited={(next) =>
                      setPosts((list) => list.map((x) => (x.id === next.id ? next : x)))
                    }
                    onTogglePost={(id, patch) =>
                      setPosts((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ImageOff}
                title={t("pages.communityDetail.emptyPosts")}
                description={t("pages.communityDetail.emptyPostsDesc")}
                variant="section"
              >
                {canCreatePost && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => requirePremium(() => setCreatePostOpen(true))}
                    className="gap-[6px]"
                  >
                    <Plus size={16} />
                    {t("pages.communityDetail.createFirstPost")}
                  </Button>
                )}
              </EmptyState>
            )}
          </>
        )}

        {tab === "chat" &&
          (joined || isOwner ? (
            <EmptyState
              icon={MessagesSquare}
              title={t("pages.communityDetail.tabChat")}
              description={t("pages.communityDetail.openChat")}
              variant="compact"
            >
              <Button type="button" onClick={openChat} className="mt-[12px] gap-[6px]">
                <MessagesSquare size={16} /> {t("pages.communityDetail.openChat")}
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title={t("pages.communityDetail.chatMembersOnly")}
              description={t("pages.communityDetail.chatMembersOnlyDesc")}
              variant="compact"
            />
          ))}

        {tab === "events" && (
          <>
            {canManage && !demo && (
              <div className="mb-[16px] flex justify-end">
                <Button
                  type="button"
                  onClick={() => setEventFormOpen((v) => !v)}
                  className="gap-[6px]"
                >
                  <Plus size={16} /> {t("pages.communityDetail.createEvent")}
                </Button>
              </div>
            )}
            {eventFormOpen && (
              <Card
                className="mb-[16px] space-y-[10px] p-[16px] shadow-none"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  borderRadius: "var(--r-card)",
                }}
              >
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder={t("pages.communityDetail.eventTitle")}
                  className="h-11 w-full rounded-[10px] border px-3 text-[14px]"
                  style={{
                    background: "var(--background-surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <input
                  type="datetime-local"
                  value={eventWhen}
                  onChange={(e) => setEventWhen(e.target.value)}
                  className="h-11 w-full rounded-[10px] border px-3 text-[14px]"
                  style={{
                    background: "var(--background-surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <input
                  value={eventPlace}
                  onChange={(e) => setEventPlace(e.target.value)}
                  placeholder={t("pages.communityDetail.eventPlace")}
                  className="h-11 w-full rounded-[10px] border px-3 text-[14px]"
                  style={{
                    background: "var(--background-surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <Button type="button" onClick={submitEvent}>
                  {t("pages.communityDetail.eventCreate")}
                </Button>
              </Card>
            )}
            {demo ? (
              events.length > 0 ? (
                <div className="grid gap-[16px] sm:grid-cols-2">
                  {events.map((e) => (
                    <EventCard key={e.id} e={e} onSignup={setSignupEvent} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title={t("pages.communityDetail.emptyEvents")}
                  description={t("pages.communityDetail.emptyEventsDesc")}
                  variant="compact"
                />
              )
            ) : eventsLoading ? (
              <Skeleton className="h-[160px] w-full rounded-[var(--r-card)]" />
            ) : hubEvents.length > 0 ? (
              <div className="grid gap-[16px] sm:grid-cols-2">
                {hubEvents.map((e) => (
                  <HubEventCard key={e.uuid} e={e} onToggle={toggleEvent} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title={t("pages.communityDetail.emptyEvents")}
                description={t("pages.communityDetail.emptyEventsDesc")}
                variant="compact"
              />
            )}
          </>
        )}

        {tab === "members" &&
          (membersLoading ? (
            <Card
              className="overflow-hidden px-[16px] py-[20px] shadow-none"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "var(--r-card)",
              }}
            >
              <Skeleton className="h-[42px] w-full" />
              <Skeleton className="mt-[10px] h-[42px] w-full" />
            </Card>
          ) : memberList.length > 0 ? (
            <Card
              className="overflow-hidden shadow-none"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "var(--r-card)",
              }}
            >
              <h2
                className="px-[16px] pt-[16px] font-display text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)" }}
              >
                {t("pages.communityDetail.membersHeading")}
              </h2>
              <div className="mt-[8px]">
                {memberList.map((m) => (
                  <MemberRow key={m.user.id} m={m} onBan={canManage ? handleBan : undefined} />
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={Users}
              title={t("pages.communityDetail.membersUnavailable")}
              variant="compact"
            />
          ))}

        {tab === "settings" && canManage && (
          <Card
            className="p-[16px] shadow-none sm:p-[24px]"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              borderRadius: "var(--r-card)",
            }}
          >
            <CommunityManagePanel
              community={community}
              Icon={Icon}
              onUpdated={setCommunity}
              onDeleted={() => navigate({ to: "/communities" })}
            />
          </Card>
        )}

        {tab === "about" && (
          <div className="space-y-[16px]">
            <Card
              className="px-[16px] py-[20px] shadow-none sm:px-[24px]"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "var(--r-card)",
              }}
            >
              <h2
                className="font-display text-[16px] font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {t("pages.communityDetail.aboutHeading")}
              </h2>
              <p
                className="mt-[8px] whitespace-pre-line text-[14px] leading-[1.65]"
                style={{ color: "var(--foreground-70)" }}
              >
                {community.fullDescription || community.description}
              </p>
              {community.rules && (
                <div className="mt-[16px]">
                  <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {t("pages.communityWizard.rules")}
                  </h3>
                  <p
                    className="mt-[6px] whitespace-pre-line text-[14px]"
                    style={{ color: "var(--foreground-70)" }}
                  >
                    {community.rules}
                  </p>
                </div>
              )}
              {admin && (
                <Link
                  to="/user/$id"
                  params={{ id: admin.id }}
                  className="mt-[16px] inline-flex items-center gap-[8px] text-[13px]"
                  style={{ color: "var(--foreground-70)" }}
                >
                  <Avatar className="h-[28px] w-[28px]">
                    <AvatarImage src={admin.avatar} alt="" />
                    <AvatarFallback
                      className="text-[11px] font-semibold"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{t("pages.communityDetail.adminLabel", { name: admin.name })}</span>
                </Link>
              )}
            </Card>
            {/* Contacts also live on the About tab (right rail is desktop-only) */}
            <div className="xl:hidden">
              <ContactsBlock contacts={community.contacts} />
            </div>
          </div>
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={url}
        title={community.name}
        heading="Поделиться сообществом"
        showSendToFriend
      />
      <SubmitPostSheet
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        communityName={community.name}
      />
      {canManage && (
        <CommunitySettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          community={community}
          Icon={Icon}
          onUpdated={setCommunity}
          onDeleted={() => navigate({ to: "/communities" })}
        />
      )}
      <EventSignupModal event={signupEvent} onClose={() => setSignupEvent(null)} />
      <CreatePostModal
        open={createPostOpen}
        selection={composerSelection}
        communityId={community.backendId}
        onClose={() => setCreatePostOpen(false)}
        onCreate={(post) => {
          setPosts((prev) => [post, ...prev]);
          setCreatePostOpen(false);
        }}
      />
      <CommunityDetailsDialog
        community={community}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
      <InviteFriendsDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        slug={community.id}
        communityName={community.name}
      />
      {/* Отдельным окном — потому что на узком экране правой колонки нет,
          а пункт меню есть на всех ширинах. */}
      <Dialog open={similarOpen} onOpenChange={setSimilarOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("pages.communityDetail.similarCommunities")}</DialogTitle>
          </DialogHeader>
          <SimilarCommunitiesList items={similar} />
        </DialogContent>
      </Dialog>
      <ComplaintDialog
        target={
          reportOpen
            ? {
                id: community.id,
                name: community.name,
                city: community.category,
                interests: "",
                avatar: community.avatarImage ?? "",
              }
            : null
        }
        onClose={() => setReportOpen(false)}
        page={`/communities/${community.id}`}
        subjectSuffix={t("pages.communityDetail.reportSuffix")}
        descriptionOverride={t("pages.communityDetail.reportDesc", { name: community.name })}
        report={
          reportOpen && community.uuid ? { type: "community", targetId: community.uuid } : undefined
        }
      />
    </AppLayout>
  );
}
