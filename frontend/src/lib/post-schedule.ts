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
  // Дата — тоже по часам браузера, как и время (не toISOString, там UTC).
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

/**
 * Дата и время для полей формы из сохранённого ISO — в выбранном поясе.
 *
 * Обе части считаются в одном поясе. Диалог переноса брал дату из UTC
 * (`toISOString().slice(0, 10)`), а время — по часам браузера: запись на
 * 00:00–02:59 МСК открывалась с предыдущим днём и при сохранении уезжала на
 * сутки назад.
 */
export function scheduleInputsFromIso(
  iso: string,
  timezone: string,
): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
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
