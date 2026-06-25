import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ads, adById } from "@/lib/mock";
import { AdGallery } from "@/components/ads/AdGallery";
import { SellerCard } from "@/components/ads/SellerCard";
import { SimilarAds } from "@/components/ads/SimilarAds";
import {
  ChevronLeft, MapPin, Truck, Tag, Bookmark, Share2,
  Phone, Eye, Heart, Clock, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ads/$id")({
  head: ({ params }) => {
    const ad = adById(params.id);
    return {
      meta: [
        { title: ad ? `${ad.title} — МоДелизМ Форум` : "Объявление — МоДелизМ Форум" },
        { name: "description", content: ad?.description?.slice(0, 160) ?? "Объявление на МоДелизМ Форум" },
      ],
    };
  },
  component: AdDetailPage,
});

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  "Продаю":  { bg: "var(--accent-soft)",  fg: "var(--accent)"  },
  "Куплю":   { bg: "var(--info-soft)",    fg: "var(--info)"    },
  "Обменяю": { bg: "var(--warning-soft)", fg: "var(--warning)" },
};

function AdDetailPage() {
  const { id } = Route.useParams();
  const ad = adById(id);
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!ad) {
    return (
      <AppLayout rightColumn={false}>
        <div className="grid place-items-center py-[80px] text-center">
          <h1 className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>Объявление не найдено</h1>
          <button onClick={() => navigate({ to: "/ads" })} className="mt-[16px] px-[20px] py-[10px]"
            style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)" }}>
            К списку
          </button>
        </div>
      </AppLayout>
    );
  }

  const status = STATUS_COLOR[ad.status];
  const similar = ads.filter((a) => a.id !== ad.id && (a.category === ad.category || a.subcategory === ad.subcategory)).slice(0, 8);
  const images = ad.gallery && ad.gallery.length ? ad.gallery : [ad.image];

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await (navigator as Navigator).share({ title: ad.title, url: window.location.href }); return; } catch {}
    }
    toast.success("Ссылка скопирована");
  };

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-[24px]">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <Link to="/ads" className="inline-flex items-center gap-[4px] transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft size={14} /> Объявления
          </Link>
          <span>/</span>
          <span style={{ color: "var(--foreground-70)" }}>{ad.category}</span>
          <span>/</span>
          <span style={{ color: "var(--foreground)" }}>{ad.subcategory}</span>
        </nav>

        {/* Top section: gallery + info */}
        <div className="grid gap-[24px] lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <AdGallery images={images} alt={ad.title} />
          </div>

          {/* Sticky right info */}
          <div className="lg:sticky lg:top-[16px] lg:h-fit">
            <div
              className="flex flex-col gap-[16px] p-[20px]"
              style={{
                background: "var(--background-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <span
                className="inline-flex w-fit items-center gap-[6px] px-[10px] py-[5px] text-[11px] font-semibold uppercase tracking-wider"
                style={{ background: status.bg, color: status.fg, borderRadius: "var(--r-pill)" }}
              >
                <Tag size={11} /> {ad.status}
              </span>

              <h1 className="font-display text-[24px] font-bold leading-[1.2]"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                {ad.title}
              </h1>

              <div className="font-display text-[34px] font-bold leading-none"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                {ad.price.toLocaleString("ru")} ₽
              </div>

              <div className="flex flex-wrap gap-x-[16px] gap-y-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                <span className="inline-flex items-center gap-[6px]"><MapPin size={14} />{ad.city}</span>
                <span className="inline-flex items-center gap-[6px]"><Eye size={14} />{ad.views ?? 0}</span>
                <span className="inline-flex items-center gap-[6px]"><Heart size={14} />{ad.likes ?? 0}</span>
                <span className="inline-flex items-center gap-[6px]"><Clock size={14} />{ad.createdAt ?? "недавно"}</span>
              </div>

              <div className="flex flex-col gap-[8px]">
                <button
                  type="button"
                  onClick={() => setShowContact((v) => !v)}
                  className="inline-flex items-center justify-center gap-[8px] py-[12px] text-[14px] font-semibold transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)", boxShadow: "var(--shadow-button)" }}
                >
                  <Phone size={16} /> {showContact ? ad.contact : "Показать контакт"}
                </button>
                <div className="grid grid-cols-2 gap-[8px]">
                  <button
                    type="button"
                    onClick={() => { setSaved((v) => !v); toast.success(saved ? "Убрано из избранного" : "В избранное"); }}
                    className="inline-flex items-center justify-center gap-[6px] py-[10px] text-[13px] font-medium transition-colors"
                    style={{
                      background: saved ? "var(--accent-soft)" : "transparent",
                      color: saved ? "var(--accent)" : "var(--foreground-70)",
                      border: `1px solid ${saved ? "var(--border-accent)" : "var(--border)"}`,
                      borderRadius: "var(--r-button)",
                    }}
                  >
                    <Bookmark size={14} fill={saved ? "currentColor" : "none"} /> В избранное
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    className="inline-flex items-center justify-center gap-[6px] py-[10px] text-[13px] font-medium"
                    style={{
                      background: "transparent",
                      color: "var(--foreground-70)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-button)",
                    }}
                  >
                    <Share2 size={14} /> Поделиться
                  </button>
                </div>
              </div>

              <div
                className="flex items-center gap-[8px] p-[10px] text-[11px]"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)", borderRadius: "var(--r-card-sm)" }}
              >
                <ShieldCheck size={14} style={{ color: "var(--success)" }} />
                Безопасная сделка: оплата при получении или через эскроу.
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <section
          className="p-[24px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Описание
          </h2>
          <p className="mt-[12px] whitespace-pre-line text-[14px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {ad.description ?? "Описание отсутствует."}
          </p>

          <div className="mt-[20px] grid gap-[12px] sm:grid-cols-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <Spec label="Категория" value={`${ad.category} · ${ad.subcategory}`} />
            <Spec label="Состояние" value={ad.condition ?? "—"} />
            <Spec label="Город" value={ad.city} />
          </div>
        </section>

        {/* Delivery */}
        <section
          className="p-[24px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Доставка
          </h2>
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {ad.delivery.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-[6px] px-[12px] py-[6px] text-[12px] font-medium"
                style={{ background: "var(--background-surface)", color: "var(--foreground)", borderRadius: "var(--r-tag)" }}
              >
                <Truck size={12} /> {d}
              </span>
            ))}
          </div>
          {ad.deliveryDetails && (
            <p className="mt-[14px] text-[13px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>
              {ad.deliveryDetails}
            </p>
          )}
        </section>

        {/* Seller */}
        {ad.seller && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Продавец
            </h2>
            <SellerCard seller={ad.seller} />
          </section>
        )}

        <SimilarAds items={similar} />
      </div>
    </AppLayout>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{label}</div>
      <div className="mt-[4px] text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}
