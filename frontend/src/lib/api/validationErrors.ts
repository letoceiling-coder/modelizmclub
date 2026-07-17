/** Human-readable text for Laravel / API validation messages. */
export function formatValidationMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;

  if (raw.startsWith("validation.")) {
    const known: Record<string, string> = {
      "validation.integer": "Проверьте введённые числа — одно из полей заполнено некорректно.",
      "validation.required": "Заполните все обязательные поля.",
      "validation.max": "Одно из значений слишком большое.",
      "validation.min": "Одно из значений некорректно.",
    };
    return known[raw] ?? "Проверьте правильность заполнения формы.";
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
