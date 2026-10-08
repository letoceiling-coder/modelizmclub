import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { askConfirm } from "@/lib/ui/ask";
import { Loader2, LogOut } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldMessage } from "@/components/ui/field-message";
import { passwordMatchState } from "@/lib/password-match";
import { revealAndFocus } from "@/lib/ui/reveal-and-focus";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { isDemoMode } from "@/lib/demo-mode";
import { changePassword, logoutOtherDevices } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/settings/security")({
  component: SecuritySection,
});

/** Поля формы смены пароля в том порядке, в каком они стоят на экране. */
type Поле = "current" | "next" | "confirmation";

const ПОРЯДОК: Поле[] = ["current", "next", "confirmation"];

/* Ключи — как их называет `ChangePasswordController`: `current_password` и
   `new_password`. Не `password`: у смены пароля свои имена, не такие, как у
   регистрации, и проверено это чтением контроллера, а не по памяти.
   Требование к длине там тоже `min:8` — то же, что на клиенте. */
const ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА: Record<string, Поле> = {
  current_password: "current",
  new_password: "next",
};

function Field({
  label,
  children,
  message,
}: {
  label: string;
  children: React.ReactNode;
  /** Подпись под полем: отказ или подтверждение. Решение Ж1 от 09.10. */
  message?: { id: string; tone: "error" | "ok"; текст: string } | null;
}) {
  return (
    <label className="block">
      <span
        className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]"
        style={{ color: "var(--foreground-50)" }}
      >
        {label}
      </span>
      {children}
      {message && (
        <FieldMessage id={message.id} tone={message.tone}>
          {message.текст}
        </FieldMessage>
      )}
    </label>
  );
}

function SecuritySection() {
  const { t } = useTranslation();
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [confirmLeft, setConfirmLeft] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Поле, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const узлы = useRef<Partial<Record<Поле, HTMLElement | null>>>({});

  /*
   * Решение Ж1 от 09.10 — то же правило, что в регистрации и в
   * восстановлении пароля, из `lib/password-match.ts`.
   *
   * Было: три отказа подряд всплывающими сообщениями («Введите текущий
   * пароль», «Новый пароль — минимум 8 символов», «Пароли не совпадают»), и
   * ни одного слова у поля, к которому отказ относится.
   */
  const совпадение = passwordMatchState(newPw, confirmPw, { left: confirmLeft });

  const повтор: { id: string; tone: "error" | "ok"; текст: string } | null = errors.confirmation
    ? { id: "sec-confirm-msg", tone: "error", текст: errors.confirmation }
    : совпадение === "mismatch"
      ? { id: "sec-confirm-msg", tone: "error", текст: t("passwordField.mismatch") }
      : совпадение === "match"
        ? { id: "sec-confirm-msg", tone: "ok", текст: t("passwordField.match") }
        : null;

  const очистить = (поле: Поле) =>
    setErrors((прежние) => {
      if (!(поле in прежние)) return прежние;
      const копия = { ...прежние };
      delete копия[поле];
      return копия;
    });

  const показатьПервое = (найденные: Partial<Record<Поле, string>>) => {
    const первое = ПОРЯДОК.find((поле) => найденные[поле]);
    if (первое) revealAndFocus(узлы.current[первое]);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const список: Array<[Поле, string]> = [];
    if (!curPw) список.push(["current", t("pages.settings.enterCurrentPassword")]);
    if (!newPw) список.push(["next", t("passwordField.required")]);
    else if (newPw.length < 8) список.push(["next", t("pages.settings.passwordMin8")]);
    if (!confirmPw) список.push(["confirmation", t("passwordField.confirmRequired")]);
    else if (newPw !== confirmPw) список.push(["confirmation", t("passwordField.mismatch")]);

    if (список.length > 0) {
      const найденные = Object.fromEntries(список) as Partial<Record<Поле, string>>;
      setErrors(найденные);
      setConfirmLeft(true);
      показатьПервое(найденные);
      return;
    }
    setErrors({});
    if (isDemoMode()) {
      toast(t("pages.settings.demoPasswordChange"));
      return;
    }

    setSaving(true);
    try {
      await changePassword(curPw, newPw);
      toast.success(t("pages.settings.passwordChanged"));
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      /* Отказ сервера — у своего поля. Неверный текущий пароль приходит под
         ключом `current_password`, требования к новому — под `password`;
         всё прочее к полю не привязать, и о таком говорится всплывающим
         сообщением. */
      if (err instanceof ApiError && err.status === 422) {
        const кПолям: Partial<Record<Поле, string>> = {};
        for (const [ключ, сообщения] of Object.entries(err.errors ?? {})) {
          const поле = ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА[ключ];
          const текст = сообщения?.[0];
          if (поле && текст) кПолям[поле] = текст;
        }
        if (Object.keys(кПолям).length > 0) {
          setErrors(кПолям);
          показатьПервое(кПолям);
        } else {
          const firstMessage = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
          setErrors({ current: firstMessage ?? t("pages.settings.checkCurrentPassword") });
          показатьПервое({ current: "x" });
        }
      } else {
        toast.error(t("pages.settings.passwordChangeFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const logoutOthers = async () => {
    if (isDemoMode()) {
      toast(t("pages.settings.demoUnavailable"));
      return;
    }
    // Действие необратимо и затрагивает другие устройства — спрашиваем.
    if (
      !(await askConfirm({
        title: t("pages.settings.logoutOthersConfirm"),
        description: t("pages.settings.logoutOthersConfirmDesc"),
        confirmLabel: t("pages.settings.logoutOtherDevices"),
        danger: true,
      }))
    )
      return;
    setLoggingOut(true);
    try {
      const ended = await logoutOtherDevices();
      // Говорим то, что сделал сервер, а не то, что мы попросили.
      toast.success(
        ended > 0
          ? t("pages.settings.loggedOutOtherDevicesCount", { count: ended })
          : t("pages.settings.loggedOutNoOtherDevices"),
      );
    } catch {
      toast.error(t("pages.settings.logoutOthersFailed"));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SettingsSectionShell title={t("pages.settings.securityTitle")}>
      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.changePassword")}
        </h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.changePasswordDesc")}
        </p>
        <form onSubmit={submitPassword} className="space-y-[12px]">
          <Field
            label={t("pages.settings.currentPassword")}
            message={
              errors.current
                ? { id: "sec-current-msg", tone: "error", текст: errors.current }
                : null
            }
          >
            <PasswordInput
              value={curPw}
              onChange={(e) => {
                setCurPw(e.target.value);
                if (errors.current && e.target.value) очистить("current");
              }}
              autoComplete="current-password"
              error={Boolean(errors.current)}
              aria-describedby={errors.current ? "sec-current-msg" : undefined}
              ref={(el) => {
                узлы.current.current = el;
              }}
            />
          </Field>
          <Field
            label={t("pages.settings.newPassword")}
            message={errors.next ? { id: "sec-next-msg", tone: "error", текст: errors.next } : null}
          >
            <PasswordInput
              value={newPw}
              onChange={(e) => {
                const v = e.target.value;
                setNewPw(v);
                if (errors.next && v.length >= 8) очистить("next");
                /* Правка нового пароля пересчитывает состояние повтора. */
                if (errors.confirmation) очистить("confirmation");
              }}
              autoComplete="new-password"
              minLength={8}
              error={Boolean(errors.next)}
              aria-describedby={errors.next ? "sec-next-msg" : undefined}
              ref={(el) => {
                узлы.current.next = el;
              }}
            />
          </Field>
          <Field label={t("pages.settings.confirmNewPassword")} message={повтор}>
            <PasswordInput
              value={confirmPw}
              onChange={(e) => {
                setConfirmPw(e.target.value);
                /* Снова печатает — значит снова набор, а не брошенное поле. */
                setConfirmLeft(false);
                if (errors.confirmation) очистить("confirmation");
              }}
              onBlur={() => setConfirmLeft(true)}
              autoComplete="new-password"
              minLength={8}
              error={повтор?.tone === "error"}
              aria-describedby={повтор ? "sec-confirm-msg" : undefined}
              ref={(el) => {
                узлы.current.confirmation = el;
              }}
            />
          </Field>
          <Button type="submit" disabled={saving} className="gap-[8px]">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t("pages.settings.changePasswordBtn")}
          </Button>
        </form>
      </Card>

      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.sessionsTitle")}
        </h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.sessionsDesc")}
        </p>
        <Button
          variant="outline"
          onClick={logoutOthers}
          disabled={loggingOut}
          className="gap-[8px]"
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          {t("pages.settings.logoutOtherDevices")}
        </Button>
      </Card>

      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.blockedUsersTitle")}
        </h2>
        {/*
         * Список читается с `auth`, а снятие блокировки сервер держит за
         * `verified` (`DELETE /users/{id}/block` — в группе с `verified`).
         * Предупреждаем до нажатия, а не отказом после него.
         */}
        <div className="mb-[14px]">
          <VerificationBanner />
        </div>
        <BlockedUsersSection />
      </Card>
    </SettingsSectionShell>
  );
}
