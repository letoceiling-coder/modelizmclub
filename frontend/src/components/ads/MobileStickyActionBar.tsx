import { MessageSquare, Phone } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Button } from "@/components/ui/button";

interface Props {
  ad: Ad;
  onWrite: () => void;
  phoneRevealState: "idle" | "loading" | "revealed";
  revealedPhone: string | null;
  onRevealPhone: () => void;
}

/** Avito's mobile listing page pins price + primary contact actions to a
 *  fixed bottom bar instead of the desktop sticky sidebar (there's no room
 *  for a side rail below lg, and a sticky-in-flow block would just get
 *  scrolled past like everything else). Sits above the app's own fixed
 *  BottomNav via --bottom-nav-space, never on top of it. */
export function MobileStickyActionBar({ ad, onWrite, phoneRevealState, revealedPhone, onRevealPhone }: Props) {
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
        <div className="font-display text-[16px] font-bold leading-none" style={{ color: "var(--foreground)" }}>
          {ad.price.toLocaleString("ru")} ₽
        </div>
      </div>
      <div className="flex min-w-0 flex-1 gap-[6px]">
        {phoneRevealState === "revealed" && revealedPhone ? (
          <Button asChild variant="success" size="sm" className="min-w-0 flex-1 rounded-[var(--r-button)] px-[8px]">
            <a href={`tel:${revealedPhone.replace(/[^\d+]/g, "")}`}>
              <Phone size={14} /> <span className="truncate">{revealedPhone}</span>
            </a>
          </Button>
        ) : (
          <Button
            variant="success"
            size="sm"
            onClick={onRevealPhone}
            loading={phoneRevealState === "loading"}
            className="min-w-0 flex-1 rounded-[var(--r-button)] px-[8px]"
          >
            <Phone size={14} />
          </Button>
        )}
        <Button onClick={onWrite} size="sm" className="min-w-0 flex-[2] rounded-[var(--r-button)] px-[8px]">
          <MessageSquare size={14} /> Написать
        </Button>
      </div>
    </div>
  );
}
