import { variantUrl } from "@/lib/media/variants";
import type { HTMLAttributes } from "react";
import { CalendarDays, Newspaper, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Img } from "@/components/ui/Img";

/** Fixed hero height — shared by feed slider and admin WYSIWYG preview (PDF QA Task 11). */
export const BANNER_HERO_HEIGHT = "h-[200px] overflow-hidden sm:h-[220px] md:h-[240px]";

/** Shared shape covering both the public `Banner` model and the admin draft/row. */
export interface BannerHeroSlideData {
  image?: string | null;
  color?: string;
  kind?: "event" | "news" | "promo" | string | null;
  until?: string | null;
  title: string;
  text?: string | null;
  cta?: string | null;
}

/**
 * Single hero-slide visual: image + gradient scrim + kind badge + title + text + CTA.
 * Used as-is by both `EventsHero` (real feed slider) and the admin banner preview so
 * the two can never visually drift apart — same markup, same classes, same sizes.
 */
export function BannerHeroSlide({
  banner,
  onCtaClick,
  ctaDisabled = false,
  ctaPointerProps,
  priority = false,
}: {
  banner: BannerHeroSlideData;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  /** LCP candidate — the first hero slide above the fold on /feed. Later slides
   *  and the admin WYSIWYG preview leave it off so they do not compete with the
   *  real first paint for bandwidth. */
  priority?: boolean;
  /** Extra pointer handlers (e.g. stopPropagation) for the CTA button — used to keep the
   *  feed slider's own swipe/drag detection from firing when the CTA is pressed. */
  ctaPointerProps?: HTMLAttributes<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const kindKey = banner.kind ?? "news";
  const KindIcon = kindKey === "event" ? CalendarDays : kindKey === "promo" ? Sparkles : Newspaper;
  const kindLabel = t(
    `components.eventsHero.kind${kindKey === "event" ? "Event" : kindKey === "promo" ? "Promo" : "News"}`,
  );

  return (
    <>
      <div className="absolute inset-0">
        {banner.image ? (
          <Img
            // The hero is the LCP element on the feed and was loading the
            // original: 277 KB for a 349x200 box on a phone. The media proxy
            // answers with the original when a variant is missing, so this is
            // safe for banners uploaded before variants existed.
            src={variantUrl(banner.image, "medium")}
            width={1600}
            height={900}
            sizes="(max-width: 768px) 100vw, 720px"
            priority={priority}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${banner.color ?? "from-slate-600 to-slate-800"}`}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in oklab, #000 58%, transparent) 0%, color-mix(in oklab, #000 28%, transparent) 42%, transparent 68%), linear-gradient(180deg, transparent 32%, color-mix(in oklab, #000 60%, transparent) 100%)",
          }}
        />
      </div>

      <div className="absolute inset-y-0 left-0 flex max-w-[86%] flex-col justify-end gap-[14px] overflow-hidden p-[22px] pb-[30px] sm:max-w-[52%] sm:gap-[16px] sm:p-[36px] sm:pb-[44px]">
        <span
          className="inline-flex w-fit shrink-0 items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[11px] font-medium uppercase tracking-wide text-white"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
        >
          <KindIcon className="h-[12px] w-[12px]" />
          {kindLabel}
          {banner.until ? <span className="opacity-70">· {banner.until}</span> : null}
        </span>
        <h2
          className="line-clamp-2 shrink-0 break-words text-[21px] font-semibold leading-tight text-white sm:text-[26px]"
          style={{ fontFamily: "var(--font-display)", textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
        >
          {banner.title || "Заголовок баннера"}
        </h2>
        {banner.text ? (
          <p className="line-clamp-3 shrink-0 break-words text-[13px] leading-relaxed text-white/90 sm:text-[15px]">
            {banner.text}
          </p>
        ) : null}
        <div className="mt-[6px] shrink-0">
          <button
            type="button"
            onClick={onCtaClick}
            disabled={ctaDisabled}
            {...ctaPointerProps}
            className="inline-flex items-center rounded-[10px] bg-white px-[16px] py-[9px] text-[13px] font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99] sm:text-[14px] disabled:pointer-events-none"
          >
            {banner.cta || "Подробнее"}
          </button>
        </div>
      </div>
    </>
  );
}
