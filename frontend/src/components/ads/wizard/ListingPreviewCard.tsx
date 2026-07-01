import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface Props {
  title: string;
  price: string;
  image: string;
  status: "Продаю" | "Куплю" | "Обменяю";
  category?: string;
  subcategory?: string;
}

const STATUS_VARIANT: Record<Props["status"], NonNullable<BadgeProps["variant"]>> = {
  "Продаю": "info",
  "Куплю": "info",
  "Обменяю": "secondary",
};

/** Compact listing preview used in the wizard's final step — mirrors how the
 *  card reads in the marketplace, with a graceful empty/broken-photo state. */
export function ListingPreviewCard({ title, price, image, status, category, subcategory }: Props) {
  const [broken, setBroken] = useState(false);
  const hasImage = Boolean(image && image.trim()) && !broken;
  const meta = [category, subcategory].filter(Boolean).join(" · ");

  return (
    <Card
      className="overflow-hidden"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="relative" style={{ aspectRatio: "4 / 3", background: "var(--background-surface)" }}>
        {hasImage ? (
          <img src={image} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ color: "var(--foreground-30)" }}>
            <ImageOff size={28} />
          </div>
        )}
        <Badge
          variant={STATUS_VARIANT[status]}
          withIcon={false}
          className="absolute left-[10px] top-[10px] shadow-[var(--shadow-card)]"
        >
          {status}
        </Badge>
      </div>

      <div className="space-y-[8px] p-[14px]">
        <div className="line-clamp-2 text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
          {title || "Название объявления"}
        </div>
        <div className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}>
          {Number(price || 0).toLocaleString("ru")} ₽
        </div>
        {meta && (
          <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {meta}
          </div>
        )}
      </div>
    </Card>
  );
}
