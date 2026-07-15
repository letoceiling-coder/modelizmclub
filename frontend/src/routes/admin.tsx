import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Newspaper, Megaphone, ShieldCheck, DollarSign, FolderTree,
  Bell, BarChart3, Settings, Home, Eye, Ban, Check, X, Plus, Trash2, Pencil, Send,
  Upload, UserPlus, Palette, Sun, Moon, CheckCircle2, AlertCircle, Info, Inbox, Truck, Clapperboard,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore, selectors, getState } from "@/lib/store";
import { useFeatureFlag, setFeatureFlag } from "@/lib/config/featureFlags";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import type { Tariff, PromoCode, Banner, Video } from "@/lib/mock";
import { Search, Filter, Calendar, Tag } from "lucide-react";
import {
  fetchDashboard, fetchAuditLogs, fetchAuditLogPage, fetchAdminUsers, updateAdminUser,
  fetchModerationQueue, approveModeration, rejectModeration,
  fetchAdminPlans, updateAdminPlan,
  fetchAdminPromocodes, createPromocode, deletePromocode,
  fetchAdminBanners, updateAdminBanner, deleteAdminBanner,
  fetchAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory,
  fetchAdminSettings, updateAdminSettings,
  fetchAdminPosts, updateAdminPostStatus, deleteAdminPost,
  fetchAdminListings, updateAdminListingStatus, deleteAdminListing,
  broadcastNotification,
  fetchAdminFeedback, updateAdminFeedbackStatus,
  fetchAdminDeliveryStats, fetchAdminShipments, updateAdminShipment,
  type AdminUserRow, type AuditEntry, type AuditLogDetailEntry, type ModerationItem,
  type AdminCategory, type CategoryKind, type AdminSetting,
  type AdminPostRow, type AdminListingRow,
  type FeedbackRow, type FeedbackStatus,
  type AdminDeliveryStats, type AdminShipmentRow,
} from "@/lib/api/admin";
import { fetchVideos, setVideoFeatured, deleteVideo } from "@/lib/api/reviews";
import { fetchEntityRequests, approveEntityRequest, rejectEntityRequest, type EntityRequest, type RequestStatus, type EntityKind } from "@/lib/api/entity-requests";
import {
  fetchIconAssets, uploadIconAsset, deleteIconAsset,
  publishIconOverrides, fetchLastPublishedIconOverrides,
  type IconAsset, type IconOverrideMap,
} from "@/lib/api/icons";
import {
  getMergedMap, setDraftOverride, resetDraft, applyPublishedMap,
} from "@/lib/icon-overrides";
import {
  ICON_SLOTS, GROUP_LABELS, TOKEN_OPTIONS, categorySlotKey, type TokenKey,
} from "@/lib/icon-slots";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { usePostCategories } from "@/lib/hooks/useCategories";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админ-панель — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
  component: AdminPage,
});

type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation" | "delivery"
  | "monetization" | "categories" | "reviews" | "notifications" | "analytics" | "design" | "feedback" | "settings"
  | "auditLog" | "applications";

type AdminRole = "admin" | "moderator";

const navItems: { id: Section; label: string; icon: typeof Users; roles: AdminRole[] }[] = [
  { id: "dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["admin", "moderator"] },
  { id: "users", label: "Пользователи", icon: Users, roles: ["admin"] },
  { id: "content", label: "Контент", icon: Newspaper, roles: ["admin"] },
  { id: "ads", label: "Объявления", icon: Megaphone, roles: ["admin"] },
  { id: "delivery", label: "Доставки", icon: Truck, roles: ["admin"] },
  { id: "moderation", label: "Модерация", icon: ShieldCheck, roles: ["admin", "moderator"] },
  { id: "applications", label: "Заявки", icon: Inbox, roles: ["admin"] },
  { id: "monetization", label: "Монетизация", icon: DollarSign, roles: ["admin"] },
  { id: "categories", label: "Категории", icon: FolderTree, roles: ["admin"] },
  { id: "reviews", label: "Обзоры", icon: Clapperboard, roles: ["admin"] },
  { id: "notifications", label: "Уведомления", icon: Bell, roles: ["admin"] },
  { id: "analytics", label: "Аналитика", icon: BarChart3, roles: ["admin"] },
  { id: "feedback", label: "Обращения", icon: Inbox, roles: ["admin", "moderator"] },
  { id: "design", label: "Design System", icon: Palette, roles: ["admin"] },
  { id: "settings", label: "Настройки", icon: Settings, roles: ["admin"] },
  { id: "auditLog", label: "История изменений", icon: Search, roles: ["admin"] },
];

function AdminPage() {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const [access, setAccess] = useState<"checking" | "granted" | "forbidden">("checking");
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [section, setSection] = useState<Section>("dashboard");

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
    if (adminRole === null) return;
    if (!visibleNavItems.some((n) => n.id === section)) {
      setSection(visibleNavItems[0]?.id ?? "dashboard");
    }
  }, [adminRole, section, visibleNavItems]);

  if (access === "checking") {
    return (
      <div
        className="min-h-screen grid place-items-center"
        style={{ background: "var(--background)", color: "var(--foreground-50)", fontSize: "13px" }}
      >
        Проверка доступа…
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
            Доступ запрещён
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--foreground-70)" }}>
            Админ-панель доступна только суперадминистраторам (роль <code>admin</code>).
          </p>
          {me.id !== "guest" && (
            <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-50)" }}>
              Вы вошли как <strong style={{ color: "var(--foreground-70)" }}>{me.name}</strong>.
              У вашего аккаунта нет роли суперадмина — обратитесь к действующему администратору
              или войдите под другим аккаунтом.
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
              Войти другим аккаунтом
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
              <Home size={14} />На главную
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
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>Админ-панель</span>
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
            <Home size={14} />К сайту
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
                  {n.label}
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
              {visibleNavItems.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
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
  if (section === "moderation") return <ModerationSection />;
  if (section === "applications") return <ApplicationsSection />;
  if (section === "monetization") return <MonetizationSection />;
  if (section === "categories") return <CategoriesSection />;
  if (section === "reviews") return <ReviewsSection />;
  if (section === "notifications") return <NotificationsSection />;
  if (section === "analytics") return <AnalyticsSection />;
  if (section === "feedback") return <FeedbackSection />;
  if (section === "design") return <DesignSystemSection />;
  if (section === "auditLog") return <AuditLogSection />;
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

function DesignSystemSection() {
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
            Дизайн-система / Основной цвет
          </h1>
          <p style={{ fontSize: 13, color: "var(--foreground-70)" }}>
            Выберите один из двух брендовых акцентов. Меняет CSS-переменные глобально, сохраняется в localStorage. Не влияет на логику и данные.
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
          Превью UI Kit 2.0 →
        </a>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", }}>
        <Panel title="Режим темы">
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
              Сбросить
            </button>
          </div>
        </Panel>

        <Panel title="Основной цвет бренда">
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
            Расширенный режим (debug) — свой цвет RGB
          </summary>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                type="color"
                value={activeHex}
                onChange={(e) => pickAccent(e.target.value)}
                aria-label="Выбрать цвет акцента"
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
              <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>Только для отладки. Основной сценарий — два бренд-пресета выше.</span>
            </div>
            <SwatchRow swatches={variations} active={activeHex} onPick={pickAccent} />
          </div>
        </details>
      </div>

      {/* Preview */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginTop: 8 }}>Превью компонентов</h2>
      <PreviewArea />

      <IconsPanel />
    </div>
  );
}

interface SlotOption { key: string; label: string; group: string; }

function IconsPanel() {
  const categories = usePostCategories();
  const [assets, setAssets] = useState<IconAsset[]>([]);
  const [slotKey, setSlotKey] = useState<string>(ICON_SLOTS[0]?.key ?? "");
  const [assetId, setAssetId] = useState<string>("");           // "" = по умолчанию (lucide)
  const [token, setToken] = useState<TokenKey>("foreground");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [canRollback, setCanRollback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectStyle: React.CSSProperties = {
    height: 38, padding: "0 10px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 13,
  };

  // Загрузка библиотеки иконок + состояния «можно ли откатить».
  useEffect(() => {
    let alive = true;
    fetchIconAssets().then((a) => alive && setAssets(a)).catch(() => {});
    fetchLastPublishedIconOverrides().then((prev) => alive && setCanRollback(prev !== null)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Слоты категорий строятся из usePostCategories() — тот же id-space, что
  // читает <CategoryIcon categoryId={c.id}> в FeedRightRail/RightCategories,
  // поэтому назначенные тут override'ы реально применяются в ленте (в demo —
  // те же demo-id "c1".."c20", что и в правом рейле).
  const categorySlots: SlotOption[] = useMemo(
    () => categories.map((c) => ({
      key: categorySlotKey(c.id), label: `Категория — ${c.name}`, group: GROUP_LABELS.category,
    })),
    [categories],
  );

  const allSlots: SlotOption[] = useMemo(
    () => [
      ...ICON_SLOTS.map((s) => ({ key: s.key, label: s.label, group: GROUP_LABELS[s.group] })),
      ...categorySlots,
    ],
    [categorySlots],
  );

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadIconAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setAssetId(asset.id);
      toast.success("Иконка загружена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить иконку");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDeleteAsset(id: string) {
    try {
      await deleteIconAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (assetId === id) setAssetId("");
    } catch {
      toast.error("Не удалось удалить иконку");
    }
  }

  function onApply() {
    if (!slotKey) return;
    if (assetId === "") {
      setDraftOverride(slotKey, null); // сброс слота на дефолт (в превью)
      toast("Слот сброшен на иконку по умолчанию (превью)");
      return;
    }
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setDraftOverride(slotKey, { assetId: asset.id, svg: asset.svg, token });
    toast("Применено в превью — опубликуйте, чтобы увидели все");
  }

  async function onPublish() {
    setPublishing(true);
    try {
      const map: IconOverrideMap = getMergedMap();
      await publishIconOverrides(map);
      applyPublishedMap(map); // published := map, draft очищается
      setCanRollback(true);
      toast.success(isDemoMode()
        ? "Опубликовано (demo — только в этом браузере)"
        : "Иконки опубликованы для всех");
    } catch {
      toast.error("Не удалось опубликовать");
    } finally {
      setPublishing(false);
    }
  }

  async function onRollback() {
    try {
      const prev = await fetchLastPublishedIconOverrides();
      if (prev === null) { setCanRollback(false); return; }
      await publishIconOverrides(prev);
      applyPublishedMap(prev);
      toast.success("Откат выполнен");
    } catch {
      toast.error("Не удалось откатить");
    }
  }

  return (
    <div style={{ ...card, padding: 24, maxWidth: 760, marginTop: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)", marginBottom: 4 }}>
        Иконки
      </h4>
      <p style={{ fontSize: 12, color: "var(--foreground-50)", marginBottom: 16 }}>
        Загрузите монохромный SVG, назначьте на место в интерфейсе и выберите цвет из палитры токенов.
        Превью применяется только у вас; «Опубликовать» — для всех пользователей.
      </p>

      {/* Библиотека */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground-70)", marginBottom: 8 }}>Библиотека</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
          {assets.map((a) => (
            <div key={a.id} title={a.name}
              style={{
                position: "relative", aspectRatio: "1", display: "grid", placeItems: "center",
                border: `1px solid ${assetId === a.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 10, cursor: "pointer", color: "var(--foreground)",
              }}
              onClick={() => setAssetId(a.id)}
            >
              <span aria-hidden style={{ width: 22, height: 22, display: "inline-flex" }}
                dangerouslySetInnerHTML={{ __html: isSafeSvgMarkup(a.svg) ? a.svg : "" }} />
              <button type="button" aria-label="Удалить" onClick={(e) => { e.stopPropagation(); void onDeleteAsset(a.id); }}
                style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 6,
                  background: "var(--background-surface)", color: "var(--foreground-50)", fontSize: 12, lineHeight: "16px" }}>
                ×
              </button>
            </div>
          ))}
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
            style={{ aspectRatio: "1", border: "1px dashed var(--border)", borderRadius: 10,
              color: "var(--foreground-50)", fontSize: 12, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "…" : "+ SVG"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/svg+xml,.svg" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
      </div>

      {/* Назначение */}
      <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Слот (место в интерфейсе)</span>
          <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} style={selectStyle}>
            {allSlots.map((s) => <option key={s.key} value={s.key}>{s.group} · {s.label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Иконка</span>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={selectStyle}>
            <option value="">По умолчанию (lucide)</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--foreground-70)" }}>Цвет (токен)</span>
          <select value={token} onChange={(e) => setToken(e.target.value as TokenKey)} style={selectStyle}>
            {TOKEN_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={onApply}
          style={{ justifySelf: "start", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" }}>
          Применить (превью)
        </button>
      </div>

      {/* Публикация */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={publishing} onClick={onPublish}
          style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: "var(--accent)", color: "var(--accent-foreground)", opacity: publishing ? 0.6 : 1 }}>
          {publishing ? "Публикация…" : "Опубликовать для всех"}
        </button>
        <button type="button" onClick={resetDraft}
          style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            border: "1px solid var(--border)", color: "var(--foreground-70)" }}>
          Сбросить превью
        </button>
        {canRollback && (
          <button type="button" onClick={onRollback}
            style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              border: "1px solid var(--border)", color: "var(--foreground-70)" }}>
            Откатить последнее изменение
          </button>
        )}
      </div>
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
                <CheckCircle2 size={13} /> Активен
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--foreground-50)" }}>{preset.primary}</div>
        </div>
      </div>

      {/* live component samples in the preset's own colors */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ padding: "8px 14px", borderRadius: 10, background: preset.primary, color: preset.foreground, fontSize: 13, fontWeight: 600 }}>
          Кнопка
        </span>
        <span style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", background: preset.primary, color: preset.foreground, fontSize: 11, fontWeight: 700 }}>
          PRO
        </span>
        <span style={{ padding: "6px 12px", borderRadius: 8, background: preset.soft, color: preset.primary, fontSize: 12, fontWeight: 600 }}>
          Активная вкладка
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
        {active ? "Основной" : "Сделать основным"}
      </button>
    </div>
  );
}

function PreviewArea() {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {/* Buttons */}
      <Panel title="Кнопки">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>Основная</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Мягкая</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)" }}>Контур</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", fontSize: 13, fontWeight: 600 }} disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", display: "grid", placeItems: "center" }}><Plus size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Pencil size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}><Trash2 size={16} /></button>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title="Бейджи">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge bg="var(--accent)" fg="var(--accent-foreground)">PRO</Badge>
          <Badge bg="var(--accent-soft)" fg="var(--accent)">Новое</Badge>
          <Badge bg="var(--success-soft)" fg="var(--success)">Активно</Badge>
          <Badge bg="var(--warning-soft)" fg="var(--warning)">На проверке</Badge>
          <Badge bg="var(--error-soft)" fg="var(--error)">Отклонено</Badge>
          <Badge bg="var(--info-soft)" fg="var(--info)">Инфо</Badge>
        </div>
      </Panel>

      {/* Alerts */}
      <Panel title="Уведомления">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Alert icon={<CheckCircle2 size={16} />} bg="var(--success-soft)" fg="var(--success)" text="Изменения сохранены" />
          <Alert icon={<Info size={16} />} bg="var(--info-soft)" fg="var(--info)" text="Подсказка для пользователя" />
          <Alert icon={<AlertCircle size={16} />} bg="var(--error-soft)" fg="var(--error)" text="Произошла ошибка" />
        </div>
      </Panel>

      {/* Card */}
      <Panel title="Карточка">
        <div style={{ padding: 14, borderRadius: 12, background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Заголовок карточки</div>
          <div style={{ fontSize: 12, color: "var(--foreground-70)", marginBottom: 10 }}>Краткое описание содержимого с акцентом на детали.</div>
          <a style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Подробнее →</a>
        </div>
      </Panel>

      {/* Inputs */}
      <Panel title="Поля ввода">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Email" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder="Активное (focus)" autoFocus style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1.5px solid var(--accent)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
          <textarea placeholder="Сообщение" rows={3} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13, resize: "none" }} />
        </div>
      </Panel>

      {/* Upload */}
      <Panel title="Загрузка файла">
        <div style={{ padding: 20, borderRadius: 12, border: "2px dashed var(--border-accent)", background: "var(--accent-soft)", textAlign: "center" }}>
          <Upload size={20} style={{ color: "var(--accent)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--foreground-70)" }}>Перетащите файл или <span style={{ color: "var(--accent)", fontWeight: 600 }}>выберите</span></div>
        </div>
      </Panel>

      {/* Login form */}
      <Panel title="Форма входа">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Логин" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder="Пароль" type="password" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>Войти</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground-70)", fontSize: 13, fontWeight: 500, border: "1px solid var(--border)" }}>Создать аккаунт</button>
        </div>
      </Panel>

      {/* Nav */}
      <Panel title="Навигация">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { label: "Главная", active: true },
            { label: "Лента", active: false },
            { label: "Каналы", active: false },
            { label: "Сообщения", active: false },
          ].map((it) => (
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
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetchDashboard().then((d) => active && setData(d)).catch(() => {});
    fetchAuditLogs().then((a) => active && setAudit(a)).catch(() => {});
    return () => { active = false; };
  }, []);

  const allStats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: "Всего пользователей", icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.communitiesTotal ?? 0).toLocaleString("ru"), l: "Сообществ", icon: Users, ch: "", up: true, adminOnly: true },
    { v: (data?.bannersActive ?? 0).toLocaleString("ru"), l: "Активных баннеров", icon: Megaphone, ch: "", up: true, adminOnly: true },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: "Публикаций", icon: Newspaper, ch: "", up: true, adminOnly: true },
    { v: String(data?.moderationPending ?? 0), l: "На модерации", icon: ShieldCheck, ch: "", up: true, warn: true, adminOnly: false },
    { v: String(data?.reportsPending ?? 0), l: "Жалоб", icon: UserPlus, ch: "", up: true, adminOnly: false },
  ];
  const stats = allStats.filter((s) => role === "admin" || !s.adminOnly);
  const bars = [40, 65, 55, 80, 70, 90, 60];
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div>
      <H>Дашборд</H>
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
          Регистрации за 30 дней
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
              <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent actions */}
      <div style={{ ...card, marginTop: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", padding: "16px 16px 8px" }}>
          Последние действия
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
const ROLE_OPTIONS: { value: AdminUserRow["role"]; label: string }[] = [
  { value: "user", label: "Пользователь" },
  { value: "subscriber", label: "Подписчик" },
  { value: "moderator", label: "Модератор" },
  { value: "admin", label: "Суперадмин" },
];

function UsersSection() {
  const me = useStore(selectors.currentUser);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | AdminUserRow["role"]>("all");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminUsers({ role }).then((list) => active && setUsers(list)).catch(() => {});
    return () => { active = false; };
  }, [role]);

  const changeRole = async (uuid: string, newRole: AdminUserRow["role"]) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target || target.role === newRole) return;
    if (me.id === uuid) {
      toast.error("Нельзя изменить собственную роль");
      return;
    }
    setSavingRole(uuid);
    try {
      await updateAdminUser(uuid, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, role: newRole } : u)));
      toast.success(newRole === "admin" ? "Назначен суперадмином" : "Роль обновлена");
    } catch {
      toast.error("Не удалось изменить роль");
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
      toast.success(ns === "blocked" ? "Пользователь заблокирован" : "Пользователь разблокирован");
    } catch {
      toast.error("Не удалось изменить статус");
    }
  };

  const roleBadge = (r: AdminUserRow["role"]) => {
    const map: Record<AdminUserRow["role"], { bg: string; c: string; l: string }> = {
      admin: { bg: "var(--accent-soft)", c: "var(--accent)", l: "Суперадмин" },
      moderator: { bg: "var(--info-soft)", c: "var(--info)", l: "Модератор" },
      subscriber: { bg: "var(--success-soft)", c: "var(--success)", l: "Подписчик" },
      user: { bg: "var(--background-surface)", c: "var(--foreground-50)", l: "Польз." },
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
      <H>Пользователи</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или email..."
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "all" | AdminUserRow["role"])}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">Все роли</option>
          <option value="user">Пользователь</option>
          <option value="subscriber">Подписчик</option>
          <option value="moderator">Модератор</option>
          <option value="admin">Суперадмин</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "780px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {["Имя", "Email", "Город", "Подписка", "Роль", "Статус", "Действия"].map((h) => (
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
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.role === "subscriber" ? "Подписка" : "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex flex-col" style={{ gap: "6px" }}>
                      {roleBadge(u.role)}
                      <select
                        value={u.role}
                        disabled={me.id === u.uuid || savingRole === u.uuid}
                        onChange={(e) => changeRole(u.uuid, e.target.value as AdminUserRow["role"])}
                        className="outline-none"
                        title={me.id === u.uuid ? "Нельзя изменить собственную роль" : "Изменить роль"}
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
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={u.status === "active" ? "published" : "rejected"}>
                      {u.status === "active" ? "Активен" : u.status === "blocked" ? "Заблокирован" : "Ожидает"}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info(`Просмотр: ${u.name}`)}><Eye size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toggle(u.uuid)}><Ban size={14} /></IconBtn>
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

function IconBtn({ children, onClick, danger, success }: { children: React.ReactNode; onClick: () => void; danger?: boolean; success?: boolean }) {
  return (
    <button
      onClick={onClick}
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

const POST_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  published: { label: "Опубликовано", variant: "published" },
  pending_moderation: { label: "На модерации", variant: "moderation" },
  revision: { label: "На доработке", variant: "moderation" },
  rejected: { label: "Отклонено", variant: "rejected" },
  draft: { label: "Черновик", variant: "default" },
  hidden: { label: "Скрыто", variant: "default" },
  archived: { label: "Архив", variant: "default" },
};

const LISTING_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  published: { label: "Опубликовано", variant: "published" },
  pending_moderation: { label: "На модерации", variant: "moderation" },
  awaiting_payment: { label: "Ждёт оплаты", variant: "moderation" },
  revision: { label: "На доработке", variant: "moderation" },
  rejected: { label: "Отклонено", variant: "rejected" },
  draft: { label: "Черновик", variant: "default" },
  unpublished: { label: "Снято", variant: "default" },
  sold: { label: "Продано", variant: "default" },
  expired: { label: "Истекло", variant: "default" },
};

function statusMeta(map: Record<string, { label: string; variant: BadgeVariant }>, status: string) {
  return map[status] ?? { label: status || "—", variant: "default" as BadgeVariant };
}

function ContentSection() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdminPosts(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error("Не удалось загрузить публикации"))
      .finally(() => setLoading(false));
  }, [status]);

  const filtered = rows.filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()));

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminPostStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success("Статус обновлён");
    } catch { toast.error("Не удалось обновить статус"); }
  };
  const remove = async (uuid: string) => {
    if (!window.confirm("Удалить публикацию?")) return;
    try {
      await deleteAdminPost(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      toast.success("Удалено");
    } catch { toast.error("Не удалось удалить"); }
  };

  return (
    <div>
      <H>Публикации</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по заголовку..." className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">Все статусы</option>
          <option value="published">Опубликовано</option>
          <option value="pending_moderation">На модерации</option>
          <option value="rejected">Отклонено</option>
          <option value="hidden">Скрыто</option>
          <option value="draft">Черновик</option>
        </select>
      </div>
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {["Заголовок", "Автор", "Категория", "Статус", "Действия"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>Загрузка…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>Публикаций нет</td></tr>
              ) : filtered.map((p) => {
                const meta = statusMeta(POST_STATUS_META, p.status);
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
                        <IconBtn success onClick={() => changeStatus(p.uuid, "published")}><Check size={14} /></IconBtn>
                        <IconBtn onClick={() => changeStatus(p.uuid, "hidden")}><Eye size={14} /></IconBtn>
                        <IconBtn danger onClick={() => remove(p.uuid)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ ADS ============ */
function AdsSection() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminListingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdminListings(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error("Не удалось загрузить объявления"))
      .finally(() => setLoading(false));
  }, [status]);

  const filtered = rows.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase()));

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminListingStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success("Статус обновлён");
    } catch { toast.error("Не удалось обновить статус"); }
  };
  const remove = async (uuid: string) => {
    if (!window.confirm("Удалить объявление?")) return;
    try {
      await deleteAdminListing(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      toast.success("Удалено");
    } catch { toast.error("Не удалось удалить"); }
  };

  return (
    <div>
      <H>Объявления</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по заголовку..." className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">Все статусы</option>
          <option value="published">Опубликовано</option>
          <option value="pending_moderation">На модерации</option>
          <option value="rejected">Отклонено</option>
          <option value="unpublished">Снято</option>
          <option value="sold">Продано</option>
        </select>
      </div>
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {["Заголовок", "Продавец", "Цена", "Категория", "Статус", "Действия"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "16px", color: "var(--foreground-50)" }}>Загрузка…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "16px", color: "var(--foreground-50)" }}>Объявлений нет</td></tr>
              ) : filtered.map((a) => {
                const meta = statusMeta(LISTING_STATUS_META, a.status);
                return (
                  <tr key={a.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{a.title}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.author}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>{a.price.toLocaleString("ru")} ₽</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.category}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div className="flex gap-[6px]">
                        <IconBtn success onClick={() => changeStatus(a.uuid, "published")}><Check size={14} /></IconBtn>
                        <IconBtn onClick={() => changeStatus(a.uuid, "unpublished")}><Eye size={14} /></IconBtn>
                        <IconBtn danger onClick={() => remove(a.uuid)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ DELIVERY ============ */
const SHIPMENT_STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Черновик", variant: "default" },
  quoted: { label: "Рассчитано", variant: "info" },
  awaiting_seller: { label: "Ждёт продавца", variant: "warning" },
  creating: { label: "Создание", variant: "info" },
  created: { label: "Создано", variant: "info" },
  accepted: { label: "Принято", variant: "info" },
  in_transit: { label: "В пути", variant: "info" },
  at_pickup: { label: "В ПВЗ", variant: "warning" },
  delivered: { label: "Доставлено", variant: "success" },
  cancelled: { label: "Отменено", variant: "default" },
  error: { label: "Ошибка", variant: "danger" },
};

const PROVIDER_LABELS: Record<string, string> = {
  cdek: "СДЭК",
  yandex: "Яндекс",
};

function DeliverySection() {
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
      .catch(() => active && toast.error("Не удалось загрузить статистику доставки"));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminShipments({ status, provider })
      .then((list) => active && setRows(list))
      .catch(() => active && toast.error("Не удалось загрузить отправления"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [status, provider]);

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
      toast.success("Заметка сохранена");
    } catch {
      toast.error("Не удалось сохранить заметку");
    } finally {
      setSavingNote(false);
    }
  };

  const statCards = [
    { v: String(stats?.shipmentsTotal ?? 0), l: "Отправлений", icon: Truck },
    {
      v: `${Math.round((stats?.deliveryRevenueCents ?? 0) / 100).toLocaleString("ru")} ₽`,
      l: "Сумма доставки",
      icon: DollarSign,
    },
    { v: String(stats?.errorsLast7d ?? 0), l: "Ошибок за 7 дней", icon: AlertCircle, warn: (stats?.errorsLast7d ?? 0) > 0 },
    {
      v: stats?.avgDeliveryDays != null ? `${stats.avgDeliveryDays} дн.` : "—",
      l: "Средний срок",
      icon: BarChart3,
    },
  ];

  return (
    <div>
      <H>Доставки (СДЭК / Яндекс)</H>

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
          По провайдерам:{" "}
          {Object.entries(stats.shipmentsByProvider).map(([p, n]) => (
            <span key={p} style={{ marginRight: "12px" }}>
              <strong style={{ color: "var(--foreground)" }}>{PROVIDER_LABELS[p] ?? p}</strong>: {n}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">Все статусы</option>
          {Object.entries(SHIPMENT_STATUS_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">Все провайдеры</option>
          <option value="cdek">СДЭК</option>
          <option value="yandex">Яндекс</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "860px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {["Объявление", "Провайдер", "Статус", "Трек", "Стоимость", "Создано", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>Загрузка…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)" }}>
                    <Truck size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
                    Отправлений пока нет
                  </td>
                </tr>
              ) : rows.map((row) => {
                const meta = SHIPMENT_STATUS_META[row.status] ?? { label: row.status, variant: "default" as const };
                return (
                  <tr key={row.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500, maxWidth: "220px" }}>{row.listingTitle}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{PROVIDER_LABELS[row.provider] ?? row.provider}</td>
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
                        Детали
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
            <button type="button" onClick={() => setSelected(null)} style={{ ...inputStyle, height: "32px", padding: "0 12px" }}>Закрыть</button>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: "12px", marginTop: "16px", fontSize: "13px" }}>
            <div><span style={{ color: "var(--foreground-50)" }}>Провайдер:</span> {PROVIDER_LABELS[selected.provider] ?? selected.provider}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>Статус:</span> {SHIPMENT_STATUS_META[selected.status]?.label ?? selected.status}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>Трек:</span> {selected.trackingNumber ?? "—"}</div>
            <div><span style={{ color: "var(--foreground-50)" }}>External ID:</span> {selected.externalId ?? "—"}</div>
          </div>

          {selected.errorMessage && (
            <div style={{ marginTop: "12px", padding: "12px", borderRadius: "var(--r-card-sm)", background: "var(--danger-soft)", color: "var(--danger)", fontSize: "13px" }}>
              {selected.errorMessage}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "6px" }}>
              Заметка администратора
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
              placeholder="Внутренняя заметка по отправлению…"
            />
            <button type="button" disabled={savingNote} onClick={() => void saveNote()} style={{ ...primaryBtn, marginTop: "8px" }}>
              {savingNote ? "Сохранение…" : "Сохранить заметку"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ MODERATION ============ */
function ModerationSection() {
  const [queue, setQueue] = useState<ModerationItem[]>([]);

  useEffect(() => {
    let active = true;
    fetchModerationQueue("pending").then((q) => active && setQueue(q)).catch(() => {});
    return () => { active = false; };
  }, []);

  const postQueue = queue.filter((q) => q.type === "posts");
  const communityQueue = queue.filter((q) => q.type === "communities");

  const decide = async (item: ModerationItem, ok: boolean) => {
    try {
      if (ok) await approveModeration(item.type, item.targetId);
      else await rejectModeration(item.type, item.targetId);
      setQueue((q) => q.filter((x) => x.id !== item.id));
      ok ? toast.success("Одобрено") : toast.error("Отклонено");
    } catch {
      toast.error("Не удалось выполнить действие");
    }
  };

  return (
    <div>
      <H>Модерация</H>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "16px" }}>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>
            Публикации на модерации ({postQueue.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {postQueue.map((p) => (
                <ModerationCard
                  key={p.id}
                  title={p.title}
                  author={p.author}
                  category={p.category}
                  onApprove={() => decide(p, true)}
                  onReject={() => decide(p, false)}
                />
              ))}
            </AnimatePresence>
            {postQueue.length === 0 && <EmptyQueue label="Нет постов на модерации" />}
          </div>
        </div>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>
            Сообщества на модерации ({communityQueue.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {communityQueue.map((c) => (
                <ModerationCard
                  key={c.id}
                  title={c.title}
                  author={c.author}
                  category={c.category}
                  onApprove={() => decide(c, true)}
                  onReject={() => decide(c, false)}
                />
              ))}
            </AnimatePresence>
            {communityQueue.length === 0 && <EmptyQueue label="Нет сообществ на модерации" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
      <ShieldCheck size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
      {label}
    </div>
  );
}

function ModerationCard({ title, author, category, onApprove, onReject }: { title: string; author: string; category: string; onApprove: () => void; onReject: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3 }}
      style={{ ...card, padding: "16px", overflow: "hidden" }}
    >
      <div style={{ fontWeight: 500, fontSize: "15px", color: "var(--foreground)" }}>{title}</div>
      <div className="flex items-center gap-[8px] mt-[6px]">
        <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{author}</span>
        <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "var(--r-tag)", background: "var(--accent-soft)", color: "var(--accent)" }}>
          {category}
        </span>
      </div>
      <div className="flex gap-[8px]" style={{ marginTop: "12px" }}>
        <button onClick={onApprove} style={{ height: "36px", padding: "0 16px", background: "var(--success)", color: "#fff", fontWeight: 600, fontSize: "12px", borderRadius: "var(--r-button)" }}>Одобрить</button>
        <button onClick={onReject} style={{ height: "36px", padding: "0 16px", background: "var(--error)", color: "#fff", fontWeight: 600, fontSize: "12px", borderRadius: "var(--r-button)" }}>Отклонить</button>
        <button style={{ height: "36px", padding: "0 16px", background: "transparent", border: "1px solid var(--border)", color: "var(--foreground-70)", fontWeight: 500, fontSize: "12px", borderRadius: "var(--r-button)" }} onClick={() => toast.info("Открыть детали")}>Открыть</button>
      </div>
    </motion.div>
  );
}

/* ============ FEEDBACK (Книга жалоб) ============ */
const FEEDBACK_FILTERS: { id: FeedbackStatus | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "read", label: "Прочитано" },
  { id: "resolved", label: "Решено" },
];

const FEEDBACK_STATUS_META: Record<FeedbackStatus, { label: string; bg: string; color: string }> = {
  new: { label: "Новое", bg: "var(--accent-soft)", color: "var(--accent)" },
  read: { label: "Прочитано", bg: "var(--background-subtle)", color: "var(--foreground-70)" },
  resolved: { label: "Решено", bg: "color-mix(in oklab, var(--success) 18%, transparent)", color: "var(--success)" },
};

function FeedbackSection() {
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminFeedback(filter === "all" ? undefined : filter)
      .then((rows) => active && setItems(rows))
      .catch(() => active && toast.error("Не удалось загрузить обращения"))
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
      toast.error("Не удалось обновить статус");
    }
  };

  return (
    <div>
      <H>Книга замечаний и предложений</H>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {FEEDBACK_FILTERS.map((f) => (
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
          Загрузка…
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
          <Inbox size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
          Обращений пока нет
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((row) => {
            const meta = FEEDBACK_STATUS_META[row.status];
            return (
              <div key={row.id} style={{ ...card, padding: "16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-[8px]">
                  <div className="flex items-center gap-[8px]">
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>
                      {row.subject || "Без темы"}
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
                        Прочитано
                      </button>
                    )}
                    {row.status !== "resolved" && (
                      <button onClick={() => setStatus(row, "resolved")} style={feedbackBtn("var(--success)", "#fff")}>
                        Решено
                      </button>
                    )}
                    {row.status !== "new" && (
                      <button onClick={() => setStatus(row, "new")} style={feedbackBtn("transparent", "var(--foreground-70)")}>
                        В новые
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
  const [editedTariffs, setEditedTariffs] = useState<Tariff[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [bannerList, setBannerList] = useState<Banner[]>([]);

  const reloadPromos = () => fetchAdminPromocodes().then(setPromos).catch(() => {});

  useEffect(() => {
    let active = true;
    fetchAdminPlans().then((p) => active && setEditedTariffs(p)).catch(() => {});
    fetchAdminPromocodes().then((p) => active && setPromos(p)).catch(() => {});
    fetchAdminBanners().then((b) => active && setBannerList(b)).catch(() => {});
    return () => { active = false; };
  }, []);

  const saveTariffs = async () => {
    try {
      await Promise.all(
        editedTariffs.map((t) =>
          updateAdminPlan(t.id, {
            name: t.name,
            price_cents: Math.round(t.price * 100),
            period_days: parseInt(t.period, 10) || undefined,
          }),
        ),
      );
      toast.success("Тарифы сохранены");
    } catch {
      toast.error("Не удалось сохранить тарифы");
    }
  };

  const updateBanner = (id: string, patch: Partial<Banner>) => {
    setBannerList((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const removeBanner = async (id: string) => {
    try {
      await deleteAdminBanner(id);
      setBannerList((prev) => prev.filter((b) => b.id !== id));
      toast.success("Баннер удалён");
    } catch {
      toast.error("Не удалось удалить баннер");
    }
  };
  const saveBanners = async () => {
    try {
      await Promise.all(
        bannerList.map((b) =>
          updateAdminBanner(b.id, {
            title: b.title,
            text: b.text,
            starts_at: b.scheduleFrom || null,
            ends_at: b.scheduleTo || null,
            is_active: b.active ?? true,
          }),
        ),
      );
      toast.success("Настройки баннеров сохранены");
    } catch {
      toast.error("Не удалось сохранить баннеры");
    }
  };
  const sortedBanners = [...bannerList].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });


  return (
    <div>
      <H>Монетизация</H>

      {/* Tariffs */}
      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>Управление тарифами</h4>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "12px", marginTop: "12px" }}>
          {editedTariffs.map((t, i) => (
            <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-card-sm)", padding: "12px" }}>
              <input
                value={t.name}
                onChange={(e) => setEditedTariffs((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="w-full outline-none"
                style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)", background: "transparent", border: "none", padding: 0 }}
              />
              <input
                type="number"
                value={t.price}
                onChange={(e) => setEditedTariffs((p) => p.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))}
                className="w-full outline-none"
                style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)", background: "transparent", border: "none", padding: "4px 0", fontFamily: "var(--font-display)" }}
              />
              <input
                value={t.period}
                onChange={(e) => setEditedTariffs((p) => p.map((x, j) => j === i ? { ...x, period: e.target.value } : x))}
                className="w-full outline-none"
                style={{ fontSize: "12px", color: "var(--foreground-50)", background: "transparent", border: "none", padding: 0 }}
              />
            </div>
          ))}
        </div>
        <button onClick={saveTariffs} style={{ ...primaryBtn, marginTop: "12px" }}>Сохранить тарифы</button>
      </div>

      {/* Promocodes */}
      <PromoCodesBlock promos={promos} setPromos={setPromos} reload={reloadPromos} />


      {/* Banners */}
      <div style={{ ...card, padding: "20px" }}>
        <div className="flex items-center justify-between flex-wrap gap-[8px]">
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>Рекламные баннеры</h4>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>Приоритет, закрепление и расписание показа</span>
        </div>
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "var(--r-card)",
            height: "100px",
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            gap: "6px",
          }}
        >
          <Upload size={26} style={{ color: "var(--foreground-30)" }} />
          <span style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузить новый баннер</span>
        </div>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {sortedBanners.map((b) => (
            <div
              key={b.id}
              style={{
                padding: "14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
                background: b.pinned ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div className="flex items-start justify-between gap-[12px]">
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>{b.title}</div>
                  <div style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: 2 }}>{b.text}</div>
                </div>
                <IconBtn danger onClick={() => removeBanner(b.id)}><Trash2 size={14} /></IconBtn>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto_auto]"
                style={{ gap: "10px", marginTop: "12px", alignItems: "end" }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Приоритет</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={b.priority ?? 0}
                    onChange={(e) => updateBanner(b.id, { priority: Math.max(0, Math.min(100, +e.target.value || 0)) })}
                    className="outline-none"
                    style={{ ...inputStyle, height: 36 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Показывать с</span>
                  <input
                    type="date"
                    value={b.scheduleFrom ?? ""}
                    onChange={(e) => updateBanner(b.id, { scheduleFrom: e.target.value })}
                    className="outline-none"
                    style={{ ...inputStyle, height: 36 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Показывать по</span>
                  <input
                    type="date"
                    value={b.scheduleTo ?? ""}
                    onChange={(e) => updateBanner(b.id, { scheduleTo: e.target.value })}
                    className="outline-none"
                    style={{ ...inputStyle, height: 36 }}
                  />
                </label>
                <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
                  <input
                    type="checkbox"
                    checked={!!b.pinned}
                    onChange={(e) => updateBanner(b.id, { pinned: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Закрепить</span>
                </label>
                <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
                  <input
                    type="checkbox"
                    checked={b.active ?? true}
                    onChange={(e) => updateBanner(b.id, { active: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать</span>
                </label>
              </div>
            </div>
          ))}
          {sortedBanners.length === 0 && (
            <div style={{ padding: "24px 12px", textAlign: "center", fontSize: "13px", color: "var(--foreground-50)" }}>
              Нет активных баннеров
            </div>
          )}
        </div>
        <button
          onClick={saveBanners}
          style={{ ...primaryBtn, marginTop: "14px" }}
        >
          Сохранить баннеры
        </button>
      </div>
    </div>
  );
}

/* ============ CATEGORIES ============ */
const CATEGORY_KINDS: { id: CategoryKind; label: string }[] = [
  { id: "post", label: "Посты" },
  { id: "community", label: "Сообщества" },
  { id: "listing", label: "Объявления" },
];

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
  const [kind, setKind] = useState<CategoryKind>("post");
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const load = (k: CategoryKind) => {
    setLoading(true);
    fetchAdminCategories(k)
      .then(setItems)
      .catch(() => toast.error("Не удалось загрузить категории"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(kind); }, [kind]);

  const roots = useMemo(() => items.filter((c) => c.parentId === null), [items]);
  const childrenOf = (id: number) => items.filter((c) => c.parentId === id);

  const addRoot = async () => {
    const name = window.prompt("Название категории")?.trim();
    if (!name) return;
    const slug = window.prompt("Slug (латиницей)", slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, { name, slug, sortOrder: roots.length });
      setItems((p) => [...p, created]);
      toast.success("Категория добавлена");
    } catch { toast.error("Не удалось создать категорию (возможно, slug занят)"); }
  };

  const addSub = async (parent: AdminCategory) => {
    const name = window.prompt(`Подкатегория в «${parent.name}»`)?.trim();
    if (!name) return;
    const slug = window.prompt("Slug (латиницей)", slugify(name))?.trim();
    if (!slug) return;
    try {
      const created = await createAdminCategory(kind, {
        name, slug, parentId: parent.id, sortOrder: childrenOf(parent.id).length,
      });
      setItems((p) => [...p, created]);
      setOpen((p) => ({ ...p, [parent.id]: true }));
      toast.success("Подкатегория добавлена");
    } catch { toast.error("Не удалось создать подкатегорию"); }
  };

  const edit = async (c: AdminCategory) => {
    const name = window.prompt("Название", c.name)?.trim();
    if (!name) return;
    const slug = window.prompt("Slug", c.slug)?.trim();
    if (!slug) return;
    try {
      const updated = await updateAdminCategory(kind, c.id, {
        name, slug, parentId: c.parentId, icon: c.icon, sortOrder: c.sortOrder, isActive: c.isActive,
      });
      setItems((p) => p.map((x) => (x.id === c.id ? updated : x)));
      toast.success("Сохранено");
    } catch { toast.error("Не удалось обновить категорию"); }
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(`Удалить «${c.name}»?`)) return;
    try {
      await deleteAdminCategory(kind, c.id);
      setItems((p) => p.filter((x) => x.id !== c.id && x.parentId !== c.id));
      toast.success("Удалено");
    } catch { toast.error("Не удалось удалить категорию"); }
  };

  return (
    <div>
      <H
        action={
          <button style={{ ...primaryBtn }} onClick={addRoot}>
            <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />Добавить
          </button>
        }
      >
        Категории
      </H>

      <div className="flex gap-[6px]" style={{ marginBottom: "12px" }}>
        {CATEGORY_KINDS.map((k) => (
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
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : roots.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Категорий пока нет</p>
        ) : (
          roots.map((c) => {
            const subs = childrenOf(c.id);
            return (
              <div key={c.id} style={{ marginBottom: "4px" }}>
                <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
                  <button onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="flex items-center gap-[8px] flex-1">
                    <motion.span animate={{ rotate: open[c.id] ? 90 : 0 }} style={{ display: "inline-block", color: "var(--foreground-50)", fontSize: "10px" }}>▶</motion.span>
                    <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c.name}</span>
                    {!c.isActive && <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>(скрыта)</span>}
                    {subs.length > 0 && <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>({subs.length})</span>}
                  </button>
                  <div className="flex gap-[4px]">
                    <IconBtn onClick={() => addSub(c)}><Plus size={14} /></IconBtn>
                    <IconBtn onClick={() => edit(c)}><Pencil size={14} /></IconBtn>
                    <IconBtn danger onClick={() => remove(c)}><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
                <AnimatePresence>
                  {open[c.id] && subs.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden", borderLeft: "1px solid var(--border)", marginLeft: "8px", paddingLeft: "16px" }}
                    >
                      {subs.map((s) => (
                        <div key={s.id} className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                          <span style={{ fontSize: "14px", color: "var(--foreground-70)" }}>{s.name}</span>
                          <div className="flex gap-[4px]">
                            <IconBtn onClick={() => edit(s)}><Pencil size={14} /></IconBtn>
                            <IconBtn danger onClick={() => remove(s)}><Trash2 size={14} /></IconBtn>
                          </div>
                        </div>
                      ))}
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast.error("Введите заголовок");
    if (!window.confirm("Отправить уведомление всем активным пользователям?")) return;
    setSending(true);
    try {
      const sent = await broadcastNotification({
        title: title.trim(),
        body: body.trim() || undefined,
        link: link.trim() || undefined,
      });
      toast.success(`Отправлено получателям: ${sent}`);
      setTitle(""); setBody(""); setLink("");
    } catch {
      toast.error("Не удалось отправить рассылку");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <H>Уведомления</H>
      <div style={{ ...card, padding: "20px", maxWidth: "640px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          Рассылка в приложении
        </h4>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          Уведомление получат все активные пользователи. Оно появится в колокольчике и на странице «Уведомления».
        </p>
        <div className="space-y-[12px]">
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>Заголовок *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Например: Новое мероприятие в эти выходные" className="outline-none" style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>Текст</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} placeholder="Подробности (необязательно)" className="outline-none" style={{ ...inputStyle, width: "100%", height: "auto", padding: "10px 12px", marginTop: 4, resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>Ссылка внутри приложения</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={255} placeholder="/feed" className="outline-none" style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
        </div>
        <button
          onClick={send}
          disabled={sending}
          className="inline-flex items-center gap-[8px]"
          style={{ ...primaryBtn, height: "44px", padding: "0 24px", fontSize: "14px", marginTop: "16px", opacity: sending ? 0.7 : 1 }}
        >
          <Send size={15} /> {sending ? "Отправляем…" : "Отправить всем"}
        </button>
      </div>
    </div>
  );
}

/* ============ ANALYTICS ============ */
function AnalyticsSection() {
  const charts = [
    "DAU / MAU (Daily/Monthly Active Users)",
    "Доход по месяцам",
    "Объявления: создано / продано",
    "Топ категорий по активности",
    "Конверсия в подписку",
    "География пользователей",
  ];
  return (
    <div>
      <H>Аналитика</H>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
        {charts.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            style={{ ...card, padding: "20px" }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c}</div>
            <div style={{ height: "180px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <BarChart3 size={32} style={{ color: "var(--foreground-15)" }} />
              <div style={{ fontSize: "13px", color: "var(--foreground-30)", textAlign: "center", maxWidth: "240px" }}>
                График будет доступен после подключения аналитики
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============ REVIEWS (videos) ============ */
function ReviewsSection() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchVideos({})
      .then(setVideos)
      .catch(() => toast.error("Не удалось загрузить обзоры"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleFeatured = async (id: string, on: boolean) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, isFeatured: on } : v)));
    try { await setVideoFeatured(id, on); } catch { toast.error("Не удалось обновить"); load(); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Удалить обзор?")) return;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    try { await deleteVideo(id); toast.success("Обзор удалён"); } catch { toast.error("Не удалось удалить"); load(); }
  };

  return (
    <div>
      <H action={<Link to="/reviews/upload" className="text-[13px]" style={{ color: "var(--accent)" }}>+ Загрузить обзор</Link>}>Обзоры</H>
      <div style={{ ...card, padding: "16px" }}>
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : videos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Обзоров пока нет</p>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-[12px] py-[8px]" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--foreground)" }}>{v.title}</span>
                <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{v.views.toLocaleString("ru")} просм.</span>
                <label className="flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
                  <input type="checkbox" checked={v.isFeatured} onChange={(e) => toggleFeatured(v.id, e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                  Промо
                </label>
                <button type="button" onClick={() => remove(v.id)} className="text-[12px]" style={{ color: "var(--danger)" }}>Удалить</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ SETTINGS ============ */
function SettingsSection() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminSettings()
      .then((rows) => {
        setSettings(rows);
        const d: Record<string, string> = {};
        for (const s of rows) {
          d[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value, null, 2);
        }
        setDrafts(d);
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const next: AdminSetting[] = [];
    for (const s of settings) {
      const raw = drafts[s.key] ?? "";
      let value: unknown = raw;
      const trimmed = raw.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          value = JSON.parse(trimmed);
        } catch {
          toast.error(`Некорректный JSON в «${s.key}»`);
          return;
        }
      }
      next.push({ key: s.key, value, group: s.group });
    }
    setSaving(true);
    try {
      const updated = await updateAdminSettings(next);
      setSettings(updated);
      toast.success("Настройки сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const s of settings) {
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return Array.from(map.entries());
  }, [settings]);

  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");
  const marketEnabled = useFeatureFlag("marketEnabled");
  const [savingMarket, setSavingMarket] = useState(false);
  const escrowEnabled = useFeatureFlag("escrowEnabled");
  const [savingEscrow, setSavingEscrow] = useState(false);

  const toggleMarket = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("marketEnabled", checked);
      toast("В демо-режиме флаг сохраняется только локально, без реального сервера");
      return;
    }
    setSavingMarket(true);
    try {
      await updateAdminSettings([{ key: "feature.market_enabled", value: { enabled: checked }, group: "feature" }]);
      setFeatureFlag("marketEnabled", checked);
      toast.success(checked ? "Кнопка «Маркет» включена для всех" : "Кнопка «Маркет» отключена для всех");
    } catch {
      toast.error("Не удалось сохранить настройку");
    } finally {
      setSavingMarket(false);
    }
  };

  const toggleEscrow = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("escrowEnabled", checked);
      toast("В демо-режиме флаг сохраняется только локально, без реального сервера");
      return;
    }
    setSavingEscrow(true);
    try {
      await updateAdminSettings([{ key: "feature.escrow_enabled", value: { enabled: checked }, group: "feature" }]);
      setFeatureFlag("escrowEnabled", checked);
      toast.success(checked ? "Бейдж «Безопасная сделка» включён для всех" : "Бейдж «Безопасная сделка» отключён для всех");
    } catch {
      toast.error("Не удалось сохранить настройку");
    } finally {
      setSavingEscrow(false);
    }
  };

  return (
    <div>
      <H>Настройки</H>

      {/* Client-only feature flags — see backend-endpoints-needed.md #17 for
          the persistent server-side version once it exists. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          Feature flags (демо)
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          Хранятся локально в браузере (localStorage), не синхронизируются между устройствами.
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input
            type="checkbox"
            checked={communitiesEnabled}
            onChange={(e) => setFeatureFlag("communitiesEnabled", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать раздел «Сообщества»</span>
        </label>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36 }}>
          <input
            type="checkbox"
            checked={reviewsEnabled}
            onChange={(e) => setFeatureFlag("reviewsEnabled", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать раздел «Обзоры»</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.market_enabled via the same
          /admin/settings endpoint below) — unlike the flags above, this one
          actually changes what every visitor sees, not just this browser. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          Кнопка «Маркет»
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          Сохраняется на сервере — включает/выключает кнопку для всех пользователей сразу, без деплоя фронта.
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingMarket ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={marketEnabled}
            disabled={savingMarket}
            onChange={(e) => void toggleMarket(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать кнопку «Маркет»</span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.escrow_enabled). Off by
          default — turn on only once ЮKassa Безопасная сделка is live on the
          backend, so the escrow badge never promises an unimplemented feature. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "4px" }}>
          Бейдж «Безопасная сделка»
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          Сохраняется на сервере — показывает бейдж «Безопасная сделка / эскроу» на объявлениях для всех сразу, без деплоя. Включать только когда ЮKassa Безопасная сделка реально подключена на бэке.
        </p>
        <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 36, opacity: savingEscrow ? 0.6 : 1 }}>
          <input
            type="checkbox"
            checked={escrowEnabled}
            disabled={savingEscrow}
            onChange={(e) => void toggleEscrow(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>Показывать бейдж «Безопасная сделка»</span>
        </label>
      </div>

      <div style={{ ...card, padding: "24px", maxWidth: "640px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "16px" }}>
          Системные настройки платформы
        </h4>

        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : settings.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Настроек пока нет</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {groups.map(([group, rows]) => (
              <div key={group}>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--foreground-50)", marginBottom: "10px" }}>
                  {group}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {rows.map((s) => {
                    const multiline = (drafts[s.key] ?? "").includes("\n");
                    return (
                      <label key={s.key} style={{ display: "grid", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>{s.key}</span>
                        {multiline ? (
                          <textarea
                            value={drafts[s.key] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))}
                            rows={Math.min(8, (drafts[s.key] ?? "").split("\n").length + 1)}
                            className="outline-none"
                            style={{
                              background: "var(--background)",
                              border: "1.5px solid var(--border)",
                              borderRadius: "var(--r-input)",
                              padding: "10px 14px",
                              fontSize: "13px",
                              fontFamily: "var(--font-mono)",
                              color: "var(--foreground)",
                              resize: "vertical",
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={drafts[s.key] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))}
                            className="outline-none"
                            style={{
                              height: "40px",
                              background: "var(--background)",
                              border: "1.5px solid var(--border)",
                              borderRadius: "var(--r-input)",
                              padding: "0 14px",
                              fontSize: "13px",
                              color: "var(--foreground)",
                            }}
                          />
                        )}
                      </label>
                    );
                  })}
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
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

/* ============ AUDIT LOG ============ */
function AuditLogSection() {
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
      return <p style={{ fontSize: 12, color: "var(--foreground-50)" }}>Нет данных об изменении.</p>;
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
      <H>История изменений</H>
      <div className="flex flex-wrap" style={{ gap: "12px", marginBottom: "16px" }}>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">Все пользователи</option>
          {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">Все действия</option>
          {actionPrefixOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>Нет записей.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "var(--background-surface)" }}>
                  {["Кто", "Когда", "Действие", "Сущность"].map((h) => (
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
          ← Назад
        </button>
        <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>Страница {page} из {lastPage}</span>
        <button
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page >= lastPage}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: "var(--r-card-sm)", border: "1px solid var(--border)", color: "var(--foreground-70)", opacity: page >= lastPage ? 0.5 : 1 }}
        >
          Вперёд →
        </button>
      </div>
    </div>
  );
}

/* ============ PROMO CODES BLOCK ============ */
function PromoCodesBlock({ promos, setPromos, reload }: { promos: PromoCode[]; setPromos: React.Dispatch<React.SetStateAction<PromoCode[]>>; reload?: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [form, setForm] = useState({ code: "", discount: 10, expiresAt: "", limit: 100 });

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
    if (!form.code.trim()) return toast.error("Введите название");
    if (!form.expiresAt) return toast.error("Укажите срок действия");
    if (form.discount < 1 || form.discount > 100) return toast.error("Скидка от 1 до 100%");
    if (form.limit < 1) return toast.error("Лимит должен быть больше 0");
    try {
      await createPromocode({
        code: form.code.toUpperCase(),
        value: form.discount,
        max_usages: form.limit,
        valid_until: form.expiresAt,
      });
      setForm({ code: "", discount: 10, expiresAt: "", limit: 100 });
      setOpen(false);
      reload?.();
      toast.success("Промокод создан");
    } catch {
      toast.error("Не удалось создать промокод");
    }
  };

  return (
    <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
      <div className="flex items-center justify-between flex-wrap gap-[12px]">
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>Промокоды</h4>
        <button onClick={() => setOpen((v) => !v)} style={primaryBtn}>
          <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />Создать промокод
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
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>Название</span>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER2026" className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>Скидка, %</span>
                  <input type="number" min={1} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>Срок действия</span>
                  <input type="date" required value={form.expiresAt} min={today} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>Лимит использований</span>
                  <input type="number" min={1} value={form.limit} onChange={(e) => setForm({ ...form, limit: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
              </div>
              <div className="flex gap-[8px]" style={{ marginTop: "12px" }}>
                <button onClick={create} style={primaryBtn}>Создать</button>
                <button onClick={() => setOpen(false)} style={{ ...primaryBtn, background: "transparent", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>Отмена</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center" style={{ gap: "8px", marginTop: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--foreground-50)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по коду…" className="w-full outline-none" style={{ ...inputStyle, paddingLeft: "34px" }} />
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
              {f === "all" ? "Все" : f === "active" ? "Активные" : "Истекшие"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: "12px", overflowX: "auto" }}>
        <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
          <thead>
            <tr style={{ background: "var(--background-surface)" }}>
              {["Код", "Скидка", "Использовано", "Срок", "Статус", ""].map((h) => (
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
                    {p.status === "active" ? "Активен" : "Истёк"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <IconBtn danger onClick={async () => {
                    try {
                      await deletePromocode(p.code);
                      setPromos((q) => q.filter((x) => x.id !== p.id));
                      toast.success("Промокод удалён");
                    } catch {
                      toast.error("Не удалось удалить промокод");
                    }
                  }}><Trash2 size={14} /></IconBtn>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--foreground-50)" }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicationsSection() {
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

  const STATUSES: { id: RequestStatus; label: string }[] = [
    { id: "pending", label: "Новые" },
    { id: "approved", label: "Одобрены" },
    { id: "rejected", label: "Отклонены" },
  ];

  const KIND_LABEL: Record<EntityKind, string> = { channel: "Канал", community: "Сообщество" };

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "18px", color: "var(--foreground)", marginBottom: "12px" }}>
        Заявки на создание
      </h3>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {STATUSES.map((s) => (
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
        <div style={{ color: "var(--foreground-50)", fontSize: "13px" }}>Загрузка…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "12px" }}>
          Заявок нет
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", background: "var(--background-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {KIND_LABEL[r.kind]}
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
                <p style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "12px" }}>{r.description}</p>
              )}
              {status === "pending" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button" onClick={() => decide(r, true)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "var(--accent-foreground)", border: "none" }}
                  >
                    Одобрить
                  </button>
                  <button
                    type="button" onClick={() => decide(r, false)}
                    style={{ flex: 1, height: "38px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--background-surface)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}
                  >
                    Отклонить
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
