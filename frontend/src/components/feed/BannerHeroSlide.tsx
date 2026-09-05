import { variantUrl } from "@/lib/media/variants";
import type { HTMLAttributes } from "react";
import { CalendarDays, Newspaper, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Img } from "@/components/ui/Img";

/** Fixed hero height — shared by feed slider and admin WYSIWYG preview (PDF QA Task 11).
 *
 *  140 на телефоне, 200 на широком экране. Прежние 200/240 забирали у первого
 *  экрана 375×812 почти треть высоты: до первой карточки ленты приходилось
 *  прокручивать, ещё не увидев ни одного поста. */
export const BANNER_HERO_HEIGHT = "h-[140px] overflow-hidden sm:h-[180px] md:h-[200px]";

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

      {/* Содержимое считается от нижнего края: значок вида, заголовок, текст,
          кнопка. В 140 px телефона помещаются только заголовок и кнопка, в
          180 добавляется значок вида, в 200 — одна строка текста. Раньше в
          блок клали всё сразу, и на любой ширине верх обрезался: значок и
          первая строка заголовка уезжали за край. */}
      <div className="absolute inset-y-0 left-0 flex max-w-[86%] flex-col justify-end gap-[8px] overflow-hidden p-[14px] pb-[16px] sm:max-w-[52%] sm:gap-[10px] sm:p-[20px] sm:pb-[22px] md:gap-[10px] md:p-[24px] md:pb-[26px]">
        <span
          className="hidden w-fit shrink-0 items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11px] font-medium uppercase tracking-wide text-white sm:inline-flex"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
        >
          <KindIcon className="h-[12px] w-[12px]" />
          {kindLabel}
          {banner.until ? <span className="opacity-70">· {banner.until}</span> : null}
        </span>
        <h2
          className="line-clamp-2 shrink-0 break-words text-[19px] font-semibold leading-tight text-white sm:text-[22px] md:text-[26px]"
          style={{ fontFamily: "var(--font-display)", textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
        >
          {banner.title || "Заголовок баннера"}
        </h2>
        {banner.text ? (
          // line-clamp сам ставит display:-webkit-box, и `hidden` спрятал бы
          // строку только по случайному порядку правил. max-md выключает её
          // ниже 768, где на неё нет высоты.
          <p className="line-clamp-1 shrink-0 break-words text-[13px] leading-snug text-white/90 max-md:hidden md:text-[14px]">
            {banner.text}
          </p>
        ) : null}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onCtaClick}
            disabled={ctaDisabled}
            {...ctaPointerProps}
            className="inline-flex items-center rounded-[10px] bg-white px-[14px] py-[8px] text-[13px] font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:pointer-events-none sm:px-[16px] sm:py-[9px] sm:text-[14px]"
          >
            {banner.cta || "Подробнее"}
          </button>
        </div>
      </div>
    </>
  );
}
