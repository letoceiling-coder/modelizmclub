import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star, ChevronRight, Calendar } from "lucide-react";
import type { AdSeller } from "@/lib/mock";
import { Card } from "@/components/ui/card";

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
        width={44}
        height={44}
        className="h-[44px] w-[44px] shrink-0 object-cover"
        style={{ borderRadius: "var(--r-pill)", border: "1px solid var(--border)" }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="grid h-[44px] w-[44px] shrink-0 place-items-center text-[15px] font-semibold"
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

/** Compact — identity + rating only. Contact actions (Написать/Позвонить)
 *  live solely in the sticky AdActionPanel now, so this doesn't duplicate
 *  them; tapping the row just opens the seller's profile. */
export function SellerCard({ seller }: { seller: AdSeller }) {
  const hasRating = seller.rating > 0;
  const hasDeals = seller.deals > 0;
  const hasSince = Boolean(seller.since && seller.since.trim());
  const hasStats = hasRating || hasDeals;

  return (
    <Link to="/profile">
      <Card
        className="flex items-center gap-[12px] p-[14px] transition-colors hover:bg-[var(--background-surface)]"
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <SellerAvatar seller={seller} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            {seller.name}
          </div>
          <div className="mt-[2px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
            {hasStats ? (
              <>
                {hasRating && (
                  <span className="inline-flex items-center gap-[3px]">
                    <Star size={11} fill="currentColor" style={{ color: "var(--warning)" }} />
                    <span style={{ color: "var(--foreground)" }}>{seller.rating.toFixed(1)}</span>
                  </span>
                )}
                {hasDeals && <span>{seller.deals} сделок</span>}
              </>
            ) : (
              <span style={{ color: "var(--foreground-50)" }}>Продавец на МоДелизМ</span>
            )}
            {hasSince && (
              <span className="inline-flex items-center gap-[3px]" style={{ color: "var(--foreground-50)" }}>
                <Calendar size={10} /> с {seller.since}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0" style={{ color: "var(--foreground-30)" }} />
      </Card>
    </Link>
  );
}
