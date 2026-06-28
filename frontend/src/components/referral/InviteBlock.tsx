import { useEffect, useState } from "react";
import { Copy, Gift, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  getReferralLink,
  getInvitedFriends,
  getReferralBonus,
  REFERRAL_MAX_BONUS,
  REFERRAL_BONUS_PER_INVITE,
} from "@/lib/referral";
import { useStore, selectors } from "@/lib/store";

export function InviteBlock() {
  const me = useStore(selectors.currentUser);
  const [copied, setCopied] = useState(false);
  // Initial render (SSR + first client paint) uses the stable canonical link
  // so hydration matches. The actual origin-derived link replaces it on mount.
  const [link, setLink] = useState<string>(() => getReferralLink(me.id));
  useEffect(() => setLink(getReferralLink(me.id)), [me.id]);
  const invited = getInvitedFriends();
  const bonus = getReferralBonus();
  const remaining = Math.max(0, REFERRAL_MAX_BONUS - bonus);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "МоДелизМ Клуб",
          text: "Присоединяйся к клубу моделистов",
          url: link,
        });
      } catch {
        /* отменено */
      }
    } else {
      copy();
    }
  };

  return (
    <section
      className="mt-[40px]"
      style={{
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card-lg)",
        padding: 20,
      }}
    >
      <div className="flex items-start gap-[12px]">
        <div
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Gift size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--foreground)",
            }}
          >
            Пригласи друга
          </h3>
          <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4 }}>
            +{REFERRAL_BONUS_PER_INVITE} бесплатное объявление за каждого друга, который зарегистрируется. Максимум — {REFERRAL_MAX_BONUS} объявлений.
          </p>
        </div>
      </div>

      <div
        className="mt-[16px] flex items-center gap-[8px]"
        style={{
          background: "var(--background-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-button)",
          padding: "4px 4px 4px 14px",
        }}
      >
        <span
          className="flex-1 truncate"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--foreground-70)" }}
        >
          {link}
        </span>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-[6px] transition-colors"
          style={{
            height: 36,
            padding: "0 14px",
            background: copied ? "var(--success)" : "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            borderRadius: "var(--r-button)",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>

      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-[10px]">
        <div className="flex items-center gap-[12px] text-[13px]">
          <span style={{ color: "var(--foreground-50)" }}>
            Приглашено: <b style={{ color: "var(--foreground)" }}>{invited.length}</b>
          </span>
          <span style={{ color: "var(--foreground-50)" }}>
            Бонус: <b style={{ color: "var(--accent)" }}>+{bonus}</b> объявлений
          </span>
          {remaining > 0 ? (
            <span style={{ color: "var(--foreground-50)" }}>Осталось: {remaining}</span>
          ) : (
            <span style={{ color: "var(--success)", fontWeight: 600 }}>Лимит достигнут</span>
          )}
        </div>
        <button
          onClick={share}
          className="inline-flex items-center gap-[6px] transition-colors"
          style={{
            height: 36,
            padding: "0 14px",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--foreground-70)",
            fontWeight: 500,
            fontSize: 13,
            borderRadius: "var(--r-button)",
          }}
        >
          <Share2 size={14} /> Поделиться
        </button>
      </div>
    </section>
  );
}
