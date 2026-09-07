/**
 * Модуль собирается плагином `modelizm:lucide-names` в vite.config.ts из
 * установленного пакета lucide-react. Держит только имена файлов иконок в
 * kebab-case — по нему `lib/lucide-icon` решает, стоит ли вообще тянуть
 * библиотеку ради конкретного имени.
 */
declare module "virtual:lucide-names" {
  export const NAMES: string[];
}
