import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchUserProfile } from "@/lib/api/catalog";
import { avatarUrl } from "@/lib/utils/time";
import type { User } from "@/lib/types";

export const Route = createFileRoute("/user/$id")({
  head: () => ({ meta: [{ title: tStatic("profile.metaTitle") }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchUserProfile(id).then((data) => {
      setUser({
        id,
        slug: (data.slug as string) ?? id,
        displayName: (data.display_name as string) ?? "User",
        avatar: (data.avatar as { url?: string })?.url ?? avatarUrl(String(data.display_name ?? "User")),
        bio: (data.bio as string) ?? "",
        city: (data.city as string) ?? "",
        interests: (data.interests as string) ?? "",
      });
    }).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center">{t("common.loading")}</div></AppLayout>;
  }

  if (!user) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center">{t("profile.notFound")}</div></AppLayout>;
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="overflow-hidden rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-4">
          <img src={user.avatar ?? avatarUrl(user.displayName)} alt="" className="h-20 w-20 rounded-full" />
          <div>
            <h1 className="font-display text-[24px] font-bold">{user.displayName}</h1>
            {user.city && <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{user.city}</p>}
          </div>
        </div>
        {user.bio && <p className="mt-4 text-[14px]" style={{ color: "var(--foreground-70)" }}>{user.bio}</p>}
      </div>
    </AppLayout>
  );
}
