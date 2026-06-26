import { useTranslation } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import type { Ad } from "@/lib/mock";
import { MapPin } from "lucide-react";

export function SimilarAds({ items }: { items: Ad[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <section className="space-y-[16px]">
      <h2 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>{t("ads.similarTitle")}</h2>
      <div
        className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "thin" }}
      >
        {items.map((a) => (
          <Link
            key={a.id}
            to="/ads/$id"
            params={{ id: a.id }}
            className="group flex flex-col overflow-hidden snap-start transition-shadow"
            style={{
              flex: "0 0 220px",
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="overflow-hidden" style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}>
              <img
                src={a.image}
                alt={a.title}
                width={440}
                height={330}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col gap-[6px] p-[12px]">
              <h3 className="text-[13px] font-medium leading-[1.3]" style={{ color: "var(--foreground)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.title}
              </h3>
              <div className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                {a.price.toLocaleString("ru")} ₽
              </div>
              <div className="inline-flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                <MapPin size={11} /> {a.city}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
