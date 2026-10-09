import {
  createLazyFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  Megaphone,
  ShieldCheck,
  DollarSign,
  FolderTree,
  Bell,
  BarChart3,
  Settings,
  Home,
  Inbox,
  Truck,
  Clapperboard,
  Image,
  FileText,
  Palette,
  Search,
  CalendarDays,
  KeyRound,
  ChevronDown,
  Users2,
  Plug,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSessionUser, useCurrentUser } from "@/lib/session";
import { ensureSession } from "@/lib/auth/session";
import { AdminSectionSkeleton } from "@/components/admin/AdminSectionSkeleton";
import type { AdminRole } from "@/components/admin/adminShared";
import type { Section } from "@/routes/admin";
import { fetchAdminAccess, setAdminAccess } from "@/lib/admin-access";
import { EmptyDirectionsNotice } from "@/components/admin/EmptyDirectionsNotice";
import { isDemoMode } from "@/lib/demo-mode";
import { reportReadFailure } from "@/lib/errors/handle";

export const Route = createLazyFileRoute("/admin")({
  component: AdminPage,
});

// Every section ships as its own chunk, fetched only when its nav item is
// opened — the shell above (header/sidebar/mobile select) stays tiny.
const Dashboard = lazy(() =>
  import("@/components/admin/AdminDashboardSection").then((m) => ({ default: m.Dashboard })),
);
const UsersSection = lazy(() =>
  import("@/components/admin/AdminUsersSection").then((m) => ({ default: m.UsersSection })),
);
const AdminRolesSection = lazy(() =>
  import("@/components/admin/AdminRolesSection").then((m) => ({ default: m.AdminRolesSection })),
);
/* Два раздела добавлены 09.10 решением Ж4: на сервере возможность была,
   экрана не было. Разбор — docs/acceptance/release/admin-inventory.md. */
const AdminCommunitiesSection = lazy(() =>
  import("@/components/admin/AdminCommunitiesSection").then((m) => ({
    default: m.AdminCommunitiesSection,
  })),
);
const AdminConnectionsSection = lazy(() =>
  import("@/components/admin/AdminConnectionsSection").then((m) => ({
    default: m.AdminConnectionsSection,
  })),
);
const ContentSection = lazy(() =>
  import("@/components/admin/AdminContentSection").then((m) => ({ default: m.ContentSection })),
);
const AdsSection = lazy(() =>
  import("@/components/admin/AdminAdsSection").then((m) => ({ default: m.AdsSection })),
);
const DeliverySection = lazy(() =>
  import("@/components/admin/AdminDeliverySection").then((m) => ({ default: m.DeliverySection })),
);
const ModerationAdminSection = lazy(() =>
  import("@/components/admin/ModerationAdminSection").then((m) => ({
    default: m.ModerationAdminSection,
  })),
);
const ApplicationsSection = lazy(() =>
  import("@/components/admin/AdminApplicationsSection").then((m) => ({
    default: m.ApplicationsSection,
  })),
);
const MonetizationPromosSection = lazy(() =>
  import("@/components/admin/AdminMonetizationSection").then((m) => ({
    default: m.MonetizationPromosSection,
  })),
);
const MonetizationPaymentsSection = lazy(() =>
  import("@/components/admin/AdminMonetizationSection").then((m) => ({
    default: m.MonetizationPaymentsSection,
  })),
);
const MonetizationLedgerSection = lazy(() =>
  import("@/components/admin/AdminMonetizationSection").then((m) => ({
    default: m.MonetizationLedgerSection,
  })),
);
const MonetizationSection = lazy(() =>
  import("@/components/admin/AdminMonetizationSection").then((m) => ({
    default: m.MonetizationSection,
  })),
);
const FeedBannersSection = lazy(() =>
  import("@/components/admin/AdminThinSections").then((m) => ({ default: m.FeedBannersSection })),
);
const AdminEventsSection = lazy(() =>
  import("@/components/admin/AdminEventsSection").then((m) => ({
    default: m.AdminEventsSection,
  })),
);
const FeedGuestAccessSection = lazy(() =>
  import("@/components/admin/AdminThinSections").then((m) => ({
    default: m.FeedGuestAccessSection,
  })),
);
const NotificationPolicySection = lazy(() =>
  import("@/components/admin/AdminThinSections").then((m) => ({
    default: m.NotificationPolicySection,
  })),
);
const LandingBlocksSection = lazy(() =>
  import("@/components/admin/AdminThinSections").then((m) => ({ default: m.LandingBlocksSection })),
);
const IconManagerSection = lazy(() =>
  import("@/components/admin/IconManagerSection").then((m) => ({ default: m.IconManagerSection })),
);
const CategoriesSection = lazy(() =>
  import("@/components/admin/AdminCategoriesSection").then((m) => ({
    default: m.CategoriesSection,
  })),
);
const ReviewsSection = lazy(() =>
  import("@/components/admin/AdminReviewsSection").then((m) => ({ default: m.ReviewsSection })),
);
const NotificationsSection = lazy(() =>
  import("@/components/admin/AdminNotificationsSection").then((m) => ({
    default: m.NotificationsSection,
  })),
);
const AnalyticsSection = lazy(() =>
  import("@/components/admin/AdminAnalyticsSection").then((m) => ({ default: m.AnalyticsSection })),
);
const FeedbackSection = lazy(() =>
  import("@/components/admin/AdminFeedbackSection").then((m) => ({ default: m.FeedbackSection })),
);
const DesignSystemSection = lazy(() =>
  import("@/components/admin/AdminDesignSystemSection").then((m) => ({
    default: m.DesignSystemSection,
  })),
);
const MediaSection = lazy(() =>
  import("@/components/admin/AdminMediaSection").then((m) => ({ default: m.MediaSection })),
);
const AuditLogSection = lazy(() =>
  import("@/components/admin/AdminAuditLogSection").then((m) => ({ default: m.AuditLogSection })),
);
const AdminRulesSection = lazy(() =>
  import("@/components/admin/AdminRulesSection").then((m) => ({ default: m.AdminRulesSection })),
);
const AdminLegalPagesSection = lazy(() =>
  import("@/components/admin/AdminLegalPagesSection").then((m) => ({
    default: m.AdminLegalPagesSection,
  })),
);
const AdminFooterLinksSection = lazy(() =>
  import("@/components/admin/AdminFooterLinksSection").then((m) => ({
    default: m.AdminFooterLinksSection,
  })),
);
const SettingsSection = lazy(() =>
  import("@/components/admin/AdminSettingsSection").then((m) => ({ default: m.SettingsSection })),
);

/*
 * Кому какой раздел — решает сервер (GET /admin/access, карта
 * App\Support\AdminAccess). Здесь только порядок, подписи и значки.
 */
/** Разделы-вкладки без своего пункта меню → пункт, внутри которого они открываются. */
const SECTION_HOSTS: Partial<Record<Section, Section>> = {
  reviewCategories: "reviews",
  /*
   * Прежний адрес монетизации. 25.09 раздел разделён на четыре вкладки, и
   * `monetization` из навигации ушёл — а значит стал «недостижимым», и
   * проверка ниже уводила такую ссылку на дашборд. Ссылки из писем,
   * закладок и старых задач должны открывать «Тарифы и цены», а не
   * молча подменяться дашбордом.
   */
  monetization: "monetizationPricing",
};

const navItems: { id: Section; labelKey: string; icon: typeof Users }[] = [
  {
    id: "dashboard",
    labelKey: "pages.adminShell.nav.dashboard",
    icon: LayoutDashboard,
  },
  { id: "users", labelKey: "pages.adminShell.nav.users", icon: Users },
  { id: "roles", labelKey: "pages.adminShell.nav.roles", icon: KeyRound },
  { id: "communities", labelKey: "pages.adminShell.nav.communities", icon: Users2 },
  { id: "connections", labelKey: "pages.adminShell.nav.connections", icon: Plug },
  { id: "content", labelKey: "pages.adminShell.nav.content", icon: Newspaper },
  { id: "ads", labelKey: "pages.adminShell.nav.ads", icon: Megaphone },
  { id: "delivery", labelKey: "pages.adminShell.nav.delivery", icon: Truck },
  {
    id: "moderation",
    labelKey: "pages.adminShell.nav.moderation",
    icon: ShieldCheck,
  },
  {
    id: "applications",
    labelKey: "pages.adminShell.nav.applications",
    icon: Inbox,
  },
  {
    id: "monetizationPricing",
    labelKey: "pages.adminShell.nav.monetizationPricing",
    icon: DollarSign,
  },
  {
    id: "monetizationPayments",
    labelKey: "pages.adminShell.nav.monetizationPayments",
    icon: DollarSign,
  },
  {
    id: "monetizationLedger",
    labelKey: "pages.adminShell.nav.monetizationLedger",
    icon: DollarSign,
  },
  {
    id: "monetizationPromos",
    labelKey: "pages.adminShell.nav.monetizationPromos",
    icon: DollarSign,
  },
  {
    id: "feedBanners",
    labelKey: "pages.adminShell.nav.feedBanners",
    icon: Megaphone,
  },
  {
    id: "events",
    labelKey: "pages.adminShell.nav.events",
    icon: CalendarDays,
  },
  {
    id: "feedGuestAccess",
    labelKey: "pages.adminShell.nav.feedGuestAccess",
    icon: ShieldCheck,
  },
  {
    id: "notificationPolicy",
    labelKey: "pages.adminShell.nav.notificationPolicy",
    icon: Bell,
  },
  {
    id: "landingBlocks",
    labelKey: "pages.adminShell.nav.landingBlocks",
    icon: Home,
  },
  { id: "icons", labelKey: "pages.adminShell.nav.icons", icon: Image },
  {
    id: "categories",
    labelKey: "pages.adminShell.nav.categories",
    icon: FolderTree,
  },
  { id: "reviews", labelKey: "pages.adminShell.nav.reviews", icon: Clapperboard },
  {
    id: "notifications",
    labelKey: "pages.adminShell.nav.notifications",
    icon: Bell,
  },
  {
    id: "analytics",
    labelKey: "pages.adminShell.nav.analytics",
    icon: BarChart3,
  },
  {
    id: "feedback",
    labelKey: "pages.adminShell.nav.feedback",
    icon: Inbox,
  },
  { id: "design", labelKey: "pages.adminShell.nav.design", icon: Palette },
  { id: "media", labelKey: "pages.adminShell.nav.media", icon: Image },
  { id: "settings", labelKey: "pages.adminShell.nav.settings", icon: Settings },
  {
    id: "rulesPages",
    labelKey: "pages.adminShell.nav.rulesPages",
    icon: FileText,
  },
  {
    id: "legalPages",
    labelKey: "pages.adminShell.nav.legalPages",
    icon: FileText,
  },
  {
    id: "footerLinks",
    labelKey: "pages.adminShell.nav.footerLinks",
    icon: FileText,
  },
  { id: "auditLog", labelKey: "pages.adminShell.nav.auditLog", icon: Search },
];

/*
 * Группы меню — десять категорий решения Ж4 от 09.10.
 *
 * Было тридцать пунктов одним столбцом. Владелец 05.10 сказал, что «много
 * панелей пропало»; проверка показала, что из кода не пропало ничего —
 * пропало из поля зрения: найти «Баннеры ленты» в списке из тридцати строк
 * без заголовков можно только перечитав его целиком. 05.10 строки собрали в
 * шесть групп, 09.10 решение Ж4 назвало десять и назвало их точно: Обзор;
 * Пользователи и доступ; Содержимое; Модерация; Сообщества и каналы;
 * Объявления и сделки; Монетизация; Уведомления; Подключения; Система.
 *
 * Состав групп решением не назван, поэтому выбран так: раздел лежит там,
 * где его стал бы искать человек, пришедший за делом, а не там, где он
 * ближе по устройству кода. Поэтому «Доставка» — в «Объявлениях и сделках»
 * (её настраивают из-за сделок), а «Значки» и «Дизайн-система» — в
 * «Системе» (их трогают раз в полгода и не ради содержимого сайта).
 *
 * Все группы свёрнуты по умолчанию, выбор человека запоминается — этого
 * требует решение Ж4. Прежнее поведение раскрывало группу с текущим
 * разделом и забывалось при перезагрузке.
 *
 * Каждый пункт входит ровно в одну группу: за этим следит
 * `admin-nav-groups.test.ts`. Новый раздел, не попавший ни в одну, иначе
 * исчез бы из меню молча — ровно то, в чём меня и заподозрили.
 */
/**
 * Где запоминается, какие группы меню раскрыты (решение Ж4: «состояние
 * запоминается»).
 *
 * Читается после гидрации, в `useEffect`: чтение хранилища в разметке
 * первого кадра — расхождение гидрации, см. CLAUDE.md, «Первый кадр в
 * браузере совпадает с серверным».
 */
const КЛЮЧ_ГРУПП = "admin.navGroups.open";

export const NAV_GROUPS: { id: string; labelKey: string; items: Section[] }[] = [
  {
    id: "overview",
    labelKey: "pages.adminShell.navGroups.overview",
    items: ["dashboard"],
  },
  {
    id: "people",
    labelKey: "pages.adminShell.navGroups.people",
    items: ["users", "roles", "feedGuestAccess"],
  },
  {
    id: "content",
    labelKey: "pages.adminShell.navGroups.content",
    items: [
      "content",
      "categories",
      "landingBlocks",
      "feedBanners",
      "legalPages",
      "rulesPages",
      "footerLinks",
      "media",
      "events",
    ],
  },
  {
    id: "moderation",
    labelKey: "pages.adminShell.navGroups.moderation",
    items: ["moderation", "reviews", "feedback"],
  },
  {
    id: "communities",
    labelKey: "pages.adminShell.navGroups.communities",
    items: ["communities", "applications"],
  },
  {
    id: "market",
    labelKey: "pages.adminShell.navGroups.market",
    items: ["ads", "delivery"],
  },
  {
    id: "money",
    labelKey: "pages.adminShell.navGroups.money",
    items: [
      "monetizationPricing",
      "monetizationPayments",
      "monetizationLedger",
      "monetizationPromos",
    ],
  },
  {
    id: "notifications",
    labelKey: "pages.adminShell.navGroups.notifications",
    items: ["notifications", "notificationPolicy"],
  },
  {
    id: "connections",
    labelKey: "pages.adminShell.navGroups.connections",
    items: ["connections"],
  },
  {
    id: "system",
    labelKey: "pages.adminShell.navGroups.system",
    items: ["settings", "icons", "design", "analytics", "auditLog"],
  },
];

function SectionView({ section, adminRole }: { section: Section; adminRole: AdminRole | null }) {
  return (
    <Suspense fallback={<AdminSectionSkeleton />}>
      <SectionViewInner section={section} adminRole={adminRole} />
    </Suspense>
  );
}

function SectionViewInner({
  section,
  adminRole,
}: {
  section: Section;
  adminRole: AdminRole | null;
}) {
  if (section === "dashboard") return <Dashboard role={adminRole ?? "owner"} />;
  if (section === "users") return <UsersSection />;
  if (section === "roles") return <AdminRolesSection />;
  if (section === "communities") return <AdminCommunitiesSection />;
  if (section === "connections") return <AdminConnectionsSection />;
  if (section === "content") return <ContentSection />;
  if (section === "ads") return <AdsSection />;
  if (section === "delivery") return <DeliverySection />;
  if (section === "moderation") return <ModerationAdminSection />;
  if (section === "applications") return <ApplicationsSection />;
  /*
   * `monetization` без уточнения ведёт на «Тарифы и цены»: ссылки на
   * прежний адрес из писем, закладок и задач не должны упираться в пустой
   * экран.
   */
  if (section === "monetization" || section === "monetizationPricing")
    return <MonetizationSection />;
  if (section === "monetizationPromos") return <MonetizationPromosSection />;
  if (section === "monetizationPayments") return <MonetizationPaymentsSection />;
  if (section === "monetizationLedger") return <MonetizationLedgerSection />;
  if (section === "feedBanners") return <FeedBannersSection />;
  if (section === "events") return <AdminEventsSection />;
  if (section === "feedGuestAccess") return <FeedGuestAccessSection />;
  if (section === "notificationPolicy") return <NotificationPolicySection />;
  if (section === "landingBlocks") return <LandingBlocksSection />;
  if (section === "icons") return <IconManagerSection />;
  if (section === "categories") return <CategoriesSection />;
  if (section === "reviews" || section === "reviewCategories")
    return (
      <ReviewsSection initialSubTab={section === "reviewCategories" ? "categories" : "list"} />
    );
  if (section === "notifications") return <NotificationsSection />;
  if (section === "analytics") return <AnalyticsSection />;
  if (section === "feedback") return <FeedbackSection />;
  if (section === "design") return <DesignSystemSection />;
  if (section === "media") return <MediaSection />;
  if (section === "auditLog") return <AuditLogSection />;
  if (section === "rulesPages") return <AdminRulesSection />;
  if (section === "legalPages") return <AdminLegalPagesSection />;
  if (section === "footerLinks") return <AdminFooterLinksSection />;
  return <SettingsSection />;
}

function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNestedAdminRoute = pathname.startsWith("/admin/") && pathname !== "/admin";
  const { section: sectionFromUrl } = Route.useSearch();
  const me = useCurrentUser();
  const [access, setAccess] = useState<"checking" | "granted" | "forbidden">("checking");
  const [localeReady, setLocaleReady] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  /*
   * Какие группы меню раскрыты.
   *
   * Решение Ж4 от 09.10: разделы сгруппированы по категориям и **свёрнуты по
   * умолчанию**, состояние запоминается. Прежнее поведение раскрывало группу
   * с текущим разделом и забывалось при перезагрузке; при десяти категориях
   * раскрытая группа снова даёт длинный столбец, от которого группы и
   * заводились.
   */
  const [открытыеГруппы, setОткрытыеГруппы] = useState<Record<string, boolean>>({});
  const [группыПрочитаны, setГруппыПрочитаны] = useState(false);
  /* Что набрано в поиске по меню — пункт 2 части В решения Ж4. */
  const [поискМеню, setПоискМеню] = useState("");
  /* Меню на телефоне — шторкой (решение Ж4, часть В3). */
  const [меню, setМеню] = useState(false);

  useEffect(() => {
    try {
      const сырое = window.localStorage.getItem(КЛЮЧ_ГРУПП);
      if (сырое) {
        const разобрано: unknown = JSON.parse(сырое);
        if (разобрано && typeof разобрано === "object") {
          setОткрытыеГруппы(разобрано as Record<string, boolean>);
        }
      }
    } catch {
      /* Хранилище бывает закрыто (приватное окно, запрет сайту) — тогда
         группы просто не запоминаются. Человеку об этом говорить нечего. */
    }
    setГруппыПрочитаны(true);
  }, []);

  useEffect(() => {
    /* Запись не начинается раньше чтения — иначе первый рендер затёр бы
       выбор человека пустым объектом (CLAUDE.md, то же место). */
    if (!группыПрочитаны) return;
    try {
      window.localStorage.setItem(КЛЮЧ_ГРУПП, JSON.stringify(открытыеГруппы));
    } catch {
      /* см. выше */
    }
  }, [открытыеГруппы, группыПрочитаны]);

  // Раздел живёт в адресе, а не в состоянии рядом с ним. Пока это был
  // `useState`, ссылку на раздел нельзя было дать, перезагрузка возвращала в
  // дашборд, а «назад» не работал вовсе. Второго источника правды здесь быть
  // не должно: `?section=` — единственный.
  const section: Section = sectionFromUrl ?? "dashboard";

  /*
   * Поиск по меню — пункт 2 части В решения Ж4.
   *
   * Сравнение без учёта регистра и по вхождению: раздел ищут по куску
   * названия («банн», «правов»), а не по полному имени. Ищется и по названию
   * группы — «монетиз» должно находить все четыре вкладки.
   */
  const ищем = поискМеню.trim().length > 0;
  const подходит = useCallback(
    (текст: string) => текст.toLowerCase().includes(поискМеню.trim().toLowerCase()),
    [поискМеню],
  );

  const goToSection = useCallback(
    (next: Section, replace = false) => {
      void navigate({ to: "/admin", search: { section: next }, replace });
    },
    [navigate],
  );

  /*
   * Словарь админки — по той же причине, что и проверка доступа ниже.
   *
   * `loadAdminLocale()` стоит в `beforeLoad` маршрута, и на переходе внутри
   * приложения этого достаточно. На прямой загрузке `beforeLoad` отрабатывает
   * на сервере, чанк словаря туда и приезжает, а клиент после гидрации его
   * не запрашивает вовсе — замерено на проде 08.09: при переходе внутри
   * приложения грузится ru-admin-*.js и сырых ключей ноль, при прямой
   * загрузке чанка нет и на экране 37 точечных путей вида
   * `pages.adminShell.nav.users`.
   *
   * Поэтому словарь дозагружается здесь, на клиентском монтировании, и
   * рендер ждёт его наравне с проверкой прав.
   */
  useEffect(() => {
    let alive = true;
    void import("@/lib/i18n")
      .then(({ loadAdminLocale }) => loadAdminLocale())
      // Не пришёл — показываем ключи, но не пустую страницу.
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLocaleReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Client-side access gate. `beforeLoad` alone is not enough: on a direct load /
  // F5 it resolves during SSR (where there is no token) and does not re-run on
  // hydration, so access must also be enforced here on every client mount.
  //   - not authenticated  -> redirect to the login page
  //   - authenticated, not superadmin -> render a 403 screen (no redirect)
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await ensureSession();
      if (!alive) return;
      if (!ok) {
        navigate({ to: "/login", search: { redirect: "/admin" } });
        return;
      }
      const current = getSessionUser();
      // `role` is the source of truth when present (real API sessions);
      // demo-mode sessions only set `isAdmin` (see lib/demo-data.ts DEMO_USER),
      // so fall back to treating isAdmin as "owner" there.
      const resolvedRole: AdminRole | null =
        current.role === "owner" ||
        current.role === "moderator" ||
        current.role === "category_admin"
          ? current.role
          : current.isAdmin
            ? "owner"
            : null;
      if (resolvedRole && !isDemoMode()) {
        try {
          const granted = await fetchAdminAccess();
          if (!alive) return;
          setAdminAccess(granted);
          setAllowedSections(granted.sections);
        } catch (e) {
          reportReadFailure(e, "разделы админки");
          if (!alive) return;
          setAdminRole(null);
          setAccess("forbidden");
          return;
        }
      } else if (resolvedRole) {
        // Демо: сессия — владелец, сервера нет.
        setAdminAccess({
          role: "owner",
          isOwner: true,
          sections: navItems.map((n) => n.id),
          capabilities: ["reports", "posts.delete", "listings.delete"],
          categories: [],
        });
        setAllowedSections(navItems.map((n) => n.id));
      }
      setAdminRole(resolvedRole);
      setAccess(resolvedRole ? "granted" : "forbidden");
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  // Hooks must run unconditionally on every render (Rules of Hooks) — this
  // has to sit before the "checking"/"forbidden" early returns below, not
  // after them, or React throws "Rendered more hooks than during the
  // previous render" once access resolves past "checking".
  const visibleNavItems = navItems.filter(
    (n) => adminRole !== null && allowedSections.includes(n.id),
  );

  // Пункт меню, под которым живёт раздел: вкладка «Категории обзоров» —
  // внутри «Обзоров», своего пункта у неё нет.
  const navIdFor = (id: Section): Section => SECTION_HOSTS[id] ?? id;

  const host = SECTION_HOSTS[section];
  const reachable =
    visibleNavItems.some((n) => n.id === section) ||
    (host !== undefined &&
      allowedSections.includes(section) &&
      visibleNavItems.some((n) => n.id === host));

  // Раздел из адреса роли не виден — уводим на первый доступный и правим
  // адрес подменой записи, чтобы «назад» не возвращал в запрещённый раздел.
  // Раздел-вкладку пропускаем, если он разрешён и виден его пункт меню: до
  // 20.09 прямая ссылка на «Категории обзоров» уводила Владельца на дашборд.
  useEffect(() => {
    if (adminRole === null) return;
    if (!reachable) {
      goToSection(visibleNavItems[0]?.id ?? "dashboard", true);
    }
  }, [adminRole, reachable, visibleNavItems, goToSection]);

  if (isNestedAdminRoute) {
    return <Outlet />;
  }

  if (access === "checking" || !localeReady) {
    return (
      <div
        className="min-h-screen grid place-items-center"
        style={{ background: "var(--background)", color: "var(--foreground-50)", fontSize: "13px" }}
      >
        {/* Пока словарь едет, ключ отдал бы точечный путь — запасное значение
            держит экран читаемым. */}
        {t("pages.adminShell.checkingAccess", { defaultValue: "Проверка доступа…" })}
      </div>
    );
  }

  if (access === "forbidden") {
    return (
      <div
        className="min-h-screen grid place-items-center"
        style={{ background: "var(--background)", padding: "24px" }}
      >
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <div style={{ fontSize: "64px", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
            403
          </div>
          <h1
            style={{
              marginTop: "16px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            {t("pages.adminShell.forbiddenTitle")}
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--foreground-70)" }}>
            {t("pages.adminShell.forbiddenDesc")}
          </p>
          {me.id !== "guest" && (
            <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-50)" }}>
              {t("pages.adminShell.forbiddenSignedIn", { name: me.name })}
            </p>
          )}
          <div
            className="flex flex-wrap items-center justify-center gap-2"
            style={{ marginTop: "20px" }}
          >
            <Link
              to="/login"
              search={{ redirect: "/admin" }}
              className="inline-flex items-center gap-[6px]"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: "var(--r-card-sm)",
                background: "var(--accent-fill)",
                color: "var(--accent-foreground)",
              }}
            >
              {t("pages.adminShell.loginOther")}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-[6px]"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: "var(--r-card-sm)",
                border: "1px solid var(--border)",
                color: "var(--foreground-70)",
              }}
            >
              <Home size={14} />
              {t("pages.adminShell.backHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    /*
     * От 768 оболочка ростом в экран, прокручивается только <main> — как у
     * сайта (AppLayout от 1024). Шапка и левое меню стоят на месте.
     *
     * Раньше они были `sticky`, но не липли: у html и body стоит
     * overflow-x: hidden, body от этого становится прокручивающим
     * контейнером, а прокручивается окно — и sticky-элементы уезжали вместе
     * со страницей. Замер на проде 17.09, 1440: после прокрутки на 400 шапка
     * на −400, меню на −352. Меню при этом высотой в экран (852) со своей
     * прокруткой без полосы: у владельца 26 разделов — 1002 px, и уехавшая
     * вверх колонка обрывалась рамкой посреди страницы, а «Правила»,
     * «Юридические страницы», «Ссылки подвала» и «История изменений»
     * оставались под её нижним краем, где содержимое страницы шло дальше.
     * На телефоне меню нет (выбор разделом), там прокручивается окно.
     */
    <div
      className="min-h-screen md:flex md:h-[100dvh] md:min-h-0 md:flex-col md:overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-[var(--z-sticky)] flex shrink-0 items-center justify-between backdrop-blur"
        style={{
          height: "48px",
          background: "color-mix(in oklab, var(--background) 85%, transparent)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
        }}
      >
        <div className="flex items-center gap-[12px]">
          <Logo size={28} showText={false} />
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>
            {t("pages.adminShell.headerTitle")}
          </span>
        </div>
        <div className="flex items-center gap-[8px]">
          <ThemeToggle />
          <Link
            to="/"
            className="inline-flex items-center gap-[6px]"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "var(--r-card-sm)",
              border: "1px solid var(--border)",
              color: "var(--foreground-70)",
            }}
          >
            <Home size={14} />
            {t("pages.adminShell.toSite")}
          </Link>
        </div>
      </header>

      <div className="flex md:min-h-0 md:flex-1">
        {/* Sidebar */}
        <aside
          className="hidden md:block"
          style={{
            width: "220px",
            background: "var(--background-elevated)",
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "8px",
            flexShrink: 0,
          }}
        >
          {/*
            Поиск по разделам — пункт 2 части В решения Ж4.

            Тридцать два раздела в десяти группах: найти «Баннеры ленты»
            быстрее набором трёх букв, чем раскрытием групп по очереди. Пока
            в поиске что-то набрано, группы с находками раскрыты сами.
          */}
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <Search
              size={14}
              aria-hidden
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--foreground-50)",
              }}
            />
            <input
              value={поискМеню}
              onChange={(e) => setПоискМеню(e.target.value)}
              placeholder={t("pages.adminShell.navSearch.placeholder")}
              aria-label={t("pages.adminShell.navSearch.label")}
              style={{
                width: "100%",
                height: "36px",
                paddingLeft: 30,
                paddingRight: 10,
                background: "var(--background-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-input)",
                fontSize: "13px",
                color: "var(--foreground)",
              }}
            />
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {NAV_GROUPS.map((группа) => {
              const пункты = visibleNavItems
                .filter((n) => группа.items.includes(n.id))
                .filter((n) => !ищем || подходит(t(n.labelKey)) || подходит(t(группа.labelKey)));

              // Группа без единого доступного раздела не рисуется вовсе:
              // заголовок без содержимого обещал бы то, чего роль не даёт.
              if (пункты.length === 0) return null;

              /*
               * Свёрнуты по умолчанию (решение Ж4). Поиск — исключение: пока
               * в нём что-то набрано, группы с находками раскрыты, иначе
               * поиск показывал бы заголовки без строк.
               */
              const раскрыта = ищем || (открытыеГруппы[группа.id] ?? false);

              return (
                <div key={группа.id} style={{ marginBottom: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setОткрытыеГруппы((п) => ({ ...п, [группа.id]: !раскрыта }))}
                    aria-expanded={раскрыта}
                    className="flex w-full items-center justify-between"
                    style={{
                      gap: "8px",
                      padding: "7px 12px",
                      borderRadius: "var(--r-card-sm)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--foreground-50)",
                      background: "transparent",
                      minHeight: "32px",
                    }}
                  >
                    <span>{t(группа.labelKey)}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: раскрыта ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </button>

                  {раскрыта
                    ? пункты.map((n) => {
                        const active = navIdFor(section) === n.id;
                        return (
                          <button
                            key={n.id}
                            onClick={() => goToSection(n.id)}
                            className="flex w-full items-center"
                            style={{
                              gap: "10px",
                              padding: "8px 12px 8px 20px",
                              borderRadius: "var(--r-card-sm)",
                              fontSize: "13px",
                              fontWeight: active ? 600 : 500,
                              color: active ? "var(--accent)" : "var(--foreground-70)",
                              background: active ? "var(--accent-soft)" : "transparent",
                              transition: "background 150ms ease",
                              minHeight: "36px",
                            }}
                            onMouseEnter={(e) => {
                              if (!active)
                                e.currentTarget.style.background = "var(--background-surface)";
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <n.icon size={16} />
                            {t(n.labelKey)}
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 p-3 sm:p-5 md:overflow-y-auto md:p-6">
          {/*
            Меню на телефоне — шторкой (решение Ж4, часть В3).

            Был родной `<select>` с `optgroup`. Решение требует шторку, и это
            не прихоть: тридцать два раздела в системном списке листаются
            вслепую, а поиск по разделам в `<select>` не работает вовсе —
            операционная система рисует его сама и о нашем поле не знает.
          */}
          <div className="md:hidden" style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setМеню(true)}
              className="flex w-full items-center justify-between"
              style={{
                height: "44px",
                background: "var(--background-elevated)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-input)",
                padding: "0 12px",
                fontSize: "14px",
                color: "var(--foreground)",
              }}
            >
              <span>{t(navItems.find((n) => n.id === navIdFor(section))?.labelKey ?? "")}</span>
              <ChevronDown size={16} aria-hidden />
            </button>
          </div>

          <Sheet open={меню} onOpenChange={setМеню}>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t("pages.adminShell.headerTitle")}</SheetTitle>
              </SheetHeader>
              <div style={{ position: "relative", margin: "12px 0" }}>
                <Search
                  size={16}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--foreground-50)",
                  }}
                />
                <input
                  value={поискМеню}
                  onChange={(e) => setПоискМеню(e.target.value)}
                  placeholder={t("pages.adminShell.navSearch.placeholder")}
                  aria-label={t("pages.adminShell.navSearch.label")}
                  style={{
                    width: "100%",
                    height: "44px",
                    paddingLeft: 36,
                    paddingRight: 12,
                    background: "var(--background-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-input)",
                    /* 16px: меньше — и iOS приближает страницу при фокусе. */
                    fontSize: "16px",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <nav className="flex flex-col gap-[2px] pb-[max(16px,env(safe-area-inset-bottom))]">
                {NAV_GROUPS.map((группа) => {
                  const пункты = visibleNavItems
                    .filter((n) => группа.items.includes(n.id))
                    .filter(
                      (n) => !ищем || подходит(t(n.labelKey)) || подходит(t(группа.labelKey)),
                    );
                  if (пункты.length === 0) return null;
                  return (
                    <div key={группа.id} style={{ marginBottom: "8px" }}>
                      <div
                        style={{
                          padding: "6px 12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--foreground-50)",
                        }}
                      >
                        {t(группа.labelKey)}
                      </div>
                      {пункты.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            goToSection(n.id);
                            setМеню(false);
                            setПоискМеню("");
                          }}
                          className="flex w-full items-center gap-[10px]"
                          style={{
                            /* 44 px — норма зоны нажатия в проекте. */
                            minHeight: "44px",
                            padding: "0 12px",
                            borderRadius: "var(--r-card-sm)",
                            fontSize: "14px",
                            textAlign: "left",
                            color:
                              n.id === navIdFor(section) ? "var(--accent)" : "var(--foreground)",
                            background:
                              n.id === navIdFor(section) ? "var(--accent-soft)" : "transparent",
                          }}
                        >
                          <n.icon size={16} />
                          {t(n.labelKey)}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {ищем &&
                  visibleNavItems.filter(
                    (n) =>
                      подходит(t(n.labelKey)) ||
                      NAV_GROUPS.some((g) => g.items.includes(n.id) && подходит(t(g.labelKey))),
                  ).length === 0 && (
                    <p
                      className="px-[12px] py-[8px] text-[13px]"
                      style={{ color: "var(--foreground-50)" }}
                    >
                      {t("pages.adminShell.navSearch.nothing")}
                    </p>
                  )}
              </nav>
            </SheetContent>
          </Sheet>

          {/*
            Заголовок страницы — имя текущего раздела.
            
            Находка B-10 финального аудита: у админки нет `h1`. Проверено
            09.10 обходом всех тридцати двух разделов под владельцем — `h1`
            нашёлся ровно на одном (`design`), `main` при этом везде один.
            Ворота проекта требуют «ровно один main и один h1 на странице»
            (FRONT-FINAL-RUN, 3.5.3), и админка их не проходила.
            
            Заголовок именно здесь, а не в шапке: в шапке стоит «Админ-панель»
            — одно и то же на тридцати двух страницах. Диктору и поисковику
            нужен заголовок страницы, а страница тут — раздел. Поэтому h1
            называет раздел и меняется вместе с ним.
            
            Визуально он не дублирует шапку: у разделов свои заголовки внутри
            карточек, а этот — крупная строка над содержимым, которой раньше
            не было вовсе.
          */}
          <h1 className="mb-[16px] text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
            {t(navItems.find((n) => n.id === navIdFor(section))?.labelKey ?? "")}
          </h1>

          {/* Выше переключателя: внутри плашка перемонтировалась бы и
              анимировалась на каждой смене раздела, хотя причина пустоты
              одна и та же. */}
          <EmptyDirectionsNotice />
          <ReducedMotionSwitch
            switchKey={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/*
              Недостижимый раздел не монтируется вовсе.

              Увод на первый доступный живёт в `useEffect`, то есть
              случается после отрисовки. Адрес без `?section` даёт
              `dashboard`, а он закрыт администратору направления — и
              сводка успевала смонтироваться и отправить `fetchDashboard`,
              обречённый на 403. Путь был редким, а с появлением пункта
              «Админ-панель» в меню стал для этой роли основным.
              Найдено ревью 01.10.
            */}
            {reachable ? <SectionView section={section} adminRole={adminRole} /> : null}
          </ReducedMotionSwitch>
        </main>
      </div>
    </div>
  );
}
