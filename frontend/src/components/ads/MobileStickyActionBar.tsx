import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SellerCallButton, type SellerCall } from "@/components/ads/SellerCallButton";
import type { Ad } from "@/lib/mock";
import { Button } from "@/components/ui/button";

interface Props {
  ad: Ad;
  onWrite: () => void;
  call?: SellerCall;
}

/** Avito's mobile listing page pins price + primary contact actions to a
 *  fixed bottom bar instead of the desktop sticky sidebar (there's no room
 *  for a side rail below lg, and a sticky-in-flow block would just get
 *  scrolled past like everything else). Sits above the app's own fixed
 *  BottomNav via --bottom-nav-space, never on top of it. */
export function MobileStickyActionBar({ ad, onWrite, call }: Props) {
  const { t } = useTranslation();
  /*
   * На 375 в полосе цена и две кнопки. До раскрытия главная — «Написать»,
   * звонок значком; после — номер во всю ширину, чтобы по нему можно было
   * попасть пальцем и позвонить, а «Написать» уходит в значок.
   */
  const revealed = Boolean(call?.phone);
  return (
    <div
      className="fixed inset-x-0 z-[calc(var(--z-sticky)+1)] flex items-center gap-[8px] px-[12px] py-[10px] lg:hidden"
      style={{
        bottom: "var(--bottom-nav-space)",
        background: "var(--background-elevated)",
        borderTop: "1px solid var(--border)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="min-w-0 shrink-0">
        <div
          className="font-display text-[16px] font-bold leading-none"
          style={{ color: "var(--foreground)" }}
        >
          {ad.price.toLocaleString("ru")} ₽
        </div>
      </div>
      <div className="flex min-w-0 flex-1 gap-[6px]">
        {revealed ? (
          <Button
            onClick={onWrite}
            size="icon"
            aria-label={t("pages.adDetail.writeShort")}
            className="shrink-0 rounded-[var(--r-button)]"
          >
            <MessageSquare size={14} />
          </Button>
        ) : (
          <Button
            onClick={onWrite}
            size="sm"
            className="min-w-0 flex-1 rounded-[var(--r-button)] px-[8px]"
          >
            <MessageSquare size={14} /> Написать продавцу
          </Button>
        )}
        {call && (
          <SellerCallButton
            call={call}
            size="sm"
            iconOnly={!revealed}
            className={revealed ? "min-w-0 flex-1 px-2" : "shrink-0"}
          />
        )}
      </div>
    </div>
  );
}
