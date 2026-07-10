import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging, Users,
  Share2, Globe, Phone, MessageCircle, FilePlus, ImageOff, ArrowLeft,
  Check, Plus, CalendarDays, MapPin, MessagesSquare, Heart, ChevronRight,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById } from "@/lib/mock";
import type { Community, CommunityContacts, Post, User } from "@/lib/mock";
import { fetchCommunity, joinCommunity, leaveCommunity } from "@/lib/api/communities";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoCommunityPosts, demoCommunityDiscussions, demoCommunityEvents, demoCommunityMembers,
  demoCommunities,
  type DemoDiscussion, type DemoCommunityEvent, type DemoCommunityMember,
} from "@/lib/demo-data";
import { ShareSheet } from "@/components/communities/ShareSheet";
import { SubmitPostSheet } from "@/components/communities/SubmitPostSheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/communities/$id")({
  head: () => ({ meta: [{ title: "Сообщество — МоДелизМ" }] }),
  component: CommunityDetailPage,
});

const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send: SendIcon, Code2, Wrench, Cpu, BatteryCharging,
};

function siteLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

type TabKey = "posts" | "discussions" | "events" | "members" | "about";
const TABS: { key: TabKey; label: string }[] = [
  { key: "posts", label: "Посты" },
  { key: "discussions", label: "Обсуждения" },
  { key: "events", label: "Мероприятия" },
  { key: "members", label: "Участники" },
  { key: "about", label: "О сообществе" },
];

/* ============================ Contacts block ============================ */

function ContactsBlock({ contacts, compact }: { contacts?: CommunityContacts; compact?: boolean }) {
  if (!contacts) return null;
  const rows: { icon: typeof Globe; label: string; value: string; href: string; external?: boolean }[] = [];
  if (contacts.website)
    rows.push({ icon: Globe, label: "Сайт", value: siteLabel(contacts.website), href: contacts.website, external: true });
  if (contacts.phone)
    rows.push({ icon: Phone, label: "Телефон", value: contacts.phone, href: `tel:${contacts.phone.replace(/\s/g, "")}` });
  if (rows.length === 0) return null;

  return (
    <Card
      className="overflow-hidden shadow-none"
      style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
    >
      <h3
        className="px-[16px] pt-[16px] font-display text-[12px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--foreground-50)" }}
      >
        Контакты
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
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
                {r.label}
              </div>
              <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
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
          style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}
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

function CommunityPostCard({ post, community, Icon }: { post: Post; community: Community; Icon: typeof Car }) {
  const [broken, setBroken] = useState(false);
  const img = post.image ?? post.images?.[0];
  const showAvatar = Boolean(community.avatarImage);
  return (
    <Card className="overflow-hidden shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
      <div className="flex items-center gap-[10px] px-[16px] pt-[14px]">
        <div className="grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-[10px]" style={{ background: "var(--accent-soft)" }}>
          {showAvatar ? (
            <img src={community.avatarImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon size={18} style={{ color: "var(--accent)" }} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{community.name}</div>
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{post.date}</div>
        </div>
      </div>
      <div className="px-[16px] pb-[12px] pt-[10px]">
        <h3 className="font-display text-[16px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>{post.title}</h3>
        <p className="mt-[6px] text-[14px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>{post.text}</p>
      </div>
      {img && !broken && (
        <div className="aspect-video overflow-hidden" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        </div>
      )}
      <div className="flex items-center gap-[18px] px-[16px] py-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
        <span className="inline-flex items-center gap-[6px]"><Heart size={15} /> {post.likes}</span>
        <span className="inline-flex items-center gap-[6px]"><MessageCircle size={15} /> {post.comments}</span>
      </div>
    </Card>
  );
}

function DiscussionRow({ d }: { d: DemoDiscussion }) {
  return (
    <div className="flex items-center gap-[12px] px-[16px] py-[12px] transition-colors hover:bg-[var(--background-surface)]" style={{ borderTop: "1px solid var(--border)" }}>
      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <MessagesSquare size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{d.title}</div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{d.replies} ответов · {d.lastActivity}</div>
      </div>
      <ChevronRight size={16} style={{ color: "var(--foreground-30)" }} />
    </div>
  );
}

function EventCard({ e, onSignup }: { e: DemoCommunityEvent; onSignup: (e: DemoCommunityEvent) => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <Card className="overflow-hidden shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
      <div className="relative h-[140px] w-full overflow-hidden" style={{ background: "var(--background-surface)" }}>
        {!broken ? (
          <img src={e.cover} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-muted))", color: "#fff" }}>
            <CalendarDays size={30} />
          </div>
        )}
        <span className="absolute left-[12px] top-[12px] inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[12px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
          <CalendarDays size={13} /> {e.date}
        </span>
      </div>
      <div className="p-[16px]">
        <h3 className="font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{e.title}</h3>
        <div className="mt-[6px] flex items-center gap-[6px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          <MapPin size={13} /> {e.place}
        </div>
        <div className="mt-[12px] flex items-center justify-between gap-[8px]">
          <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>{e.attendees}</span> идут
          </span>
          <Button onClick={() => onSignup(e)} size="sm" className="gap-[6px] rounded-[10px]">
            <CalendarDays size={14} /> Записаться
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MemberRow({ m }: { m: DemoCommunityMember }) {
  const { user, role } = m;
  return (
    <Link to="/user/$id" params={{ id: user.id }} className="flex items-center gap-[12px] px-[16px] py-[10px] transition-colors hover:bg-[var(--background-surface)]" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="relative">
        <Avatar className="h-[42px] w-[42px]">
          <AvatarImage src={user.avatar} alt="" />
          <AvatarFallback className="text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        {user.online && (
          <span className="absolute -bottom-[1px] -right-[1px] h-[12px] w-[12px] rounded-full" style={{ background: "#22c55e", border: "2px solid var(--background)" }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{user.name}</div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{user.city}</div>
      </div>
      <span className="shrink-0 rounded-full px-[10px] py-[3px] text-[11px] font-semibold" style={{
        background: role === "Администратор" ? "var(--accent-soft)" : "var(--background-surface)",
        color: role === "Администратор" ? "var(--accent)" : "var(--foreground-50)",
      }}>{role}</span>
    </Link>
  );
}

/* ============================ Right rail ============================ */

function CommunityRightRail({
  community, members, events, onSignup,
}: {
  community: Community;
  members: DemoCommunityMember[];
  events: DemoCommunityEvent[];
  onSignup: (e: DemoCommunityEvent) => void;
}) {
  const online = members.filter((m) => m.user.online).slice(0, 8);
  const similar = useMemo(
    () => (isDemoMode() ? demoCommunities().filter((c) => c.id !== community.id && c.category === community.category).slice(0, 3) : []),
    [community.id, community.category],
  );
  const fallbackSimilar = useMemo(
    () => (similar.length === 0 && isDemoMode() ? demoCommunities().filter((c) => c.id !== community.id).slice(0, 3) : similar),
    [similar, community.id],
  );

  return (
    <aside className="hidden xl:block w-72 shrink-0">
      <div className="flex h-full flex-col gap-[14px] overflow-y-auto py-[2px] pr-[2px]" style={{ scrollbarWidth: "thin" }}>
        {/* Online members */}
        {online.length > 0 && (
          <Card className="p-[14px] shadow-none" style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Участники онлайн</h3>
            <div className="mt-[10px] flex flex-wrap gap-[8px]">
              {online.map((m) => (
                <Link key={m.user.id} to="/user/$id" params={{ id: m.user.id }} title={m.user.name}>
                  <Avatar className="h-[40px] w-[40px]">
                    <AvatarImage src={m.user.avatar} alt="" />
                    <AvatarFallback className="text-[12px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
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
          <Card className="p-[14px] shadow-none" style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Ближайшие события</h3>
            <div className="mt-[10px] flex flex-col gap-[10px]">
              {events.slice(0, 2).map((e) => (
                <button key={e.id} onClick={() => onSignup(e)} className="flex items-start gap-[10px] text-left">
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <CalendarDays size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{e.title}</span>
                    <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>{e.date}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Similar communities */}
        {fallbackSimilar.length > 0 && (
          <Card className="p-[14px] shadow-none" style={{ background: "var(--background-elevated)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Похожие сообщества</h3>
            <div className="mt-[10px] flex flex-col gap-[8px]">
              {fallbackSimilar.map((c) => {
                const CIcon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                return (
                  <Link key={c.id} to="/communities/$id" params={{ id: c.id }} className="flex items-center gap-[10px] rounded-[10px] p-[6px] transition-colors hover:bg-[var(--background-surface)]">
                    <span className="grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-[10px]" style={{ background: "var(--accent-soft)" }}>
                      {c.avatarImage ? <img src={c.avatarImage} alt="" className="h-full w-full object-cover" /> : <CIcon size={16} style={{ color: "var(--accent)" }} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{c.name}</span>
                      <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>{c.members.toLocaleString("ru")} участников</span>
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

function EventSignupModal({ event, onClose }: { event: DemoCommunityEvent | null; onClose: () => void }) {
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
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full rounded-t-[20px] p-[22px] sm:max-w-[420px] sm:rounded-[18px]"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
          >
            <div className="grid h-[44px] w-[44px] place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <CalendarDays size={22} />
            </div>
            <h3 className="mt-[14px] text-[18px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
              Заявка отправлена
            </h3>
            <p className="mt-[6px] text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
              {event.title} · {event.date}
            </p>
            <p className="mt-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Demo mode: запись на мероприятие сохранена. На боевой версии здесь будет форма участника и подтверждение.
            </p>
            <button
              type="button" onClick={onClose}
              className="mt-[18px] h-[44px] w-full rounded-[12px] text-[14px] font-semibold text-white transition-transform active:scale-[0.99]"
              style={{ background: "var(--accent)" }}
            >
              Понятно
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================ Page ============================ */

function CommunityDetailPage() {
  const { id } = Route.useParams();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [brokenCover, setBrokenCover] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [tab, setTab] = useState<TabKey>("posts");
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [signupEvent, setSignupEvent] = useState<DemoCommunityEvent | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setBrokenCover(false);
    setBrokenAvatar(false);
    setTab("posts");
    fetchCommunity(id)
      .then((c) => {
        if (!alive) return;
        setCommunity(c);
        setJoined(Boolean(c.joined));
        setMembers(c.members);
      })
      .catch(() => alive && setCommunity(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  // Demo content for the tabs (backend not wired yet → empty in production).
  const demo = isDemoMode();
  const posts = useMemo(() => (community && demo ? demoCommunityPosts(community.id) : []), [community, demo]);
  const discussions = useMemo(() => (community && demo ? demoCommunityDiscussions(community.id) : []), [community, demo]);
  const events = useMemo(() => (community && demo ? demoCommunityEvents(community.id) : []), [community, demo]);
  const memberList = useMemo(() => (community && demo ? demoCommunityMembers(community.id) : []), [community, demo]);

  if (loading) return <LoadingSkeleton />;

  if (!community) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-[40px]">
          <EmptyState icon={Users} title="Сообщество не найдено" description="Возможно, оно было удалено или ссылка некорректна">
            <Button asChild className="rounded-[10px] px-[20px]">
              <Link to="/communities">Все сообщества</Link>
            </Button>
          </EmptyState>
        </div>
      </AppLayout>
    );
  }

  const Icon = ICON_MAP[community.avatarIcon ?? "Users"] ?? Users;
  const admin = community.adminId ? userById(community.adminId) : null;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const showCover = Boolean(community.coverImage) && !brokenCover;
  const showAvatar = Boolean(community.avatarImage) && !brokenAvatar;

  const toggleJoin = async () => {
    if (busy) return;
    setBusy(true);
    const next = !joined;
    // optimistic
    setJoined(next);
    setMembers((m) => Math.max(0, m + (next ? 1 : -1)));
    try {
      if (next) await joinCommunity(community.id);
      else await leaveCommunity(community.id);
    } catch {
      // revert on failure
      setJoined(!next);
      setMembers((m) => Math.max(0, m + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  const rail = demo ? (
    <CommunityRightRail community={community} members={memberList} events={events} onSignup={setSignupEvent} />
  ) : false;

  return (
    <AppLayout rightColumn={rail}>
      <div className="space-y-[16px]">
        {/* Hero: cover + avatar + identity + actions */}
        <Card className="overflow-hidden shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}>
          <div className="relative">
            {showCover ? (
              <img
                src={community.coverImage} alt="" className="w-full object-cover"
                style={{ height: "min(220px, 38vw)" }} onError={() => setBrokenCover(true)}
              />
            ) : (
              <div className="relative w-full overflow-hidden" style={{ height: 200, background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }}>
                <div className="absolute inset-0 grid place-items-center opacity-25">
                  <Icon size={90} color="#fff" />
                </div>
              </div>
            )}
          </div>

          <div className="relative px-[16px] pb-[16px] sm:px-[24px]">
            <div className="-mt-[36px] flex items-end gap-[12px]">
              <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden sm:h-[88px] sm:w-[88px]" style={{ background: "var(--background)", border: "4px solid var(--background)", borderRadius: 18 }}>
                {showAvatar ? (
                  <img src={community.avatarImage} alt="" className="h-full w-full object-cover" onError={() => setBrokenAvatar(true)} />
                ) : (
                  <div className="grid h-full w-full place-items-center" style={{ background: "var(--accent-soft)" }}>
                    <Icon size={34} style={{ color: "var(--accent)" }} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-[6px]">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                  {community.category}
                </span>
                <h1 className="font-display text-[20px] font-bold leading-tight sm:text-[26px]" style={{ color: "var(--foreground)" }}>
                  {community.name}
                </h1>
              </div>
            </div>

            <div className="mt-[12px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
              <span className="inline-flex items-center gap-[6px]">
                <Users size={14} />
                <span><span className="font-semibold" style={{ color: "var(--foreground)" }}>{members.toLocaleString("ru")}</span> участников</span>
              </span>
              {joined && (
                <span className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[2px] text-[12px] font-semibold" style={{ background: "var(--success-soft, var(--accent-soft))", color: "var(--success, var(--accent))" }}>
                  <Check size={13} /> Вы подписаны
                </span>
              )}
            </div>

            <p className="mt-[12px] text-[14px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>
              {community.description}
            </p>

            {/* CTA row */}
            <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row sm:flex-wrap">
              <Button
                onClick={toggleJoin}
                disabled={busy}
                variant={joined ? "outline" : "default"}
                size="lg"
                className="w-full gap-[8px] rounded-[12px] sm:w-auto"
              >
                {joined ? <><Check size={16} /> Вы подписаны</> : <><Plus size={16} /> Подписаться</>}
              </Button>
              {community.allowSubmitPost && (
                <Button onClick={() => setSubmitOpen(true)} variant="outline" size="lg" className="w-full gap-[8px] rounded-[12px] sm:w-auto">
                  <FilePlus size={16} /> Предложить проект
                </Button>
              )}
              <Button variant="outline" onClick={() => setShareOpen(true)} size="lg" className="w-full gap-[8px] rounded-[12px] sm:w-auto">
                <Share2 size={16} /> Поделиться
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <nav role="tablist" className="flex items-center gap-[2px] overflow-x-auto no-scrollbar" style={{ borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === "posts" ? posts.length :
              t.key === "discussions" ? discussions.length :
              t.key === "events" ? events.length :
              t.key === "members" ? memberList.length : 0;
            return (
              <button
                key={t.key} role="tab" aria-selected={active}
                onClick={() => setTab(t.key)}
                className="relative inline-flex shrink-0 items-center gap-[6px] px-[14px] py-[12px] text-[14px] font-semibold transition-colors"
                style={{ color: active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {t.label}
                {count > 0 && t.key !== "about" && (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center px-[5px] text-[11px] font-bold" style={{ background: active ? "var(--accent-soft)" : "var(--background-surface)", color: active ? "var(--accent)" : "var(--foreground-50)", borderRadius: "var(--r-pill)" }}>
                    {count}
                  </span>
                )}
                {active && (
                  <motion.span layoutId="community-tab-underline" className="absolute bottom-[-1px] left-[8px] right-[8px]" style={{ height: 3, background: "var(--accent)", borderRadius: 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        {tab === "posts" && (
          posts.length > 0 ? (
            <div className="space-y-[16px]">
              {posts.map((p) => <CommunityPostCard key={p.id} post={p} community={community} Icon={Icon} />)}
            </div>
          ) : (
            <EmptyState icon={ImageOff} title="Пока нет постов" description="Здесь появятся публикации сообщества" variant="compact" />
          )
        )}

        {tab === "discussions" && (
          discussions.length > 0 ? (
            <Card className="overflow-hidden shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
              <h2 className="px-[16px] pt-[16px] font-display text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>Обсуждения</h2>
              <div className="mt-[8px]">{discussions.map((d) => <DiscussionRow key={d.id} d={d} />)}</div>
            </Card>
          ) : (
            <EmptyState icon={MessagesSquare} title="Пока нет обсуждений" description="Начните первую тему в сообществе" variant="compact" />
          )
        )}

        {tab === "events" && (
          events.length > 0 ? (
            <div className="grid gap-[16px] sm:grid-cols-2">
              {events.map((e) => <EventCard key={e.id} e={e} onSignup={setSignupEvent} />)}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Пока нет мероприятий" description="Скоро здесь появятся заезды и встречи" variant="compact" />
          )
        )}

        {tab === "members" && (
          memberList.length > 0 ? (
            <Card className="overflow-hidden shadow-none" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
              <h2 className="px-[16px] pt-[16px] font-display text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>Участники</h2>
              <div className="mt-[8px]">{memberList.map((m) => <MemberRow key={m.user.id} m={m} />)}</div>
            </Card>
          ) : (
            <EmptyState icon={Users} title="Список участников недоступен" variant="compact" />
          )
        )}

        {tab === "about" && (
          <div className="space-y-[16px]">
            <Card className="px-[16px] py-[20px] shadow-none sm:px-[24px]" style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
              <h2 className="font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>О сообществе</h2>
              <p className="mt-[8px] whitespace-pre-line text-[14px] leading-[1.65]" style={{ color: "var(--foreground-70)" }}>
                {community.fullDescription || community.description}
              </p>
              {admin && (
                <Link to="/user/$id" params={{ id: admin.id }} className="mt-[16px] inline-flex items-center gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                  <Avatar className="h-[28px] w-[28px]">
                    <AvatarImage src={admin.avatar} alt="" />
                    <AvatarFallback className="text-[11px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>Администратор: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{admin.name}</span></span>
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
          <Button asChild variant="ghost" className="gap-[6px] rounded-[10px] text-[13px]">
            <Link to="/communities"><ArrowLeft size={14} /> Все сообщества</Link>
          </Button>
        </div>
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} url={url} title={community.name} />
      <SubmitPostSheet open={submitOpen} onOpenChange={setSubmitOpen} communityName={community.name} />
      <EventSignupModal event={signupEvent} onClose={() => setSignupEvent(null)} />
    </AppLayout>
  );
}
