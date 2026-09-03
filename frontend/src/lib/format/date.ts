/**
 * The one date formatter for the project.
 *
 * Before this, the same timestamp rendered five different ways depending on
 * which file drew it: raw ISO in community posts, "Вчера 17:33" in the feed,
 * "22.08.2026" in the cabinet, `toLocaleDateString` with ad-hoc options in
 * forty other places. Three helpers with overlapping rules (`formatRelativeTime`
 * in lib/mock, `formatTimeAgo` in lib/utils, `<TimeAgo>`) now all route here.
 *
 * `now` is injectable so the relative branch is deterministic under test.
 */
/**
 * relative — «5 мин назад» / «сегодня в 14:32» / «22 авг в 14:32» / «22 авг 2025»
 * absolute — «22 августа 2026, 14:32»
 * date     — «22.08.2026» (day-only fields, admin tables; the project's most
 *            common pre-existing format, kept so a 4-digit year is not lost)
 * short    — «22.08.26»
 */
export type DateStyle = "relative" | "absolute" | "date" | "short";

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const pad = (n: number): string => String(n).padStart(2, "0");
const hhmm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatDate(
  input: string | Date | null | undefined,
  style: DateStyle = "relative",
  now: Date = new Date(),
): string {
  if (input === null || input === undefined || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return typeof input === "string" ? input : "";

  if (style === "short") {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
  }

  if (style === "date") {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  if (style === "absolute") {
    return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}, ${hhmm(d)}`;
  }

  // relative
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;

  if (sameDay(d, now)) return `сегодня в ${hhmm(d)}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `вчера в ${hhmm(d)}`;

  const dayMonth = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (d.getFullYear() === now.getFullYear()) return `${dayMonth} в ${hhmm(d)}`;
  return `${dayMonth} ${d.getFullYear()}`;
}
