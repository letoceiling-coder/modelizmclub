import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Gift, Check, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  getReferralLink,
  REFERRAL_MAX_BONUS,
  REFERRAL_BONUS_PER_INVITE,
} from "@/lib/referral";
import { useReferral } from "@/lib/api/referral";
import { isAuthenticated } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import { GUEST_USER, useStore, selectors } from "@/lib/store";
import { ROUTES } from "@/lib/routes";
import { fetchStats } from "@/lib/api/content";

const sectionStyle = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card-lg)",
  padding: 20,
} as const;

function InviteHeader({ perInvite, maxBonus }: { perInvite: number; maxBonus: number }) {
  return (
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
          +{perInvite} бесплатное объявление за каждого друга, который зарегистрируется. Максимум — {maxBonus} объявлений.
        </p>
      </div>
    </div>
  );
}

function InviteGuestCta() {
  const [cfg, setCfg] = useState({
    enabled: true,
    perInvite: REFERRAL_BONUS_PER_INVITE,
    maxBonus: REFERRAL_MAX_BONUS,
  });
  const [ready, setReady] = useState(isDemoMode());

  useEffect(() => {
    if (isDemoMode()) return;
    let active = true;
    fetchStats()
      .then((s) => {
        if (!active) return;
        setCfg({
          enabled: s.referral?.enabled ?? true,
          perInvite: s.referral?.perInvite ?? REFERRAL_BONUS_PER_INVITE,
          maxBonus: s.referral?.maxBonus ?? REFERRAL_MAX_BONUS,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ready || !cfg.enabled) return null;

  return (
    <section id={ROUTES.subscriptionInviteHash} className="mt-[40px] scroll-mt-[24px]" style={sectionStyle}>
      <InviteHeader perInvite={cfg.perInvite} maxBonus={cfg.maxBonus} />
      <p className="mt-[16px] text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
        Войдите или создайте аккаунт, чтобы получить персональную реферальную ссылку и бонусы за приглашённых друзей.
      </p>
      <div className="mt-[16px] flex flex-wrap gap-[10px]">
        <Link
          to="/register"
          className="inline-flex h-[44px] items-center justify-center rounded-[var(--r-pill)] px-[20px] text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Создать аккаунт
        </Link>
        <Link
          to="/login"
          search={{ redirect: "/subscription" }}
          className="inline-flex h-[44px] items-center justify-center rounded-[var(--r-pill)] px-[20px] text-[14px] font-semibold transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--foreground-70)" }}
        >
          Войти
        </Link>
      </div>
    </section>
  );
}

export function InviteBlock() {
  const me = useStore(selectors.currentUser);
  const isGuest = me.id === GUEST_USER.id && !isAuthenticated() && !isDemoMode();

  if (isGuest) {
    return <InviteGuestCta />;
  }

  return <InviteBlockAuthenticated meId={me.id} />;
}

function InviteBlockAuthenticated({ meId }: { meId: string }) {
  const [copied, setCopied] = useState(false);
  const { data, loading } = useReferral();
  if (!loading && data && data.enabled === false) return null;
  const link = data?.link ?? getReferralLink(meId);
  const invitedCount = data?.invitedCount ?? 0;
  const bonus = data?.bonus ?? 0;
  const perInvite = data?.perInvite ?? REFERRAL_BONUS_PER_INVITE;
  const maxBonus = data?.maxBonus ?? REFERRAL_MAX_BONUS;
  const listingCredits = data?.listingCredits ?? 0;
  const remaining = Math.max(0, maxBonus - bonus);

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
    <section id={ROUTES.subscriptionInviteHash} className="mt-[40px] scroll-mt-[24px]" style={sectionStyle}>
      <InviteHeader perInvite={perInvite} maxBonus={maxBonus} />

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
          type="button"
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
            Приглашено: <b style={{ color: "var(--foreground)" }}>{invitedCount}</b>
          </span>
          <span style={{ color: "var(--foreground-50)" }}>
            Бонус: <b style={{ color: "var(--accent)" }}>+{bonus}</b> объявлений
          </span>
          {!loading && (
            <span style={{ color: "var(--foreground-50)" }}>
              Доступно: <b style={{ color: "var(--foreground)" }}>{listingCredits}</b>
            </span>
          )}
          {remaining > 0 ? (
            <span style={{ color: "var(--foreground-50)" }}>Осталось: {remaining}</span>
          ) : (
            <span style={{ color: "var(--success)", fontWeight: 600 }}>Лимит достигнут</span>
          )}
        </div>
        <button
          type="button"
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
