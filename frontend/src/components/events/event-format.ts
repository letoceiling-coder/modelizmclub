import type { ClubEvent } from "@/lib/api/events";

/**
 * Время мероприятий — московское, а не по часам браузера.
 *
 * Страница события отрисовывается на сервере, а у сервера и у браузера разные
 * пояса: «18:00» с сервера превращалось бы в «21:00» при гидрации, и React
 * пересобирал бы блок. Площадка живёт по Москве (APP_TIMEZONE), форма вводит
 * время тоже по Москве — одно и то же число везде. Перехода на летнее время
 * в Москве нет с 2014 года, поэтому смещение постоянное.
 */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

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
const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const WEEKDAYS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Дата, у которой UTC-поля равны московским стенным часам. */
function msk(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + MSK_OFFSET_MS);
}

/** Части даты для блока слева и строки времени. */
export function eventDateParts(iso: string): {
  day: string;
  month: string;
  time: string;
  full: string;
} {
  const d = msk(iso);
  if (!d) return { day: "—", month: "", time: "", full: "" };
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return {
    day: String(d.getUTCDate()),
    month: MONTHS_SHORT[d.getUTCMonth()],
    time: `${WEEKDAYS_SHORT[d.getUTCDay()]}, ${time}`,
    full: `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${WEEKDAYS[d.getUTCDay()]}, ${time} МСК`,
  };
}

/** Подпись на обложке. Опубликованному предстоящему подпись не нужна. */
export function eventStatusLabel(event: Pick<ClubEvent, "displayStatus">): string | null {
  switch (event.displayStatus) {
    case "draft":
      return "Черновик";
    case "cancelled":
      return "Отменено";
    case "past":
      return "Прошло";
    default:
      return null;
  }
}

/** Значение для `<input type="datetime-local">` — московские часы. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = msk(iso);
  if (!d) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Обратно: значение поля (московские часы) → ISO-строка с поясом. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
