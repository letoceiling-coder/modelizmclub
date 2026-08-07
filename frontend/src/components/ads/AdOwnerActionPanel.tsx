import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Eye,
  Heart,
  Clock,
  Tag,
  Pencil,
  Archive,
  Trash2,
  Zap,
  Share2,
  MessageSquare,
  UserRound,
} from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { BoostSheet } from "@/components/ads/BoostSheet";

const DEAL_VARIANT: Record<Ad["status"], NonNullable<BadgeProps["variant"]>> = {
  "Продаю": "info",
  "Куплю": "info",
  "Обменяю": "secondary",
};

interface AdOwnerActionPanelProps {
  ad: Ad;
  busy?: boolean;
  onEdit: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPreviewAsBuyer: () => void;
  className?: string;
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div
      className="flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-[6px] rounded-[10px] px-[8px] py-[10px] text-center"
      style={{ background: "var(--background-surface)" }}
    >
      <span className="grid h-[16px] w-[16px] shrink-0 place-items-center" style={{ color: "var(--foreground-50)" }}>
        {icon}
      </span>
      <span
        className="flex min-h-[28px] items-center justify-center text-[10px] font-medium leading-[1.25]"
        style={{ color: "var(--foreground-50)" }}
      >
        {label}
      </span>
      <span className="font-display text-[18px] font-bold tabular-nums leading-none" style={{ color: "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

export function AdOwnerActionPanel({
  ad,
  busy,
  onEdit,
  onUnpublish,
  onDelete,
  onShare,
  onPreviewAsBuyer,
  className,
}: AdOwnerActionPanelProps) {
  const { t } = useTranslation();
  const [boostOpen, setBoostOpen] = useState(false);

  return (
    <>
      <Card
        className={cn("flex flex-col gap-[16px] p-[20px]", className)}
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Alert variant="info">
          <AlertTitle>{t("pages.adDetail.ownerModeTitle")}</AlertTitle>
          <AlertDescription>{t("pages.adDetail.ownerModeDesc")}</AlertDescription>
        </Alert>

        {ad.moderation === "moderation" && (
          <Alert variant="warning">
            <AlertTitle>{t("pages.adDetail.ownerModerationTitle")}</AlertTitle>
            <AlertDescription>{t("pages.adDetail.ownerModerationDesc")}</AlertDescription>
          </Alert>
        )}
        {ad.moderation === "rejected" && (
          <Alert variant="error">
            <AlertTitle>{t("pages.adDetail.ownerRejectedTitle")}</AlertTitle>
            <AlertDescription>{t("pages.adDetail.ownerRejectedDesc")}</AlertDescription>
          </Alert>
        )}

        <Badge variant={DEAL_VARIANT[ad.status]} withIcon={false} className="w-fit gap-[6px]">
          <Tag size={12} /> {ad.status}
        </Badge>

        <h1
          className="font-display text-[22px] font-bold leading-[1.2] sm:text-[24px]"
          style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
        >
          {ad.title}
        </h1>

        <div
          className="font-display text-[30px] font-bold leading-none sm:text-[34px]"
          style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
        >
          {ad.price.toLocaleString("ru")} ₽
        </div>

        <div className="flex flex-wrap gap-x-[16px] gap-y-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
          {ad.city && (
            <span className="inline-flex items-center gap-[6px]">
              <MapPin size={14} className="shrink-0" />
              {ad.city}
            </span>
          )}
          {ad.createdAt && (
            <span className="inline-flex items-center gap-[6px]">
              <Clock size={14} className="shrink-0" />
              {ad.createdAt}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-[8px]">
          <StatTile
            icon={<Eye size={14} />}
            label={t("pages.adDetail.ownerStatViews")}
            value={ad.views ?? 0}
          />
          <StatTile
            icon={<Heart size={14} />}
            label={t("pages.adDetail.ownerStatFavorites")}
            value={ad.likes ?? 0}
          />
          <StatTile
            icon={<MessageSquare size={14} />}
            label={t("pages.adDetail.ownerStatMessages")}
            value="—"
          />
        </div>

        <div className="flex flex-col gap-[8px]">
          <Button onClick={onEdit} size="lg" className="w-full rounded-[var(--r-button)]" disabled={busy}>
            <Pencil size={16} /> {t("pages.adDetail.ownerEdit")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onUnpublish}
            className="w-full rounded-[var(--r-button)]"
            disabled={busy}
          >
            <Archive size={16} /> {t("pages.adDetail.ownerUnpublish")}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onPreviewAsBuyer}
            className="w-full rounded-[var(--r-button)]"
            disabled={busy}
          >
            <UserRound size={16} /> {t("pages.adDetail.ownerPreviewAsBuyer")}
          </Button>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="grid grid-cols-2 gap-[8px]">
            {!ad.promoted && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setBoostOpen(true)}
                className="h-[44px] w-full whitespace-normal rounded-[var(--r-button)] px-[10px] text-[13px] leading-tight"
                disabled={busy}
              >
                <Zap size={16} className="shrink-0" /> {t("pages.adDetail.ownerBoost")}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={onShare}
              className={cn(
                "h-[44px] w-full whitespace-normal rounded-[var(--r-button)] px-[10px] text-[13px] leading-tight",
                ad.promoted && "col-span-2",
              )}
              disabled={busy}
            >
              <Share2 size={16} className="shrink-0" /> {t("pages.adDetail.ownerShare")}
            </Button>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={onDelete}
            className="h-[44px] w-full whitespace-normal rounded-[var(--r-button)] px-[10px] text-[13px] leading-tight"
            disabled={busy}
            style={{ color: "var(--error)", borderColor: "color-mix(in oklab, var(--error) 35%, var(--border))" }}
          >
            <Trash2 size={16} className="shrink-0" /> {t("pages.adDetail.ownerDelete")}
          </Button>
        </div>
      </Card>

      <BoostSheet
        open={boostOpen}
        onClose={() => setBoostOpen(false)}
        listingId={ad.id}
        listingTitle={ad.title}
      />
    </>
  );
}
