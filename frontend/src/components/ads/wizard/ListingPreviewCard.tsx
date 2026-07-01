import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface Props {
  title: string;
  price: string;
  /** All uploaded photos. First is the main/cover; the rest render as thumbnails. */
  images: string[];
  status: "Продаю" | "Куплю" | "Обменяю";
  category?: string;
  subcategory?: string;
}

const STATUS_VARIANT: Record<Props["status"], NonNullable<BadgeProps["variant"]>> = {
  "Продаю": "info",
  "Куплю": "info",
  "Обменяю": "secondary",
};

/** One image tile with an independent broken-photo fallback, so a single
 *  failed URL never blanks the whole preview. */
function PreviewImg({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const ok = Boolean(src && src.trim()) && !broken;
  if (!ok) {
    return (
      <div className={`grid place-items-center ${className ?? ""}`} style={{ color: "var(--foreground-30)", background: "var(--background-surface)" }}>
        <ImageOff size={20} />
      </div>
    );
  }
  return <img src={src} alt="" className={`object-cover ${className ?? ""}`} onError={() => setBroken(true)} />;
}

/** Compact listing preview used in the wizard's final step — mirrors how the
 *  card reads in the marketplace. Shows the main photo large plus a thumbnail
 *  strip of every other uploaded photo, with graceful empty/broken states. */
export function ListingPreviewCard({ title, price, images, status, category, subcategory }: Props) {
  const gallery = (images ?? []).filter((s) => s && s.trim());
  const cover = gallery[0] ?? "";
  const rest = gallery.slice(1);
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
        {cover ? (
          <PreviewImg src={cover} className="h-full w-full" />
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
        {gallery.length > 1 && (
          <span
            className="absolute bottom-[10px] right-[10px] rounded-full px-[8px] py-[2px] text-[11px] font-semibold text-white"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          >
            {gallery.length} фото
          </span>
        )}
      </div>

      {rest.length > 0 && (
        <div className="flex gap-[6px] overflow-x-auto px-[14px] pt-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rest.map((src, i) => (
            <PreviewImg
              key={`${src}-${i}`}
              src={src}
              className="h-[52px] w-[52px] shrink-0 rounded-[8px]"
            />
          ))}
        </div>
      )}

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
