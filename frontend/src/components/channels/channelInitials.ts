/**
 * Инициалы на месте незагруженного аватара канала.
 *
 * Функция была набрана дважды — в шапке и в форме настроек, слово в слово.
 */
export function channelInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
