import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, BadgeCheck, Radio } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchCommunity, fetchCommunityPosts, joinCommunity, leaveCommunity } from "@/lib/api/communities";
import type { Community, Post } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { formatCount } from "@/lib/utils/format";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/channel/$id")({
  head: () => ({ meta: [{ title: tStatic("channels.metaTitleFallback") }] }),
  component: ChannelPage,
});

function ChannelPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { isAuthenticated } = useAuth();
  const [channel, setChannel] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await fetchCommunity(id);
      if (cancelled) return;
      if (!c) {
        setLoading(false);
        return;
      }
      setChannel(c);
      const p = await fetchCommunityPosts(id);
      if (!cancelled) {
        setPosts(p);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-20 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div>
      </AppLayout>
    );
  }

  if (!channel) {
    throw notFound();
  }

  const toggleSub = async () => {
    if (!isAuthenticated) {
      toast.error(t("auth.loginRequired"));
      return;
    }
    try {
      if (channel.joined) {
        await leaveCommunity(channel.id);
        setChannel({ ...channel, joined: false, members: Math.max(0, channel.members - 1) });
      } else {
        await joinCommunity(channel.id);
        setChannel({ ...channel, joined: true, members: channel.members + 1 });
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-4">
        <Link to="/channels" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--foreground-70)" }}>
          <ArrowLeft size={14} />{t("channels.allChannels")}
        </Link>
        <section className="overflow-hidden rounded-2xl border p-5" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-xl font-bold text-white" style={{ background: "var(--accent)" }}>{channel.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[22px] font-bold">{channel.name}</h1>
                {channel.isOfficial && <BadgeCheck size={18} style={{ color: "var(--accent)" }} />}
              </div>
              <p className="mt-2 text-[14px]" style={{ color: "var(--foreground-70)" }}>{channel.description}</p>
              <div className="mt-3 flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>
                <Users size={14} /> {formatCount(channel.members)} {t("common.subscribers")}
              </div>
              <button onClick={() => void toggleSub()} className="mt-4 inline-flex h-10 items-center px-5 text-[14px] font-semibold rounded-xl" style={{ background: channel.joined ? "transparent" : "var(--accent)", color: channel.joined ? "var(--foreground)" : "white", border: channel.joined ? "1px solid var(--border)" : "none" }}>
                {channel.joined ? t("channels.subscribed") : t("channels.subscribe")}
              </button>
            </div>
          </div>
        </section>
        {posts.length === 0 ? (
          <div className="py-12 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("channels.emptyPosts")}</div>
        ) : (
          <div className="space-y-4">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        )}
      </div>
    </AppLayout>
  );
}
