import {
  createLazyFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
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
} from "lucide-react";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSessionUser, useCurrentUser } from "@/lib/session";
import { ensureSession } from "@/lib/auth/session";
import { AdminSectionSkeleton } from "@/components/admin/AdminSectionSkeleton";
import type { AdminRole } from "@/components/admin/adminShared";
import type { Section } from "@/routes/admin";

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
const MonetizationSection = lazy(() =>
  import("@/components/admin/AdminMonetizationSection").then((m) => ({
    default: m.MonetizationSection,
  })),
);
const FeedBannersSection = lazy(() =>
  import("@/components/admin/AdminThinSections").then((m) => ({ default: m.FeedBannersSection })),
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

const navItems: { id: Section; labelKey: string; icon: typeof Users; roles: AdminRole[] }[] = [
  {
    id: "dashboard",
    labelKey: "pages.adminShell.nav.dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "moderator"],
  },
  { id: "users", labelKey: "pages.adminShell.nav.users", icon: Users, roles: ["admin"] },
  { id: "content", labelKey: "pages.adminShell.nav.content", icon: Newspaper, roles: ["admin"] },
  { id: "ads", labelKey: "pages.adminShell.nav.ads", icon: Megaphone, roles: ["admin"] },
  { id: "delivery", labelKey: "pages.adminShell.nav.delivery", icon: Truck, roles: ["admin"] },
  {
    id: "moderation",
    labelKey: "pages.adminShell.nav.moderation",
    icon: ShieldCheck,
    roles: ["admin", "moderator"],
  },
  {
    id: "applications",
    labelKey: "pages.adminShell.nav.applications",
    icon: Inbox,
    roles: ["admin"],
  },
  {
    id: "monetization",
    labelKey: "pages.adminShell.nav.monetization",
    icon: DollarSign,
    roles: ["admin"],
  },
  {
    id: "feedBanners",
    labelKey: "pages.adminShell.nav.feedBanners",
    icon: Megaphone,
    roles: ["admin"],
  },
  {
    id: "feedGuestAccess",
    labelKey: "pages.adminShell.nav.feedGuestAccess",
    icon: ShieldCheck,
    roles: ["admin"],
  },
  {
    id: "notificationPolicy",
    labelKey: "pages.adminShell.nav.notificationPolicy",
    icon: Bell,
    roles: ["admin"],
  },
  {
    id: "landingBlocks",
    labelKey: "pages.adminShell.nav.landingBlocks",
    icon: Home,
    roles: ["admin"],
  },
  { id: "icons", labelKey: "pages.adminShell.nav.icons", icon: Image, roles: ["admin"] },
  {
    id: "categories",
    labelKey: "pages.adminShell.nav.categories",
    icon: FolderTree,
    roles: ["admin"],
  },
  { id: "reviews", labelKey: "pages.adminShell.nav.reviews", icon: Clapperboard, roles: ["admin"] },
  {
    id: "notifications",
    labelKey: "pages.adminShell.nav.notifications",
    icon: Bell,
    roles: ["admin"],
  },
  {
    id: "analytics",
    labelKey: "pages.adminShell.nav.analytics",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    id: "feedback",
    labelKey: "pages.adminShell.nav.feedback",
    icon: Inbox,
    roles: ["admin", "moderator"],
  },
  { id: "design", labelKey: "pages.adminShell.nav.design", icon: Palette, roles: ["admin"] },
  { id: "media", labelKey: "pages.adminShell.nav.media", icon: Image, roles: ["admin"] },
  { id: "settings", labelKey: "pages.adminShell.nav.settings", icon: Settings, roles: ["admin"] },
  {
    id: "rulesPages",
    labelKey: "pages.adminShell.nav.rulesPages",
    icon: FileText,
    roles: ["admin"],
  },
  {
    id: "legalPages",
    labelKey: "pages.adminShell.nav.legalPages",
    icon: FileText,
    roles: ["admin"],
  },
  {
    id: "footerLinks",
    labelKey: "pages.adminShell.nav.footerLinks",
    icon: FileText,
    roles: ["admin"],
  },
  { id: "auditLog", labelKey: "pages.adminShell.nav.auditLog", icon: Search, roles: ["admin"] },
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
  if (section === "dashboard") return <Dashboard role={adminRole ?? "admin"} />;
  if (section === "users") return <UsersSection />;
  if (section === "content") return <ContentSection />;
  if (section === "ads") return <AdsSection />;
  if (section === "delivery") return <DeliverySection />;
  if (section === "moderation") return <ModerationAdminSection />;
  if (section === "applications") return <ApplicationsSection />;
  if (section === "monetization") return <MonetizationSection />;
  if (section === "feedBanners") return <FeedBannersSection />;
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
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [section, setSection] = useState<Section>(sectionFromUrl ?? "dashboard");

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
      // so fall back to treating isAdmin as "admin" there.
      const resolvedRole: AdminRole | null =
        current.role === "admin" || current.role === "moderator"
          ? current.role
          : current.isAdmin
            ? "admin"
            : null;
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
  const visibleNavItems = navItems.filter((n) => adminRole !== null && n.roles.includes(adminRole));

  useEffect(() => {
    if (sectionFromUrl) setSection(sectionFromUrl);
  }, [sectionFromUrl]);

  useEffect(() => {
    if (adminRole === null) return;
    if (!visibleNavItems.some((n) => n.id === section)) {
      setSection(visibleNavItems[0]?.id ?? "dashboard");
    }
  }, [adminRole, section, visibleNavItems]);

  if (isNestedAdminRoute) {
    return <Outlet />;
  }

  if (access === "checking") {
    return (
      <div
        className="min-h-screen grid place-items-center"
        style={{ background: "var(--background)", color: "var(--foreground-50)", fontSize: "13px" }}
      >
        {t("pages.adminShell.checkingAccess")}
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
                background: "var(--accent)",
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
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-between backdrop-blur"
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

      <div className="flex">
        {/* Sidebar */}
        <aside
          className="hidden md:block sticky"
          style={{
            width: "220px",
            background: "var(--background-elevated)",
            borderRight: "1px solid var(--border)",
            height: "calc(100vh - 48px)",
            top: "48px",
            overflowY: "auto",
            padding: "8px",
            flexShrink: 0,
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {visibleNavItems.map((n) => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className="flex w-full items-center"
                  style={{
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--r-card-sm)",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--accent)" : "var(--foreground-70)",
                    background: active ? "var(--accent-soft)" : "transparent",
                    transition: "background 150ms ease",
                    minHeight: "36px",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--background-surface)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <n.icon size={16} />
                  {t(n.labelKey)}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 p-3 sm:p-5 md:p-6">
          {/* Mobile selector */}
          <div className="md:hidden" style={{ marginBottom: "16px" }}>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as Section)}
              className="w-full outline-none"
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
              {visibleNavItems.map((n) => (
                <option key={n.id} value={n.id}>
                  {t(n.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <ReducedMotionSwitch
            switchKey={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <SectionView section={section} adminRole={adminRole} />
          </ReducedMotionSwitch>
        </main>
      </div>
    </div>
  );
}
