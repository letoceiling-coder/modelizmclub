import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";

export function CatalogCard({ ad, className }: { ad: Ad; className?: string }) {
  const [fav, setFav] = useState(false);
  const initial = ad.gallery?.[0] ?? ad.image ?? "";
  const [src, setSrc] = useState(initial);

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden p-0",
        "rounded-[var(--r-card)] border-[var(--border)] shadow-[var(--shadow-card)]",
        className,
      )}
      style={{ transition: "box-shadow 180ms, transform 180ms" }}
    >
      {/* Photo */}
      <Link
        to="/ads/$id"
        params={{ id: ad.id }}
        className="relative block aspect-[4/3] w-full overflow-hidden"
        style={{ background: "var(--background-surface)" }}
      >
        <img
          src={src}
          alt={ad.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => {
            const ph = categoryPlaceholder(ad.id, ad.category);
            if (src !== ph) setSrc(ph);
          }}
        />
        <button
          type="button"
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.preventDefault();
            setFav((v) => !v);
          }}
          className="absolute right-[8px] top-[8px] grid h-[32px] w-[32px] place-items-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--background) 78%, transparent)",
            backdropFilter: "blur(6px)",
            color: fav ? "var(--accent)" : "var(--foreground-70)",
          }}
        >
          <Heart size={16} fill={fav ? "var(--accent)" : "none"} />
        </button>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-[4px] p-[10px] sm:p-[12px]">
        <div
          className="text-[18px] font-bold leading-none sm:text-[20px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)", letterSpacing: "-0.01em" }}
        >
          {ad.price.toLocaleString("ru")} ₽
        </div>

        <Link
          to="/ads/$id"
          params={{ id: ad.id }}
          className="line-clamp-2 text-[13px] font-medium leading-[1.35] sm:text-[13.5px]"
          style={{ color: "var(--foreground-70)" }}
        >
          {ad.title}
        </Link>

        <div className="mt-auto flex items-center gap-[8px] pt-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex min-w-0 items-center gap-[4px]">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{ad.city}</span>
          </span>
          {ad.condition && <span className="shrink-0 truncate">· {ad.condition}</span>}
        </div>
      </div>
    </Card>
  );
}
