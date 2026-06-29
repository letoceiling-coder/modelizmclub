import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User, Briefcase, Car, Plane, Ship, Crosshair, Cpu, Battery, Radio, Bike, Wrench, Check,
  ArrowRight, Crown, Sparkles, Play, UserPlus, LogIn, Eye, PlusCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { fetchStats } from "@/lib/api/content";
import { showcaseImages } from "@/lib/showcase-images";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "МоДелизМ Форум — сообщество моделистов" },
      { name: "description", content: "RC авто, самолёты, квадрокоптеры, корабли, электроника. Сообщество инженеров и энтузиастов в одном пространстве." },
      { property: "og:title", content: "МоДелизМ Форум — моделизм это жизнь" },
      { property: "og:description", content: "Платформа для моделистов: лента, чаты, объявления, сообщества." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

// === Figma UI Kit 2.0 tokens (page-scoped) ===
const T = {
  // Base
  ink: "#12171B",
  inkSoft: "#2B3141",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F5F5",
  line: "#E5E5E5",
  // Accent
  orange: "#F26C05",
  orangeDeep: "#B04C00",
  red: "#A52814",
  redDeep: "#A1001E",
  // Text
  text: "#12171B",
  textMuted: "#5A6470",
  textOnDark: "#FFFFFF",
  // Radius
  rBtn: 10,
  rCard: 16,
  rPill: 999,
  // Shadows
  shadowSm: "0 1px 2px rgba(18,23,27,0.06), 0 1px 3px rgba(18,23,27,0.04)",
  shadowMd: "0 8px 24px -8px rgba(18,23,27,0.12), 0 2px 6px rgba(18,23,27,0.05)",
  shadowOrange: "0 10px 24px -8px rgba(242,108,5,0.45)",
  // Gradients
  gradOrange: "linear-gradient(135deg, #F26C05 0%, #B04C00 100%)",
  gradRed: "linear-gradient(135deg, #A52814 0%, #A1001E 100%)",
  gradDark: "linear-gradient(135deg, #2B3141 0%, #12171B 100%)",
};

const FONT = "'Manrope', system-ui, -apple-system, Segoe UI, sans-serif";
const FONT_DISPLAY = "'Space Grotesk', 'Manrope', system-ui, sans-serif";

const CATEGORIES = [
  { icon: Car, name: "Автомодели", count: "320+ участников" },
  { icon: Plane, name: "Самолёты", count: "180+ участников" },
  { icon: Ship, name: "Корабли", count: "95+ участников" },
  { icon: Crosshair, name: "Квадрокоптеры", count: "240+ участников" },
  { icon: Cpu, name: "Электроника", count: "150+ участников" },
  { icon: Battery, name: "Аккумуляторы", count: "85+ участников" },
  { icon: Radio, name: "Радиоаппаратура", count: "110+ участников" },
  { icon: Bike, name: "Электросамокаты", count: "70+ участников" },
  { icon: Wrench, name: "Запчасти", count: "200+ участников" },
];

const HOBBYIST_FEATURES = [
  "Лента публикаций и проектов",
  "Чаты по категориям и подкатегориям",
  "Объявления о продаже / обмене",
  "Сообщества по интересам",
  "Друзья и личные сообщения",
];

const PRO_FEATURES = [
  "Магазин запчастей и самодельных проектов",
  "Рекламные баннеры и продвижение",
  "Платное размещение объявлений (20 ₽)",
  "Подписка на расширенные возможности",
  "Прямые продажи через платформу",
];

const AVATAR_COLORS = ["#F26C05", "#2B3141", "#A52814", "#B04C00", "#12171B", "#A1001E", "#F26C05", "#2B3141"];
const AVATAR_INITIALS = ["АК", "МП", "ИС", "ДВ", "ТН", "ЕР", "ОЛ", "СМ"];

// === Reusable atoms (page-scoped) ===
type BtnProps = {
  to: string;
  children: React.ReactNode;
  variant?: "orange" | "dark" | "outline" | "light" | "red";
  size?: "md" | "lg";
  arrow?: boolean;
};
function Btn({ to, children, variant = "orange", size = "md", arrow }: BtnProps) {
  const h = size === "lg" ? 54 : 46;
  const px = size === "lg" ? 28 : 22;
  const styles: Record<string, React.CSSProperties> = {
    orange: { background: T.gradOrange, color: "#fff", boxShadow: T.shadowOrange },
    red: { background: T.gradRed, color: "#fff", boxShadow: "0 10px 24px -8px rgba(165,40,20,0.5)" },
    dark: { background: T.ink, color: "#fff" },
    outline: { background: "transparent", color: T.ink, border: `1.5px solid ${T.ink}` },
    light: { background: T.surface, color: T.ink, border: `1px solid ${T.line}`, boxShadow: T.shadowSm },
  };
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-[8px] font-semibold transition-all hover:-translate-y-[1px] active:translate-y-0"
      style={{
        height: h,
        padding: `0 ${px}px`,
        borderRadius: T.rBtn,
        fontFamily: FONT,
        fontSize: size === "lg" ? 16 : 15,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        ...styles[variant],
      }}
    >
      {children}
      {arrow && <ArrowRight size={size === "lg" ? 18 : 16} strokeWidth={2.5} />}
    </Link>
  );
}

function Eyebrow({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "orange" | "light" }) {
  const tones = {
    ink: { background: T.ink, color: "#fff" },
    orange: { background: "rgba(242,108,5,0.12)", color: T.orangeDeep },
    light: { background: T.surface, color: T.ink, border: `1px solid ${T.line}` },
  };
  return (
    <span
      className="inline-flex items-center gap-[6px]"
      style={{
        ...tones[tone],
        padding: "6px 12px",
        borderRadius: T.rPill,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function LandingPage() {
  return (
    <div
      style={{
        background: T.surface,
        color: T.text,
        fontFamily: FONT,
        minHeight: "100vh",
        fontFeatureSettings: '"ss01","cv11"',
      }}
    >
      <TopNav />
      <Hero />
      <HowItWorks />
      <FirstHundred />
      <TwoTracks />
      <ShowcaseSection />
      <CategoriesPreview />
      <CommunityProof />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-[20px] md:px-[40px] backdrop-blur-md"
      style={{
        height: 72,
        background: "rgba(255,255,255,0.85)",
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <div style={{ color: T.ink }}>
        <Logo size={32} />
      </div>
      <div className="flex items-center gap-[10px]">
        <Link
          to="/login"
          className="hidden sm:inline-flex items-center font-semibold transition-colors hover:bg-[#F5F5F5]"
          style={{
            height: 44,
            padding: "0 18px",
            color: T.ink,
            border: `1px solid ${T.line}`,
            borderRadius: T.rBtn,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Войти
        </Link>
        <Btn to="/register" variant="orange" arrow>
          Регистрация
        </Btn>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: T.surface }}>
      {/* subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            `linear-gradient(to right, ${T.line} 1px, transparent 1px), linear-gradient(to bottom, ${T.line} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          opacity: 0.5,
          maskImage: "radial-gradient(ellipse at 30% 30%, black 20%, transparent 75%)",
        }}
      />
      {/* orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[160px] -top-[160px] h-[640px] w-[640px] rounded-full"
        style={{ background: "rgba(242,108,5,0.18)", filter: "blur(160px)" }}
      />

      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-[48px] px-[20px] py-[72px] md:px-[40px] md:py-[112px] md:flex-row md:items-stretch">
        <div className="flex-1 md:max-w-[58%]">
          <Eyebrow tone="orange">
            <Sparkles size={12} /> Платформа для моделистов
          </Eyebrow>
          <h1
            className="mt-[20px]"
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: "clamp(38px, 6.4vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: T.ink,
              maxWidth: 620,
            }}
          >
            Моделизм — это{" "}
            <span
              style={{
                background: T.gradOrange,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              жизнь
            </span>
            . Остальное — детали.
          </h1>
          <p
            className="mt-[22px]"
            style={{
              color: T.textMuted,
              fontSize: 18,
              lineHeight: 1.55,
              maxWidth: 520,
              fontWeight: 500,
            }}
          >
            RC авто, самолёты, квадрокоптеры, корабли, электроника. Сообщество
            инженеров и энтузиастов в одном пространстве.
          </p>

          <div className="mt-[36px] flex flex-wrap gap-[12px]">
            <Btn to="/register" variant="orange" size="lg" arrow>
              Присоединиться
            </Btn>
            <Btn to="/ads" variant="outline" size="lg">
              Смотреть объявления
            </Btn>
            <Btn to="/communities" variant="outline" size="lg">
              Посмотреть сообщества
            </Btn>
          </div>

          <div className="mt-[48px] grid grid-cols-3 gap-[16px] sm:flex sm:gap-[56px]">
            {[
              { n: "1 200+", l: "моделистов" },
              { n: "45+", l: "сообществ" },
              { n: "9", l: "категорий" },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 30,
                    color: T.ink,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{ marginTop: 4, fontSize: 13, color: T.textMuted, fontWeight: 500 }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          animate={{ y: [-8, 8, -8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-1 items-center justify-center md:max-w-[42%]"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const heroPick = showcaseImages.slice(0, 4);
  return (
    <div
      className="relative w-full"
      style={{
        maxWidth: 480,
        aspectRatio: "5 / 4",
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 24,
        boxShadow: T.shadowMd,
        padding: 16,
        overflow: "hidden",
      }}
    >
      <div
        className="absolute z-10"
        style={{
          top: 16, left: 16,
          padding: "4px 10px",
          background: T.ink, color: "#fff",
          borderRadius: T.rPill, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
        }}
      >
        SCALE 1:10
      </div>
      <div className="grid h-full w-full grid-cols-2 gap-2">
        {heroPick.map((s) => (
          <div
            key={s.url}
            className="relative overflow-hidden"
            style={{
              borderRadius: 16,
              background: "linear-gradient(135deg, #2a2a2e 0%, #1a1a1e 100%)",
              border: `1px solid ${T.line}`,
            }}
          >
            <img
              src={s.url}
              alt={s.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const HOW_STEPS = [
  { icon: UserPlus, title: "Зарегистрируйтесь", text: "Создайте аккаунт за минуту — почта и пароль.", to: "/register" as const },
  { icon: LogIn, title: "Войдите", text: "Авторизуйтесь и попадёте в ленту сообщества.", to: "/login" as const },
  { icon: Eye, title: "Смотрите объявления", text: "Каталог открыт даже без регистрации — как на Авито.", to: "/ads" as const },
  { icon: PlusCircle, title: "Создавайте объявления", text: "Публикуйте свои лоты с фото и описанием.", to: "/ads/new" as const },
];

function HowItWorks() {
  return (
    <section style={{ padding: "64px 20px", background: T.surface }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Как пользоваться</SectionLabel>
          <SectionTitle>Как это работает</SectionTitle>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Video placeholder — admin can replace with an embed later */}
          <div
            className="relative overflow-hidden"
            style={{
              aspectRatio: "16 / 9",
              background: "linear-gradient(135deg, #1b1f24 0%, #0f1216 100%)",
              border: `1px solid ${T.line}`,
              borderRadius: 20,
              boxShadow: T.shadowMd,
            }}
          >
            <div className="absolute inset-0 grid place-items-center text-center">
              <div className="flex flex-col items-center gap-3">
                <span
                  className="grid place-items-center"
                  style={{ width: 64, height: 64, borderRadius: 999, background: T.gradOrange, color: "#fff", boxShadow: T.shadowOrange }}
                >
                  <Play size={26} fill="currentColor" />
                </span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: FONT_DISPLAY }}>
                  Видео-инструкция
                </span>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, maxWidth: 360 }}>
                  Пошаговый обзор: регистрация, вход, объявления и публикации. Скоро здесь появится ролик.
                </span>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {HOW_STEPS.map((s, i) => (
              <Link
                key={s.title}
                to={s.to}
                className="group flex items-start gap-3"
                style={{
                  padding: 16,
                  background: T.surface,
                  border: `1px solid ${T.line}`,
                  borderRadius: 14,
                  transition: "border-color 200ms, box-shadow 200ms",
                }}
              >
                <span
                  className="grid shrink-0 place-items-center"
                  style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(242,108,5,0.12)", color: T.orangeDeep }}
                >
                  <s.icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.orange }}>0{i + 1}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: FONT_DISPLAY }}>{s.title}</span>
                  </span>
                  <span className="mt-1 block" style={{ fontSize: 13, color: T.textMuted }}>{s.text}</span>
                </span>
                <ArrowRight size={16} style={{ color: T.textMuted, marginTop: 4 }} className="shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseSection() {
  return (
    <section style={{ padding: "64px 20px", background: T.surfaceAlt }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Каталог моделей</SectionLabel>
          <SectionTitle>Реальные модели сообщества</SectionTitle>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
          {showcaseImages.map((s) => (
            <div
              key={s.url}
              className="group relative overflow-hidden"
              style={{
                aspectRatio: "1 / 1",
                background: "linear-gradient(135deg, #2a2a2e 0%, #1a1a1e 100%)",
                border: `1px solid ${T.line}`,
                borderRadius: 18,
                transition: "transform 250ms var(--ease-out-expo), box-shadow 250ms var(--ease-out-expo)",
              }}
            >
              <img
                src={s.url}
                alt={s.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: "color-mix(in oklab, #0d0d0d 70%, transparent)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600 }}>{s.title}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function FirstHundred() {
  const [stats, setStats] = useState({ taken: 0, total: 100 });
  useEffect(() => {
    let active = true;
    fetchStats()
      .then((s) => active && setStats(s.firstHundred))
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const taken = Math.max(0, Math.min(stats.total, stats.taken));
  const total = stats.total;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const left = total - taken;
  return (
    <section style={{ padding: "32px 20px" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 1240,
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "clamp(28px, 4vw, 44px)",
          background: T.gradOrange,
          color: "#fff",
          boxShadow: T.shadowOrange,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 10% 0%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(500px circle at 90% 100%, rgba(0,0,0,0.18), transparent 55%)",
          }}
        />
        <div className="relative grid gap-[20px]">
          <div className="flex flex-wrap gap-[10px]">
            <span
              className="inline-flex items-center gap-[6px]"
              style={{
                background: "rgba(255,255,255,0.18)",
                padding: "6px 12px",
                borderRadius: T.rPill,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={12} /> Запуск МоДелизМ Форум
            </span>
            <span
              className="inline-flex items-center gap-[6px]"
              style={{
                background: T.ink,
                color: "#fff",
                padding: "6px 12px",
                borderRadius: T.rPill,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Crown size={12} /> Первые 100
            </span>
          </div>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: "clamp(26px, 4vw, 38px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 720,
            }}
          >
            Первые 100 участников получают год бесплатно
          </h2>
          <p style={{ fontSize: 15, maxWidth: 620, opacity: 0.92, lineHeight: 1.5, fontWeight: 500 }}>
            Без подписки, без оплаты. Регистрируйся сейчас, чтобы попасть в основатели и получить
            бейдж «Первые 100» в профиле навсегда.
          </p>
          <div className="grid gap-[10px]" style={{ maxWidth: 560 }}>
            <div className="flex items-end justify-between gap-[12px]">
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28 }}>
                Занято {taken} из {total}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                Осталось {left} {left === 1 ? "место" : "мест"}
              </span>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: T.rPill,
                background: "rgba(255,255,255,0.25)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: T.rPill,
                  background: T.ink,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <Btn to="/register" variant="dark" size="lg" arrow>
              Получить год бесплатно
            </Btn>
            <Btn to="/login" variant="light">
              Уже с нами — войти
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.16em",
        color: T.orangeDeep,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-[12px]"
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: "clamp(28px, 4.2vw, 46px)",
        color: T.ink,
        letterSpacing: "-0.025em",
        lineHeight: 1.1,
      }}
    >
      {children}
    </h2>
  );
}

function TwoTracks() {
  return (
    <section style={{ padding: "96px 20px", background: T.surfaceAlt }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="text-center">
          <SectionLabel>Возможности</SectionLabel>
          <SectionTitle>Два пути в МоДелизМ Форум</SectionTitle>
          <p
            className="mx-auto mt-[14px]"
            style={{ color: T.textMuted, maxWidth: 540, fontSize: 16, fontWeight: 500 }}
          >
            Выбирайте, как взаимодействовать с платформой — как участник или как профессионал.
          </p>
        </div>
        <div className="mt-[48px] grid grid-cols-1 gap-[20px] md:grid-cols-2">
          <TrackCard
            icon={User}
            title="Для моделистов"
            description="Общайтесь в чатах, публикуйте проекты, продавайте детали, находите единомышленников."
            features={HOBBYIST_FEATURES}
            cta="Начать как участник"
            ctaVariant="outline"
          />
          <TrackCard
            icon={Briefcase}
            title="Для мастеров и продавцов"
            description="Продавайте услуги, детали и самодельные проекты. Размещайте рекламу, создавайте магазин."
            features={PRO_FEATURES}
            cta="Стать продавцом"
            ctaVariant="orange"
            highlight
          />
        </div>
      </div>
    </section>
  );
}

function TrackCard({
  icon: Icon, title, description, features, cta, ctaVariant, highlight,
}: {
  icon: typeof User; title: string; description: string; features: string[]; cta: string;
  ctaVariant: "outline" | "orange"; highlight?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      className="flex flex-col"
      style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: T.rCard,
        boxShadow: highlight ? T.shadowMd : T.shadowSm,
        padding: "32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {highlight && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, height: 4,
            background: T.gradOrange,
          }}
        />
      )}
      <div
        className="grid place-items-center"
        style={{
          height: 56,
          width: 56,
          background: highlight ? T.gradOrange : T.ink,
          color: "#fff",
          borderRadius: 14,
          boxShadow: highlight ? T.shadowOrange : "none",
        }}
      >
        <Icon size={26} strokeWidth={2} />
      </div>
      <h3
        className="mt-[22px]"
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 26,
          color: T.ink,
          letterSpacing: "-0.015em",
        }}
      >
        {title}
      </h3>
      <p
        className="mt-[10px]"
        style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.6, fontWeight: 500 }}
      >
        {description}
      </p>
      <ul className="mt-[24px] flex flex-col gap-[12px]">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-[10px]"
            style={{ color: T.ink, fontSize: 14, fontWeight: 500 }}
          >
            <span
              className="grid place-items-center flex-shrink-0"
              style={{
                width: 20, height: 20,
                borderRadius: 999,
                background: "rgba(242,108,5,0.12)",
                color: T.orangeDeep,
                marginTop: 1,
              }}
            >
              <Check size={12} strokeWidth={3} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      <div className="mt-[28px]">
        <Btn to="/register" variant={ctaVariant === "orange" ? "orange" : "outline"} arrow>
          {cta}
        </Btn>
      </div>
    </motion.div>
  );
}

function CategoriesPreview() {
  return (
    <section style={{ padding: "96px 20px", background: T.surface }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="text-center">
          <SectionLabel>Категории</SectionLabel>
          <SectionTitle>Всё, что движется и летает</SectionTitle>
          <p
            className="mx-auto mt-[14px]"
            style={{ color: T.textMuted, maxWidth: 520, fontSize: 16, fontWeight: 500 }}
          >
            Найди своих по интересу — от RC-машин до самодельной электроники.
          </p>
        </div>

        <div className="mt-[48px] grid grid-cols-2 gap-[14px] md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.name}
                to="/categories"
                className="group flex items-center gap-[14px] transition-all hover:-translate-y-[2px]"
                style={{
                  padding: "20px",
                  background: T.surface,
                  border: `1px solid ${T.line}`,
                  borderRadius: T.rCard,
                  boxShadow: T.shadowSm,
                }}
              >
                <div
                  className="grid place-items-center transition-colors"
                  style={{
                    height: 48,
                    width: 48,
                    background: T.surfaceAlt,
                    color: T.ink,
                    borderRadius: 12,
                  }}
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div
                    className="truncate"
                    style={{ color: T.ink, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}
                  >
                    {c.name}
                  </div>
                  <div style={{ marginTop: 2, color: T.textMuted, fontSize: 13, fontWeight: 500 }}>
                    {c.count}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CommunityProof() {
  return (
    <section style={{ padding: "96px 20px", background: T.ink, color: "#fff", position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px circle at 20% 30%, rgba(242,108,5,0.18), transparent 60%), radial-gradient(500px circle at 80% 70%, rgba(165,40,20,0.18), transparent 55%)",
        }}
      />
      <div className="relative mx-auto text-center" style={{ maxWidth: 760 }}>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: "clamp(28px, 4vw, 42px)",
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          Присоединяйтесь к 1 200+ моделистам
        </h2>
        <p
          className="mx-auto mt-[14px]"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: 540, fontSize: 16, fontWeight: 500 }}
        >
          Первые 100 участников получают бесплатную подписку на год.
        </p>

        <div className="mt-[32px] flex justify-center">
          {AVATAR_INITIALS.map((init, i) => (
            <div
              key={init}
              className="grid place-items-center"
              style={{
                height: 44,
                width: 44,
                background: AVATAR_COLORS[i],
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: T.rPill,
                border: `2px solid ${T.ink}`,
                marginLeft: i === 0 ? 0 : -12,
              }}
            >
              {init}
            </div>
          ))}
        </div>

        <div className="mt-[36px] flex flex-wrap justify-center gap-[12px]">
          <Btn to="/register" variant="orange" size="lg" arrow>
            Создать аккаунт бесплатно
          </Btn>
          <Btn to="/login" variant="outline" size="lg">
            <span style={{ color: "#fff" }}>Войти</span>
          </Btn>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: T.surface, borderTop: `1px solid ${T.line}` }}>
      <div
        className="mx-auto grid gap-[40px] px-[20px] py-[56px] md:grid-cols-4 md:px-[40px]"
        style={{ maxWidth: 1240 }}
      >
        <div>
          <div style={{ color: T.ink }}>
            <Logo size={32} />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
            МоДелизМ Форум © 2026
          </p>
        </div>
        <FooterCol
          title="Платформа"
          links={[
            { to: "/", label: "Лента" },
            { to: "/communities", label: "Сообщества" },
            { to: "/ads", label: "Объявления" },
            { to: "/subscription", label: "Подписка" },
          ]}
        />
        <FooterCol
          title="Категории"
          links={[
            { to: "/categories", label: "Все категории" },
            { to: "/categories", label: "Автомодели" },
            { to: "/categories", label: "Самолёты" },
            { to: "/categories", label: "Квадрокоптеры" },
          ]}
        />
        <FooterCol
          title="Контакты"
          links={[
            { to: "/login", label: "Войти" },
            { to: "/register", label: "Регистрация" },
          ]}
        />
      </div>
      <div
        className="px-[20px] pb-[32px] pt-[16px] text-center"
        style={{ color: T.textMuted, fontSize: 12, fontWeight: 500 }}
      >
        Сделано с душой для моделистов
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div style={{ color: T.ink, fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <ul className="mt-[16px] flex flex-col gap-[10px]">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="transition-colors hover:text-[#F26C05]"
              style={{ color: T.textMuted, fontSize: 13, fontWeight: 500 }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
