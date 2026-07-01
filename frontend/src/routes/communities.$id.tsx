import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging, Users,
  Share2, Globe, Phone, MessageCircle, FilePlus, ImageOff, ArrowLeft,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById } from "@/lib/mock";
import type { Community, CommunityContacts } from "@/lib/mock";
import { fetchCommunity } from "@/lib/api/communities";
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

function tgLink(value: string): string {
  if (value.startsWith("http")) return value;
  const handle = value.startsWith("@") ? value.slice(1) : value;
  return `https://t.me/${handle}`;
}
function tgLabel(value: string): string {
  if (value.startsWith("http")) {
    try { return "@" + new URL(value).pathname.replace(/^\//, ""); } catch { return value; }
  }
  return value.startsWith("@") ? value : `@${value}`;
}
function siteLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function adminInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ContactsBlock({ contacts }: { contacts?: CommunityContacts }) {
  if (!contacts) return null;
  const rows: { icon: typeof Globe; label: string; value: string; href: string; external?: boolean }[] = [];
  if (contacts.website)
    rows.push({ icon: Globe, label: "Сайт", value: siteLabel(contacts.website), href: contacts.website, external: true });
  if (contacts.phone)
    rows.push({ icon: Phone, label: "Телефон", value: contacts.phone, href: `tel:${contacts.phone.replace(/\s/g, "")}` });
  if (contacts.telegram)
    rows.push({ icon: MessageCircle, label: "Telegram", value: tgLabel(contacts.telegram), href: tgLink(contacts.telegram), external: true });
  if (rows.length === 0) return null;

  return (
    <Card
      className="overflow-hidden shadow-none"
      style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 14 }}
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

function CommunityDetailPage() {
  const { id } = Route.useParams();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [brokenCover, setBrokenCover] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setBrokenCover(false);
    setBrokenAvatar(false);
    fetchCommunity(id)
      .then((c) => {
        if (alive) setCommunity(c);
      })
      .catch(() => {
        if (alive) setCommunity(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <LoadingSkeleton />;

  if (!community) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-[40px]">
          <EmptyState
            icon={Users}
            title="Сообщество не найдено"
            description="Возможно, оно было удалено или ссылка некорректна"
          >
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

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        {/* Banner + Avatar */}
        <Card
          className="overflow-hidden shadow-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}
        >
          <div className="relative">
            {showCover ? (
              <img
                src={community.coverImage}
                alt=""
                className="w-full object-cover"
                style={{ height: "min(220px, 38vw)" }}
                onError={() => setBrokenCover(true)}
              />
            ) : (
              <div
                className="w-full"
                style={{ height: 200, background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }}
              />
            )}
          </div>

          <div className="relative px-[16px] pb-[16px] sm:px-[24px]">
            {/* avatar overlapping */}
            <div className="-mt-[36px] flex items-end gap-[12px]">
              <div
                className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden sm:h-[88px] sm:w-[88px]"
                style={{ background: "var(--background)", border: "4px solid var(--background)", borderRadius: 18 }}
              >
                {showAvatar ? (
                  <img
                    src={community.avatarImage}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setBrokenAvatar(true)}
                  />
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
                <h1
                  className="font-display text-[20px] font-bold leading-tight sm:text-[26px]"
                  style={{ color: "var(--foreground)" }}
                >
                  {community.name}
                </h1>
              </div>
            </div>

            <div className="mt-[12px] flex items-center gap-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
              <Users size={14} />
              <span>
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                  {community.members.toLocaleString("ru")}
                </span>{" "}
                участников
              </span>
            </div>

            <p className="mt-[12px] text-[14px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>
              {community.description}
            </p>

            {/* CTA */}
            <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row">
              {community.allowSubmitPost && (
                <Button
                  onClick={() => setSubmitOpen(true)}
                  className="w-full gap-[8px] rounded-[12px] sm:w-auto"
                  size="lg"
                >
                  <FilePlus size={16} /> Предложить пост
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                className="w-full gap-[8px] rounded-[12px] sm:w-auto"
                size="lg"
              >
                <Share2 size={16} /> Поделиться
              </Button>
            </div>
          </div>
        </Card>

        {/* Full description */}
        {community.fullDescription && (
          <Card
            className="px-[16px] py-[20px] shadow-none sm:px-[24px]"
            style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 14 }}
          >
            <h2 className="font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
              О сообществе
            </h2>
            <p className="mt-[8px] text-[14px] leading-[1.65] whitespace-pre-line" style={{ color: "var(--foreground-70)" }}>
              {community.fullDescription}
            </p>
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
                    {adminInitials(admin.name)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  Администратор:{" "}
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {admin.name}
                  </span>
                </span>
              </Link>
            )}
          </Card>
        )}

        {/* Contacts */}
        <ContactsBlock contacts={community.contacts} />

        {/* Back link mobile */}
        <div className="pb-[8px]">
          <Button asChild variant="ghost" className="gap-[6px] rounded-[10px] text-[13px]">
            <Link to="/communities">
              <ArrowLeft size={14} /> Все сообщества
            </Link>
          </Button>
        </div>
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} url={url} title={community.name} />
      <SubmitPostSheet open={submitOpen} onOpenChange={setSubmitOpen} communityName={community.name} />
    </AppLayout>
  );
}
