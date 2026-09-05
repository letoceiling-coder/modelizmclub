import { useState } from "react";
import { variantUrl } from "@/lib/media/variants";
import { Star, ChevronRight, Calendar, ShieldCheck } from "lucide-react";
import type { AdSeller } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";

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
        src={variantUrl(seller.avatar, "thumb")}
        loading="lazy"
        decoding="async"
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

function reviewsNoun(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "отзывов";
  switch (n % 10) {
    case 1:
      return "отзыв";
    case 2:
    case 3:
    case 4:
      return "отзыва";
    default:
      return "отзывов";
  }
}

/** Compact — identity + rating only. Contact actions (Написать/Позвонить)
 *  live solely in the sticky AdActionPanel now, so this doesn't duplicate
 *  them; tapping the row just opens the seller's profile. */
export function SellerCard({ seller }: { seller: AdSeller }) {
  const guest = useGuestAccessOptional();
  const hasRating = seller.rating > 0;
  const reviews = seller.reviews ?? 0;
  const hasDeals = seller.deals > 0;
  const hasSince = Boolean(seller.since && seller.since.trim());
  const hasStats = hasRating || hasDeals;
  const href = `/user/${seller.id}`;
  const actionKey =
    guest && !guest.isAllowed("ads.seller.profile") ? "ads.seller.profile" : "route.user";

  return (
    <GuestGuardLink actionKey={actionKey} to={href}>
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
          <div className="flex items-center gap-[6px]">
            <span
              className="truncate text-[14px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {seller.name}
            </span>
            {seller.trusted && (
              <span
                className="inline-flex shrink-0 items-center gap-[3px] px-[6px] py-[1px] text-[11px] font-semibold"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  borderRadius: "var(--r-pill)",
                }}
                title="Рейтинг не ниже 4,5 по 10 и более отзывам"
              >
                <ShieldCheck size={11} /> Надёжный продавец
              </span>
            )}
          </div>
          <div
            className="mt-[2px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[12px]"
            style={{ color: "var(--foreground-70)" }}
          >
            {hasStats ? (
              <>
                {hasRating && (
                  <span className="inline-flex items-center gap-[3px]">
                    <Star size={11} fill="currentColor" style={{ color: "var(--warning)" }} />
                    <span style={{ color: "var(--foreground)" }}>{seller.rating.toFixed(1)}</span>
                    {reviews > 0 && (
                      <span>
                        · {reviews} {reviewsNoun(reviews)}
                      </span>
                    )}
                  </span>
                )}
                {hasDeals && <span>{seller.deals} сделок</span>}
              </>
            ) : (
              <span style={{ color: "var(--foreground-50)" }}>Продавец на МоДелизМ</span>
            )}
            {hasSince && (
              <span
                className="inline-flex items-center gap-[3px]"
                style={{ color: "var(--foreground-50)" }}
              >
                <Calendar size={10} /> с {seller.since}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0" style={{ color: "var(--foreground-30)" }} />
      </Card>
    </GuestGuardLink>
  );
}
