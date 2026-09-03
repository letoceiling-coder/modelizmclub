import { useTranslation } from "react-i18next";
import { Pencil, Archive } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Button } from "@/components/ui/button";

interface Props {
  ad: Ad;
  busy?: boolean;
  onEdit: () => void;
  onUnpublish: () => void;
}

/** Owner mobile bar — edit / unpublish instead of message / call. */
export function AdOwnerMobileBar({ ad, busy, onEdit, onUnpublish }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-x-0 z-30 flex items-center gap-[8px] px-[12px] py-[10px] lg:hidden"
      style={{
        bottom: "var(--bottom-nav-space)",
        background: "var(--background-elevated)",
        borderTop: "1px solid var(--border)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="min-w-0 shrink-0">
        <div
          className="font-display text-[16px] font-bold leading-none"
          style={{ color: "var(--foreground)" }}
        >
          {ad.price.toLocaleString("ru")} ₽
        </div>
        <div className="mt-[2px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adDetail.ownerModeShort")}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 gap-[6px]">
        <Button
          variant="outline"
          size="sm"
          onClick={onUnpublish}
          disabled={busy}
          className="min-w-0 flex-1 rounded-[var(--r-button)] px-[8px]"
        >
          <Archive size={14} /> {t("pages.adDetail.ownerUnpublishShort")}
        </Button>
        <Button
          onClick={onEdit}
          size="sm"
          disabled={busy}
          className="min-w-0 flex-[2] rounded-[var(--r-button)] px-[8px]"
        >
          <Pencil size={14} /> {t("pages.adDetail.ownerEditShort")}
        </Button>
      </div>
    </div>
  );
}
