import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Car, Plane, Ship, Send as SendIcon, Code2, Wrench, Cpu, BatteryCharging, Users,
  Share2, Globe, Phone, MessageCircle, FilePlus,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Community, CommunityContacts } from "@/lib/types";
import { fetchCommunity, fetchCommunityPosts, joinCommunity, leaveCommunity } from "@/lib/api/communities";
import { ShareSheet } from "@/components/communities/ShareSheet";
import { SubmitPostSheet } from "@/components/communities/SubmitPostSheet";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/communities/$id")({
  head: () => ({ meta: [{ title: tStatic("communities.metaFallback") }] }),
  component: CommunityDetailPage,
});

const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send: SendIcon, Code2, Wrench, Cpu, BatteryCharging,
};

function ContactsBlock({ contacts }: { contacts?: CommunityContacts }) {
  const { t } = useTranslation();
  if (!contacts) return null;
  const rows: { icon: typeof Globe; label: string; value: string; href: string; external?: boolean }[] = [];
  if (contacts.website) rows.push({ icon: Globe, label: t("communities.contactWebsite"), value: contacts.website, href: contacts.website, external: true });
  if (contacts.phone) rows.push({ icon: Phone, label: t("communities.contactPhone"), value: contacts.phone, href: `tel:${contacts.phone.replace(/\s/g, "")}` });
  if (contacts.telegram) rows.push({ icon: MessageCircle, label: "Telegram", value: contacts.telegram, href: contacts.telegram.startsWith("http") ? contacts.telegram : `https://t.me/${contacts.telegram.replace("@", "")}`, external: true });
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-[14px] border" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
      <h3 className="px-[16px] pt-[16px] text-[12px] font-semibold uppercase" style={{ color: "var(--foreground-50)" }}>{t("communities.contactsTitle")}</h3>
      {rows.map((r) => (
        <a key={r.label} href={r.href} target={r.external ? "_blank" : undefined} rel={r.external ? "noopener noreferrer" : undefined} className="flex items-center gap-[12px] px-[16px] py-[12px] border-t" style={{ borderColor: "var(--border)" }}>
          <r.icon size={16} style={{ color: "var(--accent)" }} />
          <span className="text-[14px]">{r.value}</span>
        </a>
      ))}
    </section>
  );
}

function CommunityDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { isAuthenticated } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await fetchCommunity(id);
      if (cancelled) return;
      setCommunity(c);
      if (c) {
        const p = await fetchCommunityPosts(id);
        if (!cancelled) setPosts(p);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center">{t("common.loading")}</div></AppLayout>;
  }

  if (!community) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center py-[120px]">
          <div className="font-display text-[22px] font-bold">{t("communities.notFound")}</div>
          <Link to="/communities" className="mt-[16px] font-semibold" style={{ color: "var(--accent)" }}>{t("communities.allCommunities")}</Link>
        </div>
      </AppLayout>
    );
  }

  const Icon = ICON_MAP[community.avatarIcon ?? "Users"] ?? Users;
  const url = typeof window !== "undefined" ? window.location.href : "";

  const toggleJoin = async () => {
    if (!isAuthenticated) { toast.error(t("auth.loginRequired")); return; }
    try {
      if (community.joined) {
        await leaveCommunity(community.id);
        setCommunity({ ...community, joined: false, members: Math.max(0, community.members - 1) });
      } else {
        await joinCommunity(community.id);
        setCommunity({ ...community, joined: true, members: community.members + 1 });
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px]">
        <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <div className="h-[200px]" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
          <div className="relative px-[16px] pb-[16px]">
            <div className="-mt-[36px] flex items-end gap-[12px]">
              <div className="grid h-[72px] w-[72px] place-items-center rounded-[18px] border-4" style={{ background: "var(--background)", borderColor: "var(--background)" }}>
                <Icon size={34} style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[22px] font-bold">{community.name}</h1>
                <div className="mt-1 text-[13px]" style={{ color: "var(--foreground-50)" }}><Users size={14} className="inline" /> {community.members.toLocaleString("ru")}</div>
              </div>
            </div>
            <p className="mt-[12px] text-[14px]" style={{ color: "var(--foreground-70)" }}>{community.description}</p>
            <div className="mt-[16px] flex gap-[8px]">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => void toggleJoin()} className="inline-flex h-11 items-center px-5 font-semibold rounded-xl" style={{ background: community.joined ? "transparent" : "var(--accent)", color: community.joined ? "var(--foreground)" : "white", border: community.joined ? "1px solid var(--border)" : "none" }}>
                {community.joined ? t("communities.leave") : t("communities.join")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShareOpen(true)} className="inline-flex h-11 items-center gap-2 px-5 font-semibold rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <Share2 size={16} />{t("post.menuShare")}
              </motion.button>
            </div>
          </div>
        </div>
        <ContactsBlock contacts={community.contacts} />
        {posts.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold">{t("communities.posts")}</h2>
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </section>
        )}
      </div>
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} url={url} title={community.name} />
      <SubmitPostSheet open={submitOpen} onOpenChange={setSubmitOpen} communityName={community.name} />
    </AppLayout>
  );
}
