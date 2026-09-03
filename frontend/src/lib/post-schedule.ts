/** Common Russian timezones for the schedule picker (IANA ids). */
export const SCHEDULE_TIMEZONES = [
  { id: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { id: "Europe/Moscow", label: "Москва (UTC+3)" },
  { id: "Europe/Samara", label: "Самара (UTC+4)" },
  { id: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { id: "Asia/Omsk", label: "Омск (UTC+6)" },
  { id: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { id: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { id: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { id: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { id: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { id: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
  { id: "UTC", label: "UTC" },
] as const;

export type PublishMode = "now" | "schedule";

export function defaultScheduleTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (SCHEDULE_TIMEZONES.some((z) => z.id === tz)) return tz;
    if (tz.startsWith("Europe/") || tz.startsWith("Asia/")) return "Europe/Moscow";
  } catch {
    /* ignore */
  }
  return "Europe/Moscow";
}

/** Default date/time: tomorrow at 12:00 in the user's browser local clock. */
export function defaultScheduleDateTime(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

/** Build API payload: local datetime string + IANA timezone. */
export function buildSchedulePayload(
  date: string,
  time: string,
  timezone: string,
): {
  scheduled_at_local: string;
  timezone: string;
} {
  return {
    scheduled_at_local: `${date} ${time}:00`,
    timezone,
  };
}

/** Format scheduled_at ISO for display in a given timezone. */
export function formatScheduledAt(iso: string, timezone: string, locale = "ru-RU"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString(locale);
  }
}

/** Minimum date for `<input type="date">` — today in local calendar. */
export function minScheduleDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isScheduleDateTimeValid(date: string, time: string): boolean {
  if (!date || !time) return false;
  const picked = new Date(`${date}T${time}:00`);
  return !Number.isNaN(picked.getTime()) && picked.getTime() > Date.now();
}
