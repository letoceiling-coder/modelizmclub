import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Car, Plane, Ship, Crosshair, Wrench, Printer, Package,
  UserPlus, MessageCircle, ShoppingBag, Truck, ShieldCheck, Newspaper,
  ArrowRight, Heart, MapPin, Tag, Crown, Sparkles, Play, Check,
  Star,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
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

// ─── constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEATURES = [
  { icon: Newspaper,    title: "Лента",             desc: "Публикуйте проекты, делитесь фото сборок и читайте новости сообщества." },
  { icon: ShoppingBag, title: "Объявления",         desc: "Покупайте и продавайте модели, запчасти и оборудование как на Авито." },
  { icon: UserPlus,    title: "Сообщества",          desc: "Вступайте в клубы по интересу: автомоделисты, авиаторы, судомоделисты." },
  { icon: MessageCircle, title: "Мессенджер",        desc: "Личные и групповые чаты внутри платформы — всё в одном месте." },
  { icon: ShieldCheck,  title: "Безопасная сделка", desc: "Средства на эскроу до получения — защита покупателя и продавца." },
  { icon: Truck,        title: "Доставка",           desc: "Интеграция с СДЭК и Почтой России прямо из карточки объявления." },
];

const CATEGORIES = [
  { icon: Car,      name: "Автомодели",  count: "320+ объявлений" },
  { icon: Plane,    name: "Авиамодели",  count: "180+ объявлений" },
  { icon: Ship,     name: "Судомодели",  count: "95+ объявлений"  },
  { icon: Crosshair,name: "Дроны",       count: "240+ объявлений" },
  { icon: Package,  name: "Запчасти",    count: "500+ объявлений" },
  { icon: Wrench,   name: "Инструменты", count: "130+ объявлений" },
  { icon: Printer,  name: "3D-печать",   count: "80+ объявлений"  },
];

const HOW_STEPS = [
  { n: "01", title: "Зарегистрируйтесь", desc: "Создайте аккаунт за минуту — потребуется только email и пароль." },
  { n: "02", title: "Разместите модель или деталь", desc: "Добавьте фото, укажите состояние и цену — объявление выйдет сразу." },
  { n: "03", title: "Общайтесь с покупателем", desc: "Встроенный чат позволяет договориться об условиях без телефона." },
  { n: "04", title: "Оформляйте доставку и безопасную сделку", desc: "Средства заморожены до получения посылки — обе стороны защищены." },
];

const LISTINGS: {
  id: number; title: string; price: string; city: string; condition: "Новое" | "Б/у"; isTop?: boolean;
  category: string; image?: string;
}[] = [
  { id: 1, title: "Багги XPower 1:10, ДВС, Futaba", price: "42 000 ₽",  city: "Москва",      condition: "Б/у",  isTop: true,  category: "Автомодели" },
  { id: 2, title: "Cessna 182 масштаб 1:6, ДВС 26см³", price: "78 000 ₽", city: "СПб",       condition: "Б/у",  category: "Авиамодели" },
  { id: 3, title: "Парусник TP52, длина 1.5 м, комплект", price: "31 500 ₽", city: "Казань",  condition: "Новое", isTop: true,  category: "Судомодели" },
  { id: 4, title: "FPV-дрон Geprc Mark5, 5\" комплект", price: "24 900 ₽", city: "Екатеринбург", condition: "Б/у", category: "Дроны" },
];

const AVATAR_INITIALS = ["АК", "МП", "ИС", "ДВ", "ТН", "ЕР", "ОЛ", "СМ"];
const AVATAR_COLORS   = ["#627FFF", "#3F4FBF", "#F26C05", "#4caf50", "#0F1519", "#1976d2", "#627FFF", "#3F4FBF"];

// ─── page root ────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>
      <TopNav />
      <Hero />
      <PlatformFeatures />
      <CategoriesSection />
      <ListingsSection />
      <HowItWorks />
      <CtaBanner />
      <Footer />
    </div>
  );
}

// ─── nav ──────────────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-10 backdrop-blur-md"
      style={{
        height: 68,
        background: "color-mix(in oklab, var(--background) 88%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Logo size={30} />
      <nav className="hidden md:flex items-center gap-6">
        {[
          { to: "/ads", label: "Объявления" },
          { to: "/communities", label: "Сообщества" },
          { to: "/", label: "Лента" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-sm font-medium transition-colors"
            style={{ color: "var(--foreground-70)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Войти</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/register">
            Создать аккаунт <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

// ─── hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const [search, setSearch] = useState("");

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--background)" }}>
      {/* subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.6,
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 10%, transparent 70%)",
        }}
      />
      {/* accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -120, right: -80, width: 600, height: 600,
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative mx-auto flex max-w-[1240px] flex-col gap-12 px-5 py-16 md:px-10 md:py-24 lg:flex-row lg:items-center lg:gap-16">
        {/* left column */}
        <div className="flex-1 lg:max-w-[52%]">
          <Badge variant="top" className="mb-6">
            <Sparkles className="size-3" /> Платформа для моделистов
          </Badge>

          <h1
            className="mt-0"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(38px, 5.8vw, 66px)",
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
            }}
          >
            Моделизм —{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-muted) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              это жизнь.
            </span>
            <br />
            Остальное — детали.
          </h1>

          <p
            className="mt-6"
            style={{ color: "var(--foreground-70)", fontSize: 18, lineHeight: 1.6, maxWidth: 500, fontWeight: 500 }}
          >
            RC авто, самолёты, квадрокоптеры, корабли, электроника. Сообщество
            инженеров и энтузиастов в одном пространстве.
          </p>

          {/* search */}
          <div className="mt-8 flex max-w-[440px] gap-2">
            <SearchInput
              placeholder="Найти модель или запчасть…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
            <Button asChild>
              <Link to="/ads">Найти</Link>
            </Button>
          </div>

          {/* CTA row */}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/register">
                Создать аккаунт <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/ads">Смотреть объявления</Link>
            </Button>
          </div>

          {/* stats */}
          <div className="mt-10 flex gap-10">
            {[
              { n: "1 200+", l: "моделистов" },
              { n: "45+",    l: "сообществ" },
              { n: "7",      l: "категорий" },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: "-0.02em",
                    color: "var(--foreground)",
                  }}
                >
                  {s.n}
                </div>
                <div style={{ marginTop: 2, fontSize: 13, color: "var(--foreground-50)", fontWeight: 500 }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right column — visual */}
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-1 items-center justify-center"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const picks = showcaseImages.slice(0, 4);
  return (
    <div
      className="relative w-full"
      style={{
        maxWidth: 460,
        aspectRatio: "5 / 4",
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card-lg)",
        boxShadow: "var(--shadow-card-airy)",
        padding: 14,
        overflow: "hidden",
      }}
    >
      {/* label */}
      <div
        className="absolute z-10 text-white"
        style={{
          top: 14, left: 14,
          background: "var(--accent)",
          padding: "3px 10px",
          borderRadius: "var(--r-pill)",
          fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
          boxShadow: "var(--shadow-button)",
        }}
      >
        RC MODELS
      </div>
      <div className="grid h-full w-full grid-cols-2 gap-2">
        {picks.map((s) => (
          <div
            key={s.url}
            className="relative overflow-hidden"
            style={{
              borderRadius: 12,
              background: "var(--background-surface)",
              border: "1px solid var(--border)",
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

// ─── platform features ────────────────────────────────────────────────────────

function PlatformFeatures() {
  return (
    <section style={{ padding: "80px 20px", background: "var(--background-surface)" }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <SectionEyebrow>Что внутри платформы</SectionEyebrow>
        <SectionTitle>Всё для моделиста в одном месте</SectionTitle>
        <p className="mt-4" style={{ color: "var(--foreground-70)", fontSize: 16, maxWidth: 520, fontWeight: 500 }}>
          От публикаций проектов до безопасной сделки — экосистема для каждого шага в моделизме.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card airy key={f.title} className="p-6 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
                <div
                  className="grid place-items-center"
                  style={{
                    width: 44, height: 44,
                    borderRadius: "var(--r-card-sm)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  <Icon className="size-5" />
                </div>
                <h3
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 17,
                    letterSpacing: "-0.01em",
                    color: "var(--foreground)",
                  }}
                >
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>
                  {f.desc}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── categories ───────────────────────────────────────────────────────────────

function CategoriesSection() {
  return (
    <section style={{ padding: "80px 20px", background: "var(--background)" }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <SectionEyebrow>Категории</SectionEyebrow>
        <SectionTitle>Всё, что движется и летает</SectionTitle>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.name}
                to="/ads"
                className="group flex flex-col items-center gap-3 py-6 text-center transition-all hover:-translate-y-1"
                style={{
                  borderRadius: "var(--r-card)",
                  border: "1px solid var(--border)",
                  background: "var(--background-elevated)",
                  boxShadow: "var(--shadow-xs)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
              >
                <div
                  className="grid place-items-center transition-colors group-hover:bg-[var(--accent)] group-hover:text-white"
                  style={{
                    width: 44, height: 44,
                    borderRadius: "var(--r-card-sm)",
                    background: "var(--background-surface)",
                    color: "var(--foreground-70)",
                    transition: "background 200ms, color 200ms",
                  }}
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {c.name}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--foreground-50)" }}>
                    {c.count}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link to="/ads">
              Все объявления <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── listings ─────────────────────────────────────────────────────────────────

function ListingsSection() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setFavorites((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  return (
    <section style={{ padding: "80px 20px", background: "var(--background-surface)" }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <SectionEyebrow>Объявления</SectionEyebrow>
            <SectionTitle>Свежие лоты от сообщества</SectionTitle>
          </div>
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link to="/ads">
              Смотреть все <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LISTINGS.map((ad) => (
            <Card
              airy
              key={ad.id}
              className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              {/* photo placeholder */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  height: 176,
                  background: "var(--background-surface)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {ad.isTop && (
                  <div className="absolute left-3 top-3">
                    <Badge variant="top" withIcon>ТОП</Badge>
                  </div>
                )}
                <button
                  aria-label={favorites.has(ad.id) ? "Убрать из избранного" : "В избранное"}
                  onClick={() => toggle(ad.id)}
                  className="absolute right-3 top-3 grid place-items-center transition-transform hover:scale-110"
                  style={{
                    width: 32, height: 32,
                    borderRadius: "var(--r-pill)",
                    background: "var(--background-elevated)",
                    border: "1px solid var(--border)",
                    color: favorites.has(ad.id) ? "var(--danger)" : "var(--foreground-50)",
                  }}
                >
                  <Heart className="size-4" fill={favorites.has(ad.id) ? "currentColor" : "none"} />
                </button>
                {/* category icon as placeholder */}
                <div style={{ color: "var(--foreground-30)" }}>
                  {ad.category === "Автомодели" && <Car className="size-16 opacity-30" />}
                  {ad.category === "Авиамодели" && <Plane className="size-16 opacity-30" />}
                  {ad.category === "Судомодели" && <Ship className="size-16 opacity-30" />}
                  {ad.category === "Дроны"      && <Crosshair className="size-16 opacity-30" />}
                </div>
              </div>

              {/* info */}
              <div className="flex flex-1 flex-col p-4">
                <div className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                  {ad.title}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>
                    {ad.price}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--foreground-50)" }}>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />{ad.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" />
                    <span
                      style={{
                        color: ad.condition === "Новое" ? "var(--success)" : "var(--foreground-50)",
                        fontWeight: 600,
                      }}
                    >
                      {ad.condition}
                    </span>
                  </span>
                </div>

                <div className="mt-auto pt-4">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/ads">Смотреть лот</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Button variant="outline" asChild>
            <Link to="/ads">
              Смотреть все <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── how it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section style={{ padding: "80px 20px", background: "var(--background)" }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          {/* steps */}
          <div>
            <SectionEyebrow>Как это работает</SectionEyebrow>
            <SectionTitle>Четыре шага — и вы на платформе</SectionTitle>

            <ol className="mt-10 flex flex-col gap-6">
              {HOW_STEPS.map((s, i) => (
                <li key={s.n} className="flex gap-5">
                  <div
                    className="grid shrink-0 place-items-center"
                    style={{
                      width: 44, height: 44,
                      borderRadius: "var(--r-card-sm)",
                      background: "var(--accent)",
                      color: "#fff",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 15,
                      boxShadow: "var(--shadow-button)",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 17,
                        color: "var(--foreground)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {s.title}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/register">
                  Начать бесплатно <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/ads">Смотреть объявления</Link>
              </Button>
            </div>
          </div>

          {/* video block */}
          <div
            className="relative overflow-hidden"
            style={{
              aspectRatio: "16 / 10",
              borderRadius: "var(--r-card-lg)",
              background: "var(--background-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="absolute inset-0 grid place-items-center text-center px-8">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="grid place-items-center"
                  style={{
                    width: 64, height: 64,
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent)",
                    color: "#fff",
                    boxShadow: "var(--shadow-button)",
                  }}
                >
                  <Play className="size-6" fill="currentColor" />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "var(--foreground)",
                    }}
                  >
                    Видео-инструкция
                  </div>
                  <p className="mt-2 text-sm" style={{ color: "var(--foreground-50)", maxWidth: 320 }}>
                    Пошаговый обзор: регистрация, объявления, сообщества. Ролик выйдет в ближайшее время.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA / promo banner (replaces FirstHundred) ───────────────────────────────

function CtaBanner() {
  const [stats, setStats] = useState({ taken: 0, total: 100 });
  useEffect(() => {
    let active = true;
    fetchStats()
      .then((s) => active && setStats(s.firstHundred))
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const pct = stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;
  const left = stats.total - stats.taken;

  return (
    <section style={{ padding: "32px 20px 80px" }}>
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          maxWidth: 1240,
          borderRadius: "var(--r-card-lg)",
          background: "linear-gradient(135deg, var(--accent-commercial) 0%, #B04C00 100%)",
          padding: "clamp(28px, 4vw, 48px)",
          color: "#fff",
          boxShadow: "var(--shadow-glow-commercial)",
        }}
      >
        {/* glow overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(600px circle at 10% 0%, rgba(255,255,255,0.20), transparent 55%), radial-gradient(400px circle at 90% 100%, rgba(0,0,0,0.15), transparent 55%)",
          }}
        />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className="border-0 text-[var(--accent-commercial)] bg-white/95 font-bold">
                <Sparkles className="size-3" /> Запуск платформы
              </Badge>
              <Badge className="border-0 text-white bg-[var(--neutral-900)]/80 font-bold">
                <Crown className="size-3" /> Первые 100
              </Badge>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(24px, 3.5vw, 36px)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                maxWidth: 640,
              }}
            >
              Первые 100 участников получают год бесплатно
            </h2>
            <p className="mt-3 text-sm font-medium opacity-90" style={{ maxWidth: 540 }}>
              Без оплаты и подписки. Зарегистрируйтесь сейчас — получите бейдж «Основатель» в профиле навсегда.
            </p>

            {/* progress */}
            <div className="mt-5" style={{ maxWidth: 480 }}>
              <div className="flex items-end justify-between mb-2">
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>
                  Занято {stats.taken} из {stats.total}
                </span>
                <span className="text-sm font-semibold opacity-90">
                  Осталось {left} {left === 1 ? "место" : "мест"}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`, height: "100%",
                    borderRadius: "var(--r-pill)",
                    background: "var(--neutral-900)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="bg-[var(--neutral-900)] text-white hover:bg-[var(--neutral-700)] border-0 shadow-none"
                size="lg"
                asChild
              >
                <Link to="/register">
                  Получить год бесплатно <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:bg-white/15 hover:text-white"
                asChild
              >
                <Link to="/login">Уже с нами — войти</Link>
              </Button>
            </div>
          </div>

          {/* avatar stack */}
          <div className="hidden lg:flex flex-col items-center gap-3">
            <div className="flex">
              {AVATAR_INITIALS.map((init, i) => (
                <div
                  key={init}
                  className="grid place-items-center text-white text-xs font-bold"
                  style={{
                    width: 40, height: 40,
                    borderRadius: "var(--r-pill)",
                    background: AVATAR_COLORS[i],
                    border: "2px solid rgba(255,255,255,0.5)",
                    marginLeft: i === 0 ? 0 : -10,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {init}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold opacity-90">
              <Star className="size-3" fill="currentColor" /> 4.9 · 1 200+ моделистов
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}>
      <div
        className="mx-auto grid gap-10 px-5 py-12 md:px-10 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
        style={{ maxWidth: 1240 }}
      >
        <div>
          <Logo size={28} />
          <p className="mt-4 text-sm" style={{ color: "var(--foreground-50)", maxWidth: 200 }}>
            Платформа для сообщества моделистов
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--foreground-30)" }}>
            © 2026 МоДелизМ Форум
          </p>
        </div>

        <FooterCol title="Проект" links={[
          { label: "О проекте",    to: "/help"         },
          { label: "Правила",      to: "/legal/rules"  },
          { label: "Безопасность", to: "/legal/privacy"},
        ]} />
        <FooterCol title="Платформа" links={[
          { label: "Лента",        to: "/"            },
          { label: "Объявления",   to: "/ads"         },
          { label: "Сообщества",   to: "/communities" },
          { label: "Подписка",     to: "/subscription"},
        ]} />
        <FooterCol title="Поддержка" links={[
          { label: "Помощь",       to: "/help"         },
          { label: "Контакты",     to: "/help"         },
        ]} />
        <FooterCol title="Аккаунт" links={[
          { label: "Войти",        to: "/login"    },
          { label: "Регистрация",  to: "/register" },
        ]} />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-sm transition-colors"
              style={{ color: "var(--foreground-50)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── shared typography helpers ────────────────────────────────────────────────

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
      style={{ color: "var(--accent)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-3"
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "clamp(26px, 3.8vw, 44px)",
        letterSpacing: "-0.025em",
        lineHeight: 1.1,
        color: "var(--foreground)",
      }}
    >
      {children}
    </h2>
  );
}
