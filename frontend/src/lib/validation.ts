/** Letters (Cyrillic + Latin), space, hyphen, straight/curly apostrophe. */
export const PERSON_NAME_PATTERN = /^[A-Za-zА-ЯЁа-яё\s'’-]+$/;

const PERSON_NAME_SANITIZE = /[^A-Za-zА-ЯЁа-яё\s'’-]/g;

/** Strip disallowed characters while the user types. */
export function sanitizePersonName(value: string, maxLength = 120): string {
  return value.replace(PERSON_NAME_SANITIZE, "").slice(0, maxLength);
}

export function isValidPersonName(value: string, maxLength = 120): boolean {
  const v = value.trim();
  return v.length >= 2 && v.length <= maxLength && PERSON_NAME_PATTERN.test(v);
}

/** Practical email check — HTML5 + backend `email` rule cover the rest. */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 255) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
