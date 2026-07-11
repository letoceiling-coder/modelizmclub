import { MapPin, Eye, Heart, Clock, MessageSquare, Bookmark, Share2, ShieldCheck, Tag, Phone } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/** Deal-type (Продаю/Куплю/Обменяю) → Badge variant. Stays within the
 *  blue accent family + neutral; never the commercial-orange palette. */
const DEAL_VARIANT: Record<Ad["status"], NonNullable<BadgeProps["variant"]>> = {
  "Продаю": "info",
  "Куплю": "info",
  "Обменяю": "secondary",
};

interface AdActionPanelProps {
  ad: Ad;
  saved: boolean;
  onWrite: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  phoneRevealState: "idle" | "loading" | "revealed";
  revealedPhone: string | null;
  onRevealPhone: () => void;
  className?: string;
}

export function AdActionPanel({ ad, saved, onWrite, onToggleSave, onShare, phoneRevealState, revealedPhone, onRevealPhone, className }: AdActionPanelProps) {
  return (
    <Card
      className={cn("flex flex-col gap-[16px] p-[20px]", className)}
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Moderation status — only when the listing is not live */}
      {ad.moderation === "moderation" && (
        <Alert variant="warning">
          <AlertTitle>На модерации</AlertTitle>
          <AlertDescription>Объявление проверяется и пока не видно в общем каталоге.</AlertDescription>
        </Alert>
      )}
      {ad.moderation === "rejected" && (
        <Alert variant="error">
          <AlertTitle>Отклонено</AlertTitle>
          <AlertDescription>Объявление не прошло модерацию. Отредактируйте его и отправьте снова.</AlertDescription>
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
        <span className="inline-flex items-center gap-[6px] tabular-nums">
          <Eye size={14} className="shrink-0" />
          {ad.views ?? 0}
        </span>
        <span className="inline-flex items-center gap-[6px] tabular-nums">
          <Heart size={14} className="shrink-0" />
          {ad.likes ?? 0}
        </span>
        {ad.createdAt && (
          <span className="inline-flex items-center gap-[6px]">
            <Clock size={14} className="shrink-0" />
            {ad.createdAt}
          </span>
        )}
      </div>

      {ad.condition && (
        <Badge variant="secondary" withIcon={false} className="w-fit">
          {ad.condition}
        </Badge>
      )}

      <div className="flex flex-col gap-[8px]">
        <Button onClick={onWrite} size="lg" className="w-full rounded-[var(--r-button)]">
          <MessageSquare size={16} /> Написать продавцу
        </Button>
        {phoneRevealState === "revealed" && revealedPhone ? (
          <Button asChild variant="outline" size="lg" className="w-full rounded-[var(--r-button)]">
            <a href={`tel:${revealedPhone.replace(/[^\d+]/g, "")}`}>
              <Phone size={16} /> {revealedPhone}
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            onClick={onRevealPhone}
            loading={phoneRevealState === "loading"}
            className="w-full rounded-[var(--r-button)]"
          >
            {phoneRevealState === "loading" ? "Загрузка…" : (
              <>
                <Phone size={16} /> Позвонить продавцу
              </>
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-[8px]">
          <Button
            variant="outline"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={cn(
              "rounded-[var(--r-button)]",
              saved && "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
            )}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
            {saved ? "В избранном" : "В избранное"}
          </Button>
          <Button variant="outline" onClick={onShare} className="rounded-[var(--r-button)]">
            <Share2 size={14} /> Поделиться
          </Button>
        </div>
      </div>

      <div
        className="flex items-center gap-[8px] p-[10px] text-[11px]"
        style={{ background: "var(--background-surface)", color: "var(--foreground-70)", borderRadius: "var(--r-card-sm)" }}
      >
        <ShieldCheck size={14} className="shrink-0" style={{ color: "var(--success)" }} />
        Безопасная сделка: оплата при получении или через эскроу.
      </div>
    </Card>
  );
}
