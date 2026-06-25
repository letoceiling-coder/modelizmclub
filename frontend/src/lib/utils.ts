import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(input: string): string {
  // Accepts ISO 8601 or a pre-formatted Russian relative string.
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffH < 5) return `${diffH} ч назад`;
  if (diffH < 24)
    return `сегодня в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffD === 1)
    return `вчера в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffD < 7) return `${diffD} дн назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
