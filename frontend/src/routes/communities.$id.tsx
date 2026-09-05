import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { variantUrl } from "@/lib/media/variants";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById } from "@/lib/mock";
import type { Community, CommunityContacts, Post, User } from "@/lib/mock";
import {
  fetchCommunity,
  fetchCommunityPosts,
  joinCommunity,
  leaveCommunity,
  fetchOwnedCommunities,
  fetchCommunityMembers,
  fetchCommunityEvents,
  attendCommunityEvent,
  createCommunityEvent,
  fetchCommunityChat,
  banCommunityMember,
  type CommunityMember,
  type CommunityEvent,
} from "@/lib/api/communities";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { recordView } from "@/lib/view-history";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoCommunityPosts,
  demoCommunityDiscussions,
  demoCommunityEvents,
  demoCommunityMembers,
  demoCommunities,
  type DemoDiscussion,
  type DemoCommunityEvent,
  type DemoCommunityMember,
} from "@/lib/demo-data";
import { ShareSheet } from "@/components/communities/ShareSheet";
import { SubmitPostSheet } from "@/components/communities/SubmitPostSheet";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/post/PostCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";
import { CommunityBrandingHeader } from "@/components/communities/CommunityBrandingHeader";
import { CommunitySettingsSheet } from "@/components/communities/CommunitySettingsSheet";
import { EntitySettingsButton } from "@/components/entity/EntitySettingsButton";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { CommunityManagePanel } from "@/components/communities/CommunityManagePanel";
import { toast } from "@/lib/toast";

import i18n from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/communities/$id")({
  head: () => ({ meta: [{ title: i18n.t("pages.communityDetail.metaTitle") }] }),
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

function communityTabs(
  t: (key: string) => string,
  canManage: boolean,
): { key: TabKey; label: string }[] {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "posts", label: t("pages.communityDetail.tabPosts") },
    { key: "chat", label: t("pages.communityDetail.tabChat") },
    { key: "events", label: t("pages.communityDetail.tabEvents") },
    { key: "members", label: t("pages.communityDetail.tabMembers") },
    { key: "about", label: t("pages.communityDetail.tabAbout") },
  ];
  if (canManage) tabs.push({ key: "settings", label: t("pages.communityDetail.tabSettings") });
  return tabs;
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
  onSignup,
}: {
  community: Community;
  members: DemoCommunityMember[];
  events: DemoCommunityEvent[];
  onSignup: (e: DemoCommunityEvent) => void;
}) {
  const { t } = useTranslation();
  const online = members.filter((m) => m.user.online).slice(0, 8);
  const similar = useMemo(
    () =>
      isDemoMode()
        ? demoCommunities()
            .filter((c) => c.id !== community.id && c.category === community.category)
            .slice(0, 3)
        : [],
    [community.id, community.category],
  );
  const fallbackSimilar = useMemo(
    () =>
      similar.length === 0 && isDemoMode()
        ? demoCommunities()
            .filter((c) => c.id !== community.id)
            .slice(0, 3)
        : similar,
    [similar, community.id],
  );

  return (
    <aside className="hidden xl:block w-72 shrink-0">
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
              {t("pages.communityDetail.membersOnline")}
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

        {/* Similar communities */}
        {fallbackSimilar.length > 0 && (
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
            <div className="mt-[10px] flex flex-col gap-[8px]">
              {fallbackSimilar.map((c) => {
                const CIcon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                return (
                  <Link
                    key={c.id}
                    to="/communities/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-[10px] rounded-[10px] p-[6px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span
                      className="grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-[10px]"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      {c.avatarImage ? (
                        <img
                          src={variantUrl(c.avatarImage, "thumb")}
                          width={36}
                          height={36}
                          loading="lazy"
                          decoding="async"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <CIcon size={16} style={{ color: "var(--accent)" }} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block truncate text-[13px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {c.name}
                      </span>
                      <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>
                        {t("pages.shared.members", { count: c.members.toLocaleString("ru") })}
                      </span>
                    </span>
                  </Link>
                );
              })}
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
  const { requirePremium } = useGuestAccess();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const tabs = useMemo(
    () => communityTabs(t, Boolean(community?.canManage || community?.isOwner)),
    [t, community],
  );
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("posts");
  const [joined, setJoined] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [members, setMembers] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [signupEvent, setSignupEvent] = useState<DemoCommunityEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [hasOwnCommunity, setHasOwnCommunity] = useState(false);
  const [memberList, setMemberList] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [hubEvents, setHubEvents] = useState<CommunityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventWhen, setEventWhen] = useState("");
  const [eventPlace, setEventPlace] = useState("");
  const [composerSelection] = useState<ComposerSelection>({ kind: "photo", source: "profile" });

  useEffect(() => {
    fetchOwnedCommunities()
      .then((list) => setHasOwnCommunity(list.length > 0))
      .catch(() => setHasOwnCommunity(false));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setTab("posts");
    fetchCommunity(id)
      .then((c) => {
        if (!alive) return;
        setCommunity(c);
        setJoined(Boolean(c.joined));
        setJoinPending(Boolean(c.joinRequestPending));
        setMembers(c.members);
        recordView({ id: c.id, kind: "community", title: c.name, thumb: c.avatarImage });
      })
      .catch(() => alive && setCommunity(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Demo content for tabs without backend wiring.
  const demo = isDemoMode();
  const discussions = useMemo(
    () => (community && demo ? demoCommunityDiscussions(community.id) : []),
    [community, demo],
  );
  const events = useMemo(
    () => (community && demo ? demoCommunityEvents(community.id) : []),
    [community, demo],
  );
  const demoMemberList = useMemo(
    () => (community && demo ? demoCommunityMembers(community.id) : []),
    [community, demo],
  );

  useEffect(() => {
    if (!community || tab !== "posts") return;
    if (demo) {
      setPosts(demoCommunityPosts(community.id));
      return;
    }
    setPostsLoading(true);
    fetchCommunityPosts(community.id)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }, [community, tab, demo]);

  useEffect(() => {
    if (!community || tab !== "members") return;
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
    fetchCommunityMembers(community.id)
      .then(setMemberList)
      .catch(() => setMemberList([]))
      .finally(() => setMembersLoading(false));
  }, [community, tab, demo, demoMemberList]);

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

  const handleBan = (uuid: string) => {
    if (!window.confirm(t("pages.communityDetail.banMember"))) return;
    void banCommunityMember(community.id, uuid)
      .then(() => {
        setMemberList((prev) => prev.filter((m) => m.user.uuid !== uuid));
        toast.success(t("pages.communityDetail.banned"));
      })
      .catch(() => toast.error(t("pages.communityDetail.banFailed")));
  };

  const rail = demo ? (
    <CommunityRightRail
      community={community}
      members={demoMemberList}
      events={events}
      onSignup={setSignupEvent}
    />
  ) : (
    false
  );

  return (
    <AppLayout rightColumn={rail}>
      <div className="space-y-[16px]">
        {/* Hero: cover + avatar + identity + actions */}
        <Card
          className="overflow-hidden shadow-none"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            borderRadius: 16,
          }}
        >
          <CommunityBrandingHeader
            community={community}
            Icon={Icon}
            editable={false}
            onUpdated={setCommunity}
          />

          <div className="relative px-[16px] pb-[16px] sm:px-[24px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <span
                    className="inline-block rounded-[6px] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-wider"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {community.category}
                  </span>
                  {(community.topics ?? []).slice(0, 4).map((topic) => (
                    <span
                      key={topic.id}
                      className="inline-block rounded-[6px] px-2 py-[3px] text-[11px] font-semibold"
                      style={{
                        background: "var(--background-surface)",
                        color: "var(--foreground-70)",
                      }}
                    >
                      {topic.name}
                    </span>
                  ))}
                  {community.customCategory && (
                    <span
                      className="inline-block rounded-[6px] px-2 py-[3px] text-[11px] font-semibold"
                      style={{
                        background: "var(--background-surface)",
                        color: "var(--foreground-70)",
                      }}
                    >
                      {community.customCategory}
                    </span>
                  )}
                </div>
                <h1
                  className="mt-[10px] font-display text-[20px] font-bold leading-tight sm:text-[26px]"
                  style={{ color: "var(--foreground)" }}
                >
                  {community.name}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-[6px]">
                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
                    style={{ color: "var(--foreground-50)" }}
                    aria-label={t("pages.communityDetail.reportAria")}
                  >
                    <Flag size={16} />
                  </button>
                )}
                {canManage && (
                  <EntitySettingsButton
                    onClick={() => setSettingsOpen(true)}
                    title={t("pages.communityDetail.manageTitle")}
                  />
                )}
              </div>
            </div>

            <div
              className="mt-[14px] flex flex-wrap items-center gap-x-[16px] gap-y-[8px] text-[13px]"
              style={{ color: "var(--foreground-70)" }}
            >
              <span className="inline-flex items-center gap-[6px]">
                <Users size={14} />
                <span>{t("pages.communityDetail.members", { count: members })}</span>
              </span>
              {community.city?.name && (
                <span className="inline-flex items-center gap-[6px]">
                  <MapPin size={14} />
                  <span>{community.city.name}</span>
                </span>
              )}
              {isOwner && (
                <span
                  className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[2px] text-[12px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Check size={13} /> {t("pages.communityDetail.youOwner")}
                </span>
              )}
              {!isOwner && joined && (
                <span
                  className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[2px] text-[12px] font-semibold"
                  style={{
                    background: "var(--success-soft, var(--accent-soft))",
                    color: "var(--success, var(--accent))",
                  }}
                >
                  <Check size={13} /> {t("pages.communityDetail.youSubscribed")}
                </span>
              )}
            </div>

            <p
              className="mt-[14px] text-[14px] leading-[1.65]"
              style={{ color: "var(--foreground-70)" }}
            >
              {community.description}
            </p>

            {/* CTA row */}
            <div className="mt-[18px] flex flex-wrap items-center gap-[8px]">
              {!isOwner && (
                <Button
                  onClick={toggleJoin}
                  disabled={busy || joinPending}
                  variant={joined || joinPending ? "outline" : "default"}
                  size="lg"
                  className="gap-[8px] rounded-[12px]"
                >
                  {joined ? (
                    <>
                      <Check size={16} /> {t("pages.communityDetail.youSubscribed")}
                    </>
                  ) : joinPending ? (
                    <>
                      <Check size={16} /> {t("pages.communityDetail.requestPending")}
                    </>
                  ) : community.accessType === "request" ? (
                    <>
                      <Plus size={16} /> {t("pages.communityDetail.requestJoin")}
                    </>
                  ) : (
                    <>
                      <Plus size={16} /> {t("pages.communityDetail.subscribe")}
                    </>
                  )}
                </Button>
              )}
              {canManage && (
                <Button
                  onClick={() => setSettingsOpen(true)}
                  size="lg"
                  className="gap-[8px] rounded-[12px]"
                >
                  <Settings2 size={16} /> {t("pages.communityDetail.manageTitle")}
                </Button>
              )}
              {(joined || isOwner) && (
                <Button
                  onClick={openChat}
                  variant="outline"
                  size="lg"
                  className="gap-[8px] rounded-[12px]"
                >
                  <MessagesSquare size={16} /> {t("pages.communityDetail.openChat")}
                </Button>
              )}
              {community.allowSubmitPost && (
                <Button
                  onClick={() => setSubmitOpen(true)}
                  variant="outline"
                  size="lg"
                  className="gap-[8px] rounded-[12px]"
                >
                  <FilePlus size={16} /> {t("pages.communityDetail.proposeProject")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                size="lg"
                className="gap-[8px] rounded-[12px]"
              >
                <Share2 size={16} /> {t("pages.communityDetail.share")}
              </Button>
              {!hasOwnCommunity && !isOwner && (
                <Button asChild variant="outline" size="lg" className="gap-[8px] rounded-[12px]">
                  <Link to="/communities/new">
                    <Plus size={16} /> {t("pages.communityDetail.wantOwnCommunity")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <nav
          role="tablist"
          className="flex items-center gap-[2px] overflow-x-auto no-scrollbar"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {tabs.map((tabItem) => {
            const active = tab === tabItem.key;
            const count =
              tabItem.key === "posts"
                ? posts.length
                : tabItem.key === "events"
                  ? demo
                    ? events.length
                    : hubEvents.length
                  : tabItem.key === "members"
                    ? memberList.length
                    : 0;
            return (
              <button
                key={tabItem.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tabItem.key)}
                className="relative inline-flex shrink-0 items-center gap-[6px] px-[14px] py-[12px] text-[14px] font-semibold transition-colors"
                style={{ color: active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {tabItem.label}
                {count > 0 && tabItem.key !== "about" && (
                  <span
                    className="inline-flex h-[18px] min-w-[18px] items-center justify-center px-[5px] text-[11px] font-bold"
                    style={{
                      background: active ? "var(--accent-soft)" : "var(--background-surface)",
                      color: active ? "var(--accent)" : "var(--foreground-50)",
                      borderRadius: "var(--r-pill)",
                    }}
                  >
                    {count}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="community-tab-underline"
                    className="absolute bottom-[-1px] left-[8px] right-[8px]"
                    style={{ height: 3, background: "var(--accent)", borderRadius: 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        {tab === "posts" && (
          <>
            {canCreatePost && (
              <div className="mb-[16px] flex justify-end">
                <Button
                  type="button"
                  onClick={() => requirePremium(() => setCreatePostOpen(true))}
                  className="gap-[6px]"
                >
                  <Plus size={16} />
                  {posts.length > 0
                    ? t("pages.communityDetail.createPost")
                    : t("pages.communityDetail.createFirstPost")}
                </Button>
              </div>
            )}
            {postsLoading ? (
              <div className="space-y-[16px]">
                <Skeleton className="h-[120px] w-full rounded-[var(--r-card)]" />
                <Skeleton className="h-[120px] w-full rounded-[var(--r-card)]" />
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-[16px]">
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
                variant="compact"
              >
                {canCreatePost && (
                  <Button
                    type="button"
                    onClick={() => requirePremium(() => setCreatePostOpen(true))}
                    className="mt-[12px] gap-[6px]"
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

        {/* Back link */}
        <div className="pb-[8px]">
          <Button asChild variant="ghost" className="gap-[6px] text-[13px]">
            <Link to="/communities">
              <ArrowLeft size={14} /> {t("pages.communityDetail.allCommunities")}
            </Link>
          </Button>
        </div>
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
