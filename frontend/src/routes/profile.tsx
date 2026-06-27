import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, FileText, MapPin, Pencil, Tag, User as UserIcon,
  UserPlus, Users, X, Plus, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/PostCard";
import { AdCard } from "@/components/AdCard";
import { InvitedFriendsSection } from "@/components/referral/InvitedFriendsSection";
import { useTranslation, tStatic } from "@/lib/i18n";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/utils/time";
import { fetchUserProfile, updateMyProfile, fetchMyInterests, fetchCities } from "@/lib/api/catalog";
import { fetchFeed } from "@/lib/api/feed";
import { fetchMyListings } from "@/lib/api/listings";
import { fetchFriends } from "@/lib/api/friends";
import { fetchCommunities } from "@/lib/api/communities";
import { uploadMedia } from "@/lib/api/media";
import type { Post, Listing, Community, Category } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: tStatic("profile.metaTitle") }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { slug } = useAuth();
  return <ProfileView slug={slug ?? undefined} isOwn />;
}

interface ProfileVM {
  id?: number;
  slug: string;
  name: string;
  avatar: string;
  bio: string;
  city: string;
  cityId?: number;
}

type TabKey = "posts" | "ads" | "communities" | "invited" | "about";

const ICON_MAP: Record<string, typeof Users> = { Users };

type AdStatus = "active" | "moderation" | "rejected" | "archived";

function statusOf(listing: Listing): AdStatus {
  if (listing.moderation === "moderation") return "moderation";
  if (listing.moderation === "rejected") return "rejected";
  if (listing.status === "archived" || listing.status === "unpublished") return "archived";
  return "active";
}

export function ProfileView({ slug, isOwn }: { slug?: string; isOwn: boolean }) {
  const { t } = useTranslation();
  const { displayName, isAuthenticated } = useAuth();

  const [vm, setVm] = useState<ProfileVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabKey>("posts");
  const [adFilter, setAdFilter] = useState<AdStatus | "all">("all");
  const [editOpen, setEditOpen] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [interests, setInterests] = useState<Category[]>([]);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); setNotFound(true); return; }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void fetchUserProfile(slug)
      .then((data) => {
        if (cancelled) return;
        const cityObj = data.city as { id?: number; name?: string } | null;
        const next: ProfileVM = {
          id: typeof data.id === "number" ? data.id : undefined,
          slug: (data.slug as string) ?? slug,
          name: (data.display_name as string) ?? displayName ?? "",
          avatar: (data.avatar as { url?: string } | null)?.url ?? avatarUrl((data.display_name as string) ?? displayName ?? "User"),
          bio: (data.bio as string) ?? "",
          city: cityObj?.name ?? "",
          cityId: cityObj?.id,
        };
        setVm(next);
        const stats = data.stats as { followers_count?: number } | undefined;
        if (next.id) {
          void fetchFeed({ author_id: next.id, per_page: 20 }).then((r) => !cancelled && setPosts(r.posts)).catch(() => setPosts([]));
        }
        if (!isOwn) setFriendsCount(stats?.followers_count ?? 0);
      })
      .catch(() => { if (!cancelled) { setVm(null); setNotFound(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    if (isOwn) {
      void fetchMyListings().then((l) => !cancelled && setListings(l)).catch(() => setListings([]));
      void fetchFriends().then((f) => !cancelled && setFriendsCount(f.length)).catch(() => setFriendsCount(0));
      void fetchCommunities({ per_page: 100 }).then((c) => !cancelled && setCommunities(c.filter((x) => x.joined))).catch(() => setCommunities([]));
      void fetchMyInterests().then((i) => !cancelled && setInterests(i)).catch(() => setInterests([]));
    }
    return () => { cancelled = true; };
  }, [slug, isOwn, displayName]);

  const filteredListings = useMemo(
    () => (adFilter === "all" ? listings : listings.filter((l) => statusOf(l) === adFilter)),
    [listings, adFilter],
  );

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    try {
      const media = await uploadMedia(file, "avatar");
      await updateMyProfile({ avatar_media_uuid: media.uuid });
      setVm((p) => (p ? { ...p, avatar: media.url ?? p.avatar } : p));
      toast.success(t("profile.avatarUpdated"));
    } catch {
      toast.error(t("profile.avatarError"));
    } finally {
      setAvatarUploading(false);
    }
  };

  if (isOwn && !isAuthenticated) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center" style={{ color: "var(--foreground-50)" }}>{t("auth.loginRequired")}</div></AppLayout>;
  }
  if (loading) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center" style={{ color: "var(--foreground-50)" }}>{t("common.loading")}</div></AppLayout>;
  }
  if (notFound || !vm) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>{t("user.notFound")}</div>
        </div>
      </AppLayout>
    );
  }

  const allTabs: { key: TabKey; label: string; Icon: typeof FileText; ownOnly?: boolean }[] = [
    { key: "posts", label: t("profile.tabPosts"), Icon: FileText },
    { key: "ads", label: t("profile.tabAds"), Icon: Tag },
    { key: "communities", label: t("profile.tabCommunities"), Icon: Users },
    { key: "invited", label: t("profile.tabInvited"), Icon: UserPlus, ownOnly: true },
    { key: "about", label: t("profile.tabAbout"), Icon: UserIcon },
  ];
  const tabs = allTabs.filter((x) => isOwn || !x.ownOnly);

  return (
    <AppLayout rightColumn={false}>
      <div className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}>
        {/* Cover */}
        <div className="relative">
          <div className="w-full" style={{ height: "clamp(120px, 22vw, 220px)", background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56px]" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--background) 85%, transparent))" }} />
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-[12px] px-[16px] pb-[16px] md:flex-row md:items-end md:gap-[24px] md:px-[32px]">
          <div className="relative shrink-0" style={{ marginTop: "clamp(-44px, -10vw, -56px)", zIndex: 2 }}>
            <img
              src={vm.avatar}
              alt=""
              className="h-[88px] w-[88px] rounded-full object-cover md:h-[112px] md:w-[112px]"
              style={{ border: "4px solid var(--background)", boxShadow: "0 10px 30px -10px rgba(0,0,0,.45), 0 0 0 1px var(--border)", background: "var(--background)" }}
            />
            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label={t("profile.changeAvatar")}
                  className="absolute bottom-0 right-0 grid h-[32px] w-[32px] place-items-center rounded-full"
                  style={{ background: "var(--accent)", color: "#fff", border: "2px solid var(--background)" }}
                >
                  <Camera size={14} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[6px]">
              <h1 className="min-w-0 truncate font-display text-[18px] font-bold md:text-[24px]" style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}>{vm.name}</h1>
            </div>
            {vm.city && (
              <div className="mt-[3px] flex items-center gap-[6px] text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
                <MapPin size={12} /> {vm.city}
              </div>
            )}
          </div>

          <div className="flex w-full gap-[8px] md:w-auto">
            {isOwn && (
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-[8px] font-medium transition-colors duration-150 md:flex-none"
                style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-70)", fontSize: 14 }}
              >
                <Pencil size={14} /> {t("profile.edit")}
              </button>
            )}
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <Counter label={t("profile.counterPosts")} value={posts.length} divider />
          <Counter label={t("profile.counterAds")} value={listings.length} divider />
          <Counter label={t("profile.counterFriends")} value={friendsCount} divider />
          <Counter label={t("profile.counterCommunities")} value={communities.length} />
        </div>

        {/* Tabs */}
        <Tabs tab={tab} setTab={setTab} tabs={tabs} />

        {/* Tab content */}
        <div className="px-[16px] py-[24px] md:px-[32px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "posts" && (
                posts.length === 0 ? <EmptyTab text={t("profile.emptyPosts")} /> : (
                  <div className="space-y-[16px]">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
                )
              )}
              {tab === "ads" && (
                listings.length === 0 ? (
                  <EmptyTab text={t("profile.emptyAds")}>
                    {isOwn && (
                      <Link to="/ads/new" className="mt-[16px] inline-flex items-center gap-[6px] font-semibold" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14 }}>
                        <Plus size={14} /> {t("profile.createAd")}
                      </Link>
                    )}
                  </EmptyTab>
                ) : (
                  <div className="space-y-[16px]">
                    {isOwn && (
                      <div className="-mx-1 flex gap-[6px] overflow-x-auto px-[4px] pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {([
                          { key: "all", label: t("profile.adFilterAll") },
                          { key: "active", label: t("profile.adFilterActive") },
                          { key: "moderation", label: t("profile.adFilterModeration") },
                          { key: "rejected", label: t("profile.adFilterRejected") },
                          { key: "archived", label: t("profile.adFilterArchived") },
                        ] as const).map(({ key, label }) => {
                          const count = key === "all" ? listings.length : listings.filter((l) => statusOf(l) === key).length;
                          const active = adFilter === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setAdFilter(key)}
                              className="shrink-0 inline-flex items-center gap-[6px] text-[13px] transition-colors"
                              style={{
                                height: 32, padding: "0 14px", borderRadius: 999,
                                background: active ? "var(--accent)" : "var(--background-surface)",
                                color: active ? "#fff" : "var(--foreground-70)",
                                fontWeight: active ? 600 : 500,
                                border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                              }}
                            >
                              {label}
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: active ? "rgba(255,255,255,0.22)" : "var(--background)", color: active ? "#fff" : "var(--foreground-50)" }}>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {filteredListings.length === 0 ? (
                      <EmptyTab text={t("profile.emptyAdsFiltered")} />
                    ) : (
                      <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
                        {filteredListings.map((ad) => {
                          const status = statusOf(ad);
                          const cardState: "default" | "moderation" | "rejected" = status === "moderation" ? "moderation" : status === "rejected" ? "rejected" : "default";
                          return (
                            <div key={ad.id} className="relative" style={{ opacity: status === "archived" ? 0.65 : 1 }}>
                              <AdCard ad={ad} state={cardState} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
              {tab === "communities" && (
                communities.length === 0 ? <EmptyTab text={t("profile.emptyCommunities")} /> : (
                  <div className="grid gap-[12px] md:grid-cols-2">
                    {communities.map((c) => {
                      const Icon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                      return (
                        <Link
                          key={c.id}
                          to="/communities/$id"
                          params={{ id: String(c.id) }}
                          className="flex items-center gap-[12px] p-[14px] transition-colors duration-150"
                          style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--background)" }}
                        >
                          <div className="grid h-[48px] w-[48px] place-items-center" style={{ background: "var(--accent-soft)", borderRadius: 10 }}>
                            <Icon size={24} style={{ color: "var(--accent)" }} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-display text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</div>
                            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{t("common.membersCount", { n: c.members })}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )
              )}
              {tab === "invited" && isOwn && <InvitedFriendsSection />}
              {tab === "about" && (
                <div className="max-w-[600px]">
                  {vm.bio ? (
                    <p className="text-[15px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>{vm.bio}</p>
                  ) : (
                    <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("profile.emptyAbout")}</p>
                  )}
                  {interests.length > 0 && (
                    <div className="mt-[20px] flex flex-wrap gap-[8px]">
                      {interests.map((p) => (
                        <span key={p.id} className="font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, padding: "6px 14px", borderRadius: 999 }}>{p.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {editOpen && (
          <EditSheet
            initial={{ name: vm.name, city: vm.city, bio: vm.bio }}
            onClose={() => setEditOpen(false)}
            onSaved={(next) => { setVm((p) => (p ? { ...p, name: next.name, city: next.city, bio: next.bio } : p)); setEditOpen(false); }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function Counter({ label, value, divider }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className="px-[16px] py-[20px] text-center md:px-[24px]" style={{ borderRight: divider ? "1px solid var(--border)" : undefined }}>
      <div className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>{label}</div>
    </div>
  );
}

function Tabs({ tab, setTab, tabs }: { tab: TabKey; setTab: (k: TabKey) => void; tabs: { key: TabKey; label: string; Icon: typeof FileText }[] }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  useEffect(() => {
    const el = refs.current[tab];
    if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab]);

  return (
    <div className="sticky top-0 z-10 overflow-x-auto" style={{ background: "var(--background)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
      <div className="relative flex">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              ref={(el) => { refs.current[key] = el; }}
              onClick={() => setTab(key)}
              className="inline-flex shrink-0 items-center gap-[8px] font-display transition-colors duration-200"
              style={{ height: 48, padding: "0 20px", fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "var(--accent)" : "var(--foreground-50)" }}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
        <motion.div
          className="absolute bottom-0 h-[3px]"
          style={{ background: "var(--accent)", borderRadius: "3px 3px 0 0" }}
          animate={{ x: indicator.x, width: indicator.w }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function EmptyTab({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-[60px] text-center">
      <div className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{text}</div>
      {children}
    </div>
  );
}

function EditSheet({ initial, onClose, onSaved }: {
  initial: { name: string; city: string; bio: string };
  onClose: () => void;
  onSaved: (next: { name: string; city: string; bio: string }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState(initial.city);
  const [bio, setBio] = useState(initial.bio);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error(t("profile.nameRequired")); return; }
    setSaving(true);
    try {
      let cityId: number | undefined;
      if (city.trim()) {
        const cities = await fetchCities().catch(() => []);
        cityId = cities.find((c) => c.name.toLowerCase() === city.trim().toLowerCase())?.id;
      }
      await updateMyProfile({ display_name: name.trim(), bio: bio.trim(), ...(cityId ? { city_id: cityId } : {}) });
      toast.success(t("profile.saved"));
      onSaved({ name: name.trim(), city: city.trim(), bio: bio.trim() });
    } catch {
      toast.error(t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto"
        style={{ background: "var(--background)", borderRadius: "20px 20px 0 0", maxHeight: "85vh", padding: 24 }}
      >
        <div className="mx-auto h-[4px] w-[36px] rounded-[2px]" style={{ background: "var(--foreground-30)", marginBottom: 20 }} />
        <h3 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>{t("profile.editTitle")}</h3>

        <div className="mt-[20px] space-y-[20px]">
          <Field label={t("profile.fieldName")}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} className="w-full outline-none" />
          </Field>
          <Field label={t("profile.fieldCity")}>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("profile.fieldCity")} style={inputStyle} className="w-full outline-none" />
          </Field>
          <Field label={t("profile.fieldBio")}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("profile.bioPlaceholder")}
              rows={4}
              style={{ ...inputStyle, height: "auto", minHeight: 100, padding: 14, resize: "vertical" }}
              className="w-full outline-none"
            />
          </Field>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <button onClick={onClose} className="flex-1 font-medium transition-colors duration-150" style={{ height: 48, border: "1px solid var(--border)", borderRadius: 12, background: "transparent", color: "var(--foreground-70)" }}>
            {t("common.cancel")}
          </button>
          <button onClick={save} disabled={saving} className="flex-1 font-semibold transition-colors duration-150" style={{ height: 48, background: "var(--accent)", color: "white", borderRadius: 12, opacity: saving ? 0.7 : 1 }}>
            {t("common.save")}
          </button>
        </div>
      </motion.div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  height: 48, border: "1px solid var(--border)", borderRadius: 10,
  padding: "0 14px", fontSize: 16, background: "var(--background-surface)", color: "var(--foreground)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-[8px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</label>
      {children}
    </div>
  );
}
