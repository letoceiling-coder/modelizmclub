import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Share2, Gift, Users, MousePointerClick, Phone, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { useReferral } from "@/lib/api/referral";
import { isAuthenticated } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import { GUEST_USER } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { getReferralLink, REFERRAL_BONUS_PER_INVITE, REFERRAL_MAX_BONUS } from "@/lib/referral";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/referral")({
  head: () => ({ meta: [{ title: "Пригласи друга — МоДелизМ Клуб" }] }),
  component: ReferralPage,
});

const card: React.CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card-lg)",
  padding: 20,
};

function ReferralPage() {
  const me = useCurrentUser();
  const isGuest = me.id === GUEST_USER.id && !isAuthenticated() && !isDemoMode();

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[720px] px-[16px] py-[28px]">
        {isGuest ? <GuestCard /> : <Dashboard meId={me.id} />}
      </div>
    </AppLayout>
  );
}

function GuestCard() {
  return (
    <section style={card}>
      <Header perInvite={REFERRAL_BONUS_PER_INVITE} maxBonus={REFERRAL_MAX_BONUS} />
      <p
        className="mt-[16px] text-[14px] leading-relaxed"
        style={{ color: "var(--foreground-70)" }}
      >
        Войдите или создайте аккаунт, чтобы получить персональную ссылку. Бонус начисляется после
        того, как друг подтвердит телефон.
      </p>
      <div className="mt-[16px] flex flex-wrap gap-[10px]">
        <Link
          to="/register"
          className="inline-flex h-[44px] items-center justify-center rounded-[var(--r-pill)] px-[20px] text-[14px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Создать аккаунт
        </Link>
        <Link
          to="/login"
          search={{ redirect: "/referral" }}
          className="inline-flex h-[44px] items-center justify-center rounded-[var(--r-pill)] px-[20px] text-[14px] font-semibold"
          style={{ border: "1px solid var(--border)", color: "var(--foreground-70)" }}
        >
          Войти
        </Link>
      </div>
    </section>
  );
}

function Header({ perInvite, maxBonus }: { perInvite: number; maxBonus: number }) {
  return (
    <div className="flex items-start gap-[12px]">
      <div
        className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Gift size={18} />
      </div>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--foreground)",
          }}
        >
          Пригласи друга
        </h1>
        <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 4 }}>
          +{perInvite} бесплатное объявление за каждого друга с подтверждённым телефоном. Максимум —{" "}
          {maxBonus}.
        </p>
      </div>
    </div>
  );
}

function Dashboard({ meId }: { meId: string }) {
  const { data, loading } = useReferral();
  const [copied, setCopied] = useState(false);
  const link = data?.link ?? getReferralLink(meId);
  const perInvite = data?.perInvite ?? REFERRAL_BONUS_PER_INVITE;
  const maxBonus = data?.maxBonus ?? REFERRAL_MAX_BONUS;

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

  const shareNative = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "МоДелизМ Клуб",
          text: "Присоединяйся к клубу моделистов",
          url: link,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy();
  };

  const encoded = encodeURIComponent(link);
  const text = encodeURIComponent("Присоединяйся к МоДелизМ Клубу");

  return (
    <div className="space-y-[16px]">
      <section style={card}>
        <Header perInvite={perInvite} maxBonus={maxBonus} />
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
            className="inline-flex shrink-0 items-center gap-[6px]"
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
            {copied ? "Скопировано" : "Скопировать ссылку"}
          </button>
        </div>
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          <button type="button" onClick={shareNative} style={shareBtn}>
            <Share2 size={14} /> Поделиться
          </button>
          <a
            href={`https://t.me/share/url?url=${encoded}&text=${text}`}
            target="_blank"
            rel="noreferrer"
            style={shareBtn}
          >
            Telegram
          </a>
          <a
            href={`https://vk.com/share.php?url=${encoded}`}
            target="_blank"
            rel="noreferrer"
            style={shareBtn}
          >
            VK
          </a>
          <a
            href={`https://wa.me/?text=${encoded}`}
            target="_blank"
            rel="noreferrer"
            style={shareBtn}
          >
            WhatsApp
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
        <Stat
          icon={<MousePointerClick size={16} />}
          label="Переходов"
          value={loading ? "…" : String(data?.clicks ?? 0)}
        />
        <Stat
          icon={<Users size={16} />}
          label="Зарегистрировались"
          value={loading ? "…" : String(data?.invitedCount ?? 0)}
        />
        <Stat
          icon={<Phone size={16} />}
          label="Подтвердили телефон"
          value={loading ? "…" : String(data?.verified ?? 0)}
        />
        <Stat
          icon={<Sparkles size={16} />}
          label="Бонусов"
          value={loading ? "…" : `${data?.bonus ?? 0} объявл.`}
        />
      </section>

      <section style={card}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--foreground)",
          }}
        >
          Приглашённые друзья
        </h2>
        {(data?.invited.length ?? 0) === 0 ? (
          <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Пока никого. Отправьте ссылку другу — бонус придёт после подтверждения телефона.
          </p>
        ) : (
          <ul className="mt-[12px] space-y-[8px]">
            {(data?.invited ?? []).map((inv) => (
              <li
                key={`${inv.user.uuid}-${inv.joinedAt}`}
                className="flex items-center justify-between gap-[12px] p-[12px]"
                style={{ border: "1px solid var(--border)", borderRadius: 12 }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                    {inv.user.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--foreground-50)" }}>
                    {inv.joinedAt ? formatDate(inv.joinedAt, "relative") : ""}
                  </div>
                </div>
                <span
                  className="shrink-0 font-semibold"
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: "var(--r-pill)",
                    color: inv.status === "completed" ? "var(--success)" : "var(--foreground-70)",
                    background:
                      inv.status === "completed"
                        ? "var(--success-soft)"
                        : "var(--background-surface)",
                  }}
                >
                  {inv.status === "completed" ? "Бонус начислен" : "Ожидает подтверждения телефона"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div className="flex items-center gap-[6px]" style={{ color: "var(--accent)" }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>{label}</span>
      </div>
      <div
        className="mt-[6px]"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          color: "var(--foreground)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const shareBtn: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid var(--border)",
  borderRadius: "var(--r-button)",
  color: "var(--foreground-70)",
  fontWeight: 500,
  fontSize: 13,
};
