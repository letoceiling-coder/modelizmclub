import { Link } from "@tanstack/react-router";
import { m } from "framer-motion";
import {
  Pencil,
  Archive,
  Trash2,
  Upload,
  MoreHorizontal,
  Zap,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { Ad } from "@/lib/mock";
import { Button } from "@/components/ui/button";
import { ListingCard, type ListingStatus } from "@/components/ads/ListingCard";
import { BoostSheet } from "@/components/ads/BoostSheet";

// Re-export for backward compatibility with ads.index.tsx
export type MyAdStatus = ListingStatus;

interface Props {
  ad: Ad;
  status: MyAdStatus;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onArchive?: (id: string) => void;
  onPublish?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
}

export function MyAdCard({
  ad,
  status,
  selected,
  onSelect,
  onArchive,
  onPublish,
  onDelete,
  onRestore,
}: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const archived = status !== "active" && status !== "moderation";
  const deleted = status === "deleted";

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
    >
      <ListingCard
        ad={ad}
        status={status}
        selected={selected}
        onSelect={onSelect}
        actions={
          <div className="relative">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
              aria-label="Действия"
              className="h-[32px] w-[32px] rounded-full p-0 text-[var(--foreground-50)]"
            >
              <MoreHorizontal size={18} />
            </Button>

            {menuOpen && (
              <>
                {/* Backdrop scrim — dims the page while the menu is open, matching
                    the app's other sheets/menus; tap anywhere to dismiss. */}
                <div
                  className="fixed inset-0 z-[15]"
                  style={{ background: "rgba(0,0,0,0.4)" }}
                  onClick={() => setMenuOpen(false)}
                />
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
                  {deleted ? (
                    <MenuItem
                      onClick={() => onRestore?.(ad.id)}
                      icon={<RotateCcw size={14} />}
                      label="Восстановить"
                      color="var(--success)"
                    />
                  ) : (
                    <>
                      <MenuItem
                        to="/ads/new"
                        search={{ edit: ad.id }}
                        icon={<Pencil size={14} />}
                        label="Редактировать"
                      />
                      {status === "active" && !ad.promoted && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            setBoostOpen(true);
                          }}
                          icon={<Zap size={14} />}
                          label="Продвинуть"
                          color="var(--accent)"
                        />
                      )}
                      {archived ? (
                        <MenuItem
                          onClick={() => onPublish?.(ad.id)}
                          icon={<Upload size={14} />}
                          label="Опубликовать"
                          color="var(--success)"
                        />
                      ) : (
                        <MenuItem
                          onClick={() => onArchive?.(ad.id)}
                          icon={<Archive size={14} />}
                          label="В архив"
                          color="var(--warning)"
                        />
                      )}
                      <MenuItem
                        onClick={() => onDelete?.(ad.id)}
                        icon={<Trash2 size={14} />}
                        label="Удалить"
                        color="var(--error)"
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        }
      />
      {/*
       * Причина отклонения.
       *
       * Модератор её пишет, `ListingResource` отдаёт, админка показывает — а
       * продавец видел только вкладку «Отклонённые» и объявление без единого
       * слова о том, что не так. Исправить он при этом мог только угадав.
       */}
      {status === "rejected" && ad.rejectionReason && (
        <div
          className="mt-[8px] flex items-start gap-[8px] rounded-[10px] px-[12px] py-[10px]"
          style={{
            background: "var(--error-soft, color-mix(in oklab, var(--error) 12%, transparent))",
            color: "var(--foreground-80)",
          }}
        >
          <AlertTriangle
            size={16}
            className="mt-[1px] shrink-0"
            style={{ color: "var(--error)" }}
          />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--error)" }}>
              {t("pages.myAds.rejectionReasonTitle")}
            </div>
            <p className="mt-[2px] whitespace-pre-wrap text-[13px]">{ad.rejectionReason}</p>
          </div>
        </div>
      )}
      <BoostSheet
        open={boostOpen}
        onClose={() => setBoostOpen(false)}
        listingId={ad.id}
        listingTitle={ad.title}
      />
    </m.div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  to,
  params,
  search,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  to?: "/ads/$id" | "/ads/new";
  params?: { id: string };
  search?: { edit: string };
  color?: string;
}) {
  const cls =
    "flex items-center gap-[10px] px-[14px] py-[8px] text-left text-[13px] font-medium transition-colors";
  const style: React.CSSProperties = { color: color ?? "var(--foreground)" };
  const onEnter = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.background = "var(--background-surface)");
  const onLeave = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.background = "transparent");

  if (to && params) {
    return (
      <Link
        to={to}
        params={params}
        className={cls}
        style={style}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {icon} {label}
      </Link>
    );
  }
  if (to && search) {
    return (
      <Link
        to={to}
        search={search}
        className={cls}
        style={style}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {icon} {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onMouseDown={onClick}
      className={cls}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {icon} {label}
    </button>
  );
}
