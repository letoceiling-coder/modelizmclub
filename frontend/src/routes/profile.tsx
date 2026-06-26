import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Pencil, Check, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/utils/time";
import { fetchUserProfile, updateMyProfile } from "@/lib/api/catalog";
import { uploadMedia } from "@/lib/api/media";
import { fetchFeed } from "@/lib/api/feed";
import { fetchMyListings } from "@/lib/api/listings";
import { PostCard } from "@/components/PostCard";
import type { Post, Listing } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: tStatic("profile.metaTitle") }] }),
  component: ProfilePage,
});

interface ProfileVM {
  id?: number;
  slug: string;
  displayName: string;
  avatar: string;
  bio: string;
  city: string;
}

function ProfilePage() {
  const { t } = useTranslation();
  const { displayName, slug, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<ProfileVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    void fetchUserProfile(slug)
      .then((data) => {
        const vm: ProfileVM = {
          id: typeof data.id === "number" ? data.id : undefined,
          slug: (data.slug as string) ?? slug,
          displayName: (data.display_name as string) ?? displayName ?? "",
          avatar: (data.avatar as { url?: string } | null)?.url ?? avatarUrl(displayName ?? "User"),
          bio: (data.bio as string) ?? "",
          city: (data.city as { name?: string } | null)?.name ?? "",
        };
        setProfile(vm);
        setEditName(vm.displayName);
        setEditBio(vm.bio);
        if (vm.id) {
          void fetchFeed({ author_id: vm.id, per_page: 20 }).then((r) => setPosts(r.posts)).catch(() => setPosts([]));
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    void fetchMyListings().then(setListings).catch(() => setListings([]));
  }, [slug, displayName]);

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    try {
      const media = await uploadMedia(file, "avatar");
      await updateMyProfile({ avatar_media_uuid: media.uuid });
      setProfile((p) => (p ? { ...p, avatar: media.url ?? p.avatar } : p));
      toast.success(t("profile.avatarUpdated"));
    } catch {
      toast.error(t("profile.avatarError"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveEdit = async () => {
    if (!editName.trim()) return toast.error(t("profile.nameRequired"));
    setSaving(true);
    try {
      await updateMyProfile({ display_name: editName.trim(), bio: editBio.trim() });
      setProfile((p) => (p ? { ...p, displayName: editName.trim(), bio: editBio.trim() } : p));
      setEditing(false);
      toast.success(t("profile.saved"));
    } catch {
      toast.error(t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-20 text-center">{t("auth.loginRequired")}</div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-20 text-center" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div>
      </AppLayout>
    );
  }

  const p = profile ?? { slug: slug ?? "", displayName: displayName ?? "User", avatar: avatarUrl(displayName ?? "User"), bio: "", city: "" };

  return (
    <AppLayout rightColumn={false}>
      <div className="flex flex-col gap-[20px]">
        <div className="overflow-hidden rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
          <div className="flex items-start gap-4">
            <div className="relative">
              <img src={p.avatar ?? avatarUrl(p.displayName)} alt="" className="h-20 w-20 rounded-full object-cover" style={{ opacity: avatarUploading ? 0.5 : 1 }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full"
                style={{ background: "var(--accent)", color: "#fff", border: "2px solid var(--background-elevated)" }}
                aria-label={t("profile.changeAvatar")}
              >
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPickAvatar(e)} />
            </div>

            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    placeholder={t("profile.namePlaceholder")}
                  />
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    placeholder={t("profile.bioPlaceholder")}
                  />
                  <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={() => void saveEdit()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "#fff" }}>
                      <Check size={14} /> {t("common.save")}
                    </button>
                    <button type="button" onClick={() => { setEditing(false); setEditName(p.displayName); setEditBio(p.bio ?? ""); }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}>
                      <X size={14} /> {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-[24px] font-bold">{p.displayName}</h1>
                    <button type="button" onClick={() => setEditing(true)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--background-surface)]" style={{ color: "var(--foreground-50)" }} aria-label={t("profile.edit")}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  {p.city && <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{p.city}</p>}
                  {p.bio && <p className="mt-2 text-[14px]" style={{ color: "var(--foreground-70)" }}>{p.bio}</p>}
                </>
              )}
            </div>
          </div>
        </div>

        <section>
          <h2 className="mb-3 font-semibold">{t("profile.tabPosts")}</h2>
          {posts.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("feed.emptyDefaultDesc")}</p>
          ) : (
            <div className="flex flex-col gap-[16px]">
              {posts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold">{t("profile.tabAds")}</h2>
          {listings.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("ads.emptyActiveDesc")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {listings.map((ad) => (
                <div key={ad.id} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  {ad.image && <img src={ad.image} alt="" className="aspect-[4/3] w-full object-cover" />}
                  <div className="p-3">
                    <div className="text-[14px] font-semibold">{ad.title}</div>
                    <div className="font-display text-[16px] font-bold">{ad.price.toLocaleString("ru")} ₽</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
