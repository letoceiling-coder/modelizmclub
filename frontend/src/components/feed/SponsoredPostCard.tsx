import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import type { Banner } from "@/lib/types";

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
    if (banner.linkUrl) {
      window.open(banner.linkUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast(t("post.detailsSoon", { title: banner.title }));
  };

  const handleDismiss = () => {
    setHidden(true);
    onDismiss?.(banner.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
      style={{
        background: "var(--background-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
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
            >{t("post.sponsoredAd")}</span>
          </div>
          <div className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("post.sponsoredAd")}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("post.menuHide")}
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full transition-colors"
          style={{ color: "var(--foreground-50)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="px-[16px] pt-[10px]">
        <p className="text-[14px]" style={{ color: "var(--foreground-70)", lineHeight: 1.55 }}>
          {banner.text}
        </p>
      </div>

      {/* Visual */}
      <div
        className="mt-[12px] mx-[16px] overflow-hidden"
        style={{
          borderRadius: 12,
          aspectRatio: "16 / 7",
          background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
          border: "1px solid var(--border)",
        }}
      >
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
      </div>

      {/* CTA */}
      <div
        className="mt-[14px] flex items-center justify-between gap-[12px] px-[16px] pb-[14px] pt-[10px]"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("post.sponsoredAdvertiser")}
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
          {banner.linkUrl ? t("components.readMore") : t("post.detailsSoonShort", { title: banner.title })}
          <ExternalLink size={14} />
        </button>
      </div>
    </motion.article>
  );
}

