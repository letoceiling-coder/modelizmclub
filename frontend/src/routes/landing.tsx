import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User, Briefcase, Car, Plane, Ship, Crosshair, Cpu, Battery, Radio, Bike, Wrench, Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FirstHundredBanner } from "@/components/FirstHundredBanner";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "МоДелизМ Форум — сообщество моделистов России" },
      { name: "description", content: "RC авто, самолёты, квадрокоптеры, корабли, электроника. Сообщество инженеров и энтузиастов в одном пространстве." },
      { property: "og:title", content: "МоДелизМ Форум — моделизм это жизнь" },
      { property: "og:description", content: "Платформа для моделистов: лента, чаты, объявления, сообщества." },
    ],
  }),
  component: LandingPage,
});

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

const AVATAR_COLORS = [
  "#C8102E", "#1E3A8A", "#0F766E", "#B45309", "#7E22CE", "#0369A1", "#BE123C", "#15803D",
];
const AVATAR_INITIALS = ["АК", "МП", "ИС", "ДВ", "ТН", "ЕР", "ОЛ", "СМ"];

function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <TopNav />
      <Hero />
      <FirstHundredBanner />
      <TwoTracks />
      <CategoriesPreview />
      <CommunityProof />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <div
      className="sticky top-0 z-30 flex h-[64px] items-center justify-between px-[24px] backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--background) 80%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Logo size={32} />
      <div className="flex items-center gap-[12px]">
        <ThemeToggle />
        <Link
          to="/login"
          className="hidden sm:inline-flex items-center px-[18px] text-[14px] font-semibold transition-colors"
          style={{
            color: "var(--foreground)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-button)",
            height: 40,
          }}
        >
          Войти
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center px-[18px] text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "var(--r-button)",
            boxShadow: "var(--shadow-button)",
            height: 40,
          }}
        >
          Регистрация
        </Link>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Engineering grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--foreground-15) 0.5px, transparent 0.5px), linear-gradient(to bottom, var(--foreground-15) 0.5px, transparent 0.5px)",
          backgroundSize: "80px 80px",
          opacity: 0.4,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[200px] -top-[200px] h-[800px] w-[800px] rounded-full"
        style={{
          background: "var(--accent-glow)",
          filter: "blur(200px)",
        }}
      />

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-[48px] px-[24px] py-[80px] md:flex-row md:items-stretch md:py-[120px]">
        {/* Left */}
        <div className="flex-1 md:max-w-[55%]">
          <span
            className="inline-flex items-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--foreground-50)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-pill)",
              padding: "4px 12px",
              textTransform: "uppercase",
            }}
          >
            Платформа
          </span>
          <h1
            className="mt-[20px] font-display"
            style={{
              fontWeight: 800,
              fontSize: "clamp(36px, 6vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-1px",
              maxWidth: 560,
              color: "var(--foreground)",
            }}
          >
            Моделизм — это{" "}
            <span
              style={{
                color: "var(--accent)",
                borderBottom: "3px solid var(--accent)",
                paddingBottom: 2,
              }}
            >
              жизнь
            </span>
            . Остальное — детали.
          </h1>
          <p
            className="mt-[20px] text-[16px] md:text-[18px]"
            style={{ color: "var(--foreground-70)", lineHeight: 1.6, maxWidth: 480 }}
          >
            RC авто, самолёты, квадрокоптеры, корабли, электроника. Сообщество инженеров и энтузиастов в одном пространстве.
          </p>

          <div className="mt-[32px] flex flex-wrap gap-[16px]">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-[32px] text-[16px] font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-button)",
                height: 52,
                boxShadow: "var(--shadow-button)",
                transitionTimingFunction: "var(--ease-out-expo)",
                transitionDuration: "200ms",
              }}
            >
              Присоединиться
            </Link>
            <Link
              to="/communities"
              className="inline-flex items-center justify-center px-[32px] text-[16px] font-semibold transition-colors"
              style={{
                background: "transparent",
                border: "1.5px solid var(--border-strong)",
                color: "var(--foreground)",
                borderRadius: "var(--r-button)",
                height: 52,
              }}
            >
              Посмотреть сообщества
            </Link>
          </div>

          <div className="mt-[48px] grid grid-cols-3 gap-[24px] sm:flex sm:gap-[48px]">
            {[
              { n: "1 200+", l: "моделистов" },
              { n: "45+", l: "сообществ" },
              { n: "9", l: "категорий" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-[24px] font-bold sm:text-[28px]" style={{ color: "var(--foreground)" }}>
                  {s.n}
                </div>
                <div className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right hero visual */}
        <motion.div
          animate={{ y: [-8, 8, -8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-1 items-center justify-center md:max-w-[45%]"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <svg
      viewBox="0 0 400 320"
      className="h-auto w-full max-w-[440px]"
      fill="none"
      stroke="var(--border-strong)"
      strokeWidth="1.5"
    >
      {/* compass circle */}
      <circle cx="200" cy="160" r="130" strokeDasharray="2 6" opacity="0.6" />
      <circle cx="200" cy="160" r="90" opacity="0.4" />
      {/* caliper crosshair */}
      <line x1="40" y1="160" x2="360" y2="160" opacity="0.5" />
      <line x1="200" y1="20" x2="200" y2="300" opacity="0.5" />
      {/* RC car wireframe */}
      <g stroke="var(--accent)" strokeWidth="1.8" opacity="0.95">
        <path d="M90 200 L130 160 L200 145 L270 150 L320 165 L320 210 L300 220 L100 220 Z" />
        <path d="M150 160 L165 145 L235 145 L255 160" />
        <circle cx="135" cy="220" r="22" fill="var(--background)" />
        <circle cx="285" cy="220" r="22" fill="var(--background)" />
        <circle cx="135" cy="220" r="10" />
        <circle cx="285" cy="220" r="10" />
        <line x1="130" y1="170" x2="280" y2="170" opacity="0.6" />
      </g>
      {/* annotation ticks */}
      <g opacity="0.4">
        <line x1="60" y1="155" x2="60" y2="165" />
        <line x1="340" y1="155" x2="340" y2="165" />
        <line x1="195" y1="40" x2="205" y2="40" />
        <line x1="195" y1="280" x2="205" y2="280" />
      </g>
      <text x="50" y="50" fontFamily="var(--font-mono)" fontSize="9" fill="var(--foreground-50)" stroke="none">
        SCALE 1:10
      </text>
      <text x="295" y="50" fontFamily="var(--font-mono)" fontSize="9" fill="var(--foreground-50)" stroke="none">
        REV.0
      </text>
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: 2,
        color: "var(--foreground-50)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function TwoTracks() {
  return (
    <section className="py-[80px]" style={{ background: "var(--background-elevated)" }}>
      <div className="mx-auto max-w-[1200px] px-[24px]">
        <div className="mb-[40px] flex items-center gap-[16px]">
          <div className="h-[1px] flex-1" style={{ background: "var(--border)" }} />
          <div className="h-[8px] w-[8px] rounded-full" style={{ background: "var(--accent)" }} />
          <div className="h-[1px] flex-1" style={{ background: "var(--border)" }} />
        </div>

        <div className="text-center">
          <SectionLabel>Возможности</SectionLabel>
          <h2
            className="mt-[12px] font-display"
            style={{
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 44px)",
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
            }}
          >
            Два пути в МоДЕЛИЗМ Форум
          </h2>
          <p
            className="mx-auto mt-[12px] text-[16px]"
            style={{ color: "var(--foreground-70)", maxWidth: 500 }}
          >
            Выбирайте, как взаимодействовать с платформой — как участник или как профессионал.
          </p>
        </div>

        <div className="mt-[48px] grid grid-cols-1 gap-[24px] md:grid-cols-2">
          <TrackCard
            icon={User}
            title="Для моделистов"
            description="Общайтесь в чатах, публикуйте проекты, продавайте детали, находите единомышленников."
            features={HOBBYIST_FEATURES}
            cta="Начать как участник →"
            ctaVariant="outline"
          />
          <TrackCard
            icon={Briefcase}
            title="Для мастеров и продавцов"
            description="Продавайте услуги, детали и самодельные проекты. Размещайте рекламу, создавайте магазин."
            features={PRO_FEATURES}
            cta="Стать продавцом →"
            ctaVariant="filled"
            accentLeft
          />
        </div>
      </div>
    </section>
  );
}

function TrackCard({
  icon: Icon, title, description, features, cta, ctaVariant, accentLeft,
}: {
  icon: typeof User; title: string; description: string; features: string[]; cta: string;
  ctaVariant: "outline" | "filled"; accentLeft?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      className="flex flex-col p-[32px] md:p-[40px]"
      style={{
        background: "var(--background-surface)",
        border: accentLeft ? "1px solid var(--border)" : "1px solid var(--border)",
        borderLeft: accentLeft ? "3px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--r-card-lg)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="grid h-[56px] w-[56px] place-items-center"
        style={{
          background: "var(--accent-soft)",
          borderRadius: 14,
          color: "var(--accent)",
        }}
      >
        <Icon size={24} />
      </div>
      <h3
        className="mt-[20px] font-display"
        style={{ fontWeight: 700, fontSize: 24, color: "var(--foreground)", letterSpacing: "-0.01em" }}
      >
        {title}
      </h3>
      <p
        className="mt-[12px] text-[15px]"
        style={{ color: "var(--foreground-70)", lineHeight: 1.6 }}
      >
        {description}
      </p>
      <ul className="mt-[24px] flex flex-col gap-[12px]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-[10px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
            <Check size={16} style={{ color: "var(--success)", marginTop: 2, flexShrink: 0 }} strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="flex-1" />
      <Link
        to="/register"
        className="mt-[32px] inline-flex items-center justify-center px-[28px] text-[15px] font-semibold transition-all"
        style={
          ctaVariant === "filled"
            ? {
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-button)",
                height: 48,
                boxShadow: "var(--shadow-button)",
              }
            : {
                background: "transparent",
                border: "1px solid var(--border-strong)",
                color: "var(--foreground)",
                borderRadius: "var(--r-button)",
                height: 48,
              }
        }
      >
        {cta}
      </Link>
    </motion.div>
  );
}

function CategoriesPreview() {
  return (
    <section className="py-[80px]" style={{ background: "var(--background-surface)" }}>
      <div className="mx-auto max-w-[1200px] px-[24px]">
        <div
          className="mx-auto mb-[40px] h-[1px]"
          style={{
            width: 300,
            background:
              "linear-gradient(to right, transparent, var(--border), transparent)",
          }}
        />
        <div className="text-center">
          <SectionLabel>Категории</SectionLabel>
          <h2
            className="mt-[12px] font-display"
            style={{
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 44px)",
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
            }}
          >
            Всё, что движется и летает
          </h2>
        </div>

        <div className="mt-[48px] grid grid-cols-2 gap-[16px] md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.name}
                to="/categories"
                className="group flex items-center gap-[14px] p-[20px] transition-all md:p-[24px]"
                style={{
                  background: "var(--background-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-card)",
                }}
              >
                <div
                  className="grid h-[44px] w-[44px] place-items-center transition-colors"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    borderRadius: "var(--r-card-sm)",
                  }}
                >
                  <Icon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold md:text-[16px]" style={{ color: "var(--foreground)" }}>
                    {c.name}
                  </div>
                  <div className="mt-[2px] text-[12px] md:text-[13px]" style={{ color: "var(--foreground-50)" }}>
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
    <section className="py-[80px]" style={{ background: "var(--background-overlay)" }}>
      <div className="mx-auto max-w-[800px] px-[24px] text-center">
        <h2
          className="font-display"
          style={{
            fontWeight: 700,
            fontSize: "clamp(26px, 3.5vw, 36px)",
            color: "var(--foreground)",
            letterSpacing: "-0.02em",
          }}
        >
          Присоединяйтесь к 1 200+ моделистам
        </h2>
        <p
          className="mx-auto mt-[12px] text-[16px]"
          style={{ color: "var(--foreground-50)", maxWidth: 520 }}
        >
          Первые 100 участников получают бесплатную подписку на 3 месяца.
        </p>

        <div className="mt-[32px] flex justify-center">
          {AVATAR_INITIALS.map((init, i) => (
            <div
              key={init}
              className="grid h-[40px] w-[40px] place-items-center text-[12px] font-semibold text-white"
              style={{
                background: AVATAR_COLORS[i],
                borderRadius: "var(--r-pill)",
                border: "2px solid var(--background-overlay)",
                marginLeft: i === 0 ? 0 : -12,
              }}
            >
              {init}
            </div>
          ))}
        </div>

        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
          className="mt-[32px] inline-block"
        >
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-[40px] text-[16px] font-semibold transition-shadow"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--r-pill)",
              height: 56,
              boxShadow: "var(--shadow-button)",
            }}
          >
            Создать аккаунт бесплатно
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto grid max-w-[1200px] gap-[40px] px-[24px] py-[56px] md:grid-cols-4">
        <div>
          <Logo size={32} />
          <p className="mt-[16px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            МоДЕЛИЗМ Форум © 2026
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
        className="px-[24px] pb-[32px] pt-[16px] text-center text-[12px]"
        style={{ color: "var(--foreground-30)" }}
      >
        Сделано с душой для моделистов России
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="text-[14px] font-semibold" style={{ color: "var(--foreground-70)" }}>
        {title}
      </div>
      <ul className="mt-[16px] flex flex-col gap-[10px]">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-[13px] transition-colors hover:opacity-80"
              style={{ color: "var(--foreground-50)" }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
