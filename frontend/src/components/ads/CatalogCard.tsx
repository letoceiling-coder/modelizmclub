import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { addFavoriteListing, removeFavoriteListing } from "@/lib/api/listings";
import { isDemoMode } from "@/lib/demo-mode";
import { getToken } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useStore, actions, selectors } from "@/lib/store";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import { ReservedOverlay } from "@/components/ads/ReservedOverlay";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { toDisplayMedia } from "@/lib/media/variants";
import { Img } from "@/components/ui/Img";

export function CatalogCard({
  ad,
  className,
  priority,
}: {
  ad: Ad;
  className?: string;
  /**
   * Карточка на первом экране. По умолчанию картинки каталога ленивые, и
   * браузер узнавал о самой большой из них только после вычисления вёрстки:
   * 658 мс между ответом сервера и началом загрузки — измерено на /ads,
   * 13 % всего LCP. Разметка приходит с сервера, так что достаточно снять
   * lazy: картинку видно уже при разборе HTML.
   */
  priority?: "high" | "eager";
}) {
  const fav = useStore(selectors.isAdFavorite(ad.id));
  const media = ad.galleryMedia?.[0] ?? toDisplayMedia(ad.gallery?.[0] ?? ad.image);
  const placeholder = categoryPlaceholder(ad.id, ad.category);
  const [broken, setBroken] = useState(false);
  const guest = useGuestAccessOptional();

  return (
    <Card
      className={cn(
        "catalog-virtual-item group relative flex flex-col overflow-hidden p-0",
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
        {broken || !media ? (
          <Img
            src={placeholder}
            width={800}
            height={600}
            alt={ad.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ResponsiveImage
            media={media}
            alt={ad.title}
            variants={["thumb", "card"]}
            /*
             * Ширины замерены на /ads, а не взяты на глаз: 175 при 390,
             * 195 при 640, 209 при 768, 253 при 900 — и 111…146 начиная с
             * 1024, где десктопная оболочка добавляет колонки и карточка
             * схлопывается. Стояло `280px`, не совпадающее ни с одной из
             * этих величин: браузер считал, что нужно 560 px при dpr 2, и
             * брал вариант card в 640 px — 67 КБ там, где хватает thumb в
             * 320 px и 24 КБ. На экране каталога это два десятка картинок.
             */
            sizes="(max-width: 640px) 50vw, (max-width: 1023px) 28vw, 150px"
            width={640}
            height={480}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority === "high" ? "high" : undefined}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setBroken(true)}
          />
        )}
        {ad.reserved && <ReservedOverlay compact />}
        <button
          type="button"
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.preventDefault();
            const run = async () => {
              if (!getToken() && !isDemoMode()) return;
              const next = !fav;
              actions.toggleFavoriteAd(ad.id);
              if (!isDemoMode()) {
                try {
                  if (next) await addFavoriteListing(ad.id);
                  else await removeFavoriteListing(ad.id);
                } catch {
                  actions.toggleFavoriteAd(ad.id);
                  toast.error("Не удалось обновить избранное", { id: "favorite-toggle" });
                  return;
                }
              }
              toast.success(next ? "В избранное" : "Убрано из избранного", {
                id: "favorite-toggle",
              });
            };
            if (guest) {
              guest.requireAccount(() => {
                void run();
              });
              return;
            }
            void run();
          }}
          className="absolute right-[8px] top-[8px] grid h-[32px] w-[32px] place-items-center rounded-full before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
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
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--foreground)",
            letterSpacing: "-0.01em",
          }}
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

        <div
          className="mt-auto flex items-center gap-[8px] pt-[4px] text-[11.5px]"
          style={{ color: "var(--foreground-50)" }}
        >
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
