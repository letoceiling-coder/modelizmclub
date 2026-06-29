import { Link } from "@tanstack/react-router";
import { Star, ShieldCheck, MessageSquare, Calendar } from "lucide-react";
import type { AdSeller } from "@/lib/mock";

export function SellerCard({ seller, onWrite }: { seller: AdSeller; onWrite?: () => void }) {
  return (
    <div
      className="flex flex-col gap-[16px] p-[20px]"
      style={{
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-[14px]">
        <img
          src={seller.avatar}
          alt={seller.name}
          width={56}
          height={56}
          className="h-[56px] w-[56px] object-cover"
          style={{ borderRadius: "var(--r-pill)", border: "1px solid var(--border)" }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[6px] text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            <span className="truncate">{seller.name}</span>
            <ShieldCheck size={14} style={{ color: "var(--success)" }} />
          </div>
          <div className="mt-[3px] flex items-center gap-[10px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
            <span className="inline-flex items-center gap-[3px]">
              <Star size={12} fill="currentColor" style={{ color: "var(--warning)" }} />
              <span style={{ color: "var(--foreground)" }}>{seller.rating.toFixed(1)}</span>
            </span>
            <span>· {seller.deals} сделок</span>
          </div>
          <div className="mt-[2px] inline-flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
            <Calendar size={10} /> На сайте с {seller.since}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <button
          type="button"
          onClick={onWrite}
          className="inline-flex items-center justify-center gap-[8px] py-[12px] text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "var(--r-button)",
            boxShadow: "var(--shadow-button)",
          }}
        >
          <MessageSquare size={16} /> Написать продавцу
        </button>
        <Link
          to="/profile"
          className="inline-flex items-center justify-center py-[10px] text-[13px] font-medium transition-colors"
          style={{
            background: "transparent",
            color: "var(--foreground-70)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
          }}
        >
          Профиль продавца
        </Link>
      </div>
    </div>
  );
}
