import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Newspaper, Megaphone, ShieldCheck, DollarSign, FolderTree,
  Bell, BarChart3, Settings, Home, Eye, Ban, Check, X, Plus, Trash2, Pencil, Send,
  Upload, UserPlus, Palette, Sun, Moon, CheckCircle2, AlertCircle, Info, Inbox, Truck, Clapperboard, Image, FileText, EyeOff,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore, selectors, getState } from "@/lib/store";
import { setFeatureFlag, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import type { Tariff, PromoCode, Video } from "@/lib/mock";
import { Search, Filter, Calendar, Tag } from "lucide-react";
import {
  fetchDashboard, fetchModeratorDashboardStats, fetchAuditLogs, fetchAuditLogPage, fetchAdminUsers, updateAdminUser, deleteAdminUser,
  approveModeration,
  fetchAdminPlans, fetchAdminPlansDetailed, updateAdminPlan,
  fetchAdminPromocodes, createPromocode, deletePromocode,
  fetchAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory,
  fetchAdminSettings, updateAdminSettings,
  fetchAdminPosts, updateAdminPostStatus, deleteAdminPost,
  fetchAdminVideos, updateAdminVideo, deleteAdminVideo,
  bulkUpdateAdminVideoStatus, bulkDeleteAdminVideos, bulkApproveAdminVideos,
  fetchAdminListings, updateAdminListingStatus, deleteAdminListing,
  bulkUpdateAdminListingStatus, bulkDeleteAdminListings,
  broadcastNotification,
  fetchAdminFeedback, updateAdminFeedbackStatus,
  fetchAdminDeliveryStats, fetchAdminShipments, updateAdminShipment,
  type AdminUserRow, type AuditEntry, type AuditLogDetailEntry,
  type AdminCategory, type CategoryKind, type AdminSetting,
  type AdminPostRow, type AdminListingRow,
  type FeedbackRow, type FeedbackStatus,
  type AdminPlanRow,
} from "@/lib/api/admin";
import type { AdminVideoRow } from "@/lib/api/admin";
import { fetchEntityRequests, approveEntityRequest, rejectEntityRequest, type EntityRequest, type RequestStatus, type EntityKind } from "@/lib/api/entity-requests";
import { FooterContactsAdminCard } from "@/components/admin/FooterContactsAdminCard";
import { SiteBrandingAdminCard } from "@/components/admin/SiteBrandingAdminCard";
import { DeliveryMethodsAdminCard } from "@/components/admin/DeliveryMethodsAdminCard";
import { ReviewCategoriesAdminSection } from "@/components/admin/ReviewCategoriesAdminSection";
import { ReferralProgramAdminCard } from "@/components/admin/ReferralProgramAdminCard";
import { FirstHundredAdminCard } from "@/components/admin/FirstHundredAdminCard";
import { AdminPaymentsAdminCard } from "@/components/admin/AdminPaymentsAdminCard";
import { AdminBillingOpsCard } from "@/components/admin/AdminBillingOpsCard";
import { CollapsibleText } from "@/components/ui/CollapsibleText";
import { BannersAdminCard } from "@/components/admin/BannersAdminCard";
import { LandingBlocksAdminCard } from "@/components/admin/LandingBlocksAdminCard";
import { FaqAdminCard } from "@/components/admin/FaqAdminCard";
import { IconManagerSection } from "@/components/admin/IconManagerSection";
import { FeedGuestAccessAdminCard } from "@/components/admin/FeedGuestAccessAdminCard";
import { AdminLegalPagesSection } from "@/components/admin/AdminLegalPagesSection";
import { AdminFooterLinksSection } from "@/components/admin/AdminFooterLinksSection";
import { ModerationAdminSection } from "@/components/admin/ModerationAdminSection";
import { MediaManagerCard } from "@/components/admin/MediaManagerCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import i18n from "@/lib/i18n";

type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation" | "delivery"
  | "monetization" | "feedBanners" | "feedGuestAccess" | "landingBlocks" | "categories" | "reviews" | "reviewCategories" | "notifications" | "analytics" | "design" | "icons" | "media" | "feedback" | "settings"
  | "auditLog" | "applications" | "legalPages" | "footerLinks";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: i18n.t("pages.adminShell.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>): { section?: Section } => ({
    section: typeof search.section === "string" ? (search.section as Section) : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: AdminPage,
});

type AdminRole = "admin" | "moderator";

const navItems: { id: Section; labelKey: string; icon: typeof Users; roles: AdminRole[] }[] = [
  { id: "dashboard", labelKey: "pages.adminShell.nav.dashboard", icon: LayoutDashboard, roles: ["admin", "moderator"] },
  { id: "users", labelKey: "pages.adminShell.nav.users", icon: Users, roles: ["admin"] },
  { id: "content", labelKey: "pages.adminShell.nav.content", icon: Newspaper, roles: ["admin"] },
  { id: "ads", labelKey: "pages.adminShell.nav.ads", icon: Megaphone, roles: ["admin"] },
  { id: "delivery", labelKey: "pages.adminShell.nav.delivery", icon: Truck, roles: ["admin"] },
  { id: "moderation", labelKey: "pages.adminShell.nav.moderation", icon: ShieldCheck, roles: ["admin", "moderator"] },
  { id: "applications", labelKey: "pages.adminShell.nav.applications", icon: Inbox, roles: ["admin"] },
  { id: "monetization", labelKey: "pages.adminShell.nav.monetization", icon: DollarSign, roles: ["admin"] },
  { id: "feedBanners", labelKey: "pages.adminShell.nav.feedBanners", icon: Megaphone, roles: ["admin"] },
  { id: "feedGuestAccess", labelKey: "pages.adminShell.nav.feedGuestAccess", icon: ShieldCheck, roles: ["admin"] },
  { id: "landingBlocks", labelKey: "pages.adminShell.nav.landingBlocks", icon: Home, roles: ["admin"] },
  { id: "icons", labelKey: "pages.adminShell.nav.icons", icon: Image, roles: ["admin"] },
  { id: "categories", labelKey: "pages.adminShell.nav.categories", icon: FolderTree, roles: ["admin"] },
  { id: "reviews", labelKey: "pages.adminShell.nav.reviews", icon: Clapperboard, roles: ["admin"] },
  { id: "notifications", labelKey: "pages.adminShell.nav.notifications", icon: Bell, roles: ["admin"] },
  { id: "analytics", labelKey: "pages.adminShell.nav.analytics", icon: BarChart3, roles: ["admin"] },
  { id: "feedback", labelKey: "pages.adminShell.nav.feedback", icon: Inbox, roles: ["admin", "moderator"] },
  { id: "design", labelKey: "pages.adminShell.nav.design", icon: Palette, roles: ["admin"] },
  { id: "media", labelKey: "pages.adminShell.nav.media", icon: Image, roles: ["admin"] },
  { id: "settings", labelKey: "pages.adminShell.nav.settings", icon: Settings, roles: ["admin"] },
  { id: "legalPages", labelKey: "pages.adminShell.nav.legalPages", icon: FileText, roles: ["admin"] },
  { id: "footerLinks", labelKey: "pages.adminShell.nav.footerLinks", icon: FileText, roles: ["admin"] },
  { id: "auditLog", labelKey: "pages.adminShell.nav.auditLog", icon: Search, roles: ["admin"] },
];

function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNestedAdminRoute = pathname.startsWith("/admin/") && pathname !== "/admin";
  const { section: sectionFromUrl } = Route.useSearch();
  const me = useStore(selectors.currentUser);
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
      const current = selectors.currentUser(getState());
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
          <div style={{ fontSize: "64px", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>403</div>
          <h1 style={{ marginTop: "16px", fontSize: "20px", fontWeight: 700, color: "var(--foreground)" }}>
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
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginTop: "20px" }}>
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
              <Home size={14} />{t("pages.adminShell.backHome")}
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
        className="sticky top-0 z-30 flex items-center justify-between backdrop-blur"
        style={{
          height: "48px",
          background: "color-mix(in oklab, var(--background) 85%, transparent)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
        }}
      >
        <div className="flex items-center gap-[12px]">
          <Logo size={28} showText={false} />
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>{t("pages.adminShell.headerTitle")}</span>
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
            <Home size={14} />{t("pages.adminShell.toSite")}
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
              {visibleNavItems.map((n) => <option key={n.id} value={n.id}>{t(n.labelKey)}</option>)}
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

function H({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-[12px]" style={{ marginBottom: "16px" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-h4)", color: "var(--foreground)" }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

const card = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};
const inputStyle: React.CSSProperties = {
  height: "40px",
  background: "var(--background-elevated)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
};
const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontWeight: 600,
  fontSize: "13px",
  borderRadius: "var(--r-button)",
  padding: "0 16px",
  height: "40px",
};

function SectionView({ section, adminRole }: { section: Section; adminRole: AdminRole | null }) {
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
  if (section === "landingBlocks") return <LandingBlocksSection />;
  if (section === "icons") return <IconManagerSection />;
  if (section === "categories") return <CategoriesSection />;
  if (section === "reviews" || section === "reviewCategories") return <ReviewsSection initialSubTab={section === "reviewCategories" ? "categories" : "list"} />;
  if (section === "notifications") return <NotificationsSection />;
  if (section === "analytics") return <AnalyticsSection />;
  if (section === "feedback") return <FeedbackSection />;
  if (section === "design") return <DesignSystemSection />;
  if (section === "media") return <MediaSection />;
  if (section === "auditLog") return <AuditLogSection />;
  if (section === "legalPages") return <AdminLegalPagesSection />;
  if (section === "footerLinks") return <AdminFooterLinksSection />;
  return <SettingsSection />;
}

// =============================================================
// Design System — admin-only theme switcher (visual sandbox)
// =============================================================
import {
  generateVariations, applyTheme, loadTheme,
  ACCENT_PRESET_LIST, ACCENT_PRESETS, DEFAULT_ACCENT_ID, isAccentPresetId,
  type Mode, type AccentSwatch, type AccentPreset, type AccentPresetId,
} from "@/lib/theme-manager";

function MediaSection() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <MediaManagerCard />
    </div>
  );
}

function DesignSystemSection() {
  const { t } = useTranslation();
  const initial = loadTheme();
  const [mode, setMode] = useState<Mode>(initial?.mode ?? (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"));
  const [accent, setAccent] = useState<string>(initial?.accent ?? DEFAULT_ACCENT_ID);

  const activeHex = isAccentPresetId(accent) ? ACCENT_PRESETS[accent].primary : accent;
  const variations = useMemo(() => generateVariations(activeHex), [activeHex]);

  function pickPreset(id: AccentPresetId) {
    setAccent(id);
    applyTheme({ mode, accent: id });
  }
  function pickAccent(hex: string) {
    setAccent(hex);
    applyTheme({ mode, accent: hex });
  }
  function pickMode(m: Mode) {
    setMode(m);
    applyTheme({ mode: m, accent });
  }
  function reset() {
    setMode("dark");
    setAccent(DEFAULT_ACCENT_ID);
    applyTheme({ mode: "dark", accent: DEFAULT_ACCENT_ID });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
            {t("pages.adminDesignSystem.title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--foreground-70)" }}>
            {t("pages.adminDesignSystem.subtitle")}
          </p>
        </div>
        <a
          href="/admin/design-system"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, border: "1px solid var(--accent)", color: "var(--accent)",
            background: "var(--accent-soft)", whiteSpace: "nowrap",
          }}
        >
          {t("pages.adminDesignSystem.uiKitLink")}
        </a>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", }}>
        <Panel title={t("pages.adminDesignSystem.themeMode")}>
          <div style={{ display: "flex", gap: 8 }}>
            <ModeBtn active={mode === "light"} onClick={() => pickMode("light")} icon={<Sun size={16} />} label="Light" />
            <ModeBtn active={mode === "dark"} onClick={() => pickMode("dark")} icon={<Moon size={16} />} label="Dark" />
            <button
              onClick={reset}
              style={{
                marginLeft: "auto", padding: "8px 14px", borderRadius: 10, fontSize: 13,
                border: "1px solid var(--border)", background: "var(--background-surface)", color: "var(--foreground-70)",
              }}
            >
              {t("pages.adminDesignSystem.reset")}
            </button>
          </div>
        </Panel>

        <Panel title={t("pages.adminDesignSystem.brandColor")}>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {ACCENT_PRESET_LIST.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={isAccentPresetId(accent) && accent === p.id}
                onPick={() => pickPreset(p.id)}
              />
            ))}
          </div>
        </Panel>

        {/* Advanced / debug — free-form hex is intentionally NOT the main scenario. */}
        <details style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: 16 }}>
          <summary style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground-70)", cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("pages.adminDesignSystem.advancedMode")}
          </summary>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                type="color"
                value={activeHex}
                onChange={(e) => pickAccent(e.target.value)}
                aria-label={t("pages.adminDesignSystem.pickAccentAria")}
                style={{ width: 48, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "transparent", cursor: "pointer", padding: 2 }}
              />
              <input
                type="text"
                value={activeHex}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) pickAccent(v.toUpperCase());
                }}
                placeholder="#RRGGBB"
                spellCheck={false}
                style={{
                  width: 130, height: 36, padding: "0 12px", borderRadius: 8, fontSize: 13,
                  border: "1px solid var(--border)", background: "var(--background-surface)", color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>{t("pages.adminDesignSystem.debugHint")}</span>
            </div>
            <SwatchRow swatches={variations} active={activeHex} onPick={pickAccent} />
          </div>
        </details>
      </div>

      {/* Preview */}
      <SiteBrandingAdminCard cardStyle={{ background: "var(--background-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }} />

      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginTop: 8 }}>{t("pages.adminDesignSystem.previewTitle")}</h2>
      <PreviewArea />

      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 24, padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--background-elevated)" }}>
        {t("pages.adminDesignSystem.iconsHint")}{" "}
        <Link to="/admin" search={{ section: "icons" }} style={{ color: "var(--accent)", fontWeight: 600 }}>
          {t("pages.adminDesignSystem.iconsLink")}
        </Link>
        .
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--background-elevated)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", padding: 16,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground-70)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
        borderRadius: 10, fontSize: 13, fontWeight: 600,
        background: active ? "var(--accent)" : "var(--background-surface)",
        color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        boxShadow: active ? "var(--shadow-button)" : "none",
      }}
    >
      {icon}{label}
    </button>
  );
}

function SwatchRow({ swatches, active, onPick }: { swatches: AccentSwatch[]; active: string; onPick: (hex: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {swatches.map((s) => {
        const isActive = s.hex.toUpperCase() === active.toUpperCase();
        return (
          <button
            key={s.id + s.hex}
            onClick={() => onPick(s.hex)}
            title={`${s.label} — ${s.hex}`}
            style={{
              width: 88, padding: 6, borderRadius: 12,
              border: `2px solid ${isActive ? "var(--foreground)" : "transparent"}`,
              background: "var(--background-surface)",
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div style={{ height: 44, borderRadius: 8, background: s.hex }} />
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--foreground-70)" }}>{s.hex}</div>
          </button>
        );
      })}
    </div>
  );
}

/** Brand preset chooser card — swatch + hex + live component samples (rendered
 *  with the preset's OWN colors so it previews before you apply it). */
function PresetCard({ preset, active, onPick }: { preset: AccentPreset; active: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        border: `2px solid ${active ? preset.primary : "var(--border)"}`,
        borderRadius: 16,
        padding: 16,
        background: "var(--background-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: active ? `0 0 0 4px ${preset.soft}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: preset.primary, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{preset.label}</span>
            {active && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: preset.primary }}>
                <CheckCircle2 size={13} /> {t("pages.adminDesignSystem.presetActive")}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--foreground-50)" }}>{preset.primary}</div>
        </div>
      </div>

      {/* live component samples in the preset's own colors */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ padding: "8px 14px", borderRadius: 10, background: preset.primary, color: preset.foreground, fontSize: 13, fontWeight: 600 }}>
          {t("pages.adminDesignSystem.presetButton")}
        </span>
        <span style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", background: preset.primary, color: preset.foreground, fontSize: 11, fontWeight: 700 }}>
          PRO
        </span>
        <span style={{ padding: "6px 12px", borderRadius: 8, background: preset.soft, color: preset.primary, fontSize: 12, fontWeight: 600 }}>
          {t("pages.adminDesignSystem.presetTab")}
        </span>
      </div>

      <button
        onClick={onPick}
        disabled={active}
        style={{
          marginTop: "auto",
          height: 40,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: active ? "default" : "pointer",
          border: active ? "1px solid var(--border)" : "none",
          background: active ? "var(--background-elevated)" : preset.primary,
          color: active ? "var(--foreground-50)" : preset.foreground,
        }}
      >
        {active ? t("pages.adminDesignSystem.presetPrimary") : t("pages.adminDesignSystem.presetMakePrimary")}
      </button>
    </div>
  );
}

function PreviewArea() {
  const { t } = useTranslation();
  const navItems = useMemo(() => [
    { label: t("pages.adminDesignSystem.preview.navHome"), active: true },
    { label: t("pages.adminDesignSystem.preview.navFeed"), active: false },
    { label: t("pages.adminDesignSystem.preview.navChannels"), active: false },
    { label: t("pages.adminDesignSystem.preview.navMessages"), active: false },
  ], [t]);
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {/* Buttons */}
      <Panel title={t("pages.adminDesignSystem.preview.buttons")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>{t("pages.adminDesignSystem.preview.btnPrimary")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>{t("pages.adminDesignSystem.preview.btnSoft")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)" }}>{t("pages.adminDesignSystem.preview.btnOutline")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", fontSize: 13, fontWeight: 600 }} disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", display: "grid", placeItems: "center" }}><Plus size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Pencil size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}><Trash2 size={16} /></button>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title={t("pages.adminDesignSystem.preview.badges")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge bg="var(--accent)" fg="var(--accent-foreground)">PRO</Badge>
          <Badge bg="var(--accent-soft)" fg="var(--accent)">{t("pages.adminDesignSystem.preview.badgeNew")}</Badge>
          <Badge bg="var(--success-soft)" fg="var(--success)">{t("pages.adminDesignSystem.preview.badgeActive")}</Badge>
          <Badge bg="var(--warning-soft)" fg="var(--warning)">{t("pages.adminDesignSystem.preview.badgeReview")}</Badge>
          <Badge bg="var(--error-soft)" fg="var(--error)">{t("pages.adminDesignSystem.preview.badgeRejected")}</Badge>
          <Badge bg="var(--info-soft)" fg="var(--info)">{t("pages.adminDesignSystem.preview.badgeInfo")}</Badge>
        </div>
      </Panel>

      {/* Alerts */}
      <Panel title={t("pages.adminDesignSystem.preview.alerts")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Alert icon={<CheckCircle2 size={16} />} bg="var(--success-soft)" fg="var(--success)" text={t("pages.adminDesignSystem.preview.alertSaved")} />
          <Alert icon={<Info size={16} />} bg="var(--info-soft)" fg="var(--info)" text={t("pages.adminDesignSystem.preview.alertHint")} />
          <Alert icon={<AlertCircle size={16} />} bg="var(--error-soft)" fg="var(--error)" text={t("pages.adminDesignSystem.preview.alertError")} />
        </div>
      </Panel>

      {/* Card */}
      <Panel title={t("pages.adminDesignSystem.preview.card")}>
        <div style={{ padding: 14, borderRadius: 12, background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>{t("pages.adminDesignSystem.preview.cardTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--foreground-70)", marginBottom: 10 }}>{t("pages.adminDesignSystem.preview.cardDesc")}</div>
          <a style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{t("pages.adminDesignSystem.preview.cardMore")}</a>
        </div>
      </Panel>

      {/* Inputs */}
      <Panel title={t("pages.adminDesignSystem.preview.inputs")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Email" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder={t("pages.adminDesignSystem.preview.inputFocus")} autoFocus style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1.5px solid var(--accent)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
          <textarea placeholder={t("pages.adminDesignSystem.preview.inputMessage")} rows={3} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13, resize: "none" }} />
        </div>
      </Panel>

      {/* Upload */}
      <Panel title={t("pages.adminDesignSystem.preview.upload")}>
        <div style={{ padding: 20, borderRadius: 12, border: "2px dashed var(--border-accent)", background: "var(--accent-soft)", textAlign: "center" }}>
          <Upload size={20} style={{ color: "var(--accent)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--foreground-70)" }}>{t("pages.adminDesignSystem.preview.uploadHint")} <span style={{ color: "var(--accent)", fontWeight: 600 }}>{t("pages.adminDesignSystem.preview.uploadChoose")}</span></div>
        </div>
      </Panel>

      {/* Login form */}
      <Panel title={t("pages.adminDesignSystem.preview.loginForm")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder={t("pages.adminDesignSystem.preview.login")} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder={t("pages.adminDesignSystem.preview.password")} type="password" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>{t("pages.adminDesignSystem.preview.signIn")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground-70)", fontSize: 13, fontWeight: 500, border: "1px solid var(--border)" }}>{t("pages.adminDesignSystem.preview.signUp")}</button>
        </div>
      </Panel>

      {/* Nav */}
      <Panel title={t("pages.adminDesignSystem.preview.nav")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((it) => (
            <div key={it.label} style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13,
              fontWeight: it.active ? 600 : 500,
              color: it.active ? "var(--accent)" : "var(--foreground-70)",
              background: it.active ? "var(--accent-soft)" : "transparent",
            }}>{it.label}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return <span style={{ padding: "4px 10px", borderRadius: "var(--r-pill)", fontSize: 11, fontWeight: 600, background: bg, color: fg }}>{children}</span>;
}
function Alert({ icon, bg, fg, text }: { icon: React.ReactNode; bg: string; fg: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: bg, color: fg, fontSize: 13, fontWeight: 500 }}>
      {icon}{text}
    </div>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard({ role }: { role: AdminRole }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let active = true;
    if (role === "admin") {
      fetchDashboard().then((d) => active && setData(d)).catch(() => {});
      fetchAuditLogs().then((a) => active && setAudit(a)).catch(() => {});
    } else {
      fetchModeratorDashboardStats()
        .then((stats) => {
          if (!active) return;
          setData({
            usersTotal: 0,
            postsTotal: 0,
            communitiesTotal: 0,
            moderationPending: stats.moderationPending,
            reportsPending: stats.reportsPending,
            plansActive: 0,
            promocodesActive: 0,
            bannersActive: 0,
          });
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [role]);

  const allStats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statUsers"), icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.communitiesTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statCommunities"), icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.bannersActive ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statBanners"), icon: Megaphone, ch: "", up: true, adminOnly: true },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statPosts"), icon: Newspaper, ch: "", up: true, adminOnly: true },
    { v: String(data?.moderationPending ?? 0), l: t("pages.adminDashboard.statModeration"), icon: ShieldCheck, ch: "", up: true, warn: true, adminOnly: false },
    { v: String(data?.reportsPending ?? 0), l: t("pages.adminDashboard.statReports"), icon: UserPlus, ch: "", up: true, adminOnly: false },
  ];
  const stats = allStats.filter((s) => role === "admin" || !s.adminOnly);
  const bars = [40, 65, 55, 80, 70, 90, 60];
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return (
    <div>
      <H>{t("pages.adminDashboard.title")}</H>
      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        style={{ gap: "12px" }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            style={{ ...card, padding: "16px" }}
          >
            <div
              style={{
                width: "36px", height: "36px",
                borderRadius: "var(--r-pill)",
                background: s.warn ? "var(--warning-soft)" : "var(--accent-soft)",
                display: "grid", placeItems: "center",
                marginBottom: "12px",
              }}
            >
              <s.icon size={18} style={{ color: s.warn ? "var(--warning)" : "var(--accent)" }} />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "28px", color: "var(--foreground)" }}>{s.v}</div>
            <div style={{ fontSize: "12px", color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>{s.l}</div>
            {s.ch && <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--success)", marginTop: "2px" }}>{s.ch} ↑</div>}
          </motion.div>
        ))}
      </motion.div>

      {role === "admin" && (
        <>
          {/* Chart */}
          <div style={{ ...card, padding: "20px", marginTop: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>
          {t("pages.adminDashboard.registrationsChart")}
        </h4>
        <div style={{ height: "200px", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "16px", marginTop: "16px" }}>
          {bars.map((h, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    width: "36px",
                    background: "var(--accent)",
                    borderRadius: "4px 4px 0 0",
                    minHeight: "4px",
                  }}
                />
              </div>
              <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t(`pages.adminDashboard.days.${dayKeys[i]}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent actions */}
      <div style={{ ...card, marginTop: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", padding: "16px 16px 8px" }}>
          {t("pages.adminDashboard.recentActions")}
        </h4>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{a.user}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.action}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.target}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-30)", fontSize: "12px", textAlign: "right" }}>{a.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/* ============ USERS ============ */
function UsersSection() {
  const { t } = useTranslation();
  const me = useStore(selectors.currentUser);
  const roleOptions = useMemo(() => ([
    { value: "user" as const, label: t("pages.adminUsers.roleUser") },
    { value: "subscriber" as const, label: t("pages.adminUsers.roleSubscriber") },
    { value: "moderator" as const, label: t("pages.adminUsers.roleModerator") },
    { value: "admin" as const, label: t("pages.adminUsers.roleAdmin") },
  ]), [t]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | AdminUserRow["role"]>("all");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminUsers({ role }).then((list) => active && setUsers(list)).catch(() => {});
    return () => { active = false; };
  }, [role]);

  const changeRole = async (uuid: string, newRole: AdminUserRow["role"]) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target || target.role === newRole) return;
    if (me.id === uuid) {
      toast.error(t("pages.adminUsers.cannotChangeOwnRole"));
      return;
    }
    setSavingRole(uuid);
    try {
      await updateAdminUser(uuid, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, role: newRole } : u)));
      toast.success(newRole === "admin" ? t("pages.adminUsers.roleAdminAssigned") : t("pages.adminUsers.roleUpdated"));
    } catch {
      toast.error(t("pages.adminUsers.roleChangeFailed"));
    } finally {
      setSavingRole(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchR = role === "all" || u.role === role;
      return matchQ && matchR;
    });
  }, [users, query, role]);

  const toggle = async (uuid: string) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target) return;
    const ns = target.status === "active" ? "blocked" : "active";
    try {
      await updateAdminUser(uuid, { status: ns });
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, status: ns } : u)));
      toast.success(ns === "blocked" ? t("pages.adminUsers.userBlocked") : t("pages.adminUsers.userUnblocked"));
    } catch {
      toast.error(t("pages.adminUsers.statusChangeFailed"));
    }
  };

  const remove = async (uuid: string) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target) return;
    if (me.id === uuid) {
      toast.error(t("pages.adminUsers.cannotDeleteSelf"));
      return;
    }
    if (!window.confirm(t("pages.adminUsers.deleteConfirm", { email: target.email }))) return;
    setDeletingUuid(uuid);
    try {
      await deleteAdminUser(uuid);
      setUsers((prev) => prev.filter((u) => u.uuid !== uuid));
      toast.success(t("pages.adminUsers.userDeleted"));
    } catch {
      toast.error(t("pages.adminUsers.deleteFailed"));
    } finally {
      setDeletingUuid(null);
    }
  };

  const roleBadge = (r: AdminUserRow["role"]) => {
    const map: Record<AdminUserRow["role"], { bg: string; c: string; l: string }> = {
      admin: { bg: "var(--accent-soft)", c: "var(--accent)", l: t("pages.adminUsers.roleAdmin") },
      moderator: { bg: "var(--info-soft)", c: "var(--info)", l: t("pages.adminUsers.roleModerator") },
      subscriber: { bg: "var(--success-soft)", c: "var(--success)", l: t("pages.adminUsers.roleSubscriber") },
      user: { bg: "var(--background-surface)", c: "var(--foreground-50)", l: t("pages.adminUsers.roleUserShort") },
    };
    const s = map[r];
    return (
      <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "var(--r-tag)", background: s.bg, color: s.c }}>
        {s.l}
      </span>
    );
  };

  return (
    <div>
      <H>{t("pages.adminUsers.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pages.adminUsers.searchPlaceholder")}
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "all" | AdminUserRow["role"])}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminUsers.allRoles")}</option>
          <option value="user">{t("pages.adminUsers.roleUser")}</option>
          <option value="subscriber">{t("pages.adminUsers.roleSubscriber")}</option>
          <option value="moderator">{t("pages.adminUsers.roleModerator")}</option>
          <option value="admin">{t("pages.adminUsers.roleAdmin")}</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "780px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {[t("pages.adminCommon.colName"), t("pages.adminCommon.colEmail"), t("pages.adminCommon.colCity"), t("pages.adminCommon.colSubscription"), t("pages.adminCommon.colRole"), t("pages.adminCommon.colStatus"), t("pages.adminCommon.colActions")].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-[10px]">
                      <div style={{ width: "32px", height: "32px", borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 700 }}>
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.email}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.city || "—"}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.role === "subscriber" ? t("pages.adminUsers.subscriptionActive") : "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex flex-col" style={{ gap: "6px" }}>
                      {roleBadge(u.role)}
                      <select
                        value={u.role}
                        disabled={me.id === u.uuid || savingRole === u.uuid}
                        onChange={(e) => changeRole(u.uuid, e.target.value as AdminUserRow["role"])}
                        className="outline-none"
                        title={me.id === u.uuid ? t("pages.adminUsers.cannotChangeOwnRole") : t("pages.adminUsers.changeRoleTitle")}
                        style={{
                          fontSize: "12px",
                          height: "28px",
                          padding: "0 8px",
                          borderRadius: "var(--r-card-sm)",
                          border: "1px solid var(--border)",
                          background: "var(--background-surface)",
                          color: "var(--foreground-70)",
                          opacity: me.id === u.uuid ? 0.5 : 1,
                        }}
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={u.status === "active" ? "published" : "rejected"}>
                      {u.status === "active" ? t("pages.adminUsers.statusActive") : u.status === "blocked" ? t("pages.adminUsers.statusBlocked") : t("pages.adminUsers.statusPending")}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info(t("pages.adminUsers.previewToast", { name: u.name }))}><Eye size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toggle(u.uuid)}><Ban size={14} /></IconBtn>
                      <IconBtn
                        danger
                        onClick={() => remove(u.uuid)}
                        title={me.id === u.uuid ? t("pages.adminUsers.cannotDeleteSelf") : t("pages.adminCommon.actionDelete")}
                      >
                        <Trash2 size={14} style={{ opacity: deletingUuid === u.uuid ? 0.4 : 1 }} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, danger, success, title }: { children: React.ReactNode; onClick: () => void; danger?: boolean; success?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "32px", height: "32px",
        borderRadius: "var(--r-card-sm)",
        border: "1px solid var(--border)",
        background: "transparent",
        color: danger ? "var(--error)" : success ? "var(--success)" : "var(--foreground-70)",
        display: "grid", placeItems: "center",
        transition: "background 150ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "var(--error-soft)" : success ? "var(--success-soft)" : "var(--background-surface)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

/* ============ CONTENT ============ */
type BadgeVariant = "published" | "moderation" | "rejected" | "default";

function statusMeta(map: Record<string, { label: string; variant: BadgeVariant }>, status: string) {
  return map[status] ?? { label: status || "—", variant: "default" as BadgeVariant };
}

function ContentSection() {
  const { t } = useTranslation();
  const postStatusMeta = useMemo(() => ({
    published: { label: t("pages.adminCommon.statusPublished"), variant: "published" as BadgeVariant },
    pending_moderation: { label: t("pages.adminCommon.statusPendingModeration"), variant: "moderation" as BadgeVariant },
    revision: { label: t("pages.adminCommon.statusRevision"), variant: "moderation" as BadgeVariant },
    rejected: { label: t("pages.adminCommon.statusRejected"), variant: "rejected" as BadgeVariant },
    draft: { label: t("pages.adminCommon.statusDraft"), variant: "default" as BadgeVariant },
    hidden: { label: t("pages.adminCommon.statusHidden"), variant: "default" as BadgeVariant },
    archived: { label: t("pages.adminCommon.statusArchived"), variant: "default" as BadgeVariant },
  }), [t]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AdminPostRow | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminPosts(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminContent.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, t]);

  const filtered = rows.filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()));

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminPostStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminCommon.statusUpdated"));
    } catch { toast.error(t("pages.adminCommon.statusUpdateFailed")); }
  };
  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminContent.deleteConfirm"))) return;
    try {
      await deleteAdminPost(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      toast.success(t("pages.adminCommon.deleted"));
    } catch { toast.error(t("pages.adminCommon.deleteFailed")); }
  };

  const tableHeaders = [
    t("pages.adminCommon.colTitle"),
    t("pages.adminCommon.colAuthor"),
    t("pages.adminCommon.colCategory"),
    t("pages.adminCommon.colStatus"),
    t("pages.adminCommon.colActions"),
  ];

  return (
    <div>
      <H>{t("pages.adminContent.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("pages.adminCommon.searchPlaceholder")} className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("pages.adminCommon.allStatuses")}</option>
          <option value="published">{t("pages.adminCommon.statusPublished")}</option>
          <option value="pending_moderation">{t("pages.adminCommon.statusPendingModeration")}</option>
          <option value="rejected">{t("pages.adminCommon.statusRejected")}</option>
          <option value="hidden">{t("pages.adminCommon.statusHidden")}</option>
          <option value="draft">{t("pages.adminCommon.statusDraft")}</option>
        </select>
      </div>
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {tableHeaders.map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminContent.empty")}</td></tr>
              ) : filtered.map((p) => {
                const meta = statusMeta(postStatusMeta, p.status);
                return (
                  <tr key={p.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{p.title}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.author}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.community ?? p.category}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div className="flex gap-[6px]">
                        <IconBtn success onClick={() => changeStatus(p.uuid, "published")} title={t("pages.adminCommon.actionApprove")}><Check size={14} /></IconBtn>
                        <IconBtn onClick={() => setPreview(p)} title={t("pages.adminCommon.actionPreview")}><Eye size={14} /></IconBtn>
                        <IconBtn danger onClick={() => remove(p.uuid)} title={t("pages.adminCommon.actionDelete")}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("pages.adminContent.previewDialog")}
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...card,
              width: "min(720px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "20px",
            }}
          >
            <div className="flex items-start justify-between gap-[12px]">
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--foreground)" }}>
                  {preview.title}
                </h3>
                <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--foreground-50)" }}>
                  {preview.author} · {preview.category}
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)} style={{ ...inputStyle, height: "32px", padding: "0 12px" }}>
                {t("pages.adminCommon.close")}
              </button>
            </div>
            {preview.body && (
              <p style={{ marginTop: "16px", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.6, color: "var(--foreground-90)" }}>
                {preview.body}
              </p>
            )}
            {preview.video ? (
              <video
                src={preview.video}
                controls
                preload="metadata"
                playsInline
                style={{ marginTop: "16px", width: "100%", maxHeight: 420, borderRadius: 10, background: "#000" }}
              />
            ) : preview.images[0] ? (
              <img
                src={preview.images[0]}
                alt={preview.title}
                style={{ marginTop: "16px", width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 10, background: "var(--background-surface)" }}
              />
            ) : (
              <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminContent.noMedia")}</p>
            )}
            <div className="flex flex-wrap gap-[8px]" style={{ marginTop: "20px" }}>
              <button type="button" style={primaryBtn} onClick={() => { void changeStatus(preview.uuid, "published"); setPreview(null); }}>
                {t("pages.adminCommon.approveAndPublish")}
              </button>
              <button
                type="button"
                style={{ ...inputStyle, height: "40px", padding: "0 16px", fontWeight: 600 }}
                onClick={() => { void changeStatus(preview.uuid, "rejected"); setPreview(null); }}
              >
                {t("pages.adminCommon.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ ADS ============ */
function AdsSection() {
  const { t } = useTranslation();
  const listingStatusMeta = useMemo(() => ({
    published: { label: t("pages.adminCommon.statusPublished"), variant: "published" as BadgeVariant },
    pending_moderation: { label: t("pages.adminCommon.statusPendingModeration"), variant: "moderation" as BadgeVariant },
    awaiting_payment: { label: t("pages.adminCommon.statusAwaitingPayment"), variant: "moderation" as BadgeVariant },
    revision: { label: t("pages.adminCommon.statusRevision"), variant: "moderation" as BadgeVariant },
    rejected: { label: t("pages.adminCommon.statusRejected"), variant: "rejected" as BadgeVariant },
    draft: { label: t("pages.adminCommon.statusDraft"), variant: "default" as BadgeVariant },
    unpublished: { label: t("pages.adminCommon.statusUnpublished"), variant: "default" as BadgeVariant },
    sold: { label: t("pages.adminCommon.statusSold"), variant: "default" as BadgeVariant },
    expired: { label: t("pages.adminCommon.statusExpired"), variant: "default" as BadgeVariant },
  }), [t]);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminListings(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminAds.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, t]);

  const filtered = useMemo(
    () => rows.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  useEffect(() => {
    setSelected(new Set());
  }, [status, query]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.uuid));
  const someSelected = filtered.some((r) => selected.has(r.uuid));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleOne = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.uuid));
      else filtered.forEach((r) => next.add(r.uuid));
      return next;
    });
  };

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminListingStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminCommon.statusUpdated"));
    } catch { toast.error(t("pages.adminCommon.statusUpdateFailed")); }
  };

  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminAds.deleteConfirm"))) return;
    try {
      await deleteAdminListing(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      setSelected((prev) => {
        if (!prev.has(uuid)) return prev;
        const next = new Set(prev);
        next.delete(uuid);
        return next;
      });
      toast.success(t("pages.adminCommon.deleted"));
    } catch { toast.error(t("pages.adminCommon.deleteFailed")); }
  };

  const bulkChangeStatus = async (next: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkUpdateAdminListingStatus(ids, next);
      if (ok > 0) {
        setRows((prev) => prev.map((r) => (selected.has(r.uuid) ? { ...r, status: next } : r)));
      }
      setSelected(new Set());
      if (failed > 0) toast.error(t("pages.adminCommon.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminAds.bulkStatusSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminCommon.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkDeleteAdminListings(ids);
      if (ok > 0) {
        setRows((prev) => prev.filter((r) => !selected.has(r.uuid)));
        setSelected(new Set());
      }
      setDeleteConfirmOpen(false);
      if (failed > 0) toast.error(t("pages.adminCommon.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminAds.bulkDeleteSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminCommon.deleteFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkBtnStyle: CSSProperties = {
    ...inputStyle,
    height: "34px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: bulkBusy ? "not-allowed" : "pointer",
    opacity: bulkBusy ? 0.6 : 1,
  };

  const tableHeaders = [
    t("pages.adminCommon.colTitle"),
    t("pages.adminCommon.colSeller"),
    t("pages.adminCommon.colPrice"),
    t("pages.adminCommon.colCategory"),
    t("pages.adminCommon.colStatus"),
    t("pages.adminCommon.colActions"),
  ];

  return (
    <div>
      <H>{t("pages.adminAds.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("pages.adminCommon.searchPlaceholder")} className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("pages.adminCommon.allStatuses")}</option>
          <option value="published">{t("pages.adminCommon.statusPublished")}</option>
          <option value="pending_moderation">{t("pages.adminCommon.statusPendingModeration")}</option>
          <option value="rejected">{t("pages.adminCommon.statusRejected")}</option>
          <option value="unpublished">{t("pages.adminCommon.statusUnpublished")}</option>
          <option value="sold">{t("pages.adminCommon.statusSold")}</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center"
          style={{
            ...card,
            marginTop: "16px",
            padding: "12px 16px",
            gap: "10px",
            borderColor: "color-mix(in oklab, var(--accent) 35%, var(--border))",
            background: "color-mix(in oklab, var(--accent) 6%, var(--background-elevated))",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("pages.adminCommon.selectedCount", { count: selected.size })}
          </span>
          <button type="button" disabled={bulkBusy} style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px" }} onClick={() => void bulkChangeStatus("published")}>
            <Check size={13} /> {t("pages.adminCommon.actionPublish")}
          </button>
          <button type="button" disabled={bulkBusy} style={bulkBtnStyle} onClick={() => void bulkChangeStatus("unpublished")}>
            {t("pages.adminAds.bulkUnpublish")}
          </button>
          <button type="button" disabled={bulkBusy} style={bulkBtnStyle} onClick={() => void bulkChangeStatus("pending_moderation")}>
            {t("pages.adminAds.bulkToModeration")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--error)", borderColor: "color-mix(in oklab, var(--error) 40%, var(--border))" }}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 size={13} /> {t("pages.adminCommon.bulkDelete")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, marginLeft: "auto", color: "var(--foreground-50)" }}
            onClick={() => setSelected(new Set())}
          >
            {t("pages.adminCommon.bulkClear")}
          </button>
        </div>
      )}

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "760px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                <th style={{ padding: "10px 12px", width: "44px" }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={t("pages.adminAds.selectAll")}
                    style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                  />
                </th>
                {tableHeaders.map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminAds.empty")}</td></tr>
              ) : filtered.map((a) => {
                const meta = statusMeta(listingStatusMeta, a.status);
                const isSelected = selected.has(a.uuid);
                return (
                  <tr
                    key={a.uuid}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: isSelected ? "color-mix(in oklab, var(--accent) 5%, transparent)" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(a.uuid)}
                        aria-label={t("pages.adminAds.selectRow", { title: a.title })}
                        style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{a.title}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.author}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>{a.price.toLocaleString("ru")} ₽</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.category}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div className="flex gap-[6px]">
                        <IconBtn success onClick={() => changeStatus(a.uuid, "published")} title={t("pages.adminCommon.actionPublish")}><Check size={14} /></IconBtn>
                        <IconBtn
                          onClick={() => navigate({ to: "/admin/listings/$uuid", params: { uuid: a.uuid } })}
                          title={t("pages.adminCommon.actionViewEdit")}
                        >
                          <Eye size={14} />
                        </IconBtn>
                        <IconBtn danger onClick={() => remove(a.uuid)} title={t("pages.adminCommon.actionDelete")}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.adminAds.bulkDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.adminAds.bulkDeleteDesc", { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>{t("pages.adminCommon.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault();
                void bulkRemove();
              }}
              className="bg-[var(--error)] text-white hover:bg-[var(--error)]/90"
            >
              {bulkBusy ? t("pages.adminCommon.bulkDeleting") : t("pages.adminCommon.bulkDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ============ DELIVERY ============ */
function DeliverySection() {
  const { t } = useTranslation();
  const shipmentStatusMeta = useMemo(() => ({
    draft: { label: t("pages.adminDelivery.status.draft"), variant: "default" as const },
    quoted: { label: t("pages.adminDelivery.status.quoted"), variant: "info" as const },
    awaiting_seller: { label: t("pages.adminDelivery.status.awaiting_seller"), variant: "warning" as const },
    creating: { label: t("pages.adminDelivery.status.creating"), variant: "info" as const },
    created: { label: t("pages.adminDelivery.status.created"), variant: "info" as const },
    accepted: { label: t("pages.adminDelivery.status.accepted"), variant: "info" as const },
    in_transit: { label: t("pages.adminDelivery.status.in_transit"), variant: "info" as const },
    at_pickup: { label: t("pages.adminDelivery.status.at_pickup"), variant: "warning" as const },
    delivered: { label: t("pages.adminDelivery.status.delivered"), variant: "success" as const },
    cancelled: { label: t("pages.adminDelivery.status.cancelled"), variant: "default" as const },
    error: { label: t("pages.adminDelivery.status.error"), variant: "danger" as const },
  }), [t]);
  const providerLabels = useMemo(() => ({
    cdek: t("pages.adminDelivery.providers.cdek"),
    yandex: t("pages.adminDelivery.providers.yandex"),
  }), [t]);
  const [stats, setStats] = useState<AdminDeliveryStats | null>(null);
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [rows, setRows] = useState<AdminShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminShipmentRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminDeliveryStats()
      .then((d) => active && setStats(d))
      .catch(() => active && toast.error(t("pages.adminDelivery.loadStatsFailed")));
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminShipments({ status, provider })
      .then((list) => active && setRows(list))
      .catch(() => active && toast.error(t("pages.adminDelivery.loadShipmentsFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [status, provider, t]);

  const openRow = (row: AdminShipmentRow) => {
    setSelected(row);
    setNoteDraft(row.adminNote ?? "");
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      const updated = await updateAdminShipment(selected.uuid, { admin_note: noteDraft.trim() || null });
      setRows((list) => list.map((r) => (r.uuid === updated.uuid ? updated : r)));
      setSelected(updated);
      toast.success(t("pages.adminDelivery.noteSaved"));
    } catch {
      toast.error(t("pages.adminDelivery.noteSaveFailed"));
    } finally {
      setSavingNote(false);
    }
  };

  const statCards = useMemo(() => [
    { v: String(stats?.shipmentsTotal ?? 0), l: t("pages.adminDelivery.statShipments"), icon: Truck },
    {
      v: `${Math.round((stats?.deliveryRevenueCents ?? 0) / 100).toLocaleString("ru")} ₽`,
      l: t("pages.adminDelivery.statRevenue"),
      icon: DollarSign,
    },
    { v: String(stats?.errorsLast7d ?? 0), l: t("pages.adminDelivery.statErrors"), icon: AlertCircle, warn: (stats?.errorsLast7d ?? 0) > 0 },
    {
      v: stats?.avgDeliveryDays != null ? `${stats.avgDeliveryDays} ${t("pages.adminDelivery.daysShort")}` : "—",
      l: t("pages.adminDelivery.statAvgDays"),
      icon: BarChart3,
    },
  ], [stats, t]);

  const tableHeaders = useMemo(() => [
    t("pages.adminDelivery.colListing"),
    t("pages.adminDelivery.colProvider"),
    t("pages.adminDelivery.colStatus"),
    t("pages.adminDelivery.colTrack"),
    t("pages.adminDelivery.colCost"),
    t("pages.adminDelivery.colCreated"),
    "",
  ], [t]);

  return (
    <div>
      <H>{t("pages.adminDelivery.title")}</H>

      <DeliveryMethodsAdminCard cardStyle={card} />

      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: "12px", marginBottom: "20px" }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ ...card, padding: "16px" }}>
            <div
              style={{
                width: "36px", height: "36px", borderRadius: "var(--r-pill)",
                background: s.warn ? "var(--warning-soft)" : "var(--accent-soft)",
                display: "grid", placeItems: "center", marginBottom: "12px",
              }}
            >
              <s.icon size={18} style={{ color: s.warn ? "var(--warning)" : "var(--accent)" }} />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "24px", color: "var(--foreground)" }}>{s.v}</div>
            <div style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "4px" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {stats && Object.keys(stats.shipmentsByProvider).length > 0 && (
        <div style={{ ...card, padding: "16px", marginBottom: "16px", fontSize: "13px", color: "var(--foreground-70)" }}>
          {t("pages.adminDelivery.byProviders")}{" "}
          {Object.entries(stats.shipmentsByProvider).map(([p, n]) => (
            <span key={p} style={{ marginRight: "12px" }}>
              <strong style={{ color: "var(--foreground)" }}>{providerLabels[p as keyof typeof providerLabels] ?? p}</strong>: {n}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("pages.adminCommon.allStatuses")}</option>
          {Object.entries(shipmentStatusMeta).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("pages.adminDelivery.allProviders")}</option>
          <option value="cdek">{providerLabels.cdek}</option>
          <option value="yandex">{providerLabels.yandex}</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "860px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {tableHeaders.map((h) => (
                  <th key={h || "actions"} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)" }}>
                    <Truck size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
                    {t("pages.adminDelivery.empty")}
                  </td>
                </tr>
              ) : rows.map((row) => {
                const meta = shipmentStatusMeta[row.status] ?? { label: row.status, variant: "default" as const };
                return (
                  <tr key={row.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500, maxWidth: "220px" }}>{row.listingTitle}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{providerLabels[row.provider as keyof typeof providerLabels] ?? row.provider}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                      {row.trackingNumber ?? row.externalId ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>
                      {row.deliveryCostCents != null ? `${Math.round(row.deliveryCostCents / 100).toLocaleString("ru")} ₽` : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-50)", fontSize: "12px" }}>
                      {row.createdAt ? new Date(row.createdAt).toLocaleString("ru-RU") : "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <button type="button" onClick={() => openRow(row)} style={{ ...primaryBtn, height: "32px", fontSize: "12px" }}>
                        {t("pages.adminDelivery.details")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          style={{
            ...card,
            marginTop: "16px",
            padding: "20px",
            borderColor: "var(--accent)",
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--foreground)" }}>{selected.listingTitle}</h3>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--foreground-50)" }}>UUID: {selected.uuid}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} style={{ ...inputStyle, height: "32px", padding: "0 12px" }}>{t("pages.adminCommon.close")}</button>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: "12px", marginTop: "16px", fontSize: "13px" }}>
            <div><span style={{ color: "var(--foreground-50)" }}>{t("pages.adminDelivery.detailProvider")}</span> {providerLabels[selected.provider as keyof typeof providerLabels] ?? selected.provider}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>{t("pages.adminDelivery.detailStatus")}</span> {shipmentStatusMeta[selected.status]?.label ?? selected.status}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>{t("pages.adminDelivery.detailTrack")}</span> {selected.trackingNumber ?? "—"}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>{t("pages.adminDelivery.detailExternalId")}</span> {selected.externalId ?? "—"}</div>
          </div>

          {selected.errorMessage && (
            <div style={{ marginTop: "12px", padding: "12px", borderRadius: "var(--r-card-sm)", background: "var(--danger-soft)", color: "var(--danger)", fontSize: "13px" }}>
              {selected.errorMessage}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "6px" }}>
              {t("pages.adminDelivery.adminNote")}
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="w-full outline-none resize-y"
              style={{
                ...inputStyle,
                height: "auto",
                minHeight: "80px",
                padding: "10px 14px",
              }}
              placeholder={t("pages.adminDelivery.adminNotePlaceholder")}
            />
            <button type="button" disabled={savingNote} onClick={() => void saveNote()} style={{ ...primaryBtn, marginTop: "8px" }}>
              {savingNote ? t("pages.adminDelivery.savingNote") : t("pages.adminDelivery.saveNote")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ FEEDBACK (Книга жалоб) ============ */
const FEEDBACK_FILTER_IDS = ["all", "new", "read", "resolved"] as const;
const FEEDBACK_STATUS_IDS: FeedbackStatus[] = ["new", "read", "resolved"];

function FeedbackSection() {
  const { t } = useTranslation();
  const feedbackFilters = useMemo(
    () => FEEDBACK_FILTER_IDS.map((id) => ({ id, label: t(`pages.adminFeedback.filters.${id}`) })),
    [t],
  );
  const feedbackStatusMeta = useMemo(
    () =>
      Object.fromEntries(
        FEEDBACK_STATUS_IDS.map((id) => [
          id,
          {
            label: t(`pages.adminFeedback.status.${id}`),
            bg:
              id === "new"
                ? "var(--accent-soft)"
                : id === "read"
                  ? "var(--background-subtle)"
                  : "color-mix(in oklab, var(--success) 18%, transparent)",
            color: id === "new" ? "var(--accent)" : id === "read" ? "var(--foreground-70)" : "var(--success)",
          },
        ]),
      ) as Record<FeedbackStatus, { label: string; bg: string; color: string }>,
    [t],
  );
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminFeedback(filter === "all" ? undefined : filter)
      .then((rows) => active && setItems(rows))
      .catch(() => active && toast.error(t("pages.adminFeedback.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filter]);

  const setStatus = async (row: FeedbackRow, status: FeedbackStatus) => {
    const prev = row.status;
    setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status } : x)));
    try {
      await updateAdminFeedbackStatus(row.id, status);
    } catch {
      setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      toast.error(t("pages.adminFeedback.statusFailed"));
    }
  };

  return (
    <div>
      <H>{t("pages.adminFeedback.title")}</H>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {feedbackFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              height: "32px",
              padding: "0 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "var(--r-button)",
              border: "1px solid var(--border)",
              background: filter === f.id ? "var(--accent)" : "transparent",
              color: filter === f.id ? "var(--accent-foreground)" : "var(--foreground-70)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
          {t("pages.adminCommon.loading")}
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
          <Inbox size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
          {t("pages.adminFeedback.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((row) => {
            const meta = feedbackStatusMeta[row.status];
            return (
              <div key={row.id} style={{ ...card, padding: "16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-[8px]">
                  <div className="flex items-center gap-[8px]">
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>
                      {row.subject || t("pages.adminFeedback.noSubject")}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "var(--r-tag)", background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString("ru-RU") : ""}
                  </span>
                </div>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-80)", whiteSpace: "pre-wrap" }}>
                  {row.message}
                </p>
                <div className="flex items-center justify-between flex-wrap gap-[8px]" style={{ marginTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
                    {row.author}{row.page ? ` · ${row.page}` : ""}
                  </span>
                  <div className="flex gap-[8px]">
                    {row.status !== "read" && (
                      <button onClick={() => setStatus(row, "read")} style={feedbackBtn("transparent", "var(--foreground-70)")}>
                        {t("pages.adminFeedback.markRead")}
                      </button>
                    )}
                    {row.status !== "resolved" && (
                      <button onClick={() => setStatus(row, "resolved")} style={feedbackBtn("var(--success)", "#fff")}>
                        {t("pages.adminFeedback.markResolved")}
                      </button>
                    )}
                    {row.status !== "new" && (
                      <button onClick={() => setStatus(row, "new")} style={feedbackBtn("transparent", "var(--foreground-70)")}>
                        {t("pages.adminFeedback.backToNew")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function feedbackBtn(bg: string, color: string): React.CSSProperties {
  return {
    height: "32px",
    padding: "0 14px",
    background: bg,
    color,
    fontWeight: 600,
    fontSize: "12px",
    borderRadius: "var(--r-button)",
    border: bg === "transparent" ? "1px solid var(--border)" : "none",
  };
}

/* ============ MONETIZATION ============ */
function MonetizationSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [defaultPlacementRub, setDefaultPlacementRub] = useState(30);
  const [registeredPlacementRub, setRegisteredPlacementRub] = useState(20);
  const [guestPlacementRub, setGuestPlacementRub] = useState(30);
  const [subscriberPlacementRub, setSubscriberPlacementRub] = useState(20);
  const [savingPlacement, setSavingPlacement] = useState(false);

  const reloadPromos = () => fetchAdminPromocodes().then(setPromos).catch(() => {});

  useEffect(() => {
    let active = true;
    fetchAdminPlansDetailed().then((p) => active && setPlans(p)).catch(() => {});
    fetchAdminPromocodes().then((p) => active && setPromos(p)).catch(() => {});
    fetchAdminSettings().then((s) => {
      if (!active) return;
      const readCents = (key: string, fallback: number) => {
        const row = s.find((x) => x.key === key);
        const cents = (row?.value as { cents?: number | null } | undefined)?.cents;
        return typeof cents === "number" ? Math.round(cents / 100) : fallback;
      };
      setDefaultPlacementRub(readCents("listing.placement.default_price_cents", 30));
      setRegisteredPlacementRub(readCents("listing.placement.registered_price_cents", 20));
      setGuestPlacementRub(readCents("listing.placement.guest_price_cents", 30));
      const subRow = s.find((x) => x.key === "listing.placement.subscriber_default_price_cents");
      const subCents = (subRow?.value as { cents?: number | null } | undefined)?.cents;
      setSubscriberPlacementRub(typeof subCents === "number" ? Math.round(subCents / 100) : 20);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const savePlans = async () => {
    try {
      await Promise.all(
        plans.map((plan) =>
          updateAdminPlan(plan.slug, {
            name: plan.name,
            price_cents: plan.priceCents,
            period_days: plan.periodDays,
            free_listings_per_month: plan.freeListingsPerMonth,
            listing_discount_percent: plan.listingDiscountPercent,
            is_active: plan.isActive,
          }),
        ),
      );
      toast.success(t("pages.adminMonetization.plansSaved"));
    } catch {
      toast.error(t("pages.adminMonetization.plansSaveFailed"));
    }
  };

  const savePlacementPricing = async () => {
    setSavingPlacement(true);
    try {
      await updateAdminSettings([
        {
          key: "listing.placement.registered_price_cents",
          value: { cents: Math.max(0, Math.round(registeredPlacementRub * 100)) },
          group: "billing",
        },
        {
          key: "listing.placement.guest_price_cents",
          value: { cents: Math.max(0, Math.round(guestPlacementRub * 100)) },
          group: "billing",
        },
        {
          key: "listing.placement.subscriber_default_price_cents",
          value: {
            cents: Math.max(0, Math.round(subscriberPlacementRub * 100)),
          },
          group: "billing",
        },
        {
          key: "listing.placement.default_price_cents",
          value: { cents: Math.max(0, Math.round(registeredPlacementRub * 100)) },
          group: "billing",
        },
      ]);
      toast.success(t("pages.adminMonetization.placementPriceSaved"));
      setDefaultPlacementRub(registeredPlacementRub);
    } catch {
      toast.error(t("pages.adminMonetization.placementPriceSaveFailed"));
    } finally {
      setSavingPlacement(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminMonetization.title")}</H>

      <FirstHundredAdminCard cardStyle={card} />

      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("pages.adminMonetization.placementTitle")}</h4>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "6px" }}>
          {t("pages.adminMonetization.placementHint")}
        </p>
        <div className="flex flex-wrap items-end gap-[10px]" style={{ marginTop: "12px" }}>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.registeredPriceLabel")}</span>
            <input type="number" min={0} value={registeredPlacementRub} onChange={(e) => setRegisteredPlacementRub(+e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.guestPriceLabel")}</span>
            <input type="number" min={0} value={guestPlacementRub} onChange={(e) => setGuestPlacementRub(+e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.subscriberPriceLabel")}</span>
            <input
              type="number"
              min={0}
              value={subscriberPlacementRub}
              onChange={(e) => setSubscriberPlacementRub(Math.max(0, +e.target.value))}
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
          <button onClick={savePlacementPricing} disabled={savingPlacement} style={primaryBtn}>{savingPlacement ? "…" : t("pages.adminCommon.save")}</button>
        </div>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "10px" }}>
          {t("pages.adminMonetization.placementLegacyNote", { price: registeredPlacementRub })}
        </p>
      </div>

      {/* Tariffs */}
      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("pages.adminMonetization.tariffsTitle")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4" style={{ gap: "12px", marginTop: "12px" }}>
          {plans.map((plan, i) => (
            <div key={plan.slug} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-card-sm)", padding: "12px" }}>
              <input
                value={plan.name}
                onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="w-full outline-none"
                style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)", background: "transparent", border: "none", padding: 0 }}
              />
              <input
                type="number"
                value={Math.round(plan.priceCents / 100)}
                onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, priceCents: Math.max(0, +e.target.value) * 100 } : x))}
                className="w-full outline-none"
                style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)", background: "transparent", border: "none", padding: "4px 0", fontFamily: "var(--font-display)" }}
              />
              <label className="flex items-center gap-2" style={{ marginTop: "8px", fontSize: "12px", color: "var(--foreground-70)" }}>
                <input
                  type="checkbox"
                  checked={plan.isActive}
                  onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, isActive: e.target.checked } : x))}
                  style={{ accentColor: "var(--accent)" }}
                />
                {t("pages.adminMonetization.planActiveLabel")}
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.periodDaysLabel")}</span>
                <input type="number" min={1} value={plan.periodDays} onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, periodDays: Math.max(1, +e.target.value) } : x))} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.freeListingsLabel")}</span>
                <input type="number" min={0} value={plan.freeListingsPerMonth} onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, freeListingsPerMonth: +e.target.value } : x))} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: "4px", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminMonetization.discountLabel")}</span>
                <input type="number" min={0} max={100} value={plan.listingDiscountPercent} onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, listingDiscountPercent: +e.target.value } : x))} style={inputStyle} />
              </label>
            </div>
          ))}
        </div>
        <button onClick={savePlans} style={{ ...primaryBtn, marginTop: "12px" }}>{t("pages.adminMonetization.savePlans")}</button>
      </div>

      {/* Promocodes */}
      <PromoCodesBlock promos={promos} setPromos={setPromos} reload={reloadPromos} />

      <ReferralProgramAdminCard cardStyle={card} />

      <AdminPaymentsAdminCard cardStyle={card} />

      <AdminBillingOpsCard cardStyle={card} />
    </div>
  );
}

function FeedBannersSection() {
  const { t } = useTranslation();
  return (
    <div>
      <H>{t("pages.adminFeedBanners.title")}</H>
      <BannersAdminCard cardStyle={card} />
    </div>
  );
}

function LandingBlocksSection() {
  const { t } = useTranslation();
  return (
    <div>
      <H>{t("pages.adminLanding.title")}</H>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "16px" }}>
        {t("pages.adminLanding.subtitle")}
      </p>
      <LandingBlocksAdminCard cardStyle={card} />
      <FaqAdminCard cardStyle={card} />
    </div>
  );
}

function FeedGuestAccessSection() {
  return (
    <div>
      <FeedGuestAccessAdminCard />
    </div>
  );
}

/* ============ CATEGORIES ============ */
const CATEGORY_KIND_IDS: CategoryKind[] = ["post", "community", "listing", "video"];

// Простой транслит для генерации slug из кириллического названия.
function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  const s = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `cat-${Date.now()}`;
}

function CategoriesSection() {
  const { t } = useTranslation();
  const categoryKinds = useMemo(
    () => CATEGORY_KIND_IDS.map((id) => ({ id, label: t(`pages.adminCategories.kinds.${id}`) })),
    [t],
  );
  const [kind, setKind] = useState<CategoryKind>("post");
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const load = (k: CategoryKind) => {
    setLoading(true);
    fetchAdminCategories(k)
      .then(setItems)
      .catch(() => toast.error(t("pages.adminCategories.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(kind); }, [kind]);

  const roots = useMemo(
    () => (kind === "video" ? items : items.filter((c) => c.parentId === null)),
    [items, kind],
  );
  const childrenOf = (id: number) => items.filter((c) => c.parentId === id);
  const depthOf = (id: number) => {
    let depth = 0;
    let cur = items.find((x) => x.id === id);
    const seen = new Set<number>();
    while (cur?.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      depth += 1;
      cur = items.find((x) => x.id === cur!.parentId);
    }
    return depth;
  };

  const addRoot = async () => {
    const name = window.prompt(t("pages.adminCategories.promptName"))?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptSlug"), slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, { name, slug, sortOrder: roots.length });
      setItems((p) => [...p, created]);
      toast.success(t("pages.adminCategories.added"));
    } catch { toast.error(t("pages.adminCategories.addFailed")); }
  };

  const addSub = async (parent: AdminCategory) => {
    if (depthOf(parent.id) >= 2) {
      toast.error(t("pages.adminCategories.parentInvalid"));
      return;
    }
    const name = window.prompt(t("pages.adminCategories.promptSubName", { name: parent.name }))?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptSlug"), slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, {
        name, slug, parentId: parent.id, sortOrder: childrenOf(parent.id).length,
      });
      setItems((p) => [...p, created]);
      setOpen((p) => ({ ...p, [parent.id]: true }));
      toast.success(t("pages.adminCategories.subAdded"));
    } catch { toast.error(t("pages.adminCategories.subAddFailed")); }
  };

  const edit = async (c: AdminCategory) => {
    const name = window.prompt(t("pages.adminCategories.promptEditName"), c.name)?.trim();
    if (!name) return;
    const slug = window.prompt(t("pages.adminCategories.promptEditSlug"), c.slug)?.trim();
    if (!slug) return;
    const icon = window.prompt(t("pages.adminCategories.promptIcon"), c.icon ?? "") ?? c.icon;
    const sortRaw = window.prompt(t("pages.adminCategories.promptSort"), String(c.sortOrder));
    const sortOrder = sortRaw != null && sortRaw !== "" ? Number(sortRaw) : c.sortOrder;
    const parentRaw = window.prompt(
      t("pages.adminCategories.promptParent"),
      c.parentId != null ? String(c.parentId) : "",
    );
    let parentId = c.parentId;
    if (parentRaw !== null) {
      const trimmed = parentRaw.trim();
      parentId = trimmed === "" ? null : Number(trimmed);
      if (parentId != null && (!Number.isInteger(parentId) || parentId < 1 || parentId === c.id)) {
        toast.error(t("pages.adminCategories.parentInvalid"));
        return;
      }
    }
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name, slug, parentId, icon: icon || null, sortOrder, isActive: c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCommon.saved"));
    } catch { toast.error(t("pages.adminCategories.updateFailed")); }
  };

  const toggleActive = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: !c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCommon.saved"));
    } catch { toast.error(t("pages.adminCategories.updateFailed")); }
  };

  const patchCategoryPrices = async (c: AdminCategory) => {
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        listingPriceCents: c.listingPriceCents,
        subscriberListingPriceCents: c.subscriberListingPriceCents,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success(t("pages.adminCategories.pricesSaved"));
    } catch {
      toast.error(t("pages.adminCategories.pricesSaveFailed"));
    }
  };

  const listingPriceFields = (c: AdminCategory) => {
    if (kind !== "listing") return null;
    return (
      <div className="flex flex-wrap items-center gap-[6px] ml-[24px] mt-[4px] mb-[6px]">
        <label className="flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adminCategories.priceRegular")}
          <input
            type="number"
            min={0}
            placeholder="—"
            style={{ ...inputStyle, width: 72, height: 30, padding: "0 8px", fontSize: 12 }}
            value={c.listingPriceCents != null ? Math.round(c.listingPriceCents / 100) : ""}
            onChange={(e) => {
              const rub = e.target.value === "" ? null : Math.max(0, +e.target.value);
              setItems((p) => p.map((x) => x.id === c.id ? { ...x, listingPriceCents: rub == null ? null : rub * 100 } : x));
            }}
            onBlur={() => patchCategoryPrices(c)}
          />
        </label>
        <label className="flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adminCategories.priceSubscriber")}
          <input
            type="number"
            min={0}
            placeholder="—"
            style={{ ...inputStyle, width: 72, height: 30, padding: "0 8px", fontSize: 12 }}
            value={c.subscriberListingPriceCents != null ? Math.round(c.subscriberListingPriceCents / 100) : ""}
            onChange={(e) => {
              const rub = e.target.value === "" ? null : Math.max(0, +e.target.value);
              setItems((p) => p.map((x) => x.id === c.id ? { ...x, subscriberListingPriceCents: rub == null ? null : rub * 100 } : x));
            }}
            onBlur={() => patchCategoryPrices(c)}
          />
        </label>
      </div>
    );
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(t("pages.adminCategories.deleteConfirm", { name: c.name }))) return;
    try {
      await deleteAdminCategory(kind, c.id);
      const drop = new Set<number>([c.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const x of items) {
          if (x.parentId && drop.has(x.parentId) && !drop.has(x.id)) {
            drop.add(x.id);
            grew = true;
          }
        }
      }
      setItems((p) => p.filter((x) => !drop.has(x.id)));
      toast.success(t("pages.adminCommon.deleted"));
    } catch { toast.error(t("pages.adminCategories.deleteFailed")); }
  };

  return (
    <div>
      <H
        action={
          <button style={{ ...primaryBtn }} onClick={addRoot}>
            <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />{t("pages.adminCommon.add")}
          </button>
        }
      >
        {t("pages.adminCategories.title")}
      </H>

      {kind === "post" && (
        <p className="text-[13px]" style={{ color: "var(--foreground-50)", marginBottom: 12 }}>
          {t("pages.adminCategories.unifiedHint")}
        </p>
      )}

      <div className="flex gap-[6px]" style={{ marginBottom: "12px" }}>
        {categoryKinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: kind === k.id ? 600 : 500,
              borderRadius: "var(--r-pill)",
              border: `1px solid ${kind === k.id ? "var(--border-accent)" : "var(--border)"}`,
              background: kind === k.id ? "var(--accent-soft)" : "transparent",
              color: kind === k.id ? "var(--accent)" : "var(--foreground-70)",
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: "16px" }}>
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
        ) : roots.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCategories.empty")}</p>
        ) : kind === "video" ? (
          roots.map((c) => (
            <div key={c.id} className="flex items-center justify-between" style={{ padding: "8px 0" }}>
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c.name}</span>
              <div className="flex gap-[4px]">
                <IconBtn onClick={() => edit(c)}><Pencil size={14} /></IconBtn>
                <IconBtn danger onClick={() => remove(c)}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
          ))
        ) : (
          roots.map((c) => {
            const subs = childrenOf(c.id);
            return (
              <div key={c.id} style={{ marginBottom: "4px" }}>
                <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
                  <button onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="flex items-center gap-[8px] flex-1">
                    <motion.span animate={{ rotate: open[c.id] ? 90 : 0 }} style={{ display: "inline-block", color: "var(--foreground-50)", fontSize: "10px" }}>▶</motion.span>
                    <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c.name}</span>
                    {!c.isActive && <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminCategories.hidden")}</span>}
                    {subs.length > 0 && <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>({subs.length})</span>}
                  </button>
                  <div className="flex gap-[4px]">
                    <IconBtn onClick={() => addSub(c)}><Plus size={14} /></IconBtn>
                    <IconBtn onClick={() => void toggleActive(c)}>{c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                    <IconBtn onClick={() => edit(c)}><Pencil size={14} /></IconBtn>
                    <IconBtn danger onClick={() => remove(c)}><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
                {listingPriceFields(c)}
                <AnimatePresence>
                  {open[c.id] && subs.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden", borderLeft: "1px solid var(--border)", marginLeft: "8px", paddingLeft: "16px" }}
                    >
                      {subs.map((s) => {
                        const thirds = childrenOf(s.id);
                        return (
                        <div key={s.id}>
                          <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                            <span className="flex items-center gap-[8px]" style={{ fontSize: "14px", color: "var(--foreground-70)" }}>
                              {s.name}
                              {!s.isActive && <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{t("pages.adminCategories.hidden")}</span>}
                              {thirds.length > 0 && <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>({thirds.length})</span>}
                            </span>
                          <div className="flex gap-[4px]">
                              {depthOf(s.id) < 2 && <IconBtn onClick={() => addSub(s)}><Plus size={14} /></IconBtn>}
                              <IconBtn onClick={() => void toggleActive(s)}>{s.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                            <IconBtn onClick={() => edit(s)}><Pencil size={14} /></IconBtn>
                            <IconBtn danger onClick={() => remove(s)}><Trash2 size={14} /></IconBtn>
                          </div>
                          </div>
                          {listingPriceFields(s)}
                          {thirds.map((n) => (
                            <div key={n.id} style={{ borderLeft: "1px solid var(--border)", marginLeft: "8px", paddingLeft: "16px" }}>
                              <div className="flex items-center justify-between" style={{ padding: "4px 0" }}>
                                <span className="flex items-center gap-[8px]" style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
                                  {n.name}
                                  {!n.isActive && <span style={{ fontSize: "11px" }}>{t("pages.adminCategories.hidden")}</span>}
                                </span>
                                <div className="flex gap-[4px]">
                                  <IconBtn onClick={() => void toggleActive(n)}>{n.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                                  <IconBtn onClick={() => edit(n)}><Pencil size={14} /></IconBtn>
                                  <IconBtn danger onClick={() => remove(n)}><Trash2 size={14} /></IconBtn>
                                </div>
                              </div>
                              {listingPriceFields(n)}
                            </div>
                          ))}
                        </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============ NOTIFICATIONS ============ */
function NotificationsSection() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast.error(t("pages.adminNotifications.errTitle"));
    if (!window.confirm(t("pages.adminNotifications.confirmSend"))) return;
    setSending(true);
    try {
      const sent = await broadcastNotification({
        title: title.trim(),
        body: body.trim() || undefined,
        link: link.trim() || undefined,
      });
      toast.success(t("pages.adminNotifications.sent", { count: sent }));
      setTitle(""); setBody(""); setLink("");
    } catch {
      toast.error(t("pages.adminNotifications.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminNotifications.title")}</H>
      <div style={{ ...card, padding: "20px", maxWidth: "640px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminNotifications.broadcastTitle")}
        </h4>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminNotifications.broadcastHint")}
        </p>
        <div className="space-y-[12px]">
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>{t("pages.adminNotifications.fieldTitle")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={t("pages.adminNotifications.titlePlaceholder")} className="outline-none" style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>{t("pages.adminNotifications.fieldBody")}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} placeholder={t("pages.adminNotifications.bodyPlaceholder")} className="outline-none" style={{ ...inputStyle, width: "100%", height: "auto", padding: "10px 12px", marginTop: 4, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>{t("pages.adminNotifications.fieldLink")}</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={255} placeholder={t("pages.adminNotifications.linkPlaceholder")} className="outline-none" style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
        </div>
        <button
          onClick={send}
          disabled={sending}
          className="inline-flex items-center gap-[8px]"
          style={{ ...primaryBtn, height: "44px", padding: "0 24px", fontSize: "14px", marginTop: "16px", opacity: sending ? 0.7 : 1 }}
        >
          <Send size={15} /> {sending ? t("pages.adminNotifications.sending") : t("pages.adminNotifications.sendAll")}
        </button>
      </div>
    </div>
  );
}

/* ============ ANALYTICS ============ */
function AnalyticsSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((d) => active && setData(d))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const chartKeys = ["dauMau", "revenue", "listings", "topCategories", "subscription", "geo"] as const;
  const kpiStats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statUsers") },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: t("pages.adminDashboard.statPosts") },
    { v: String(data?.moderationPending ?? 0), l: t("pages.adminDashboard.statModeration") },
    { v: String(data?.reportsPending ?? 0), l: t("pages.adminDashboard.statReports") },
    { v: (data?.plansActive ?? 0).toLocaleString("ru"), l: t("pages.adminAnalytics.statPlans") },
    { v: (data?.promocodesActive ?? 0).toLocaleString("ru"), l: t("pages.adminAnalytics.statPromocodes") },
  ];

  return (
    <div>
      <H>{t("pages.adminAnalytics.title")}</H>
      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        style={{ gap: "12px", marginBottom: "20px" }}
      >
        {kpiStats.map((s, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} style={{ ...card, padding: "14px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px", color: "var(--foreground)" }}>{s.v}</div>
            <div style={{ fontSize: "11px", color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "0.4px", marginTop: "4px" }}>{s.l}</div>
          </motion.div>
        ))}
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
        {chartKeys.map((key, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            style={{ ...card, padding: "20px" }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{t(`pages.adminAnalytics.charts.${key}`)}</div>
            <div style={{ height: "180px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <BarChart3 size={32} style={{ color: "var(--foreground-15)" }} />
              <div style={{ fontSize: "13px", color: "var(--foreground-30)", textAlign: "center", maxWidth: "240px" }}>
                {t("pages.adminAnalytics.chartPlaceholder")}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============ REVIEWS (videos) ============ */
function ReviewsSection({ initialSubTab = "list" }: { initialSubTab?: "list" | "categories" }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<"list" | "categories">(initialSubTab);
  const statusMetaMap = useMemo(() => ({
    published: { label: t("pages.adminReviews.statusPublishedBadge"), variant: "success" as BadgeVariant },
    processing: { label: t("pages.adminReviews.statusProcessingBadge"), variant: "warning" as BadgeVariant },
    rejected: { label: t("pages.adminReviews.statusRejectedBadge"), variant: "danger" as BadgeVariant },
    scheduled: { label: t("pages.adminReviews.statusScheduledBadge"), variant: "info" as BadgeVariant },
  }), [t]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AdminVideoRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminVideos({ status: status === "all" ? undefined : status, q: query.trim() || undefined })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminReviews.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, query, t]);

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    setSelected(new Set());
  }, [status, query]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.uuid));
  const someSelected = rows.some((r) => selected.has(r.uuid));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleOne = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.uuid));
      else rows.forEach((r) => next.add(r.uuid));
      return next;
    });
  };

  const bulkBtnStyle: CSSProperties = {
    ...inputStyle,
    height: "34px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: bulkBusy ? "not-allowed" : "pointer",
    opacity: bulkBusy ? 0.6 : 1,
  };

  const bulkChangeStatus = async (next: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkUpdateAdminVideoStatus(ids, next);
      if (ok > 0) {
        setRows((prev) => prev.map((r) => (selected.has(r.uuid) ? { ...r, status: next } : r)));
      }
      setSelected(new Set());
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkStatusSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkApprove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkApproveAdminVideos(ids);
      setSelected(new Set());
      if (ok > 0) load();
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkApproveSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkDeleteAdminVideos(ids);
      if (ok > 0) {
        setRows((prev) => prev.filter((r) => !selected.has(r.uuid)));
        setSelected(new Set());
      }
      setDeleteConfirmOpen(false);
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkDeleteSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const tableHeaders = [
    t("pages.adminReviews.colTitle"),
    t("pages.adminReviews.colAuthor"),
    t("pages.adminReviews.colCategory"),
    t("pages.adminReviews.colDuration"),
    t("pages.adminReviews.colEngagement"),
    t("pages.adminReviews.colPublished"),
    t("pages.adminReviews.colStatus"),
    t("pages.adminReviews.colViews"),
    t("pages.adminReviews.colActions"),
  ];

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—");

  const approve = async (uuid: string) => {
    try {
      await approveModeration("videos", uuid);
      toast.success(t("pages.adminReviews.approved"));
      load();
    } catch {
      toast.error(t("pages.adminReviews.approveFailed"));
    }
  };

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminVideo(uuid, { status: next });
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminReviews.statusUpdated"));
    } catch {
      toast.error(t("pages.adminReviews.statusUpdateFailed"));
    }
  };

  const toggleFeatured = async (uuid: string, on: boolean) => {
    setRows((prev) => prev.map((v) => (v.uuid === uuid ? { ...v, isFeatured: on } : v)));
    try {
      await updateAdminVideo(uuid, { isFeatured: on });
    } catch {
      toast.error(t("pages.adminReviews.updateFailed"));
      load();
    }
  };

  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminReviews.deleteConfirm"))) return;
    try {
      await deleteAdminVideo(uuid);
      setRows((prev) => prev.filter((v) => v.uuid !== uuid));
      toast.success(t("pages.adminReviews.deleted"));
    } catch {
      toast.error(t("pages.adminReviews.deleteFailed"));
      load();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {(["list", "categories"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            style={{
              height: "34px",
              padding: "0 14px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--r-button)",
              border: "1px solid var(--border)",
              background: subTab === id ? "var(--accent)" : "transparent",
              color: subTab === id ? "var(--accent-foreground)" : "var(--foreground-70)",
            }}
          >
            {id === "list" ? t("pages.adminReviews.subTabList") : t("pages.adminReviews.subTabCategories")}
          </button>
        ))}
      </div>
      {subTab === "categories" ? (
        <ReviewCategoriesAdminSection />
      ) : (
        <>
      <H action={<Link to="/reviews/upload" className="text-[13px]" style={{ color: "var(--accent)" }}>{t("pages.adminReviews.uploadLink")}</Link>}>{t("pages.adminReviews.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          placeholder={t("pages.adminReviews.searchPlaceholder")}
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("pages.adminReviews.allStatuses")}</option>
          <option value="published">{t("pages.adminReviews.statusPublished")}</option>
          <option value="processing">{t("pages.adminReviews.statusProcessing")}</option>
          <option value="scheduled">{t("pages.adminReviews.statusScheduled")}</option>
          <option value="rejected">{t("pages.adminReviews.statusRejected")}</option>
        </select>
        <button type="button" onClick={load} style={{ ...inputStyle, padding: "0 14px" }}>{t("pages.adminReviews.refresh")}</button>
      </div>

      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center"
          style={{
            ...card,
            marginTop: "16px",
            padding: "12px 16px",
            gap: "10px",
            borderColor: "color-mix(in oklab, var(--accent) 35%, var(--border))",
            background: "color-mix(in oklab, var(--accent) 6%, var(--background-elevated))",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("pages.adminReviews.selectedCount", { count: selected.size })}
          </span>
          <button type="button" disabled={bulkBusy} style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px" }} onClick={() => void bulkApprove()}>
            <Check size={13} /> {t("pages.adminReviews.bulkApprove")}
          </button>
          <button type="button" disabled={bulkBusy} style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px" }} onClick={() => void bulkChangeStatus("published")}>
            <Check size={13} /> {t("pages.adminReviews.bulkPublish")}
          </button>
          <button type="button" disabled={bulkBusy} style={bulkBtnStyle} onClick={() => void bulkChangeStatus("rejected")}>
            {t("pages.adminReviews.bulkReject")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--error)" }}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 size={13} /> {t("pages.adminReviews.bulkDelete")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, marginLeft: "auto", color: "var(--foreground-50)" }}
            onClick={() => setSelected(new Set())}
          >
            {t("pages.adminReviews.bulkClear")}
          </button>
        </div>
      )}

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "1020px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                <th style={{ padding: "10px 12px", width: "44px" }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={t("pages.adminReviews.selectAll")}
                    style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                  />
                </th>
                {tableHeaders.map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminReviews.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: "16px", color: "var(--foreground-50)" }}>{t("pages.adminReviews.empty")}</td></tr>
              ) : rows.map((v) => {
                const meta = statusMeta(statusMetaMap, v.status);
                const isSelected = selected.has(v.uuid);
                return (
                  <tr
                    key={v.uuid}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: isSelected ? "color-mix(in oklab, var(--accent) 5%, transparent)" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(v.uuid)}
                        aria-label={t("pages.adminReviews.selectRow", { title: v.title })}
                        style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>
                      <div className="truncate max-w-[280px]">{v.title}</div>
                      {v.scheduledAt && (
                        <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          {t("pages.adminReviews.scheduledAt", { date: new Date(v.scheduledAt).toLocaleString() })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{v.author}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{v.category}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)", fontFamily: "var(--font-mono, monospace)" }}>{formatDuration(v.durationSeconds)}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)", whiteSpace: "nowrap" }}>
                      {t("pages.adminReviews.engagementSummary", { likes: v.likesCount, comments: v.commentsCount })}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)", whiteSpace: "nowrap" }}>{formatDate(v.publishedAt)}</td>
                    <td style={{ padding: "10px 16px" }}><StatusBadge variant={meta.variant}>{meta.label}</StatusBadge></td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{v.views.toLocaleString()}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div className="flex flex-wrap items-center gap-[6px]">
                        {v.status === "processing" && (
                          <IconBtn success onClick={() => approve(v.uuid)} title={t("pages.adminReviews.approve")}><Check size={14} /></IconBtn>
                        )}
                        <IconBtn onClick={() => setPreview(v)} title={t("pages.adminReviews.preview")}><Eye size={14} /></IconBtn>
                        <Link
                          to="/reviews/upload"
                          search={{ edit: v.uuid }}
                          title={t("pages.adminReviews.edit")}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "var(--r-card-sm)",
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "var(--foreground-70)",
                            display: "grid",
                            placeItems: "center",
                            textDecoration: "none",
                          }}
                        >
                          <Pencil size={14} />
                        </Link>
                        <Link to="/reviews/$id" params={{ id: v.uuid }} className="text-[12px]" style={{ color: "var(--accent)" }}>{t("pages.adminReviews.onSite")}</Link>
                        <label className="flex items-center gap-[4px] text-[11px]" style={{ color: "var(--foreground-70)" }}>
                          <input type="checkbox" checked={v.isFeatured} onChange={(e) => toggleFeatured(v.uuid, e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                          {t("pages.adminReviews.promo")}
                        </label>
                        <IconBtn danger onClick={() => remove(v.uuid)} title={t("pages.adminReviews.delete")}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {preview && (
        <div role="dialog" aria-modal="true" aria-label={t("pages.adminReviews.previewDialog")} onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto", padding: "20px" }}>
            <div className="flex items-start justify-between gap-[12px]">
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--foreground)" }}>{preview.title}</h3>
                <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--foreground-50)" }}>{preview.author} · {preview.category}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} style={{ ...inputStyle, height: "32px", padding: "0 12px" }}>{t("pages.adminReviews.close")}</button>
            </div>
            {preview.videoUrl ? (
              <video src={preview.videoUrl} controls preload="metadata" playsInline poster={preview.posterUrl} style={{ marginTop: "16px", width: "100%", maxHeight: 420, borderRadius: 10, background: "#000" }} />
            ) : preview.posterUrl ? (
              <img src={preview.posterUrl} alt={preview.title} style={{ marginTop: "16px", width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 10, background: "var(--background-surface)" }} />
            ) : (
              <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminReviews.videoUnavailable")}</p>
            )}
            <div style={{ marginTop: "16px", padding: "12px", borderRadius: 10, background: "var(--background-surface)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)", marginBottom: "8px" }}>{t("pages.adminReviews.mediaCheckTitle")}</div>
              <div className="flex flex-wrap gap-[8px] text-[12px]">
                <span style={{ color: preview.videoUrl ? "var(--success)" : "var(--error)" }}>
                  {preview.videoUrl ? t("pages.adminReviews.mediaVideoOk") : t("pages.adminReviews.mediaVideoMissing")}
                </span>
                <span style={{ color: preview.posterUrl ? "var(--success)" : "var(--warning)" }}>
                  {preview.posterUrl ? t("pages.adminReviews.mediaPosterOk") : t("pages.adminReviews.mediaPosterMissing")}
                </span>
                <span style={{ color: "var(--foreground-50)" }}>
                  {t("pages.adminReviews.previewStats", {
                    views: preview.views.toLocaleString(),
                    duration: formatDuration(preview.durationSeconds),
                    likes: preview.likesCount,
                    comments: preview.commentsCount,
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-[8px]" style={{ marginTop: "20px" }}>
              {preview.status === "processing" && (
                <button type="button" style={primaryBtn} onClick={() => { void approve(preview.uuid); setPreview(null); }}>{t("pages.adminReviews.approveAndPublish")}</button>
              )}
              {preview.status !== "published" && preview.status !== "processing" && (
                <button type="button" style={primaryBtn} onClick={() => { void changeStatus(preview.uuid, "published"); setPreview(null); }}>{t("pages.adminReviews.publish")}</button>
              )}
              {preview.status === "published" && (
                <button type="button" style={inputStyle} onClick={() => { void changeStatus(preview.uuid, "rejected"); setPreview(null); }}>{t("pages.adminReviews.hideReview")}</button>
              )}
              <Link to="/reviews/upload" search={{ edit: preview.uuid }} className="inline-flex items-center" style={{ ...inputStyle, height: "36px", padding: "0 14px", textDecoration: "none", color: "var(--foreground)" }}>
                {t("pages.adminReviews.edit")}
              </Link>
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.adminReviews.bulkDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pages.adminReviews.bulkDeleteDesc", { count: selected.size })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>{t("pages.adminReviews.close")}</AlertDialogCancel>
            <AlertDialogAction disabled={bulkBusy} onClick={() => void bulkRemove()} style={{ background: "var(--error)" }}>
              {t("pages.adminReviews.bulkDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </div>
  );
}

/* ============ SETTINGS ============ */

/* Human-readable metadata for system settings. The admin NEVER sees or edits
   raw JSON — every known key gets a labeled toggle/input; unknown keys fall
   back by value shape (boolean → тумблер, string/number → инпут, plain
   object → labeled per-field inputs). */
function useSettingMeta() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      ({
        "feature.reviews_enabled": {
          label: t("pages.adminSettings.settingMeta.feature_reviews_enabled.label"),
          hint: t("pages.adminSettings.settingMeta.feature_reviews_enabled.hint"),
          hidden: true,
        },
        "feature.market_enabled": {
          label: t("pages.adminSettings.settingMeta.feature_market_enabled.label"),
          hidden: true,
        },
        "feature.escrow_enabled": {
          label: t("pages.adminSettings.settingMeta.feature_escrow_enabled.label"),
          hidden: true,
        },
        "feature.feed_auto_publish": {
          label: t("pages.adminSettings.settingMeta.feature_feed_auto_publish.label"),
          hidden: true,
        },
        "feature.listing_payment_enabled": {
          label: t("pages.adminSettings.settingMeta.feature_listing_payment_enabled.label"),
          hidden: true,
        },
        icon_overrides: { label: t("pages.adminSettings.settingMeta.icon_overrides.label"), hidden: true },
        "footer.contacts": { label: t("pages.adminSettings.settingMeta.footer_contacts.label"), hidden: true },
        site_name: {
          label: t("pages.adminSettings.settingMeta.site_name.label"),
          fieldLabels: {
            ru: t("pages.adminSettings.settingMeta.site_name.fields.ru"),
            en: t("pages.adminSettings.settingMeta.site_name.fields.en"),
          },
        },
        first_hundred_stats: {
          label: t("pages.adminSettings.settingMeta.first_hundred_stats.label"),
          hidden: true,
          fieldLabels: {
            taken: t("pages.adminSettings.settingMeta.first_hundred_stats.fields.taken"),
            total: t("pages.adminSettings.settingMeta.first_hundred_stats.fields.total"),
          },
        },
        moderation_auto_publish: {
          label: t("pages.adminSettings.settingMeta.moderation_auto_publish.label"),
          hint: t("pages.adminSettings.settingMeta.moderation_auto_publish.hint"),
        },
      }) satisfies Record<string, { label: string; hint?: string; hidden?: boolean; fieldLabels?: Record<string, string> }>,
    [t],
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** {enabled: boolean} (possibly the only key) → treat as a single toggle. */
function isEnabledShape(v: unknown): v is { enabled: boolean } {
  return isPlainObject(v) && Object.keys(v).length === 1 && typeof v.enabled === "boolean";
}

function readEnabledSetting(settings: AdminSetting[], key: string, fallback = false): boolean {
  const row = settings.find((s) => s.key === key);
  return isEnabledShape(row?.value) ? row.value.enabled : fallback;
}

function mergeAdminSettings(prev: AdminSetting[], updated: AdminSetting[]): AdminSetting[] {
  if (updated.length === 0) return prev;
  const byKey = new Map(prev.map((s) => [s.key, s]));
  for (const row of updated) byKey.set(row.key, row);
  return Array.from(byKey.values());
}

function draftsFromSettings(rows: AdminSetting[]): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const s of rows) d[s.key] = structuredClone(s.value);
  return d;
}

/** Saved immediately by dedicated cards — must not be overwritten by the bulk «Сохранить» drafts. */
const CARD_MANAGED_SETTING_KEYS = new Set([
  "feature.communities_enabled",
  "feature.reviews_enabled",
  "feature.market_enabled",
  "feature.escrow_enabled",
  "feature.feed_auto_publish",
  "feature.listing_payment_enabled",
  "first_hundred_stats",
]);

function SettingsSection() {
  const { t } = useTranslation();
  const SETTING_META = useSettingMeta();
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminSettings()
      .then(async (rows) => {
        setSettings(rows);
        setDrafts(draftsFromSettings(rows));
        await loadFeatureFlagsFromServer();
      })
      .catch(() => toast.error(t("pages.adminSettings.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const setDraft = (key: string, value: unknown) => setDrafts((p) => ({ ...p, [key]: value }));

  const setDraftField = (key: string, field: string, value: unknown) =>
    setDrafts((p) => {
      const cur = isPlainObject(p[key]) ? { ...(p[key] as Record<string, unknown>) } : {};
      cur[field] = value;
      return { ...p, [key]: cur };
    });

  const save = async () => {
    const next: AdminSetting[] = settings
      .filter((s) => !CARD_MANAGED_SETTING_KEYS.has(s.key))
      .map((s) => ({
        key: s.key,
        value: drafts[s.key] ?? s.value,
        group: s.group,
      }));
    setSaving(true);
    try {
      if (next.length > 0) {
        await updateAdminSettings(next);
      }
      const rows = await fetchAdminSettings();
      setSettings(rows);
      setDrafts(draftsFromSettings(rows));
      await loadFeatureFlagsFromServer();
      toast.success(t("pages.adminSettings.saved"));
    } catch {
      toast.error(t("pages.adminSettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const s of settings) {
      if (SETTING_META[s.key]?.hidden) continue;
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return Array.from(map.entries()).filter(([, rows]) => rows.length > 0);
  }, [settings, SETTING_META]);

  const inputStyle: CSSProperties = {
    height: "40px",
    background: "var(--background)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-input)",
    padding: "0 14px",
    fontSize: "13px",
    color: "var(--foreground)",
  };

  /** One field inside an object-valued setting (string/number/boolean). */
  const renderField = (key: string, field: string, value: unknown) => {
    const meta = SETTING_META[key];
    const label = meta?.fieldLabels?.[field] ?? field;
    if (typeof value === "boolean") {
      return (
        <label key={field} className="flex items-center gap-[8px] cursor-pointer" style={{ height: 32 }}>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setDraftField(key, field, e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{label}</span>
        </label>
      );
    }
    if (typeof value === "number") {
      return (
        <label key={field} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>{label}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setDraftField(key, field, Number(e.target.value))}
            className="outline-none"
            style={{ ...inputStyle, maxWidth: 180 }}
          />
        </label>
      );
    }
    if (typeof value === "string") {
      return (
        <label key={field} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>{label}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setDraftField(key, field, e.target.value)}
            className="outline-none"
            style={inputStyle}
          />
        </label>
      );
    }
    // Nested structures are system-managed — never expose raw JSON.
    return (
      <p key={field} style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
        «{label}» {t("pages.adminSettings.systemManaged")}
      </p>
    );
  };

  /** Full control block for a single setting, chosen by value shape. */
  const renderSetting = (s: AdminSetting) => {
    const meta = SETTING_META[s.key];
    const label = meta?.label ?? s.key;
    const value = drafts[s.key];

    // Toggle: plain boolean or the {enabled: bool} convention.
    if (typeof value === "boolean" || isEnabledShape(value)) {
      const checked = typeof value === "boolean" ? value : value.enabled;
      return (
        <div key={s.key} style={{ display: "grid", gap: "4px" }}>
          <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 32 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                typeof value === "boolean"
                  ? setDraft(s.key, e.target.checked)
                  : setDraftField(s.key, "enabled", e.target.checked)
              }
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{label}</span>
          </label>
          {meta?.hint && <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginLeft: 26 }}>{meta.hint}</p>}
        </div>
      );
    }

    if (typeof value === "string" || typeof value === "number") {
      return (
        <label key={s.key} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>{label}</span>
          <input
            type={typeof value === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => setDraft(s.key, typeof value === "number" ? Number(e.target.value) : e.target.value)}
            className="outline-none"
            style={{ ...inputStyle, maxWidth: typeof value === "number" ? 180 : undefined }}
          />
        </label>
      );
    }

    if (isPlainObject(value)) {
      return (
        <div key={s.key} style={{ display: "grid", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>{label}</span>
          {meta?.hint && <p style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{meta.hint}</p>}
          <div style={{ display: "grid", gap: "10px", paddingLeft: 2 }}>
            {Object.entries(value).map(([field, v]) => renderField(s.key, field, v))}
          </div>
        </div>
      );
    }

    // Arrays / null / anything exotic — system-managed, no raw JSON editing.
    return (
      <p key={s.key} style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
        «{label}» {t("pages.adminSettings.systemManaged")}
      </p>
    );
  };

  const reviewsEnabledSetting = readEnabledSetting(settings, "feature.reviews_enabled", true);
  const communitiesEnabled = readEnabledSetting(settings, "feature.communities_enabled", false);
  const marketEnabled = readEnabledSetting(settings, "feature.market_enabled", false);
  const escrowEnabled = readEnabledSetting(settings, "feature.escrow_enabled", false);
  const listingPaymentEnabled = readEnabledSetting(settings, "feature.listing_payment_enabled", false);
  const [savingCommunities, setSavingCommunities] = useState(false);
  const [savingReviews, setSavingReviews] = useState(false);
  const [savingMarket, setSavingMarket] = useState(false);
  const [savingEscrow, setSavingEscrow] = useState(false);
  const [savingListingPayment, setSavingListingPayment] = useState(false);

  // Server-persisted (SystemSetting: feature.feed_auto_publish). Not part of the
  // public feature-flags endpoint — it only affects the backend publish path.
  // Absent/false → moderation ON (posts wait in queue). Read straight from the
  // loaded settings so it reflects the real server state.
  const feedAutoPublish = readEnabledSetting(settings, "feature.feed_auto_publish", false);
  const [savingFeedAutoPublish, setSavingFeedAutoPublish] = useState(false);

  const toggleFeedAutoPublish = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingFeedAutoPublish(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.feed_auto_publish", value: { enabled: checked }, group: "feed" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.feed_auto_publish": { enabled: checked } }));
      toast.success(checked ? t("pages.adminSettings.featureCards.feedAutoPublish.enabled") : t("pages.adminSettings.featureCards.feedAutoPublish.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingFeedAutoPublish(false);
    }
  };

  const toggleReviews = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingReviews(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.reviews_enabled", value: { enabled: checked }, group: "features" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.reviews_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(checked ? t("pages.adminSettings.featureCards.reviews.enabled") : t("pages.adminSettings.featureCards.reviews.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingReviews(false);
    }
  };

  const toggleCommunities = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingCommunities(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.communities_enabled", value: { enabled: checked }, group: "features" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.communities_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(checked ? t("pages.adminSettings.featureCards.communities.enabled") : t("pages.adminSettings.featureCards.communities.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingCommunities(false);
    }
  };

  const toggleMarket = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("marketEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingMarket(true);
    try {
      const [updated] = await updateAdminSettings([{ key: "feature.market_enabled", value: { enabled: checked }, group: "feature" }]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.market_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(checked ? t("pages.adminSettings.featureCards.market.enabled") : t("pages.adminSettings.featureCards.market.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingMarket(false);
    }
  };

  const toggleEscrow = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("escrowEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingEscrow(true);
    try {
      const [updated] = await updateAdminSettings([{ key: "feature.escrow_enabled", value: { enabled: checked }, group: "feature" }]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.escrow_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(checked ? t("pages.adminSettings.featureCards.escrow.enabled") : t("pages.adminSettings.featureCards.escrow.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingEscrow(false);
    }
  };

  const toggleListingPayment = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("listingPaymentEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingListingPayment(true);
    try {
      const [updated] = await updateAdminSettings([{ key: "feature.listing_payment_enabled", value: { enabled: checked }, group: "feature" }]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.listing_payment_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(checked ? t("pages.adminSettings.featureCards.listingPayment.enabled") : t("pages.adminSettings.featureCards.listingPayment.disabled"));
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingListingPayment(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminSettings.title")}</H>

      {/* Server-persisted (SystemSetting: feature.reviews_enabled). */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.reviews.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.reviews.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingReviews ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={reviewsEnabledSetting}
            disabled={savingReviews}
            onChange={(e) => void toggleReviews(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.reviews.toggle")}</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.communities_enabled). */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.communities.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.communities.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingCommunities ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={communitiesEnabled}
            disabled={savingCommunities}
            onChange={(e) => void toggleCommunities(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.communities.toggle")}</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.market_enabled via the same
          /admin/settings endpoint below) — unlike the flags above, this one
          actually changes what every visitor sees, not just this browser. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.market.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.market.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingMarket ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={marketEnabled}
            disabled={savingMarket}
            onChange={(e) => void toggleMarket(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.market.toggle")}</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.escrow_enabled). Off by
          default — turn on only once ЮKassa Безопасная сделка is live on the
          backend, so the escrow badge never promises an unimplemented feature. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.escrow.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.escrow.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingEscrow ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={escrowEnabled}
            disabled={savingEscrow}
            onChange={(e) => void toggleEscrow(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.escrow.toggle")}</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.listing_payment_enabled). Off
          by default — ads publish for free until billing is wired in the wizard. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.listingPayment.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.listingPayment.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingListingPayment ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={listingPaymentEnabled}
            disabled={savingListingPayment}
            onChange={(e) => void toggleListingPayment(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.listingPayment.toggle")}</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.feed_auto_publish). Off by
          default → new feed posts go to the moderation queue. Turning it on
          auto-publishes them without a redeploy. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          {t("pages.adminSettings.featureCards.feedAutoPublish.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.feedAutoPublish.subtitle")}
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingFeedAutoPublish ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={feedAutoPublish}
            disabled={savingFeedAutoPublish}
            onChange={(e) => void toggleFeedAutoPublish(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("pages.adminSettings.featureCards.feedAutoPublish.toggle")}</span>
        </label>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <FooterContactsAdminCard cardStyle={card} />
      </div>

      <div style={{ ...card, padding: "24px", maxWidth: "640px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "16px" }}>
          {t("pages.adminSettings.platformTitle")}
        </h4>

        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
        ) : settings.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.empty")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {groups.map(([group, rows]) => (
              <div key={group}>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--foreground-50)", marginBottom: "10px" }}>
                  {t(`pages.adminSettings.groups.${group}`, { defaultValue: group })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {rows.map(renderSetting)}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || loading}
          style={{ ...primaryBtn, height: "44px", padding: "0 32px", fontSize: "14px", marginTop: "20px", opacity: saving || loading ? 0.7 : 1 }}
        >
          {saving ? t("pages.adminSettings.saving") : t("pages.adminSettings.save")}
        </button>
      </div>
    </div>
  );
}

/* ============ AUDIT LOG ============ */
function AuditLogSection() {
  const { t } = useTranslation();
  const auditColumns = useMemo(
    () => [
      t("pages.adminAuditLog.columns.who"),
      t("pages.adminAuditLog.columns.when"),
      t("pages.adminAuditLog.columns.action"),
      t("pages.adminAuditLog.columns.entity"),
    ],
    [t],
  );
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogDetailEntry[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditLogPage(page)
      .then((r) => {
        if (!active) return;
        setEntries(r.entries);
        setLastPage(r.lastPage);
      })
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page]);

  const userOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.user))).sort(),
    [entries],
  );
  const actionPrefixOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action.split(".")[0]).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = entries.filter((e) => {
    const matchUser = userFilter === "all" || e.user === userFilter;
    const matchAction = actionFilter === "all" || e.action.startsWith(actionFilter + ".");
    return matchUser && matchAction;
  });

  const renderDiffValue = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderDiff = (entry: AuditLogDetailEntry) => {
    const oldV = entry.oldValues ?? {};
    const newV = entry.newValues ?? {};
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
    if (keys.length === 0) {
      return <p style={{ fontSize: 12, color: "var(--foreground-50)" }}>{t("pages.adminAuditLog.noDiff")}</p>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {keys.map((k) => (
          <div key={k} style={{ fontSize: 12, color: "var(--foreground-70)" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{k}</span>
            {": "}
            {renderDiffValue((oldV as Record<string, unknown>)[k])}
            {" → "}
            <span style={{ color: "var(--accent)" }}>{renderDiffValue((newV as Record<string, unknown>)[k])}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <H>{t("pages.adminAuditLog.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px", marginBottom: "16px" }}>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminAuditLog.allUsers")}</option>
          {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminAuditLog.allActions")}</option>
          {actionPrefixOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>{t("pages.adminAuditLog.empty")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "var(--background-surface)" }}>
                  {auditColumns.map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{e.user}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-30)", fontSize: "12px" }} title={e.time}>{e.time}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{e.action}</td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{e.target}</td>
                    </tr>
                    {expandedId === e.id && (
                      <tr style={{ background: "var(--background-surface)" }}>
                        <td colSpan={4} style={{ padding: "12px 16px" }}>
                          {renderDiff(e)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "12px" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--r-card-sm)", border: "1px solid var(--border)", color: "var(--foreground-70)", opacity: page <= 1 ? 0.5 : 1 }}
        >
          {t("pages.adminAuditLog.prev")}
        </button>
        <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>{t("pages.adminAuditLog.page", { page, last: lastPage })}</span>
        <button
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page >= lastPage}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--r-card-sm)", border: "1px solid var(--border)", color: "var(--foreground-70)", opacity: page >= lastPage ? 0.5 : 1 }}
        >
          {t("pages.adminAuditLog.next")}
        </button>
      </div>
    </div>
  );
}

/* ============ PROMO CODES BLOCK ============ */
function PromoCodesBlock({ promos, setPromos, reload }: { promos: PromoCode[]; setPromos: React.Dispatch<React.SetStateAction<PromoCode[]>>; reload?: () => void }) {
  const { t } = useTranslation();
  const promoColumns = useMemo(
    () => [
      t("pages.adminPromocodes.columns.code"),
      t("pages.adminPromocodes.columns.discount"),
      t("pages.adminPromocodes.columns.used"),
      t("pages.adminPromocodes.columns.expires"),
      t("pages.adminPromocodes.columns.status"),
      "",
    ],
    [t],
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [form, setForm] = useState({
    code: "", discount: 10, expiresAt: "", limit: 100,
    type: "percent" as "percent" | "fixed" | "free",
    notifyAll: false,
    notifyUserIds: "",
    notifyTitle: "",
    notifyBody: "",
  });

  const today = new Date().toISOString().slice(0, 10);
  const enriched = promos.map((p) => ({
    ...p,
    status: (p.status ?? (p.expiresAt >= today ? "active" : "expired")) as "active" | "expired",
  }));

  const filtered = enriched.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q && !p.code.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const create = async () => {
    if (!form.code.trim()) return toast.error(t("pages.adminPromocodes.errCode"));
    if (!form.expiresAt) return toast.error(t("pages.adminPromocodes.errExpires"));
    if (form.type === "percent" && (form.discount < 1 || form.discount > 100)) return toast.error(t("pages.adminPromocodes.errDiscount"));
    if (form.limit < 1) return toast.error(t("pages.adminPromocodes.errLimit"));
    try {
      const notifyMode = form.notifyUserIds.trim()
        ? "selected"
        : form.notifyAll
          ? "all"
          : "none";
      const result = await createPromocode({
        code: form.code.toUpperCase(),
        type: form.type,
        scope: "listing_placement",
        value: form.type === "free" ? 100 : form.discount,
        max_usages: form.limit,
        valid_until: form.expiresAt,
        notify_mode: notifyMode,
        notify_title: form.notifyTitle.trim() || undefined,
        notify_body: form.notifyBody.trim() || undefined,
        notify_user_ids: form.notifyUserIds
          .split(/[\s,;]+/)
          .map((x) => +x)
          .filter((x) => Number.isInteger(x) && x > 0),
      });
      setForm({ code: "", discount: 10, expiresAt: "", limit: 100, type: "percent", notifyAll: false, notifyUserIds: "", notifyTitle: "", notifyBody: "" });
      setOpen(false);
      reload?.();
      toast.success(result.notifications_sent
        ? t("pages.adminPromocodes.createdWithNotify", { count: result.notifications_sent })
        : t("pages.adminPromocodes.created"));
    } catch {
      toast.error(t("pages.adminPromocodes.createFailed"));
    }
  };

  return (
    <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
      <div className="flex items-center justify-between flex-wrap gap-[12px]">
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("pages.adminPromocodes.title")}</h4>
        <button onClick={() => setOpen((v) => !v)} style={primaryBtn}>
          <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />{t("pages.adminPromocodes.create")}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ marginTop: "12px", padding: "16px", background: "var(--background-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-card-sm)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.fieldCode")}</span>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER2026" className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.fieldType")}</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" | "free" })} style={inputStyle}>
                    <option value="percent">{t("pages.adminPromocodes.typePercent")}</option>
                    <option value="fixed">{t("pages.adminPromocodes.typeFixed")}</option>
                    <option value="free">{t("pages.adminPromocodes.typeFree")}</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.fieldDiscount")}</span>
                  <input type="number" min={1} max={100} value={form.discount} disabled={form.type !== "percent"} onChange={(e) => setForm({ ...form, discount: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.fieldExpires")}</span>
                  <input type="date" required value={form.expiresAt} min={today} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.fieldLimit")}</span>
                  <input type="number" min={1} value={form.limit} onChange={(e) => setForm({ ...form, limit: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label className="md:col-span-2 flex items-center gap-[8px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                  <input type="checkbox" checked={form.notifyAll} onChange={(e) => setForm({ ...form, notifyAll: e.target.checked, notifyUserIds: e.target.checked ? "" : form.notifyUserIds })} />
                  {t("pages.adminPromocodes.notifyAll")}
                </label>
                <label className="md:col-span-2" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.notifyUserIds")}</span>
                  <input value={form.notifyUserIds} onChange={(e) => setForm({ ...form, notifyUserIds: e.target.value, notifyAll: false })} placeholder="12, 45, 78" style={inputStyle} />
                </label>
                {form.notifyAll && (
                  <>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.notifyTitle")}</span>
                      <input value={form.notifyTitle} onChange={(e) => setForm({ ...form, notifyTitle: e.target.value })} placeholder={t("pages.adminPromocodes.notifyTitlePlaceholder")} style={inputStyle} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("pages.adminPromocodes.notifyBody")}</span>
                      <input value={form.notifyBody} onChange={(e) => setForm({ ...form, notifyBody: e.target.value })} placeholder={t("pages.adminPromocodes.notifyBodyPlaceholder")} style={inputStyle} />
                    </label>
                  </>
                )}
              </div>
              <div className="flex gap-[8px]" style={{ marginTop: "12px" }}>
                <button onClick={create} style={primaryBtn}>{t("pages.adminPromocodes.submit")}</button>
                <button onClick={() => setOpen(false)} style={{ ...primaryBtn, background: "transparent", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>{t("pages.adminCommon.cancel")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center" style={{ gap: "8px", marginTop: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--foreground-50)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pages.adminPromocodes.searchPlaceholder")} className="w-full outline-none" style={{ ...inputStyle, paddingLeft: "34px" }} />
        </div>
        <div className="flex" style={{ gap: "4px", background: "var(--background-surface)", padding: "3px", borderRadius: "var(--r-pill)" }}>
          {(["all", "active", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "var(--r-pill)",
                background: filter === f ? "var(--background)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--foreground-70)",
              }}
            >
              {t(`pages.adminPromocodes.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: "12px", overflowX: "auto" }}>
        <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
          <thead>
            <tr style={{ background: "var(--background-surface)" }}>
              {promoColumns.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--foreground)" }}>{p.code}</td>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--accent)" }}>{p.discount}%</td>
                <td style={{ padding: "10px 12px", color: "var(--foreground-70)" }}>{p.usedCount} / {p.limit}</td>
                <td style={{ padding: "10px 12px", color: "var(--foreground-70)" }}>{p.expiresAt}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "var(--r-pill)",
                    background: p.status === "active" ? "var(--success-soft, rgba(34,197,94,0.12))" : "var(--background-surface)",
                    color: p.status === "active" ? "var(--success, #16a34a)" : "var(--foreground-50)",
                  }}>
                    {p.status === "active" ? t("pages.adminPromocodes.statusActive") : t("pages.adminPromocodes.statusExpired")}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <IconBtn danger onClick={async () => {
                    try {
                      await deletePromocode(p.code);
                      setPromos((q) => q.filter((x) => x.id !== p.id));
                      toast.success(t("pages.adminPromocodes.deleted"));
                    } catch {
                      toast.error(t("pages.adminPromocodes.deleteFailed"));
                    }
                  }}><Trash2 size={14} /></IconBtn>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--foreground-50)" }}>{t("pages.adminPromocodes.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicationsSection() {
  const { t } = useTranslation();
  const statuses = useMemo(
    () => (["pending", "approved", "rejected"] as const).map((id) => ({ id, label: t(`pages.adminApplications.filters.${id}`) })),
    [t],
  );
  const kindLabels = useMemo(
    () => ({ channel: t("pages.adminApplications.kinds.channel"), community: t("pages.adminApplications.kinds.community") }) as Record<EntityKind, string>,
    [t],
  );
  const [status, setStatus] = useState<RequestStatus>("pending");
  const [items, setItems] = useState<EntityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEntityRequests(status)
      .then((list) => { if (alive) setItems(list); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status]);

  const decide = async (r: EntityRequest, approve: boolean) => {
    setItems((cur) => cur.filter((x) => x.id !== r.id)); // optimistic
    try {
      if (approve) await approveEntityRequest(r.kind, r.id);
      else await rejectEntityRequest(r.kind, r.id);
    } catch {
      // на реальном бэке при ошибке перезагрузим список
      fetchEntityRequests(status).then(setItems).catch(() => {});
    }
  };

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "18px", color: "var(--foreground)", marginBottom: "12px" }}>
        {t("pages.adminApplications.title")}
      </h3>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            style={{
              padding: "7px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 600,
              background: status === s.id ? "var(--accent-soft)" : "var(--background-surface)",
              color: status === s.id ? "var(--accent)" : "var(--foreground-70)",
              border: `1px solid ${status === s.id ? "var(--border-accent)" : "var(--border)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--foreground-50)", fontSize: "13px" }}>{t("pages.adminCommon.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "12px" }}>
          {t("pages.adminApplications.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", background: "var(--background-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {kindLabels[r.kind]}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>{r.proposedName}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "8px" }}>
                <Link to="/user/$id" params={{ id: r.applicant.slug ?? r.applicant.id }} style={{ color: "var(--accent)" }}>
                  {r.applicant.name}
                </Link>
                {" · "}{r.category}{" · "}{new Date(r.createdAt).toLocaleDateString("ru-RU")}
              </div>
              {r.description && (
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--foreground-70)", wordBreak: "break-word" }}>
                  <CollapsibleText text={r.description} maxLines={3} />
                </div>
              )}
              {status === "pending" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button" onClick={() => decide(r, true)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "var(--accent-foreground)", border: "none" }}
                  >
                    {t("pages.adminCommon.actionApprove")}
                  </button>
                  <button
                    type="button" onClick={() => decide(r, false)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--background-surface)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}
                  >
                    {t("pages.adminCommon.reject")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
