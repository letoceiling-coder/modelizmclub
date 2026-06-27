import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging, Users,
  Share2, Globe, Phone, MessageCircle, FilePlus,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { communities, communityById, userById } from "@/lib/mock";
import type { CommunityContacts } from "@/lib/mock";
import { fetchCommunity } from "@/lib/api/communities";
import { ShareSheet } from "@/components/communities/ShareSheet";
import { SubmitPostSheet } from "@/components/communities/SubmitPostSheet";

export const Route = createFileRoute("/communities/$id")({
  head: ({ params }) => ({ meta: [{ title: `${communityById(params.id)?.name ?? "Сообщество"} — МоДелизМ Форум` }] }),
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

function ContactsBlock({ contacts }: { contacts?: CommunityContacts }) {
  if (!contacts) return null;
  const rows: { icon: typeof Globe; label: string; value: string; href: string; external?: boolean }[] = [];
  if (contacts.website) rows.push({ icon: Globe, label: "Сайт", value: siteLabel(contacts.website), href: contacts.website, external: true });
  if (contacts.phone) rows.push({ icon: Phone, label: "Телефон", value: contacts.phone, href: `tel:${contacts.phone.replace(/\s/g, "")}` });
  if (contacts.telegram) rows.push({ icon: MessageCircle, label: "Telegram", value: tgLabel(contacts.telegram), href: tgLink(contacts.telegram), external: true });
  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
      <h3 className="px-[16px] pt-[16px] font-display text-[14px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)", fontSize: 12 }}>
        Контакты
      </h3>
      <div className="mt-[8px] flex flex-col">
        {rows.map((r, i) => (
          <a
            key={r.label}
            href={r.href}
            target={r.external ? "_blank" : undefined}
            rel={r.external ? "noopener noreferrer" : undefined}
            className="flex items-center gap-[12px] px-[16px] py-[12px] transition-colors hover:bg-[var(--background-surface)]"
            style={{ borderTop: i === 0 ? "1px solid var(--border)" : "1px solid var(--border)" }}
          >
            <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <r.icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{r.label}</div>
              <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{r.value}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function CommunityDetailPage() {
  const { id } = Route.useParams();
  const [community, setCommunity] = useState(() => communities.find((c) => c.id === id) ?? communityById(id));
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    if (community?.id === id) return;
    let alive = true;
    fetchCommunity(id)
      .then((c) => { if (alive && c) setCommunity(c); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id, community?.id]);

  if (!community) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)" }}>Сообщество не найдено</div>
          <Link to="/communities" className="mt-[16px] inline-flex font-semibold items-center" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}>
            Все сообщества
          </Link>
        </div>
      </AppLayout>
    );
  }

  const Icon = ICON_MAP[community.avatarIcon ?? "Users"] ?? Users;
  const admin = community.adminId ? userById(community.adminId) : null;
  const url = typeof window !== "undefined" ? window.location.href : "";

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        {/* Banner + Avatar */}
        <div className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <div className="relative">
            {community.coverImage ? (
              <img src={community.coverImage} alt="" className="w-full object-cover" style={{ height: "min(220px, 38vw)" }} />
            ) : (
              <div className="w-full" style={{ height: 200, background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
            )}
          </div>

          <div className="relative px-[16px] pb-[16px] sm:px-[24px]">
            {/* avatar overlapping */}
            <div className="-mt-[36px] flex items-end gap-[12px]">
              <div
                className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden sm:h-[88px] sm:w-[88px]"
                style={{ background: "var(--background)", border: "4px solid var(--background)", borderRadius: 18 }}
              >
                {community.avatarImage ? (
                  <img src={community.avatarImage} alt="" className="h-full w-full object-cover" />
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

            <div className="mt-[12px] flex items-center gap-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
              <Users size={14} />
              <span><span className="font-semibold" style={{ color: "var(--foreground)" }}>{community.members.toLocaleString("ru")}</span> участников</span>
            </div>

            <p className="mt-[12px] text-[14px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>
              {community.description}
            </p>

            {/* CTA */}
            <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row">
              {community.allowSubmitPost && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSubmitOpen(true)}
                  className="inline-flex items-center justify-center gap-[8px] font-semibold"
                  style={{
                    height: 44, padding: "0 20px", borderRadius: 12, fontSize: 14,
                    background: "var(--accent)", color: "white",
                  }}
                >
                  <FilePlus size={16} /> Предложить пост
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center justify-center gap-[8px] font-semibold"
                style={{
                  height: 44, padding: "0 20px", borderRadius: 12, fontSize: 14,
                  background: "transparent", color: "var(--foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                <Share2 size={16} /> Поделиться
              </motion.button>
            </div>
          </div>
        </div>

        {/* Full description */}
        {community.fullDescription && (
          <section className="px-[16px] py-[20px] sm:px-[24px]" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <h2 className="font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>О сообществе</h2>
            <p className="mt-[8px] text-[14px] leading-[1.65] whitespace-pre-line" style={{ color: "var(--foreground-70)" }}>
              {community.fullDescription}
            </p>
            {admin && (
              <Link to="/user/$id" params={{ id: admin.id }} className="mt-[16px] inline-flex items-center gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                <img src={admin.avatar} alt="" className="h-[28px] w-[28px] rounded-full object-cover" />
                <span>Администратор: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{admin.name}</span></span>
              </Link>
            )}
          </section>
        )}

        {/* Contacts */}
        <ContactsBlock contacts={community.contacts} />
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} url={url} title={community.name} />
      <SubmitPostSheet open={submitOpen} onOpenChange={setSubmitOpen} communityName={community.name} />
    </AppLayout>
  );
}
