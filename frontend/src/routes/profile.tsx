import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/utils/time";
import { fetchUserProfile } from "@/lib/api/catalog";
import type { User } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: tStatic("profile.metaTitle") }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { user, displayName, slug, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    if (!slug) return;
    void fetchUserProfile(slug).then((data) => {
      setProfile({
        slug: slug ?? "",
        displayName: (data.display_name as string) ?? displayName ?? "",
        avatar: (data.avatar as { url?: string })?.url ?? avatarUrl(displayName ?? "User"),
        bio: (data.bio as string) ?? "",
        city: (data.city as string) ?? "",
        interests: (data.interests as string) ?? "",
      });
    }).catch(() => {
      setProfile({
        slug: slug ?? "",
        displayName: displayName ?? "User",
        avatar: avatarUrl(displayName ?? "User"),
      });
    });
  }, [slug, displayName]);

  if (!isAuthenticated) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-20 text-center">{t("auth.loginRequired")}</div>
      </AppLayout>
    );
  }

  const p = profile ?? { slug: slug ?? "", displayName: displayName ?? "User", avatar: avatarUrl(displayName ?? "User") };

  return (
    <AppLayout rightColumn={false}>
      <div className="overflow-hidden rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-4">
          <img src={p.avatar ?? avatarUrl(p.displayName)} alt="" className="h-20 w-20 rounded-full" />
          <div>
            <h1 className="font-display text-[24px] font-bold">{p.displayName}</h1>
            {p.city && <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{p.city}</p>}
          </div>
        </div>
        {p.bio && <p className="mt-4 text-[14px]" style={{ color: "var(--foreground-70)" }}>{p.bio}</p>}
        <div className="mt-8 grid gap-4">
          <section>
            <h2 className="font-semibold">{t("profile.tabPosts")}</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("feed.emptyDefaultDesc")}</p>
          </section>
          <section>
            <h2 className="font-semibold">{t("profile.tabAds")}</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("ads.emptyActiveDesc")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
