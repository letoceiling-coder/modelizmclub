import { createFileRoute } from "@tanstack/react-router";
import i18n from "@/lib/i18n";

export type Section =
  | "dashboard"
  | "users"
  | "content"
  | "ads"
  | "moderation"
  | "delivery"
  /*
   * Монетизация разделена на четыре вкладки 25.09.
   *
   * Было одно полотно на 788 строк: цены, тарифы, промокоды, акции,
   * реферальная программа, поставщик эскроу и список платежей вперемешку.
   * Найти в нём нужное можно было только прокруткой.
   *
   * Каждая вкладка — своё значение `section`, то есть свой адрес: ссылку
   * на «Бухгалтерию» можно дать, и она откроется там же.
   *
   * Прежнее значение оставлено: ссылки на `?section=monetization` из
   * писем, закладок и старых задач не должны упираться в пустой экран —
   * оно ведёт на «Тарифы и цены».
   */
  | "monetization"
  | "monetizationPricing"
  | "monetizationPayments"
  | "monetizationLedger"
  | "monetizationPromos"
  | "feedBanners"
  | "events"
  | "feedGuestAccess"
  | "notificationPolicy"
  | "landingBlocks"
  | "categories"
  | "reviews"
  | "reviewCategories"
  | "notifications"
  | "analytics"
  | "design"
  | "icons"
  | "media"
  | "feedback"
  | "settings"
  | "auditLog"
  | "applications"
  | "legalPages"
  | "rulesPages"
  | "footerLinks"
  | "roles";

// The component lives in admin.lazy.tsx (createLazyFileRoute) so the whole
// admin panel — 20+ sections — ships as its own chunk and never touches the
// bundle for logged-out / non-admin pages like /feed.
export const Route = createFileRoute("/admin")({
  // Заголовок вкладки считается до того, как словарь админки догрузится:
  // на прямой загрузке он приезжает только на клиентском монтировании, и без
  // запасного значения во вкладке стояло `pages.adminShell.metaTitle`.
  head: () => ({
    meta: [
      {
        title: i18n.t("pages.adminShell.metaTitle", { defaultValue: "Админ-панель — МоДелизМ" }),
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { section?: Section } => ({
    section: typeof search.section === "string" ? (search.section as Section) : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    // Словарь админки — вместе с проверкой прав и до отрисовки: он весит
    // 45 КБ и в главном чанке не нужен никому, кроме тех, кто сюда дошёл.
    const [{ loadAdminLocale }] = await Promise.all([import("@/lib/i18n"), requireAdmin(location)]);
    await loadAdminLocale();
  },
});
