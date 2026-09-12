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
  Продаю: "info",
  Куплю: "info",
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

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="grid h-full min-h-[92px] grid-rows-[18px_minmax(0,1fr)_auto] items-center justify-items-center gap-[4px] rounded-[10px] px-[6px] py-[10px] text-center"
      style={{ background: "var(--background-surface)" }}
    >
      <span
        className="grid h-[16px] w-[16px] place-items-center"
        style={{ color: "var(--foreground-50)" }}
      >
        {icon}
      </span>
      <span
        className="font-display text-[18px] font-bold tabular-nums leading-none"
        style={{ color: "var(--foreground)" }}
      >
        {value}
      </span>
      <span
        className="line-clamp-2 text-[10px] font-medium leading-[1.2]"
        style={{ color: "var(--foreground-50)" }}
      >
        {label}
      </span>
    </div>
  );
}

/** Широкая кнопка блока: переносит подпись, высота не меньше 44. */
const WRAP_LG =
  "h-auto min-h-[44px] w-full whitespace-normal rounded-[var(--r-button)] px-[16px] py-[10px] text-center leading-snug";

/** Кнопка в ряду во всю ширину — «Удалить». */
const WRAP_ROW =
  "inline-flex h-auto min-h-[44px] w-full min-w-0 items-center justify-center gap-[8px] whitespace-normal rounded-[var(--r-button)] px-[12px] py-[10px] text-center text-[13px] leading-snug";

/**
 * Кнопка пары. Основа ширины — подпись в одну строку (`flex-basis:
 * max-content`): по ней `flex-wrap` решает, помещаются ли обе рядом. Не
 * помещаются — вторая уходит на новую строку и растягивается во всю ширину.
 * Подпись длиннее целого ряда сжимается (`min-w-0`) и переносится внутри.
 *
 * Первая версия ставила `min-width: min(100%, max-content)` — и не работала:
 * математические функции CSS не принимают `max-content`, браузер молча
 * выбрасывал правило, и пара оставалась рядом с подписью в две строки.
 */
const WRAP_PAIR =
  "inline-flex h-auto min-h-[44px] min-w-0 flex-[1_1_max-content] items-center justify-center gap-[8px] whitespace-normal rounded-[var(--r-button)] px-[12px] py-[10px] text-center text-[13px] leading-snug";

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

        <div
          className="flex flex-wrap gap-x-[16px] gap-y-[8px] text-[13px]"
          style={{ color: "var(--foreground-70)" }}
        >
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

        <div className="grid grid-cols-3 items-stretch gap-[8px]">
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

        {/*
          Кнопки блока переносят подпись, а не выталкивают её наружу.

          У базовой кнопки `whitespace-nowrap` и фиксированная высота: пока
          подпись короче кнопки, это незаметно. «Поднять объявление» на
          половине панели в 360 уже не помещалась — на 375, 1024 и 1440 текст
          вылезал на 15–19 px и ложился на соседнюю «Поделиться» (замер 13.09).
          С подписью в полтора раза длиннее — а переводы длиннее русского
          именно так — вылезали все шесть кнопок, до 164 px.

          Поэтому здесь `whitespace-normal` и высота «не меньше 44»: короткая
          подпись даёт ту же кнопку, длинная — кнопку в две строки, но никогда
          не текст поверх соседа.
        */}
        <div className="flex flex-col gap-[8px]">
          <Button onClick={onEdit} size="lg" className={WRAP_LG} disabled={busy}>
            <Pencil size={16} /> {t("pages.adDetail.ownerEdit")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onUnpublish}
            className={WRAP_LG}
            disabled={busy}
          >
            <Archive size={16} /> {t("pages.adDetail.ownerUnpublish")}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onPreviewAsBuyer}
            className={WRAP_LG}
            disabled={busy}
          >
            <UserRound size={16} /> {t("pages.adDetail.ownerPreviewAsBuyer")}
          </Button>
        </div>

        <div className="flex flex-col gap-[8px]">
          {/*
            Пара рядом, пока обе подписи помещаются в строку, иначе — друг под
            другом. Решает не брейкпоинт, а сама подпись: `flex-wrap` и
            минимальная ширина «по содержимому, но не шире ряда». Сетка в две
            колонки делила ряд пополам независимо от текста — отсюда и вылет.
          */}
          <div className="flex flex-wrap gap-[8px]">
            {!ad.promoted && (
              <Button
                variant="outline"
                onClick={() => setBoostOpen(true)}
                className={WRAP_PAIR}
                disabled={busy}
              >
                <Zap size={16} className="shrink-0" />
                <span className="min-w-0 text-center">{t("pages.adDetail.ownerBoost")}</span>
              </Button>
            )}
            <Button variant="outline" onClick={onShare} className={WRAP_PAIR} disabled={busy}>
              <Share2 size={16} className="shrink-0" />
              <span className="min-w-0 text-center">{t("pages.adDetail.ownerShare")}</span>
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={onDelete}
            className={WRAP_ROW}
            disabled={busy}
            style={{
              color: "var(--error)",
              borderColor: "color-mix(in oklab, var(--error) 35%, var(--border))",
            }}
          >
            <Trash2 size={16} className="shrink-0" />
            <span className="min-w-0 text-center">{t("pages.adDetail.ownerDelete")}</span>
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
