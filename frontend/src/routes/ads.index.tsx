import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Inbox, Eye, Heart, TrendingUp, MessageCircle, X, Filter, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Ad } from "@/lib/types";
import { fetchMyListings, publishListing, archiveListing, deleteListing } from "@/lib/api/listings";
import { MyAdCard, type MyAdStatus } from "@/components/MyAdCard";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/ads/")({
  head: () => ({ meta: [{ title: tStatic("ads.myMetaTitle") }] }),
  component: MyAdsPage,
});

type TabKey = "active" | "moderation" | "rejected" | "unpublished" | "archived" | "deleted" | "draft";
type AdStatusKey = MyAdStatus;

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: "active", labelKey: "ads.tabActive" },
  { key: "moderation", labelKey: "ads.tabModeration" },
  { key: "rejected", labelKey: "ads.tabRejected" },
  { key: "unpublished", labelKey: "ads.tabUnpublished" },
  { key: "archived", labelKey: "ads.tabArchived" },
  { key: "deleted", labelKey: "ads.tabDeleted" },
  { key: "draft", labelKey: "ads.tabDraft" },
];

function mapListingStatus(status: string): AdStatusKey {
  if (status === "published" || status === "active") return "active";
  if (status === "moderation" || status === "pending") return "moderation";
  if (status === "rejected") return "rejected";
  if (status === "archived") return "archived";
  if (status === "draft") return "draft";
  if (status === "deleted") return "deleted";
  return "unpublished";
}

function MyAdsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("active");
  const [listings, setListings] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<Record<string, AdStatusKey>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    void fetchMyListings()
      .then((items) => {
        setListings(items);
        const map: Record<string, AdStatusKey> = {};
        for (const a of items) map[a.id] = mapListingStatus(a.status);
        setLocalStatus(map);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handlePublish = async (id: string) => {
    try {
      await publishListing(id);
      setLocalStatus((s) => ({ ...s, [id]: "active" }));
      toast.success(t("ads.publishedToast"));
    } catch {
      toast.error(t("ads.actionError"));
    }
  };
  const handleArchive = async (id: string) => {
    try {
      await archiveListing(id);
      setLocalStatus((s) => ({ ...s, [id]: "unpublished" }));
      toast.success(t("ads.archivedToast"));
    } catch {
      toast.error(t("ads.actionError"));
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await deleteListing(id);
      setListings((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("ads.deletedToast"));
    } catch {
      toast.error(t("ads.actionError"));
    }
  };

  const decorated = useMemo(
    () => listings.map((ad) => ({ ad, status: localStatus[ad.id] ?? mapListingStatus(ad.status) })),
    [listings, localStatus],
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { active: 0, moderation: 0, rejected: 0, unpublished: 0, archived: 0, deleted: 0, draft: 0 };
    for (const { status } of decorated) c[status as TabKey] = (c[status as TabKey] ?? 0) + 1;
    return c;
  }, [decorated]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decorated.filter(({ ad, status }) => {
      if (status !== tab) return false;
      if (q && !ad.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [decorated, tab, query]);

  if (!isAuthenticated) {
    return (
      <AppLayout rightColumn={false}>
        <div className="py-20 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("auth.loginRequired")}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-[20px]">
        <header className="flex flex-wrap items-end justify-between gap-[12px]">
          <div>
            <h1 className="font-display text-[28px] font-bold">{t("ads.myTitle")}</h1>
            <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-70)" }}>{t("ads.mySubtitle")}</p>
          </div>
          <button type="button" onClick={() => navigate({ to: "/ads/new" })} className="inline-flex items-center gap-2 px-5 font-semibold" style={{ height: 44, background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)" }}>
            <Plus size={16} /> {t("ads.createAd")}
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b py-2" style={{ borderColor: "var(--border)" }}>
          {TABS.map((tabItem) => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)} className="whitespace-nowrap px-4 py-2 text-[14px] font-semibold" style={{ color: tab === tabItem.key ? "var(--accent)" : "var(--foreground-50)" }}>
              {t(tabItem.labelKey)} ({counts[tabItem.key]})
            </button>
          ))}
        </nav>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--foreground-50)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ads.searchPlaceholder")} className="w-full text-[14px] outline-none" style={{ height: 40, paddingLeft: 36, background: "var(--background-surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--foreground)" }} />
        </div>

        {loading ? (
          <div className="py-20 text-center">{t("common.loading")}</div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center gap-3 p-14 text-center" style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-card)" }}>
            <Inbox size={26} style={{ color: "var(--foreground-50)" }} />
            <p style={{ color: "var(--foreground-70)" }}>{t("ads.emptyActiveDesc")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-20">
            {visible.map(({ ad, status }) => (
              <MyAdCard
                key={ad.id}
                ad={ad}
                status={status}
                onArchive={(id) => void handleArchive(id)}
                onPublish={(id) => void handlePublish(id)}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
