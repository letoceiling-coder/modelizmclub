import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star, MessageSquare, Calendar } from "lucide-react";
import type { AdSeller } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function SellerAvatar({ seller }: { seller: AdSeller }) {
  const [broken, setBroken] = useState(false);
  const hasImg = Boolean(seller.avatar && seller.avatar.trim()) && !broken;

  if (hasImg) {
    return (
      <img
        src={seller.avatar}
        alt={seller.name}
        width={56}
        height={56}
        className="h-[56px] w-[56px] shrink-0 object-cover"
        style={{ borderRadius: "var(--r-pill)", border: "1px solid var(--border)" }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="grid h-[56px] w-[56px] shrink-0 place-items-center text-[18px] font-semibold"
      style={{
        borderRadius: "var(--r-pill)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        border: "1px solid var(--border)",
      }}
      aria-hidden
    >
      {initials(seller.name)}
    </div>
  );
}

export function SellerCard({ seller, onWrite }: { seller: AdSeller; onWrite?: () => void }) {
  const hasRating = seller.rating > 0;
  const hasDeals = seller.deals > 0;
  const hasSince = Boolean(seller.since && seller.since.trim());
  const hasStats = hasRating || hasDeals;

  return (
    <Card
      className="flex flex-col gap-[16px] p-[20px]"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-[14px]">
        <SellerAvatar seller={seller} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            {seller.name}
          </div>

          {hasStats ? (
            <div className="mt-[3px] flex items-center gap-[10px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
              {hasRating && (
                <span className="inline-flex items-center gap-[3px]">
                  <Star size={12} fill="currentColor" style={{ color: "var(--warning)" }} />
                  <span style={{ color: "var(--foreground)" }}>{seller.rating.toFixed(1)}</span>
                </span>
              )}
              {hasDeals && <span>{hasRating ? "· " : ""}{seller.deals} сделок</span>}
            </div>
          ) : (
            <div className="mt-[3px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Продавец на МоДелизМ
            </div>
          )}

          {hasSince && (
            <div className="mt-[2px] inline-flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
              <Calendar size={10} /> На сайте с {seller.since}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <Button onClick={onWrite} size="lg" className="w-full rounded-[var(--r-button)]">
          <MessageSquare size={16} /> Написать продавцу
        </Button>
        <Button asChild variant="outline" className="rounded-[var(--r-button)]">
          <Link to="/profile">Профиль продавца</Link>
        </Button>
      </div>
    </Card>
  );
}
