import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { recordBannerEvent } from "@/lib/api/banners";
import { Appear } from "@/components/ui/Appear";
import type { Banner } from "@/lib/mock";

interface Props {
  banner: Banner;
  onDismiss?: (id: string) => void;
}

/**
 * Native sponsored post — same card chrome as PostCard, with a mandatory
 * «Реклама» tag and a single CTA. No carousel, no banner strip.
 */
export function SponsoredPostCard({ banner, onDismiss }: Props) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const handleCta = () => {
    const href = banner.link?.trim();
    if (href) {
      void recordBannerEvent(banner.id, "click");
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    toast(t("components.sponsoredPost.noLink", { title: banner.title }));
  };

  const handleDismiss = () => {
    setHidden(true);
    onDismiss?.(banner.id);
  };

  return (
    // Appear, а не motion.article с initial: рекламная карточка стоит в той же
    // ленте, что и посты, и по правилу из CLAUDE.md начальное состояние в
    // серверной разметке прячет содержимое до конца гидрации.
    <Appear
      className="overflow-hidden border-y border-x-0 sm:rounded-[var(--r-card)] sm:border-x"
      durationMs={250}
      style={{
        background: "var(--background-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-[12px] px-[16px] pt-[14px]">
        <div
          className="grid h-[40px] w-[40px] shrink-0 place-items-center text-[13px] font-bold text-white"
          style={{ background: "var(--accent)", borderRadius: 12 }}
          aria-hidden
        >
          AD
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[8px]">
            <span
              className="truncate text-[14px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {banner.title}
            </span>
            <span
              className="shrink-0 px-[8px] py-[2px] text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "var(--accent-soft, rgba(229,57,53,0.12))",
                color: "var(--accent)",
                border: "1px solid rgba(229,57,53,0.25)",
                borderRadius: "var(--r-pill)",
                letterSpacing: "0.08em",
              }}
            >
              {t("components.sponsoredPost.ad")}
            </span>
          </div>
          <div className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("components.sponsoredPost.promo")}
            {banner.until ? ` · ${banner.until}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("components.sponsoredPost.dismiss")}
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full transition-colors"
          style={{ color: "var(--foreground-50)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--background-surface-hover)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      {banner.text ? (
        <div className="px-[16px] pt-[10px]">
          <p className="text-[14px]" style={{ color: "var(--foreground-70)", lineHeight: 1.55 }}>
            {banner.text}
          </p>
        </div>
      ) : null}

      {/* Visual */}
      <div
        className="mt-[12px] mx-[16px] overflow-hidden"
        style={{
          borderRadius: 12,
          aspectRatio: "16 / 7",
          background: banner.image
            ? "var(--background-surface)"
            : `linear-gradient(135deg, ${gradientStops(banner.color)})`,
          border: "1px solid var(--border)",
        }}
      >
        {banner.image ? (
          <img
            src={banner.image}
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center px-[20px] text-center"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), transparent 60%)",
            }}
          >
            <span
              className="font-display"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(20px, 3.5vw, 30px)",
                letterSpacing: "-0.02em",
                color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.35)",
              }}
            >
              {banner.title}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        className="mt-[14px] flex items-center justify-between gap-[12px] px-[16px] pb-[14px] pt-[10px]"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("components.sponsoredPost.ad")}
        </span>
        <button
          type="button"
          onClick={handleCta}
          className="inline-flex items-center gap-[6px] px-[16px] text-[13px] font-semibold transition-colors active:scale-[0.98]"
          style={{
            height: 36,
            borderRadius: "var(--r-pill)",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          {banner.cta}
          <ExternalLink size={14} />
        </button>
      </div>
    </Appear>
  );
}

/**
 * Map the existing tailwind gradient hint ("from-red-600 to-red-800") to
 * concrete colors so we don't rely on Tailwind JIT for arbitrary classes.
 */
function gradientStops(token: string): string {
  if (token.includes("slate")) return "#334155, #0f172a";
  if (token.includes("red-700") && token.includes("slate")) return "#991b1b, #0f172a";
  return "var(--danger), #7f1d1d";
}
