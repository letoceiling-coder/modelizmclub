import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Eye, Heart, MapPin, Pencil, Archive, Trash2, Upload, ImageOff, MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import type { Ad } from "@/lib/mock";

export type MyAdStatus = "active" | "archived" | "moderation" | "rejected" | "draft" | "unpublished" | "deleted";

const STATUS_BADGE: Record<MyAdStatus, { dot: string; fg: string; label: string }> = {
  active:      { dot: "var(--success)",       fg: "var(--success)",       label: "Активно" },
  archived:    { dot: "var(--foreground-30)", fg: "var(--foreground-50)", label: "В архиве" },
  moderation:  { dot: "var(--warning)",       fg: "var(--warning)",       label: "На модерации" },
  rejected:    { dot: "var(--error)",         fg: "var(--error)",         label: "С ошибками" },
  draft:       { dot: "var(--foreground-50)", fg: "var(--foreground-70)", label: "Черновик" },
  unpublished: { dot: "var(--foreground-50)", fg: "var(--foreground-70)", label: "Не опубликовано" },
  deleted:     { dot: "var(--error)",         fg: "var(--error)",         label: "Удалено" },
};

interface Props {
  ad: Ad;
  status: MyAdStatus;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onArchive?: (id: string) => void;
  onPublish?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function MyAdCard({ ad, status, selected, onSelect, onArchive, onPublish, onDelete }: Props) {
  const badge = STATUS_BADGE[status];
  const hero = ad.gallery?.[0] ?? ad.image;
  const [menuOpen, setMenuOpen] = useState(false);
  const archived = status !== "active" && status !== "moderation";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
      className="relative grid grid-cols-[88px_minmax(0,1fr)_auto] items-stretch gap-[12px] p-[10px] sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:p-[12px]"
      style={{
        background: "var(--background)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-card)",
        boxShadow: selected ? "0 0 0 3px color-mix(in oklab, var(--accent) 15%, transparent)" : "var(--shadow-card)",
        transition: "border-color 180ms var(--ease-out-expo), box-shadow 180ms var(--ease-out-expo)",
      }}
    >
      {/* Photo */}
      <Link
        to="/ads/$id"
        params={{ id: ad.id }}
        className="relative shrink-0 overflow-hidden"
        style={{
          aspectRatio: "1 / 1",
          borderRadius: "var(--r-card-sm)",
          background: "var(--background-surface)",
        }}
      >
        {hero ? (
          <img src={hero} alt={ad.title} loading="lazy" className="h-full w-full object-cover" />
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
              background: selected ? "var(--accent)" : "color-mix(in oklab, var(--background) 85%, transparent)",
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
            {selected && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1, fontWeight: 700 }}>✓</span>}
          </label>
        )}
      </Link>

      {/* Body */}
      <div className="flex min-w-0 flex-col justify-between gap-[6px] py-[2px]">
        <div className="min-w-0">
          <Link
            to="/ads/$id"
            params={{ id: ad.id }}
            className="block min-w-0 truncate font-display text-[14px] font-semibold leading-[1.3] sm:text-[15px]"
            style={{ color: "var(--foreground)" }}
          >
            {ad.title}
          </Link>
          <div
            className="mt-[4px] font-display text-[18px] font-bold leading-none sm:text-[20px]"
            style={{ color: "var(--accent)", letterSpacing: "-0.01em" }}
          >
            {ad.price.toLocaleString("ru")} ₽
          </div>
        </div>

        <div className="flex items-center gap-[10px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex min-w-0 items-center gap-[4px]">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{ad.city}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-[4px]"><Eye size={12} /> {ad.views ?? 0}</span>
          <span className="inline-flex shrink-0 items-center gap-[4px]"><Heart size={12} /> {ad.likes ?? 0}</span>
        </div>
      </div>

      {/* Right column: status + menu */}
      <div className="flex shrink-0 flex-col items-end justify-between gap-[6px]">
        <span
          className="inline-flex items-center gap-[5px] whitespace-nowrap font-mono text-[10.5px] font-medium uppercase tracking-[0.06em]"
          style={{ color: badge.fg }}
        >
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: badge.dot }} />
          {badge.label}
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            aria-label="Действия"
            className="grid h-[32px] w-[32px] place-items-center rounded-full transition-colors"
            style={{ color: "var(--foreground-50)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-[36px] z-20 flex flex-col py-[6px]"
              style={{
                minWidth: 180,
                background: "var(--background-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <MenuItem to="/ads/$id" params={{ id: ad.id }} icon={<Pencil size={14} />} label="Редактировать" />
              {archived ? (
                <MenuItem onClick={() => onPublish?.(ad.id)} icon={<Upload size={14} />} label="Опубликовать" color="var(--success)" />
              ) : (
                <MenuItem onClick={() => onArchive?.(ad.id)} icon={<Archive size={14} />} label="В архив" color="var(--warning)" />
              )}
              <MenuItem onClick={() => onDelete?.(ad.id)} icon={<Trash2 size={14} />} label="Удалить" color="var(--error)" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MenuItem({
  icon, label, onClick, to, params, color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  to?: "/ads/$id";
  params?: { id: string };
  color?: string;
}) {
  const cls = "flex items-center gap-[10px] px-[14px] py-[8px] text-left text-[13px] font-medium transition-colors";
  const style: React.CSSProperties = { color: color ?? "var(--foreground)" };
  const onEnter = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.background = "var(--background-surface)");
  const onLeave = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.background = "transparent");
  if (to && params) {
    return (
      <Link to={to} params={params} className={cls} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {icon} {label}
      </Link>
    );
  }
  return (
    <button type="button" onMouseDown={onClick} className={cls} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {icon} {label}
    </button>
  );
}
