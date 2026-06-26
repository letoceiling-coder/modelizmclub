import { useTranslation, tStatic } from "@/lib/i18n";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MapPin,
  Clock,
  Heart,
  ImageOff,
  Package,
  Truck,
  BoxSelect,
  Store,
} from "lucide-react";
import type { Ad } from "@/lib/mock";

const STATUS_STYLE: Record<Ad["status"], { bg: string; fg: string; border: string }> = {
  "Продаю":  { bg: "var(--success-soft)", fg: "var(--success)", border: "var(--success)" },
  "Куплю":   { bg: "var(--info-soft)",    fg: "var(--info)",    border: "var(--info)"    },
  "Обменяю": { bg: "var(--warning-soft)", fg: "var(--warning)", border: "var(--warning)" },
};

function relativeTime(input?: string): string {
  if (!input) return tStatic("common.recently");
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return tStatic("common.justNow");
  if (diff < 86400) return tStatic("common.hoursAgo", { n: Math.floor(diff / 3600) });
  if (diff < 172800) return tStatic("common.yesterday");
  if (diff < 604800) return tStatic("common.daysAgo", { n: Math.floor(diff / 86400) });
  return d.toLocaleDateString("ru-RU");
}

const DELIVERY_ICON: Record<string, { Icon: typeof Package; label: string }> = {
  "Почта": { Icon: Package, label: "Почта России" },
  "Почта России": { Icon: Package, label: "Почта России" },
  "СДЭК": { Icon: Truck, label: "СДЭК" },
  "Boxberry": { Icon: BoxSelect, label: "Boxberry" },
  "Самовывоз": { Icon: Store, label: "Самовывоз" },
};

interface Props {
  ad: Ad;
  state?: "default" | "moderation" | "rejected";
  compact?: boolean;
}

export function AdCard({ ad, state = "default", compact = false }: Props) {
  const { t } = useTranslation();
  const moderationState = state !== "default" ? state : ad.moderation && ad.moderation !== "published" ? ad.moderation : "default";
  const [liked, setLiked] = useState<boolean>(false);
  const [likeBump, setLikeBump] = useState(0);
  const status = STATUS_STYLE[ad.status];
  const hero = ad.gallery?.[0] ?? ad.image;
  const moderated = moderationState === "moderation";
  const rejected = moderationState === "rejected";

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked((v) => !v);
    setLikeBump((n) => n + 1);
  };

  return (
    <motion.div
      whileHover={{ scale: compact ? 1 : 1.02 }}
      transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
      className="group relative h-full"
      style={{ opacity: rejected ? 0.7 : 1 }}
    >
      <Link
        to="/ads/$id"
        params={{ id: ad.id }}
        className="flex h-full flex-col overflow-hidden gpu-accelerated"
        style={{
          background: "var(--background-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
          transition: "all 250ms var(--ease-out-expo)",
          minWidth: compact ? undefined : 280,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
          e.currentTarget.style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-card)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        {/* Photo */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "4 / 3", background: "var(--background-surface-hover)" }}
        >
          {hero ? (
            <img
              src={hero}
              alt={ad.title}
              loading="lazy"
              className="h-full w-full object-cover transition-[filter] duration-300 group-hover:brightness-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <ImageOff size={32} style={{ color: "var(--foreground-30)" }} />
            </div>
          )}

          {/* Status badge */}
          <span
            className="absolute left-[10px] top-[10px] inline-flex items-center px-[12px] py-[4px] text-[11px] font-semibold"
            style={{
              background: status.bg,
              color: status.fg,
              border: `1px solid ${status.border}`,
              borderRadius: "var(--r-pill)",
              backdropFilter: "blur(6px)",
            }}
          >
            {ad.status}
          </span>

          {/* Heart */}
          {!compact && (
            <motion.button
              type="button"
              onClick={handleLike}
              aria-label={liked ? t("ads.removeFromFavorites") : t("ads.addToFavorites")}
              key={likeBump}
              initial={likeBump ? { scale: 0.8 } : false}
              animate={likeBump ? { scale: [0.8, 1.1, 1] } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="absolute right-[10px] top-[10px] grid h-[32px] w-[32px] place-items-center"
              style={{
                background: "rgba(0,0,0,0.35)",
                borderRadius: "var(--r-pill)",
                color: liked ? "var(--accent)" : "rgba(255,255,255,0.85)",
              }}
            >
              <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={2} />
            </motion.button>
          )}

          {/* Moderation overlay banner */}
          {moderated && (
            <div
              className="absolute bottom-0 left-0 w-full py-[4px] text-center text-[12px] font-semibold text-white"
              style={{ background: "var(--warning)" }}
            >
              {t("ads.onReview")}
            </div>
          )}
          {rejected && (
            <div
              className="absolute bottom-0 left-0 w-full py-[4px] text-center text-[12px] font-semibold text-white"
              style={{ background: "var(--error)" }}
            >{t("profile.adStatusRejected")}</div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col" style={{ padding: "16px 16px 12px 16px" }}>
          {/* Price — hero */}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: compact ? 18 : 22,
              lineHeight: 1.2,
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            {ad.price.toLocaleString("ru")} ₽
          </div>

          {/* Title */}
          <h3
            className="text-[15px] font-medium"
            style={{
              color: "var(--foreground)",
              lineHeight: 1.4,
              marginBottom: 10,
              minHeight: compact ? undefined : 42,
              display: "-webkit-box",
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {ad.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span
              className="inline-flex items-center gap-[4px] text-[13px]"
              style={{ color: "var(--foreground-50)" }}
            >
              <MapPin size={14} />
              {ad.city}
            </span>
            <span
              className="inline-flex items-center gap-[4px] text-[12px]"
              style={{ color: "var(--foreground-30)" }}
            >
              <Clock size={14} />
              {relativeTime(ad.createdAt)}
            </span>
          </div>

          {/* Delivery icons */}
          {!compact && ad.delivery && ad.delivery.length > 0 && (
            <div className="mt-auto flex flex-wrap items-center gap-[6px]">
              {ad.delivery.slice(0, 4).map((d) => {
                const entry = DELIVERY_ICON[d] ?? { Icon: Package, label: d };
                const { Icon, label } = entry;
                return (
                  <span
                    key={d}
                    title={label}
                    className="grid h-[28px] w-[28px] place-items-center"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-pill)",
                      color: "var(--foreground-50)",
                    }}
                  >
                    <Icon size={14} />
                  </span>
                );
              })}
              {(ad.likes ?? 0) > 0 && (
                <span
                  className="ml-auto inline-flex items-center gap-[4px] text-[12px]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  <Heart size={12} /> {ad.likes}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
