import { ApiError } from "./client";

/** Human-readable text for Laravel / API validation messages. */
export function formatValidationMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;

  if (raw.startsWith("validation.")) {
    const known: Record<string, string> = {
      "validation.integer": "Проверьте введённые числа — одно из полей заполнено некорректно.",
      "validation.required": "Заполните все обязательные поля.",
      "validation.max": "Одно из значений слишком большое.",
      "validation.min": "Одно из значений некорректно.",
      "validation.uuid": "Один из прикреплённых файлов не распознан. Загрузите его заново.",
      "validation.exists": "Один из прикреплённых файлов не найден. Загрузите его заново.",
    };
    return known[raw] ?? "Проверьте правильность заполнения формы.";
  }

  if (/медиафайл.*недоступен/i.test(raw)) {
    return "Видео или фото ещё не готово. Дождитесь окончания загрузки или прикрепите файл заново.";
  }

  return raw;
}

export function firstFieldError(
  errors: Record<string, string[]> | undefined,
  fallback: string,
): string {
  if (!errors) return fallback;
  const first = Object.values(errors)[0]?.[0];
  return formatValidationMessage(first, fallback);
}

/** Maps API / network failures to a message suitable for toast UI. */
export function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const code = (err.payload as { code?: string } | undefined)?.code;
    if (code === "phone_not_verified") {
      return "Подтвердите номер телефона по SMS в настройках аккаунта.";
    }
    if (code === "email_not_verified") {
      return "Подтвердите email в настройках аккаунта.";
    }
    if (code === "subscription_required") {
      return err.message || "Оформите подписку, чтобы публиковать контент и пользоваться этой функцией.";
    }
    if (code === "insufficient_funds") {
      return "Недостаточно средств на балансе. Пополните кошелёк.";
    }
    if (code === "vtb_required") {
      return err.message || "Пополнение баланса доступно только через ВТБ Эквайринг.";
    }
    if (err.errors) {
      return firstFieldError(err.errors, err.message || fallback);
    }
    if (err.status === 413) {
      return "Файл слишком большой. Уменьшите размер и попробуйте снова.";
    }
    if (err.status >= 500) {
      return "Сервис временно недоступен. Попробуйте опубликовать позже.";
    }
    if (err.status === 401) {
      return "Сессия истекла. Войдите в аккаунт и повторите попытку.";
    }
    if (err.status === 403) {
      return err.message || "Недостаточно прав для публикации.";
    }
    return formatValidationMessage(err.message, fallback);
  }
  if (err instanceof Error && err.message) {
    if (/Storage upload failed/i.test(err.message)) {
      return "Не удалось загрузить файл на сервер. Проверьте соединение и попробуйте снова.";
    }
    if (/Upload confirm failed|Upload session failed/i.test(err.message)) {
      return "Файл загружен не полностью. Попробуйте прикрепить его ещё раз.";
    }
    if (/Failed to fetch|NetworkError|network/i.test(err.message)) {
      return "Не удалось загрузить файл или отправить запрос. Попробуйте ещё раз.";
    }
    return err.message;
  }
  return fallback;
}

/** Max listing price in rubles (matches backend ListingFormRules::MAX_PRICE_CENTS). */
export const MAX_LISTING_PRICE_RUB = 999_999_999;

export function priceRubToCents(priceRub: string): number | null {
  const digits = priceRub.replace(/\D/g, "");
  if (!digits) return 0;
  if (digits.length > String(MAX_LISTING_PRICE_RUB).length) return null;
  const rub = Number(digits);
  if (!Number.isSafeInteger(rub) || rub > MAX_LISTING_PRICE_RUB) return null;
  return rub * 100;
}
