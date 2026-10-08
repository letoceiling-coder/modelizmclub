import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { UserPlus, Megaphone, Users2, UserCircle } from "lucide-react";
import { AuthShell, AuthLogoLink } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { FieldMessage } from "@/components/ui/field-message";
import { Button } from "@/components/ui/button";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { isValidEmail, isValidPersonName, sanitizePersonName } from "@/lib/validation";
import { peekStoredReferralCode, rememberReferralCodeAndTrack } from "@/lib/referral-cookie";
import { passwordMatchState } from "@/lib/password-match";
import { revealAndFocus } from "@/lib/ui/reveal-and-focus";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; returnTo?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    returnTo: typeof s.returnTo === "string" && s.returnTo.startsWith("/") ? s.returnTo : undefined,
  }),
  head: () => ({ meta: [{ title: i18n.t("pages.register.metaTitle") }] }),
  component: RegisterPage,
});

/** Поля формы в том порядке, в каком они стоят на экране. Порядок важен:
 *  по нему выбирается первое проблемное место для прокрутки и фокуса. */
type Поле = "name" | "email" | "password" | "confirmation" | "terms" | "privacy";

const ПОРЯДОК: Поле[] = ["name", "email", "password", "confirmation", "terms", "privacy"];

/** Какому полю принадлежит отказ сервера. Ключи — как их называет
 *  `RegisterRequest`; всё, чего здесь нет, к полю не привязать, и о таком
 *  говорится всплывающим сообщением. */
const ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА: Record<string, Поле> = {
  display_name: "name",
  email: "email",
  password: "password",
  accept_terms: "terms",
  accept_privacy: "privacy",
};

/**
 * Строка согласия.
 *
 * Обязательное согласие отличается от необязательного **словом**, а не
 * только порядком строк: замер 09.10 показал, что у всех трёх галочек нет
 * ни `required`, ни `aria-required`, и на экране они выглядят одинаково —
 * при том, что кнопка не работала, пока не отмечены первые две.
 *
 * Согласие на рекламные материалы условием регистрации не является: на
 * клиенте его не было в проверке, на сервере `accept_ads` объявлен
 * `sometimes|boolean`. Поэтому оно и помечено «необязательно», а не убрано
 * и не сделано обязательным.
 *
 * `min-h-[44px]` и `py-[6px]` — зона нажатия, а не отступ. Замер 04.10 на
 * 360 px: сам чекбокс 13×13, подпись вокруг него 312×18 у однострочной и
 * 312×36 у двухстрочной. По высоте все три строки не дотягивали до 44 px,
 * а это первый экран пути регистрации. Ширина была в порядке — не хватало
 * именно высоты.
 */
function Consent({
  checked,
  onChange,
  required,
  marker,
  error,
  errorId,
  inputRef,
  first,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  required: boolean;
  marker: string;
  error?: string;
  errorId: string;
  inputRef: (el: HTMLInputElement | null) => void;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={first ? { marginTop: 8 } : undefined}>
      <label
        className="flex min-h-[44px] items-start gap-[10px] py-[6px]"
        style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)" }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          ref={inputRef}
          /* shrink-0: без него двухстрочная подпись сжимает сам чекбокс по
             ширине — замер дал 13×18 вместо 18×18. */
          className="shrink-0"
          style={{
            marginTop: 3,
            width: 18,
            height: 18,
            accentColor: "var(--accent)",
            outlineColor: error ? "var(--danger)" : undefined,
          }}
        />
        <span>
          {children}{" "}
          <span
            style={{
              color: required ? "var(--foreground)" : "var(--foreground-50)",
              fontWeight: required ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            — {marker}
          </span>
        </span>
      </label>
      {error && (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      )}
    </div>
  );
}

function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/register" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAds, setAcceptAds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  /* Человек ушёл из поля повтора. До ухода недобранный повтор — это ещё
     набор, а не ошибка: краснеть на каждой букве значит обвинять его в том,
     что он печатает. */
  const [confirmationLeft, setConfirmationLeft] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Поле, string>>>({});
  const узлы = useRef<Partial<Record<Поле, HTMLElement | null>>>({});

  useEffect(() => {
    if (ref) void rememberReferralCodeAndTrack(ref);
  }, [ref]);

  /* Решение Ж1: состояние поля повтора считается на каждый знак и
     пересчитывается, когда правят первый пароль. Правило лежит в
     lib/password-match.ts — оно общее для трёх форм с повтором пароля. */
  const совпадение = passwordMatchState(password, confirmation, { left: confirmationLeft });

  /* Что показать под полем повтора. Отказ, выставленный отправкой, главнее
     живого состояния: он назван точнее («Повторите пароль» против
     «Пароли не совпадают» у пустого поля). */
  const повтор: { tone: "error" | "ok"; текст: string } | null = errors.confirmation
    ? { tone: "error", текст: errors.confirmation }
    : совпадение === "mismatch"
      ? { tone: "error", текст: t("passwordField.mismatch") }
      : совпадение === "match"
        ? { tone: "ok", текст: t("passwordField.match") }
        : null;

  const очистить = (поле: Поле) =>
    setErrors((прежние) => {
      if (!(поле in прежние)) return прежние;
      const копия = { ...прежние };
      delete копия[поле];
      return копия;
    });

  /*
   * Что в форме не так — списком, в порядке полей на экране.
   *
   * Требования к паролю здесь ровно те же, что на сервере:
   * `Password::min(8)` в `RegisterRequest` и `password.length < 8` тут.
   * Шкала надёжности показывает, насколько пароль хорош, но ничего не
   * запрещает — иначе клиент запрещал бы разрешённое сервером.
   */
  const проблемы = (): Array<[Поле, string]> => {
    const список: Array<[Поле, string]> = [];
    const имя = name.trim();
    const почта = email.trim();

    if (!имя) список.push(["name", t("pages.register.nameRequired")]);
    else if (!isValidPersonName(имя)) список.push(["name", t("pages.register.nameInvalid")]);

    if (!почта) список.push(["email", t("pages.register.emailRequired")]);
    else if (!isValidEmail(почта)) список.push(["email", t("pages.register.emailInvalid")]);

    if (!password) список.push(["password", t("passwordField.required")]);
    else if (password.length < 8) список.push(["password", t("passwordField.tooShort")]);

    if (!confirmation) список.push(["confirmation", t("passwordField.confirmRequired")]);
    else if (confirmation !== password) список.push(["confirmation", t("passwordField.mismatch")]);

    if (!acceptTerms) список.push(["terms", t("pages.register.termsRequired")]);
    if (!acceptPrivacy) список.push(["privacy", t("pages.register.privacyRequired")]);

    return список;
  };

  const показатьПервое = (найденные: Partial<Record<Поле, string>>) => {
    const первое = ПОРЯДОК.find((поле) => найденные[поле]);
    if (первое) revealAndFocus(узлы.current[первое]);
  };

  /*
   * Кнопка «Создать аккаунт» нажимаема всегда (решение Ж1).
   *
   * Было `disabled={loading || !acceptTerms || !acceptPrivacy}`, а у
   * `Button` в выключенном состоянии стоит `disabled:pointer-events-none`.
   * То есть нажатие не доходило даже до формы: замер 09.10 на 360 px
   * показал, что `elementFromPoint` в середине кнопки возвращает саму
   * форму, а у кнопки нет ни `title`, ни `aria-describedby`, ни текста
   * рядом. Серая кнопка, по которой ничего не происходит, не объясняет,
   * чего от человека хотят.
   *
   * Теперь нажатие всегда что-то делает: либо отправляет форму, либо
   * называет каждое незаполненное место у самого места и уводит к первому.
   */
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const найденные = Object.fromEntries(проблемы()) as Partial<Record<Поле, string>>;
    if (Object.keys(найденные).length > 0) {
      setErrors(найденные);
      /* Неполный повтор после нажатия — уже не набор, а незаполненность. */
      setConfirmationLeft(true);
      показатьПервое(найденные);
      return;
    }

    setErrors({});
    setLoading(true);
    const почта = email.trim().toLowerCase();
    try {
      await register({
        name: name.trim(),
        email: почта,
        password,
        passwordConfirmation: confirmation,
        referralCode: ref || peekStoredReferralCode(),
        acceptTerms,
        acceptPrivacy,
        acceptAds,
      });
      toast.success(t("pages.register.registerSuccess"));
      nav({ to: "/verify-email", search: { email: почта } });
    } catch (err) {
      /* Отказ сервера показывается у своего поля, а не всплывающим
         сообщением поверх страницы: иначе человек читает «Некорректный
         email», закрывает сообщение и ищет, какое из шести полей имелось
         в виду. Всплывающим остаётся только то, что к полю не привязать —
         частота запросов, обрыв связи, отказ без разбора по полям. */
      const кПолям: Partial<Record<Поле, string>> = {};
      if (err instanceof ApiError && err.errors) {
        for (const [ключ, сообщения] of Object.entries(err.errors)) {
          const поле = ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА[ключ];
          const текст = сообщения?.[0];
          if (поле && текст) кПолям[поле] = текст;
        }
      }
      if (Object.keys(кПолям).length > 0) {
        setErrors(кПолям);
        показатьПервое(кПолям);
      } else {
        toast.error(err instanceof ApiError ? err.message : t("pages.register.registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <>
      <AuthLogoLink size={40} />
      <div className="flex flex-col gap-[20px]">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            maxWidth: 460,
          }}
        >
          {t("authPages.registerTitle")}
        </h2>
        <p
          style={{ color: "rgba(255,255,255,0.75)", maxWidth: 420, fontSize: "var(--fs-body-lg)" }}
        >
          {t("authPages.registerSubtitle")}
        </p>
        <div className="flex flex-col gap-[14px]">
          {[
            { icon: Megaphone, text: t("authPages.registerBenefitAds") },
            { icon: Users2, text: t("authPages.registerBenefitCommunities") },
            { icon: UserCircle, text: t("authPages.registerBenefitProfile") },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-[12px]">
              <div
                className="grid shrink-0 place-items-center rounded-full"
                style={{ width: 36, height: 36, background: "var(--accent-fill)", color: "#fff" }}
              >
                <Icon size={18} />
              </div>
              <span style={{ fontSize: "var(--fs-sm)", color: "rgba(255,255,255,0.9)" }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-xs)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {t("authPages.loginQuote")}
      </div>
    </>
  );

  return (
    <AuthShell
      title={t("pages.register.title")}
      subtitle={t("pages.register.subtitle")}
      leftContent={leftContent}
      footer={
        <>
          {t("pages.register.hasAccount")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("pages.register.loginLink")}
          </Link>
        </>
      }
    >
      {ref && (
        <div
          className="mb-[16px] flex items-center gap-[10px]"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div
            className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
            style={{ background: "var(--accent-fill)", color: "#fff" }}
          >
            <UserPlus size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
              {t("pages.register.referralTitle")}
            </div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>
              {t("pages.register.referralDesc")}
            </div>
          </div>
        </div>
      )}
      {/*
        noValidate — чтобы форму проверяли мы, а не браузер.

        Атрибуты `required` оставлены: они называют поле обязательным для
        экранного диктора. Но пока проверку делал браузер, он показывал свой
        пузырь у первого пустого поля и до нашего обработчика дело не
        доходило — значит ни подписей у полей, ни прокрутки к первому
        незаполненному месту не было бы вовсе.
      */}
      <form onSubmit={submit} className="space-y-[12px]" noValidate>
        <div>
          <Input
            required
            name="name"
            autoComplete="name"
            placeholder={t("pages.register.namePlaceholder")}
            maxLength={120}
            value={name}
            error={Boolean(errors.name)}
            aria-describedby={errors.name ? "reg-name-msg" : undefined}
            ref={(el) => {
              узлы.current.name = el;
            }}
            onChange={(e) => {
              const v = sanitizePersonName(e.target.value);
              setName(v);
              if (errors.name && v.trim() && isValidPersonName(v)) очистить("name");
            }}
            onBlur={() => {
              if (name.trim().length > 0 && !isValidPersonName(name))
                setErrors((п) => ({ ...п, name: t("pages.register.nameInvalid") }));
            }}
          />
          {errors.name && (
            <FieldMessage id="reg-name-msg" tone="error">
              {errors.name}
            </FieldMessage>
          )}
        </div>
        <div>
          <Input
            required
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("auth.email")}
            value={email}
            error={Boolean(errors.email)}
            aria-describedby={errors.email ? "reg-email-msg" : undefined}
            ref={(el) => {
              узлы.current.email = el;
            }}
            onChange={(e) => {
              const v = e.target.value;
              setEmail(v);
              if (errors.email && v.trim() && isValidEmail(v)) очистить("email");
            }}
            onBlur={() => {
              if (email.trim().length > 0 && !isValidEmail(email))
                setErrors((п) => ({ ...п, email: t("pages.register.emailInvalid") }));
            }}
          />
          {errors.email && (
            <FieldMessage id="reg-email-msg" tone="error">
              {errors.email}
            </FieldMessage>
          )}
        </div>
        <div>
          {/*
            autoComplete="new-password" — чтобы менеджер паролей предложил
            создать пароль, а не подставил сохранённый от входа. Замер 09.10
            показал у обоих полей `autocomplete: null`: для менеджера это
            были просто два поля пароля, и какое из них новое, он не знал.
            Вставка из буфера ничем не ограничена и раньше, и теперь —
            обработчика `onPaste` на этих полях нет.
          */}
          <PasswordInput
            required
            name="password"
            autoComplete="new-password"
            placeholder={t("pages.register.passwordPlaceholder")}
            minLength={8}
            value={password}
            error={Boolean(errors.password)}
            aria-describedby={errors.password ? "reg-password-msg" : undefined}
            ref={(el) => {
              узлы.current.password = el;
            }}
            onChange={(e) => {
              const v = e.target.value;
              setPassword(v);
              if (errors.password && v.length >= 8) очистить("password");
              /* Правка первого пароля пересчитывает состояние второго:
                 отказ, выставленный отправкой, снимается, а дальше за
                 состояние отвечает passwordMatchState. */
              if (errors.confirmation) очистить("confirmation");
            }}
          />
          {errors.password && (
            <FieldMessage id="reg-password-msg" tone="error">
              {errors.password}
            </FieldMessage>
          )}
        </div>
        <PasswordStrengthMeter password={password} />
        <div>
          <PasswordInput
            required
            name="password_confirmation"
            autoComplete="new-password"
            placeholder={t("pages.register.passwordConfirmPlaceholder")}
            minLength={8}
            value={confirmation}
            error={повтор?.tone === "error"}
            aria-describedby={повтор ? "reg-confirm-msg" : undefined}
            ref={(el) => {
              узлы.current.confirmation = el;
            }}
            onChange={(e) => {
              setConfirmation(e.target.value);
              /* Снова печатает — значит снова набор, а не брошенное поле. */
              setConfirmationLeft(false);
              if (errors.confirmation) очистить("confirmation");
            }}
            onBlur={() => setConfirmationLeft(true)}
          />
          {повтор && (
            <FieldMessage id="reg-confirm-msg" tone={повтор.tone}>
              {повтор.текст}
            </FieldMessage>
          )}
        </div>
        <Consent
          first
          required
          checked={acceptTerms}
          onChange={(v) => {
            setAcceptTerms(v);
            if (v) очистить("terms");
          }}
          marker={t("pages.register.consentRequired")}
          error={errors.terms}
          errorId="reg-terms-msg"
          inputRef={(el) => {
            узлы.current.terms = el;
          }}
        >
          Принимаю{" "}
          <Link to="/legal/$slug" params={{ slug: "rules" }} style={{ color: "var(--accent)" }}>
            Пользовательское соглашение
          </Link>
        </Consent>
        <Consent
          required
          checked={acceptPrivacy}
          onChange={(v) => {
            setAcceptPrivacy(v);
            if (v) очистить("privacy");
          }}
          marker={t("pages.register.consentRequired")}
          error={errors.privacy}
          errorId="reg-privacy-msg"
          inputRef={(el) => {
            узлы.current.privacy = el;
          }}
        >
          Согласен(на) на обработку персональных данных (
          <Link to="/legal/$slug" params={{ slug: "consent" }} style={{ color: "var(--accent)" }}>
            Согласие на обработку ПД
          </Link>
          )
        </Consent>
        <Consent
          required={false}
          checked={acceptAds}
          onChange={setAcceptAds}
          marker={t("pages.register.consentOptional")}
          errorId="reg-ads-msg"
          inputRef={() => {}}
        >
          Согласен(на) на получение рекламных материалов (
          <Link to="/legal/$slug" params={{ slug: "privacy" }} style={{ color: "var(--accent)" }}>
            Политика конфиденциальности
          </Link>
          )
        </Consent>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 16 }}>
          {loading ? t("pages.register.creating") : t("pages.register.create")}
        </Button>
      </form>
      <OAuthDivider />
      <OAuthButtons />
    </AuthShell>
  );
}
