import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, Heart, MapPin, ImageOff } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ListingStatus =
  | "active"
  | "archived"
  | "moderation"
  | "rejected"
  | "draft"
  | "unpublished"
  | "deleted";

type StatusVariant =
  | "published"
  | "draft"
  | "moderation"
  | "warning"
  | "outline"
  | "destructive";

const STATUS_CONFIG: Record<ListingStatus, { variant: StatusVariant; label: string }> = {
  active:      { variant: "published",   label: "Активно" },
  archived:    { variant: "draft",       label: "В архиве" },
  moderation:  { variant: "moderation",  label: "На модерации" },
  rejected:    { variant: "warning",     label: "С ошибками" },
  draft:       { variant: "draft",       label: "Черновик" },
  unpublished: { variant: "outline",     label: "Не опубликовано" },
  deleted:     { variant: "destructive", label: "Удалено" },
};

interface ListingCardProps {
  ad: Ad;
  /** Optional: renders status Badge in the right column */
  status?: ListingStatus;
  /** Optional: selection state for bulk-action checkbox */
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  /** Right-column slot — action menus, custom controls, etc. */
  actions?: ReactNode;
  className?: string;
}

export function ListingCard({ ad, status, selected, onSelect, actions, className }: ListingCardProps) {
  const [imgErr, setImgErr] = useState(false);
  const hero = ad.gallery?.[0] ?? ad.image;
  const statusCfg = status ? STATUS_CONFIG[status] : undefined;

  return (
    <Card
      className={cn(
        "relative grid items-stretch gap-[10px] p-[10px]",
        "grid-cols-[80px_minmax(0,1fr)_auto] sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-[12px] sm:p-[12px]",
        "rounded-[var(--r-card)] border-[var(--border)] shadow-[var(--shadow-card)]",
        selected && "border-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_15%,transparent)]",
        className,
      )}
      style={{ transition: "border-color 180ms, box-shadow 180ms" }}
    >
      {/* Thumbnail */}
      <Link
        to="/ads/$id"
        params={{ id: ad.id }}
        className="relative shrink-0 overflow-hidden w-[80px] h-[80px] sm:w-[96px] sm:h-[96px]"
        style={{
          borderRadius: "var(--r-card-sm)",
          background: "var(--background-surface)",
        }}
      >
        {hero && !imgErr ? (
          <img
            src={hero}
            alt={ad.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ImageOff size={22} style={{ color: "var(--foreground-30)" }} />
          </div>
        )}

        {onSelect && (
          <label
            onClick={(e) => e.stopPropagation()}
            className="absolute left-[6px] top-[6px] grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-md"
            style={{
              background: selected
                ? "var(--accent)"
                : "color-mix(in oklab, var(--background) 85%, transparent)",
              border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
              backdropFilter: "blur(6px)",
            }}
          >
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelect(ad.id, e.target.checked)}
              className="sr-only"
              aria-label="Выбрать объявление"
            />
            {selected && (
              <span style={{ color: "#fff", fontSize: 13, lineHeight: 1, fontWeight: 700 }}>✓</span>
            )}
          </label>
        )}
      </Link>

      {/* Body */}
      <div className="flex min-w-0 flex-col justify-between gap-[4px] py-[2px]">
        <div className="min-w-0">
          <Link
            to="/ads/$id"
            params={{ id: ad.id }}
            className="block min-w-0 line-clamp-2 text-[13.5px] font-semibold leading-[1.3] sm:text-[14.5px]"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            {ad.title}
          </Link>

          <div
            className="mt-[4px] text-[15.5px] font-bold leading-none sm:text-[17px]"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)", letterSpacing: "-0.01em" }}
          >
            {ad.price.toLocaleString("ru")} ₽
          </div>

          {ad.condition && (
            <div className="mt-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
              {ad.condition}
            </div>
          )}
        </div>

        <div className="flex items-center gap-[10px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex min-w-0 items-center gap-[4px]">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{ad.city}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-[4px]">
            <Eye size={12} />{ad.views ?? 0}
          </span>
          <span className="inline-flex shrink-0 items-center gap-[4px]">
            <Heart size={12} />{ad.likes ?? 0}
          </span>
        </div>
      </div>

      {/* Right column: status badge + action slot */}
      <div className="flex shrink-0 flex-col items-end justify-between gap-[6px]">
        {statusCfg && (
          <Badge
            variant={statusCfg.variant}
            withIcon={false}
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.05em]"
          >
            {statusCfg.label}
          </Badge>
        )}
        {actions}
      </div>
    </Card>
  );
}
