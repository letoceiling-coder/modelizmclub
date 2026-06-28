import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  promoCodes as initialPromos,
  ads, posts, categories, tariffs, banners as initialBanners,
  type PromoCode, type Banner,
} from "@/lib/mock";
import { Search, Filter, Calendar, Tag } from "lucide-react";
import {
  fetchDashboard, fetchAuditLogs, fetchAdminUsers, updateAdminUser,
  fetchModerationQueue, approveModeration, rejectModeration,
  fetchAdminPlans, updateAdminPlan,
  fetchAdminPromocodes, createPromocode, deletePromocode,
  fetchAdminBanners, updateAdminBanner, deleteAdminBanner,
  type AdminUserRow, type AuditEntry, type ModerationItem,
} from "@/lib/api/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админ-панель — МоДелизМ Форум" }] }),
  component: AdminPage,
});

type Section =
  | "dashboard" | "users" | "content" | "ads" | "moderation"
  | "monetization" | "categories" | "notifications" | "analytics" | "design" | "settings";

const navItems: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
  { id: "users", label: "Пользователи", icon: Users },
  { id: "content", label: "Контент", icon: Newspaper },
  { id: "ads", label: "Объявления", icon: Megaphone },
  { id: "moderation", label: "Модерация", icon: ShieldCheck },
  { id: "monetization", label: "Монетизация", icon: DollarSign },
  { id: "categories", label: "Категории", icon: FolderTree },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "design", label: "Design System", icon: Palette },
  { id: "settings", label: "Настройки", icon: Settings },
];

function AdminPage() {
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
              {navItems.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
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
          Визуальный конструктор темы. Меняет CSS-переменные глобально, сохраняет в localStorage. Не влияет на логику и данные.
        </p>
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

        <Panel title="Базовые акценты (UI Kit)">
          <SwatchRow swatches={BASE_ACCENTS} active={accent} onPick={pickAccent} />
        </Panel>

        <Panel title="Вариации (5 светлее / 5 темнее)">
          <SwatchRow swatches={variations} active={accent} onPick={pickAccent} />
        </Panel>
      </div>

      {/* Preview */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginTop: 8 }}>Превью компонентов</h2>
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
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {/* Buttons */}
      <Panel title="Кнопки">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>Основная</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Мягкая</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)" }}>Контур</button>
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", fontSize: 13, fontWeight: 600 }} disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center" }}><Plus size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Pencil size={16} /></button>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: "var(--background-surface)", color: "var(--foreground-70)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}><Trash2 size={16} /></button>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title="Бейджи">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge bg="var(--accent)" fg="#fff">PRO</Badge>
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
          <button style={{ padding: "10px 18px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-button)" }}>Войти</button>
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
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetchDashboard().then((d) => active && setData(d)).catch(() => {});
    fetchAuditLogs().then((a) => active && setAudit(a)).catch(() => {});
    return () => { active = false; };
  }, []);

  const stats = [
    { v: (data?.usersTotal ?? 0).toLocaleString("ru"), l: "Всего пользователей", icon: Users, ch: "", up: true },
    { v: (data?.communitiesTotal ?? 0).toLocaleString("ru"), l: "Сообществ", icon: Users, ch: "", up: true },
    { v: (data?.bannersActive ?? 0).toLocaleString("ru"), l: "Активных баннеров", icon: Megaphone, ch: "", up: true },
    { v: (data?.postsTotal ?? 0).toLocaleString("ru"), l: "Публикаций", icon: Newspaper, ch: "", up: true },
    { v: String(data?.moderationPending ?? 0), l: "На модерации", icon: ShieldCheck, ch: "", up: true, warn: true },
    { v: String(data?.reportsPending ?? 0), l: "Жалоб", icon: UserPlus, ch: "", up: true },
  ];
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
    </div>
  );
}

/* ============ USERS ============ */
function UsersSection() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | AdminUserRow["role"]>("all");
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  useEffect(() => {
    let active = true;
    fetchAdminUsers({ role }).then((list) => active && setUsers(list)).catch(() => {});
    return () => { active = false; };
  }, [role]);

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
      admin: { bg: "var(--accent-soft)", c: "var(--accent)", l: "Админ" },
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
          <option value="moderator">Модератор</option>
          <option value="admin">Администратор</option>
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
                  <td style={{ padding: "10px 16px" }}>{roleBadge(u.role)}</td>
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
function ContentSection() {
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
      <H>Публикации</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по заголовку..." className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="outline-none" style={{ ...inputStyle, padding: "0 12px" }}>
          <option value="all">Все статусы</option>
          <option value="published">Опубликовано</option>
          <option value="moderation">На модерации</option>
          <option value="rejected">Отклонено</option>
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
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{p.title}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.authorId}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{p.category}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={p.st}>
                      {p.st === "published" ? "Опубликовано" : p.st === "moderation" ? "На модерации" : "Отклонено"}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info("Открыть пост")}><Eye size={14} /></IconBtn>
                      <IconBtn success onClick={() => toast.success("Одобрено")}><Check size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toast.error("Отклонено")}><X size={14} /></IconBtn>
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
  const [query, setQuery] = useState("");
  const items = ads.slice(0, 8).map((a, i) => ({
    ...a,
    st: (i < 6 ? "published" : i === 6 ? "moderation" : "rejected") as "published" | "moderation" | "rejected",
  }));
  const filtered = items.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <H>Объявления</H>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по заголовку..." className="outline-none" style={{ ...inputStyle, width: "320px", maxWidth: "100%" }} />
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
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{a.title}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.authorId}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>{a.price.toLocaleString("ru")} ₽</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{a.category}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={a.st}>
                      {a.st === "published" ? "Опубликовано" : a.st === "moderation" ? "На модерации" : "Отклонено"}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn onClick={() => toast.info("Открыть объявление")}><Eye size={14} /></IconBtn>
                      <IconBtn success onClick={() => toast.success("Одобрено")}><Check size={14} /></IconBtn>
                      <IconBtn danger onClick={() => toast.error("Отклонено")}><X size={14} /></IconBtn>
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

/* ============ MONETIZATION ============ */
function MonetizationSection() {
  const [editedTariffs, setEditedTariffs] = useState(tariffs);
  const [promos, setPromos] = useState(initialPromos);
  const [bannerList, setBannerList] = useState<Banner[]>(initialBanners);

  const reloadPromos = () => fetchAdminPromocodes().then(setPromos).catch(() => {});

  useEffect(() => {
    let active = true;
    fetchAdminPlans().then((p) => active && p.length && setEditedTariffs(p)).catch(() => {});
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
                className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto]"
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
function CategoriesSection() {
  const [open, setOpen] = useState<Record<string, boolean>>({ c1: true });
  return (
    <div>
      <H
        action={
          <div className="flex gap-[8px]">
            <button style={{ ...primaryBtn }} onClick={() => toast.success("Категория добавлена")}>
              <Plus size={14} style={{ display: "inline", marginRight: "4px" }} />Добавить
            </button>
            <button style={{ ...primaryBtn, background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" }} onClick={() => toast.success("Порядок сохранён")}>
              Сохранить порядок
            </button>
          </div>
        }
      >
        Категории
      </H>
      <div style={{ ...card, padding: "16px" }}>
        {categories.map((c) => (
          <div key={c.id} style={{ marginBottom: "4px" }}>
            <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
              <button onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="flex items-center gap-[8px] flex-1">
                <motion.span animate={{ rotate: open[c.id] ? 90 : 0 }} style={{ display: "inline-block", color: "var(--foreground-50)", fontSize: "10px" }}>▶</motion.span>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--foreground)" }}>{c.name}</span>
                <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>({c.members.toLocaleString("ru")} уч.)</span>
              </button>
              <div className="flex gap-[4px]">
                <IconBtn onClick={() => toast.info("Добавить подкатегорию")}><Plus size={14} /></IconBtn>
                <IconBtn onClick={() => toast.info("Редактировать")}><Pencil size={14} /></IconBtn>
                <IconBtn danger onClick={() => toast.success("Удалено")}><Trash2 size={14} /></IconBtn>
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
                        <IconBtn onClick={() => toast.info("Редактировать")}><Pencil size={14} /></IconBtn>
                        <IconBtn danger onClick={() => toast.success("Удалено")}><Trash2 size={14} /></IconBtn>
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
              {["Название", "Тема", "Изменено", "Действия"].map((h) => (
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
                    <IconBtn onClick={() => toast.info("Редактировать")}><Pencil size={14} /></IconBtn>
                    <IconBtn onClick={() => toast.success("Тестовое уведомление отправлено")}><Send size={14} /></IconBtn>
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
      <H>Уведомления</H>
      {renderTable("Email-шаблоны", emailTpl)}
      {renderTable("Push-шаблоны", pushTpl)}
      <button
        onClick={() => toast.success("Уведомление отправлено всем пользователям")}
        style={{ ...primaryBtn, height: "44px", padding: "0 24px", fontSize: "14px", marginTop: "16px" }}
      >
        Отправить уведомление всем
      </button>
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

/* ============ SETTINGS ============ */
function SettingsSection() {
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
      <H>Настройки</H>
      <div style={{ ...card, padding: "24px", maxWidth: "600px" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "16px" }}>
          Настройки платформы
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {field("Название проекта", "МоДелизМ Форум")}
          {field("Домен", "modelizm-forum.ru")}
          {field("Email поддержки", "support@modelizm-forum.ru")}
          {field("Платёжный ключ ЮKassa (Shop ID)", "••••••••", "password")}
          {field("Платёжный ключ Т-Банк (Terminal Key)", "••••••••", "password")}
          {field("SMTP сервер", "smtp.mail.ru")}
          {field("SMTP порт", "587", "number")}
          {field("SMTP логин", "noreply@modelizm-forum.ru")}
          {field("SMTP пароль", "••••••••", "password")}
        </div>
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <Toggle label="Модерация постов вручную" k="modPosts" />
          <Toggle label="Модерация объявлений вручную" k="modAds" />
          <Toggle label="Регистрация открыта" k="regOpen" />
          <Toggle label="Email-подтверждение обязательно" k="emailReq" />
        </div>
        <button
          onClick={() => toast.success("Настройки сохранены")}
          style={{ ...primaryBtn, height: "44px", padding: "0 32px", fontSize: "14px", marginTop: "20px" }}
        >
          Сохранить
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
                    borderRadius: 999,
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
