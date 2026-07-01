import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { User } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import {
  fetchPublicProfile, sendFriendRequest, followUser, unfollowUser,
  type PublicProfile,
} from "@/lib/api/social";
import { createConversation } from "@/lib/api/chat";
import { ProfileView } from "./profile";
import { toast } from "sonner";

export const Route = createFileRoute("/user/$id")({
  head: () => ({ meta: [{ title: "Профиль — МоДелизМ" }] }),
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const me = useStore(selectors.currentUser);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchPublicProfile(id)
      .then((p) => { if (active) { setProfile(p); setLoading(false); } })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex items-center justify-center py-[120px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          Загрузка…
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>Пользователь не найден</div>
          <Link to="/friends" className="mt-[16px] inline-flex font-semibold" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14, alignItems: "center" }}>
            К списку друзей
          </Link>
        </div>
      </AppLayout>
    );
  }

  const user: User = profile.user;

  const toggleFriend = async () => {
    if (!user.numericId) return;
    await sendFriendRequest(user.numericId);
  };

  const toggleFollow = async (next: boolean) => {
    if (!user.numericId) return;
    if (next) await followUser(user.numericId);
    else await unfollowUser(user.numericId);
  };

  const write = async () => {
    if (!user.numericId || !me) {
      toast.error("Не удалось открыть диалог");
      return;
    }
    const dialog = await createConversation(user.numericId, me.id);
    navigate({ to: "/messenger", search: { chat: dialog.id } });
  };

  return (
    <ProfileView
      user={user}
      isOwn={false}
      stats={{ publications: profile.stats.publications }}
      isFollowingInitial={profile.isFollowing}
      onToggleFriend={toggleFriend}
      onToggleFollow={toggleFollow}
      onWrite={write}
    />
  );
}
