import { useHasToken } from "@/hooks/use-has-token";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useCurrentUser, useSessionResolved } from "@/lib/session";
import {
  isAnonymousUser,
  isPhoneVerified,
  isPhoneVerificationRequired,
} from "@/lib/auth/verification";
import { isDemoMode } from "@/lib/demo-mode";

/**
 * Спокойная строка про телефон — вместо всплывающего окна. Решение З3.
 *
 * Пункт 3 решения: «В профиле — спокойная строка „Подтвердите телефон,
 * чтобы размещать объявления“ с кнопкой, без всплывающих окон». Эта строка
 * ею и стала, и текст у неё теперь называет настоящую причину.
 *
 * Прежний текст — «чтобы получить доступ к этой функции» — был верен, пока
 * телефон требовался на 134 маршрутах. По решению З2 он нужен для двух
 * действий, и обещать «доступ к функциям» значило бы пугать человека тем,
 * чего нет: всё остальное на сайте ему открыто.
 *
 * Со `/feed` и `/subscription` строка снята: там телефон не нужен ни для
 * чего, и напоминание на каждом заходе в ленту — то самое «окно всплывает
 * постоянно», только в виде плашки. Осталась там, где речь о деньгах и
 * реквизитах, и в настройках учётной записи.
 */
export function VerificationBanner() {
  const me = useCurrentUser();
  const sessionReady = useSessionResolved();
  const hasToken = useHasToken();

  // Guests must see login, not SMS. Also wait for the boot-time session probe
  // so GUEST_USER is not treated as an unverified account on reload.
  if (!sessionReady || isDemoMode()) return null;
  if (!hasToken || isAnonymousUser(me)) return null;
  if (!isPhoneVerificationRequired(me) || isPhoneVerified(me)) return null;

  return (
    <div
      className="flex items-start gap-[12px] rounded-[var(--r-card)] border px-[14px] py-[12px]"
      style={{
        borderColor: "color-mix(in oklab, var(--accent) 35%, var(--border))",
        background: "color-mix(in oklab, var(--accent) 8%, var(--background-elevated))",
      }}
    >
      <ShieldAlert size={18} className="mt-[2px] shrink-0" style={{ color: "var(--accent)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
          Подтвердите телефон, чтобы размещать объявления
        </p>
        <p className="mt-[4px] text-[13px] leading-snug" style={{ color: "var(--foreground-70)" }}>
          Подтверждённый номер нужен для двух вещей: разместить объявление и вывести средства. Всё
          остальное на сайте открыто и без него.
        </p>
        <Link
          to="/settings/account"
          className="mt-[8px] inline-block text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Подтвердить номер →
        </Link>
      </div>
    </div>
  );
}
