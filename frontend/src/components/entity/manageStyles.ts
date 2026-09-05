/**
 * Общий вид полей ввода в панелях настроек.
 *
 * Отдельным файлом, а не рядом с компонентами: экспорт-константа в одном
 * модуле с компонентами ломает горячую замену — react-refresh об этом и
 * предупреждает.
 */
export const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;
