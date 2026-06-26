import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Newspaper, Megaphone, ShieldCheck, DollarSign, FolderTree,
  Bell, BarChart3, Settings, Home, Eye, Ban, Check, X, Plus, Trash2, Pencil, Send,
  Upload, UserPlus, Palette, Sun, Moon, CheckCircle2, AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import {
  adminStats, adminActions, adminUsers, promoCodes as initialPromos,
  ads, posts, categories, tariffs, banners as initialBanners,
  type AdminUser, type PromoCode, type Banner,
} from "@/lib/mock";
import { Search, Filter, Calendar, Tag } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: tStatic("admin.metaTitle") }] }),
  component: AdminPage,
});

type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation"
  | "monetization" | "categories" | "notifications" | "analytics" | "design" | "settings";

const navItems: { id: Section; labelKey: string; icon: typeof Users }[] = [
  { id: "dashboard", labelKey: "admin.dashboard", icon: LayoutDashboard },
  { id: "users", labelKey: "admin.users", icon: Users },
  { id: "content", labelKey: "admin.content", icon: Newspaper },
  { id: "ads", labelKey: "admin.ads", icon: Megaphone },
  { id: "moderation", labelKey: "admin.moderation", icon: ShieldCheck },
  { id: "monetization", labelKey: "admin.monetization", icon: DollarSign },
  { id: "categories", labelKey: "admin.categories", icon: FolderTree },
  { id: "notifications", labelKey: "admin.notifications", icon: Bell },
  { id: "analytics", labelKey: "admin.analytics", icon: BarChart3 },
  { id: "design", labelKey: "admin.design", icon: Palette },
  { id: "settings", labelKey: "admin.settings", icon: Settings },
];

function AdminPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("dashboard");

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
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>{t("nav.admin")}</span>
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
            <Home size={14} />{t("admin.backToSite")}</Link>
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
            {navItems.map((n) => {
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
              {navItems.map((n) => <option key={n.id} value={n.id}>{t(n.labelKey)}</option>)}
            </select>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionView section={section} />
            </motion.div>
          </AnimatePresence>
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
  color: "#fff",
  fontWeight: 600,
  fontSize: "13px",
  borderRadius: "var(--r-button)",
  padding: "0 16px",
  height: "40px",
};

function SectionView({ section }: { section: Section }) {
  if (section === "dashboard") return <Dashboard />;
  if (section === "users") return <UsersSection />;
  if (section === "content") return <ContentSection />;
  if (section === "ads") return <AdsSection />;
  if (section === "moderation") return <ModerationSection />;
  if (section === "monetization") return <MonetizationSection />;
  if (section === "categories") return <CategoriesSection />;
  if (section === "notifications") return <NotificationsSection />;
  if (section === "analytics") return <AnalyticsSection />;
  if (section === "design") return <DesignSystemSection />;
  return <SettingsSection />;
}

// =============================================================
// Design System — admin-only theme switcher (visual sandbox)
// =============================================================
import {
  BASE_ACCENTS, generateVariations, applyTheme, loadTheme,
  type Mode, type AccentSwatch,
} from "@/lib/theme-manager";

function DesignSystemSection() {
  const { t } = useTranslation();
  const initial = loadTheme();
  const [mode, setMode] = useState<Mode>(initial?.mode ?? (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"));
  const [accent, setAccent] = useState<string>(initial?.accent ?? "#F26C05");

  const variations = useMemo(() => generateVariations(accent), [accent]);

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
    setAccent("#F26C05");
    applyTheme({ mode: "dark", accent: "#F26C05" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
          Design System
        </h1>
        <p style={{ fontSize: 13, color: "var(--foreground-70)" }}>
          {t("admin.designDesc")}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", }}>
        <Panel title={t("admin.themeMode")}>
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
              {t("admin.reset")}
            </button>
          </div>
        </Panel>

        <Panel title={t("admin.baseAccents")}>
          <SwatchRow swatches={BASE_ACCENTS} active={accent} onPick={pickAccent} />
        </Panel>

        <Panel title={t("admin.variations")}>
          <SwatchRow swatches={variations} active={accent} onPick={pickAccent} />
        </Panel>
      </div>

      {/* Preview */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginTop: 8 }}>{t("admin.previewComponents")}</h2>
      <PreviewArea />
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
        color: active ? "#fff" : "var(--foreground-70)",
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

function PreviewArea() {
  const { t } = useTranslation();
  const navPreview = [
    { labelKey: "components.breadcrumbsHome", active: true },
    { labelKey: "nav.feed", active: false },
    { labelKey: "nav.channels", active: false },
    { labelKey: "nav.messages", active: false },
  ] as const;
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {/* Buttons */}
      <Panel title={t("admin.buttons")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>{t("admin.btnPrimary")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>{t("admin.btnSoft")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)" }}>{t("admin.btnOutline")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", fontSize: 13, fontWeight: 600 }} disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center" }}><Plus size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Pencil size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}><Trash2 size={16} /></button>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title={t("admin.badges")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge bg="var(--accent)" fg="#fff">PRO</Badge>
          <Badge bg="var(--accent-soft)" fg="var(--accent)">{t("admin.badgeNew")}</Badge>
          <Badge bg="var(--success-soft)" fg="var(--success)">{t("profile.adStatusActive")}</Badge>
          <Badge bg="var(--warning-soft)" fg="var(--warning)">{t("admin.badgeReview")}</Badge>
          <Badge bg="var(--error-soft)" fg="var(--error)">{t("profile.adStatusRejected")}</Badge>
          <Badge bg="var(--info-soft)" fg="var(--info)">{t("admin.badgeInfo")}</Badge>
        </div>
      </Panel>

      {/* Alerts */}
      <Panel title={t("admin.notifications")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Alert icon={<CheckCircle2 size={16} />} bg="var(--success-soft)" fg="var(--success)" text={t("admin.alertSaved")} />
          <Alert icon={<Info size={16} />} bg="var(--info-soft)" fg="var(--info)" text={t("admin.alertHint")} />
          <Alert icon={<AlertCircle size={16} />} bg="var(--error-soft)" fg="var(--error)" text={t("admin.alertError")} />
        </div>
      </Panel>

      {/* Card */}
      <Panel title={t("admin.panelCard")}>
        <div style={{ padding: 14, borderRadius: 12, background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>{t("admin.cardTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--foreground-70)", marginBottom: 10 }}>{t("admin.cardDesc")}</div>
          <a style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{t("admin.cardMore")}</a>
        </div>
      </Panel>

      {/* Inputs */}
      <Panel title={t("admin.inputs")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Email" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder={t("admin.inputActive")} autoFocus style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1.5px solid var(--accent)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
          <textarea placeholder={t("admin.inputMessage")} rows={3} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13, resize: "none" }} />
        </div>
      </Panel>

      {/* Upload */}
      <Panel title={t("admin.fileUpload")}>
        <div style={{ padding: 20, borderRadius: 12, border: "2px dashed var(--border-accent)", background: "var(--accent-soft)", textAlign: "center" }}>
          <Upload size={20} style={{ color: "var(--accent)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--foreground-70)" }}>{t("admin.fileDrop")} <span style={{ color: "var(--accent)", fontWeight: 600 }}>{t("admin.filePick")}</span></div>
        </div>
      </Panel>

      {/* Login form */}
      <Panel title={t("admin.loginForm")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder={t("admin.loginPlaceholder")} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <input placeholder={t("auth.password")} type="password" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--background-input)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>{t("index.heroLogin")}</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground-70)", fontSize: 13, fontWeight: 500, border: "1px solid var(--border)" }}>{t("auth.submitRegister")}</button>
        </div>
      </Panel>

      {/* Nav */}
      <Panel title={t("admin.navigation")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navPreview.map((it) => (
            <div key={it.labelKey} style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13,
              fontWeight: it.active ? 600 : 500,
              color: it.active ? "var(--accent)" : "var(--foreground-70)",
              background: it.active ? "var(--accent-soft)" : "transparent",
            }}>{t(it.labelKey)}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg }}>{children}</span>;
}
function Alert({ icon, bg, fg, text }: { icon: React.ReactNode; bg: string; fg: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: bg, color: fg, fontSize: 13, fontWeight: 500 }}>
      {icon}{text}
    </div>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard() {
  const { t } = useTranslation();
  const stats = [
    { v: adminStats.totalUsers.toLocaleString("ru"), l: t("admin.statTotalUsers"), icon: Users, ch: "+8%", up: true },
    { v: `${adminStats.monthlyRevenue.toLocaleString("ru")} ₽`, l: t("admin.statMonthlyRevenue"), icon: DollarSign, ch: "+15%", up: true },
    { v: adminStats.activeAds.toLocaleString("ru"), l: t("admin.statActiveAds"), icon: Megaphone, ch: "+5%", up: true },
    { v: adminStats.totalPosts.toLocaleString("ru"), l: t("admin.statPosts"), icon: Newspaper, ch: "+22%", up: true },
    { v: String(adminStats.inModeration), l: t("admin.statInModeration"), icon: ShieldCheck, ch: "", up: true, warn: true },
    { v: String(adminStats.newToday), l: t("admin.statNewToday"), icon: UserPlus, ch: "+3%", up: true },
  ];
  const bars = [40, 65, 55, 80, 70, 90, 60];
  const days = [t("admin.dayMon"), t("admin.dayTue"), t("admin.dayWed"), t("admin.dayThu"), t("admin.dayFri"), t("admin.daySat"), t("admin.daySun")];

  return (
    <div>
      <H>{t("admin.dashboard")}</H>
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

      {/* Chart */}
      <div style={{ ...card, padding: "20px", marginTop: "20px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>
          {t("admin.registrations30")}
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
          {t("admin.recentActions")}
        </h4>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
            <tbody>
              {adminActions.map((a) => (
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
    </div>
  );
}

/* ============ USERS ============ */
function UsersSection() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | AdminUser["role"]>("all");
  const [users, setUsers] = useState(adminUsers);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchR = role === "all" || u.role === role;
      return matchQ && matchR;
    });
  }, [users, query, role]);

  const toggle = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const ns = u.status === "active" ? "blocked" : "active";
        toast.success(ns === "blocked" ? t("admin.userBlocked") : t("admin.userUnblocked"));
        return { ...u, status: ns };
      })
    );
  };

  const roleBadge = (r: AdminUser["role"]) => {
    const map = {
      admin: { bg: "var(--accent-soft)", c: "var(--accent)", l: t("admin.roleAdmin") },
      moderator: { bg: "var(--info-soft)", c: "var(--info)", l: t("admin.roleModerator") },
      user: { bg: "var(--background-surface)", c: "var(--foreground-50)", l: t("admin.roleUser") },
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
      <H>{t("admin.users")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.searchUsers")}
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "all" | AdminUser["role"])}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("admin.allRoles")}</option>
          <option value="user">{t("admin.roleUserOpt")}</option>
          <option value="moderator">{t("admin.roleModerator")}</option>
          <option value="admin">{t("admin.roleAdminOpt")}</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "780px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {[t("admin.colName"), t("admin.colEmail"), t("admin.colCity"), t("admin.colSubscription"), t("admin.colRole"), t("admin.colStatus"), t("admin.colActions")].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-[10px]">
                      <img src={u.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "var(--r-pill)" }} />
                      <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.email}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.city}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.subscription ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }}>{roleBadge(u.role)}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={u.status === "active" ? "published" : "rejected"}>
                      {u.status === "active" ? t("admin.statusActive") : t("admin.statusBlocked")}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info(t("admin.viewUser", { name: u.name }))}><Eye size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toggle(u.id)}><Ban size={14} /></IconBtn>
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
function ContentSection() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "moderation" | "rejected">("all");
  const items = posts.slice(0, 8).map((p, i) => ({
    ...p,
    st: (i === 3 || i === 6 ? "moderation" : i === 7 ? "rejected" : "published") as "published" | "moderation" | "rejected",
  }));
  const filtered = items.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || p.title.toLowerCase().includes(q);
    const matchS = status === "all" || p.st === status;
    return matchQ && matchS;
  });

  return (
    <div>
      <H>{t("profile.tabPosts")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.searchTitle")} className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">{t("admin.allStatuses")}</option>
          <option value="published">{t("admin.statusPublished")}</option>
          <option value="moderation">{t("post.onModeration")}</option>
          <option value="rejected">{t("profile.adStatusRejected")}</option>
        </select>
      </div>
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {[t("admin.colTitle"), t("admin.colAuthor"), t("admin.colCategory"), t("admin.colStatus"), t("admin.colActions")].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{p.title}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.authorId}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.category}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={p.st}>
                      {p.st === "published" ? t("admin.statusPublished") : p.st === "moderation" ? t("admin.statusModeration") : t("admin.statusRejected")}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info(t("admin.openPost"))}><Eye size={14} /></IconBtn>
                      <IconBtn success onClick={() => toast.success(t("admin.approved"))}><Check size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toast.error(t("profile.adStatusRejected"))}><X size={14} /></IconBtn>
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

/* ============ ADS ============ */
function AdsSection() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const items = ads.slice(0, 8).map((a, i) => ({
    ...a,
    st: (i < 6 ? "published" : i === 6 ? "moderation" : "rejected") as "published" | "moderation" | "rejected",
  }));
  const filtered = items.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <H>{t("nav.ads")}</H>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.searchTitle")} className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {[t("admin.colTitle"), t("admin.colSeller"), t("admin.colPrice"), t("admin.colCategory"), t("admin.colStatus"), t("admin.colActions")].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{a.title}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.authorId}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>{a.price.toLocaleString("ru")} ₽</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.category}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={a.st}>
                      {a.st === "published" ? t("admin.statusPublished") : a.st === "moderation" ? t("admin.statusModeration") : t("admin.statusRejected")}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info(t("admin.openAd"))}><Eye size={14} /></IconBtn>
                      <IconBtn success onClick={() => toast.success(t("admin.approved"))}><Check size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toast.error(t("profile.adStatusRejected"))}><X size={14} /></IconBtn>
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

/* ============ MODERATION ============ */
function ModerationSection() {
  const { t } = useTranslation();
  const [postQueue, setPostQueue] = useState(posts.slice(0, 2).map((p) => ({ id: p.id, title: p.title, author: p.authorId, category: p.category })));
  const [adQueue, setAdQueue] = useState(ads.slice(0, 1).map((a) => ({ id: a.id, title: a.title, author: a.authorId, category: a.category })));
  const [channelQueue, setChannelQueue] = useState([
    { id: "chp-m1", title: "Обзор нового набора красок Mr.Hobby", author: "Моя мастерская", category: "Канал · Автор" },
    { id: "chp-m2", title: "Скидка 20% на наборы Tamiya — выходные", author: "Tamiya News", category: "Канал · Бренд" },
  ]);

  const removePost = (id: string, ok: boolean) => {
    setPostQueue((q) => q.filter((x) => x.id !== id));
    ok ? toast.success(t("admin.postApproved")) : toast.error(t("admin.postRejected"));
  };
  const removeAd = (id: string, ok: boolean) => {
    setAdQueue((q) => q.filter((x) => x.id !== id));
    ok ? toast.success(t("admin.adApproved")) : toast.error(t("admin.adRejected"));
  };
  const removeChannel = (id: string, ok: boolean) => {
    setChannelQueue((q) => q.filter((x) => x.id !== id));
    ok ? toast.success(t("admin.channelPostApproved")) : toast.error(t("admin.channelPostRejected"));
  };

  return (
    <div>
      <H>{t("admin.moderation")}</H>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "16px" }}>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>
            {t("admin.postsModeration", { n: postQueue.length })}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {postQueue.map((p) => (
                <ModerationCard
                  key={p.id}
                  title={p.title}
                  author={p.author}
                  category={p.category}
                  onApprove={() => removePost(p.id, true)}
                  onReject={() => removePost(p.id, false)}
                />
              ))}
            </AnimatePresence>
            {postQueue.length === 0 && <EmptyQueue label={t("admin.emptyPostsModeration")} />}
          </div>
        </div>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>
            {t("admin.adsModeration", { n: adQueue.length })}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {adQueue.map((a) => (
                <ModerationCard
                  key={a.id}
                  title={a.title}
                  author={a.author}
                  category={a.category}
                  onApprove={() => removeAd(a.id, true)}
                  onReject={() => removeAd(a.id, false)}
                />
              ))}
            </AnimatePresence>
            {adQueue.length === 0 && <EmptyQueue label={t("admin.emptyAdsModeration")} />}
          </div>
        </div>
        <div className="lg:col-span-2">
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>
            {t("admin.channelsModeration", { n: channelQueue.length })}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {channelQueue.map((c) => (
                <ModerationCard
                  key={c.id}
                  title={c.title}
                  author={c.author}
                  category={c.category}
                  onApprove={() => removeChannel(c.id, true)}
                  onReject={() => removeChannel(c.id, false)}
                />
              ))}
            </AnimatePresence>
            {channelQueue.length === 0 && <EmptyQueue label={t("admin.emptyChannelsModeration")} />}
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
  const { t } = useTranslation();
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
        <button onClick={onApprove} style={{ height: "36px", padding: "0 16px", background: "var(--success)", color: "#fff", fontWeight: 600, fontSize: "12px", borderRadius: "var(--r-button)" }}>{t("admin.approve")}</button>
        <button onClick={onReject} style={{ height: "36px", padding: "0 16px", background: "var(--error)", color: "#fff", fontWeight: 600, fontSize: "12px", borderRadius: "var(--r-button)" }}>{t("admin.reject")}</button>
        <button style={{ height: "36px", padding: "0 16px", background: "transparent", border: "1px solid var(--border)", color: "var(--foreground-70)", fontWeight: 500, fontSize: "12px", borderRadius: "var(--r-button)" }} onClick={() => toast.info(t("admin.openDetails"))}>{t("components.categoryCardOpen")}</button>
      </div>
    </motion.div>
  );
}

/* ============ MONETIZATION ============ */
function MonetizationSection() {
  const { t } = useTranslation();
  const [editedTariffs, setEditedTariffs] = useState(tariffs);
  const [promos, setPromos] = useState(initialPromos);
  const [bannerList, setBannerList] = useState<Banner[]>(initialBanners);

  const updateBanner = (id: string, patch: Partial<Banner>) => {
    setBannerList((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const removeBanner = (id: string) => {
    setBannerList((prev) => prev.filter((b) => b.id !== id));
    toast.success(t("admin.bannerDeleted"));
  };
  const sortedBanners = [...bannerList].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });


  return (
    <div>
      <H>{t("admin.monetization")}</H>

      {/* Tariffs */}
      <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("admin.manageTariffs")}</h4>
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
        <button onClick={() => toast.success(t("admin.tariffsSaved"))} style={{ ...primaryBtn, marginTop: "12px" }}>{t("admin.saveTariffs")}</button>
      </div>

      {/* Promocodes */}
      <PromoCodesBlock promos={promos} setPromos={setPromos} />


      {/* Banners */}
      <div style={{ ...card, padding: "20px" }}>
        <div className="flex items-center justify-between flex-wrap gap-[8px]">
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("admin.adBanners")}</h4>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("admin.bannersHint")}</span>
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
          <span style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("admin.uploadBanner")}</span>
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
                className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto]"
                style={{ gap: "10px", marginTop: "12px", alignItems: "end" }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("admin.priority")}</span>
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
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("admin.showFrom")}</span>
                  <input
                    type="date"
                    value={b.scheduleFrom ?? ""}
                    onChange={(e) => updateBanner(b.id, { scheduleFrom: e.target.value })}
                    className="outline-none"
                    style={{ ...inputStyle, height: 36 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("admin.showUntil")}</span>
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
                  <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>{t("admin.pin")}</span>
                </label>
              </div>
            </div>
          ))}
          {sortedBanners.length === 0 && (
            <div style={{ padding: "24px 12px", textAlign: "center", fontSize: "13px", color: "var(--foreground-50)" }}>
              {t("admin.noActiveBanners")}
            </div>
          )}
        </div>
        <button
          onClick={() => toast.success(t("admin.bannersSaved"))}
          style={{ ...primaryBtn, marginTop: "14px" }}
        >
          {t("admin.saveBanners")}
        </button>
      </div>
    </div>
  );
}

/* ============ CATEGORIES ============ */
function CategoriesSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Record<string, boolean>>({ c1: true });
  return (
    <div>
      <H
        action={
          <div className="flex gap-[8px]">
            <button style={{ ...primaryBtn }} onClick={() => toast.success(t("admin.categoryAdded"))}>
              <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />{t("admin.addCategory")}</button>
            <button style={{ ...primaryBtn, background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" }} onClick={() => toast.success(t("admin.orderSaved"))}>
              {t("admin.saveOrder")}
            </button>
          </div>
        }
      >{t("nav.categories")}</H>
      <div style={{ ...card, padding: "16px" }}>
        {categories.map((c) => (
          <div key={c.id} style={{ marginBottom: "4px" }}>
            <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
              <button onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="flex items-center gap-[8px] flex-1">
                <motion.span animate={{ rotate: open[c.id] ? 90 : 0 }} style={{ display: "inline-block", color: "var(--foreground-50)", fontSize: "10px" }}>▶</motion.span>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c.name}</span>
                <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("admin.membersShort", { n: c.members.toLocaleString("ru") })}</span>
              </button>
              <div className="flex gap-[4px]">
                <IconBtn onClick={() => toast.info(t("admin.addSubcategory"))}><Plus size={14} /></IconBtn>
                <IconBtn onClick={() => toast.info(t("profile.edit"))}><Pencil size={14} /></IconBtn>
                <IconBtn danger onClick={() => toast.success(t("admin.deleted"))}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
            <AnimatePresence>
              {open[c.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden", borderLeft: "1px solid var(--border)", marginLeft: "8px", paddingLeft: "16px" }}
                >
                  {c.subcategories.map((s) => (
                    <div key={s.id} className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                      <span style={{ fontSize: "14px", color: "var(--foreground-70)" }}>{s.name}</span>
                      <div className="flex gap-[4px]">
                        <IconBtn onClick={() => toast.info(t("profile.edit"))}><Pencil size={14} /></IconBtn>
                        <IconBtn danger onClick={() => toast.success(t("admin.deleted"))}><Trash2 size={14} /></IconBtn>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ NOTIFICATIONS ============ */
function NotificationsSection() {
  const { t } = useTranslation();
  const emailTpl = [
    ["Приветствие", "Добро пожаловать в МоДелизМ Форум!", "01.06.2026"],
    ["Подтверждение почты", "Подтвердите ваш email", "15.05.2026"],
    ["Сброс пароля", "Восстановление доступа", "10.05.2026"],
    ["Оповещение о модерации", "Ваш пост проверен", "05.06.2026"],
  ];
  const pushTpl = [
    ["Новый пост в ленте", "В ленте новый пост от {{author}}", "20.05.2026"],
    ["Новое сообщение", "{{sender}} написал вам", "18.05.2026"],
    ["Объявление одобрено", "Ваше объявление прошло модерацию", "12.05.2026"],
  ];

  const renderTable = (title: string, rows: string[][]) => (
    <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "12px" }}>{title}</h4>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
          <thead>
            <tr style={{ background: "var(--background-surface)" }}>
              {[t("admin.promoName"), t("admin.colSubject"), t("admin.colChanged"), t("admin.colActions")].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{r[0]}</td>
                <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{r[1]}</td>
                <td style={{ padding: "10px 16px", color: "var(--foreground-30)", fontSize: "12px" }}>{r[2]}</td>
                <td style={{ padding: "10px 16px" }}>
                  <div className="flex gap-[6px]">
                    <IconBtn onClick={() => toast.info(t("profile.edit"))}><Pencil size={14} /></IconBtn>
                    <IconBtn onClick={() => toast.success(t("admin.testNotificationSent"))}><Send size={14} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <H>{t("admin.notifications")}</H>
      {renderTable(t("admin.emailTemplates"), emailTpl)}
      {renderTable(t("admin.pushTemplates"), pushTpl)}
      <button
        onClick={() => toast.success(t("admin.notifyAllSent"))}
        style={{ ...primaryBtn, height: "44px", padding: "0 24px", fontSize: "14px", marginTop: "16px" }}
      >
        {t("admin.sendNotifyAll")}
      </button>
    </div>
  );
}

/* ============ ANALYTICS ============ */
function AnalyticsSection() {
  const { t } = useTranslation();
  const charts = [
    "DAU / MAU (Daily/Monthly Active Users)",
    t("admin.chartRevenue"),
    t("admin.chartAds"),
    t("admin.chartTopCategories"),
    t("admin.chartConversion"),
    t("admin.chartGeo"),
  ];
  return (
    <div>
      <H>{t("admin.analytics")}</H>
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
                {t("admin.chartSoon")}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============ SETTINGS ============ */
function SettingsSection() {
  const { t } = useTranslation();
  const [toggles, setToggles] = useState({ modPosts: true, modAds: true, regOpen: true, emailReq: true });

  const field = (label: string, defaultValue: string, type = "text") => (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-50)" }}>{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
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
    </label>
  );

  const Toggle = ({ label, k }: { label: string; k: keyof typeof toggles }) => (
    <button
      onClick={() => setToggles((p) => ({ ...p, [k]: !p[k] }))}
      className="flex items-center justify-between w-full"
      style={{ padding: "8px 0" }}
    >
      <span style={{ fontSize: "13px", color: "var(--foreground)" }}>{label}</span>
      <div
        style={{
          width: "44px", height: "24px",
          borderRadius: "var(--r-pill)",
          background: toggles[k] ? "var(--accent)" : "var(--background-surface)",
          position: "relative",
          transition: "background 200ms ease",
        }}
      >
        <motion.div
          animate={{ x: toggles[k] ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            width: "20px", height: "20px",
            borderRadius: "var(--r-pill)",
            background: "#fff",
            position: "absolute",
            top: "2px",
            boxShadow: "var(--shadow-card)",
          }}
        />
      </div>
    </button>
  );

  return (
    <div>
      <H>{t("admin.settings")}</H>
      <div style={{ ...card, padding: "24px", maxWidth: "600px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "16px" }}>
          {t("admin.platformSettings")}
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {field(t("admin.fieldProjectName"), "МоДелизМ Форум")}
          {field(t("admin.fieldDomain"), "modelizm-forum.ru")}
          {field(t("admin.fieldSupportEmail"), "support@modelizm-forum.ru")}
          {field(t("admin.fieldYookassa"), "••••••••", "password")}
          {field(t("admin.fieldTbank"), "••••••••", "password")}
          {field(t("admin.fieldSmtpServer"), "smtp.mail.ru")}
          {field(t("admin.fieldSmtpPort"), "587", "number")}
          {field(t("admin.fieldSmtpLogin"), "noreply@modelizm-forum.ru")}
          {field(t("admin.fieldSmtpPassword"), "••••••••", "password")}
        </div>
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <Toggle label={t("admin.toggleModPosts")} k="modPosts" />
          <Toggle label={t("admin.toggleModAds")} k="modAds" />
          <Toggle label={t("admin.toggleRegOpen")} k="regOpen" />
          <Toggle label={t("admin.toggleEmailReq")} k="emailReq" />
        </div>
        <button
          onClick={() => toast.success(t("admin.settingsSaved"))}
          style={{ ...primaryBtn, height: "44px", padding: "0 32px", fontSize: "14px", marginTop: "20px" }}
        >{t("post.save")}</button>
      </div>
    </div>
  );
}

/* ============ PROMO CODES BLOCK ============ */
function PromoCodesBlock({ promos, setPromos }: { promos: PromoCode[]; setPromos: React.Dispatch<React.SetStateAction<PromoCode[]>> }) {
  const { t } = useTranslation();
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

  const create = () => {
    if (!form.code.trim()) return toast.error(t("admin.promoNameRequired"));
    if (!form.expiresAt) return toast.error(t("admin.promoDateRequired"));
    if (form.discount < 1 || form.discount > 100) return toast.error(t("admin.promoDiscountRange"));
    if (form.limit < 1) return toast.error(t("admin.promoLimitMin"));
    const status: "active" | "expired" = form.expiresAt >= today ? "active" : "expired";
    setPromos((p) => [
      ...p,
      { id: String(Date.now()), code: form.code.toUpperCase(), discount: form.discount, usedCount: 0, limit: form.limit, expiresAt: form.expiresAt, status },
    ]);
    setForm({ code: "", discount: 10, expiresAt: "", limit: 100 });
    setOpen(false);
    toast.success(t("admin.promoCreated"));
  };

  return (
    <div style={{ ...card, padding: "20px", marginBottom: "16px" }}>
      <div className="flex items-center justify-between flex-wrap gap-[12px]">
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)" }}>{t("admin.promoCodes")}</h4>
        <button onClick={() => setOpen((v) => !v)} style={primaryBtn}>
          <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />{t("admin.createPromo")}
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
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("admin.promoName")}</span>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER2026" className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("admin.promoDiscount")}</span>
                  <input type="number" min={1} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("admin.promoExpiry")}</span>
                  <input type="date" required value={form.expiresAt} min={today} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="outline-none" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)", fontWeight: 500 }}>{t("admin.promoLimit")}</span>
                  <input type="number" min={1} value={form.limit} onChange={(e) => setForm({ ...form, limit: +e.target.value })} className="outline-none" style={inputStyle} />
                </label>
              </div>
              <div className="flex gap-[8px]" style={{ marginTop: "12px" }}>
                <button onClick={create} style={primaryBtn}>{t("admin.create")}</button>
                <button onClick={() => setOpen(false)} style={{ ...primaryBtn, background: "transparent", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>{t("common.cancel")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center" style={{ gap: "8px", marginTop: "12px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--foreground-50)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchByCode")} className="w-full outline-none" style={{ ...inputStyle, paddingLeft: "34px" }} />
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
              {f === "all" ? t("common.all") : f === "active" ? t("admin.filterActive") : t("admin.filterExpired")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: "12px", overflowX: "auto" }}>
        <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
          <thead>
            <tr style={{ background: "var(--background-surface)" }}>
              {[t("admin.colCode"), t("admin.colDiscount"), t("admin.colUsed"), t("admin.colExpiry"), t("admin.colStatus"), ""].map((h) => (
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
                    borderRadius: 999,
                    background: p.status === "active" ? "var(--success-soft, rgba(34,197,94,0.12))" : "var(--background-surface)",
                    color: p.status === "active" ? "var(--success, #16a34a)" : "var(--foreground-50)",
                  }}>
                    {p.status === "active" ? t("admin.statusActive") : t("admin.promoExpired")}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <IconBtn danger onClick={() => { setPromos((q) => q.filter((x) => x.id !== p.id)); toast.success(t("admin.promoDeleted")); }}><Trash2 size={14} /></IconBtn>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--foreground-50)" }}>{t("admin.nothingFound")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
