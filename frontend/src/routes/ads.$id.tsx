import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchListing, fetchListings } from "@/lib/api/listings";
import type { Ad } from "@/lib/types";
import { AdGallery } from "@/components/ads/AdGallery";
import { SellerCard } from "@/components/ads/SellerCard";
import { SimilarAds } from "@/components/ads/SimilarAds";
import { ChevronLeft, MapPin, Tag, Bookmark, Share2, Eye, Heart, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ads/$id")({
  head: () => ({ meta: [{ title: tStatic("ads.detailMetaFallback") }] }),
  component: AdDetailPage,
});

function AdDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [similar, setSimilar] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const item = await fetchListing(id);
        if (cancelled) return;
        setAd(item);
        if (item) {
          const all = await fetchListings({ q: item.category });
          if (!cancelled) setSimilar(all.filter((a) => a.id !== item.id).slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setAd(null);
          setSimilar([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <AppLayout rightColumn={false}><div className="py-20 text-center">{t("common.loading")}</div></AppLayout>;
  }

  if (!ad) {
    return (
      <AppLayout rightColumn={false}>
        <div className="grid place-items-center py-[80px] text-center">
          <h1 className="font-display text-[24px] font-bold">{t("ads.detailNotFound")}</h1>
          <button onClick={() => navigate({ to: "/ads" })} className="mt-[16px] px-[20px] py-[10px]" style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)" }}>{t("ads.backToListShort")}</button>
        </div>
      </AppLayout>
    );
  }

  const images = ad.gallery && ad.gallery.length ? ad.gallery : ad.image ? [ad.image] : [];

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-[24px]">
        <nav className="flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <Link to="/ads" className="inline-flex items-center gap-[4px]"><ChevronLeft size={14} />{t("nav.ads")}</Link>
          <span>/</span>
          <span>{ad.category}</span>
        </nav>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {images.length > 0 && <AdGallery images={images} alt={ad.title} />}
            <h1 className="mt-4 font-display text-[26px] font-bold">{ad.title}</h1>
            <div className="mt-2 text-[28px] font-bold" style={{ color: "var(--accent)" }}>{ad.price.toLocaleString("ru")} ₽</div>
            {ad.description && <p className="mt-4 whitespace-pre-line text-[15px]" style={{ color: "var(--foreground-70)" }}>{ad.description}</p>}
            <div className="mt-4 flex flex-wrap gap-4 text-[13px]" style={{ color: "var(--foreground-50)" }}>
              <span className="inline-flex items-center gap-1"><MapPin size={14} />{ad.city}</span>
              <span className="inline-flex items-center gap-1"><Tag size={14} />{ad.category}</span>
              {ad.views != null && <span className="inline-flex items-center gap-1"><Eye size={14} />{ad.views}</span>}
            </div>
          </div>
          <div className="space-y-4">
            <SellerCard seller={{ slug: ad.author.slug, name: ad.author.name, avatar: ad.author.avatar, rating: 5, deals: 0, since: ad.createdAt ?? "" }} />
            <SimilarAds items={similar} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
