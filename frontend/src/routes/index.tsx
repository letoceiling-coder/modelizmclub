import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ChevronDown, Play, Pause, Volume2, VolumeX, Plus, Check,
  Newspaper, Megaphone, Users2, Radio, MessageSquare, Heart, MoreVertical,
  MapPin, Search, Compass, Sparkles, ImageOff,
  Car, Plane, Ship, TrainFront, Cpu, Wrench, Package, Boxes,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { ads as mockAds } from "@/lib/mock";
import { isDemoMode } from "@/lib/demo-mode";
import cover from "@/assets/cover-modelizm.jpg";

const HERO_VIDEO = "/videos/herovideo.mp4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "МоДелизМ — маркетплейс и сообщество моделистов" },
      { name: "description", content: "Маркетплейс, лента и сообщество для моделистов: RC авто, самолёты, квадрокоптеры, корабли, электроника. Покупайте, публикуйте сборки, находите клубы." },
    ],
  }),
  component: LandingPage,
});

// Enter-product target: in demo mode CTAs drop straight into the app.
function useEnter() {
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemoMode()), []);
  return {
    register: demo ? "/feed" : "/register",
    login: demo ? "/feed" : "/login",
    demo,
  } as const;
}

function LandingPage() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>
      <TopNav />
      <Hero />
      <QuickSections />
      <PopularListings />
      <CategoriesSection />
      <StepsTimeline />
      <PricingSection />
      <WhyChoose />
      <FaqSection />
      <Footer />
    </div>
  );
}

/* ===================== TopNav (sticky) ===================== */

const NAV_LINKS: { to: string; label: string }[] = [
  { to: "/ads", label: "Объявления" },
  { to: "/communities", label: "Сообщества" },
  { to: "/channels", label: "Каналы" },
  { to: "#how", label: "Как работает" },
  { to: "/subscription", label: "Подписка" },
];

function TopNav() {
  const enter = useEnter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "color-mix(in oklab, var(--background) 86%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex h-[64px] max-w-[1240px] items-center justify-between gap-4 px-4 md:px-8">
        <Link to="/" className="shrink-0">
          <Logo size={28} />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) =>
            l.to.startsWith("#") ? (
              <a key={l.label} href={l.to} className="text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{l.label}</a>
            ) : (
              <Link key={l.label} to={l.to} className="text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{l.label}</Link>
            ),
          )}
        </nav>

        {/* right controls */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Link to={enter.login} className="hidden rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition-colors sm:inline-flex"
            style={{ color: "var(--foreground-70)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >Войти</Link>
          <Link to={enter.register} className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-button)" }}
          >
            {enter.demo ? "Открыть демо" : "Создать аккаунт"}
            <ArrowRight size={15} />
          </Link>

          {/* mobile: theme + menu */}
          <button
            type="button"
            aria-label="Меню"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-[40px] w-[40px] place-items-center rounded-full lg:hidden"
            style={{ border: "1px solid var(--border)", background: "var(--background-surface)" }}
          >
            <span className="flex flex-col gap-[3px]">
              <span style={{ width: 16, height: 2, background: "var(--foreground-70)", borderRadius: 2 }} />
              <span style={{ width: 16, height: 2, background: "var(--foreground-70)", borderRadius: 2 }} />
              <span style={{ width: 16, height: 2, background: "var(--foreground-70)", borderRadius: 2 }} />
            </span>
          </button>
        </div>
      </div>

      {/* mobile menu sheet */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
            style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map((l) =>
                l.to.startsWith("#") ? (
                  <a key={l.label} href={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>{l.label}</a>
                ) : (
                  <Link key={l.label} to={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>{l.label}</Link>
                ),
              )}
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--background-surface)" }}>
                <span className="text-sm" style={{ color: "var(--foreground-70)" }}>Тема и язык</span>
                <span className="flex items-center gap-1">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = { color: "var(--foreground-70)" };

/* ===================== Hero (video-first, blue accent) ===================== */

function Hero() {
  const enter = useEnter();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else void v.play().catch(() => {});
    setIsPlaying(!isPlaying);
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  const fadeUp = {
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };
  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } };

  return (
    <section className="relative overflow-hidden" style={{ minHeight: "min(88vh, 760px)" }}>
      {/* background media */}
      <div className="absolute inset-0 z-0">
        {videoError ? (
          <img src={cover} alt="Сборка RC-моделей" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            poster={cover}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            className="h-full w-full object-cover"
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        )}
        {/* dark overlay — no white fade at the bottom, blends into --background */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, var(--background) 100%)" }}
        />
      </div>

      {/* video controls */}
      {!videoError && (
        <div className="absolute bottom-6 right-6 z-20 hidden gap-2 sm:flex">
          <HeroCtrl onClick={togglePlay} label={isPlaying ? "Пауза" : "Играть"}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </HeroCtrl>
          <HeroCtrl onClick={toggleMute} label={isMuted ? "Звук" : "Без звука"}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </HeroCtrl>
        </div>
      )}

      {/* content */}
      <div className="relative z-10 mx-auto flex max-w-[1240px] flex-col items-start justify-center px-4 md:px-8" style={{ minHeight: "min(88vh, 760px)" }}>
        <AnimatePresence>
          {ready && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="w-full max-w-[720px] py-20">
              <motion.h1
                variants={fadeUp}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(44px, 8vw, 92px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.03em",
                  fontWeight: 800,
                  color: "#ffffff",
                  textShadow: "0 4px 30px rgba(0,0,0,0.45)",
                }}
              >
                МоДелизМ
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-4"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.4vw, 26px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}
              >
                Маркетплейс, лента и сообщество для моделистов
              </motion.p>

              <motion.p
                variants={fadeUp}
                className="mt-4"
                style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(235,238,248,0.86)", maxWidth: 560, lineHeight: 1.55 }}
              >
                Покупайте модели и запчасти, публикуйте сборки, находите клубы и
                общайтесь с моделистами по всей России.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={() => navigate({ to: "/ads" })} style={ctaPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover, #4f6ae6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <Search size={18} /> Смотреть объявления
                </button>
                <button onClick={() => navigate({ to: enter.register })} style={ctaGhost}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  {enter.demo ? "Открыть демо" : "Создать аккаунт"} <ArrowRight size={18} />
                </button>
              </motion.div>

              {/* stats */}
              <motion.div variants={fadeUp} className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { n: "1 200+", l: "моделистов" },
                  { n: "45+", l: "сообществ" },
                  { n: "8", l: "категорий" },
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#fff", letterSpacing: "-0.02em" }}>{s.n}</div>
                    <div style={{ fontSize: 12, color: "rgba(235,238,248,0.7)", marginTop: 2, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.l}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* scroll hint */}
      <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 sm:flex" style={{ color: "rgba(235,238,248,0.6)" }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Листайте</span>
        <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown size={20} />
        </motion.div>
      </div>
    </section>
  );
}

function HeroCtrl({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid place-items-center"
      style={{ width: 40, height: 40, borderRadius: "var(--r-pill)", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", backdropFilter: "blur(8px)" }}
    >{children}</button>
  );
}

const ctaPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
  height: 54, padding: "0 28px", borderRadius: "var(--r-pill)",
  background: "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 700,
  border: "none", cursor: "pointer", boxShadow: "var(--shadow-button)", transition: "background 180ms",
};
const ctaGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
  height: 54, padding: "0 28px", borderRadius: "var(--r-pill)",
  background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, fontWeight: 700,
  border: "2px solid rgba(255,255,255,0.28)", cursor: "pointer", backdropFilter: "blur(8px)", transition: "background 180ms",
};
const ctaText: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: 54, padding: "0 20px", borderRadius: "var(--r-pill)",
  background: "transparent", color: "#fff", fontSize: 16, fontWeight: 600,
  border: "none", cursor: "pointer",
};

/* ===================== Quick sections ("Что есть в МоДелизМ") ===================== */

const QUICK: { icon: typeof Newspaper; title: string; desc: string; to: string }[] = [
  { icon: Megaphone, title: "Объявления", desc: "Покупка и продажа моделей, запчастей и техники как на Авито.", to: "/ads" },
  { icon: Newspaper, title: "Лента публикаций", desc: "Проекты, сборки, фото и видео других моделистов.", to: "/feed" },
  { icon: Users2, title: "Сообщества", desc: "Клубы по интересам: RC, авиа, суда, электроника.", to: "/communities" },
  { icon: Radio, title: "Каналы", desc: "Официальные каналы брендов, магазинов и экспертов.", to: "/channels" },
  { icon: MessageSquare, title: "Мессенджер", desc: "Личные и групповые чаты внутри платформы.", to: "/messenger" },
];

function QuickSections() {
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>Всё в одном месте</Eyebrow>
      <Title>Что есть в МоДелизМ</Title>
      <p className="mt-3 max-w-[560px]" style={mutedP}>
        Пять инструментов, которые закрывают повседневные задачи моделиста — от покупки детали до общения в клубе.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK.map(({ icon: Icon, title, desc, to }) => (
          <Link key={title} to={to} className="group flex flex-col p-6 transition-all hover:-translate-y-1"
            style={cardStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
          >
            <div className="grid place-items-center" style={{ width: 46, height: 46, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon size={22} />
            </div>
            <h3 className="mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>
              Открыть <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ===================== Popular listings (Avito-like) ===================== */

const CONDITION_COLOR = (c?: string) =>
  c === "Новое" ? "var(--success)" : "var(--foreground-50)";

function PopularListings() {
  const items = mockAds.slice(0, 6);
  return (
    <Section bg="var(--background)">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Маркетплейс</Eyebrow>
          <Title>Популярные объявления</Title>
        </div>
        <Link to="/ads" className="hidden shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] px-4 py-2.5 text-sm font-semibold sm:inline-flex"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >Все объявления <ArrowRight size={15} /></Link>
      </div>

      {/* mobile: horizontal scroll (no page overflow), desktop: 3+3 grid */}
      <div className="-mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((ad) => (
          <LandingListingCard key={ad.id} ad={ad} />
        ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link to="/ads" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >Все объявления <ArrowRight size={15} /></Link>
      </div>
    </Section>
  );
}

function LandingListingCard({ ad }: { ad: (typeof mockAds)[number] }) {
  const [fav, setFav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovIdx, setHovIdx] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  // Build gallery: prefer ad.gallery when it has multiple entries, else use ad.image
  const rawGallery = (ad.gallery && ad.gallery.length > 0 ? ad.gallery : [ad.image]).filter(Boolean) as string[];
  // Filter out already-errored images for dot indicators but still render them (fallback shown)
  const gallery = rawGallery.length > 0 ? rawGallery : [];
  const hasImages = gallery.length > 0;
  const canHover = hasImages && gallery.length > 1;

  return (
    <div
      className="relative flex min-w-[240px] shrink-0 snap-start flex-col overflow-hidden sm:min-w-0"
      style={cardStyle}
      onMouseLeave={() => { setMenuOpen(false); setHovIdx(0); }}
    >
      {/* photo */}
      <button
        onClick={() => navigate({ to: "/ads/$id", params: { id: ad.id } })}
        className="relative block h-[180px] w-full overflow-hidden"
        style={{ background: "var(--background-surface)", borderBottom: "1px solid var(--border)" }}
        onMouseMove={(e) => {
          if (!canHover) return;
          const r = e.currentTarget.getBoundingClientRect();
          const p = (e.clientX - r.left) / r.width;
          setHovIdx(Math.min(gallery.length - 1, Math.max(0, Math.floor(p * gallery.length))));
        }}
      >
        {hasImages && !imgErrors[hovIdx] ? (
          <img
            src={gallery[hovIdx]}
            alt={ad.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgErrors((prev) => ({ ...prev, [hovIdx]: true }))}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: "var(--foreground-30)" }}>
            <ImageOff size={28} />
            <span style={{ fontSize: 11, color: "var(--foreground-30)" }}>Фото скоро</span>
          </div>
        )}
        {canHover && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {gallery.slice(0, 5).map((_, i) => (
              <span key={i} style={{ width: 14, height: 3, borderRadius: 2, background: i === hovIdx ? "#fff" : "rgba(255,255,255,0.5)", transition: "background 120ms" }} />
            ))}
          </div>
        )}
      </button>

      {/* favorite */}
      <button
        aria-label={fav ? "Убрать из избранного" : "В избранное"}
        onClick={() => setFav((v) => !v)}
        className="absolute right-3 top-3 grid place-items-center transition-transform hover:scale-110"
        style={{ width: 32, height: 32, borderRadius: "var(--r-pill)", background: "var(--background-elevated)", border: "1px solid var(--border)", color: fav ? "#e53935" : "var(--foreground-50)" }}
      >
        <Heart size={16} fill={fav ? "currentColor" : "none"} />
      </button>

      {/* three-dots menu */}
      <div className="absolute left-3 top-3">
        <button
          aria-label="Меню объявления"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid place-items-center"
          style={{ width: 32, height: 32, borderRadius: "var(--r-pill)", background: "var(--background-elevated)", border: "1px solid var(--border)", color: "var(--foreground-50)" }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-[38px] z-20 min-w-[170px] overflow-hidden rounded-[12px] py-1"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
          >
            {["Скрыть", "Не интересно", "Пожаловаться"].map((label) => (
              <button key={label} onClick={() => setMenuOpen(false)}
                className="block w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover,var(--background-surface))]"
                style={{ color: "var(--foreground)" }}
              >{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <button onClick={() => navigate({ to: "/ads/$id", params: { id: ad.id } })} className="flex flex-1 flex-col p-4 text-left">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>
          {ad.price.toLocaleString("ru-RU")} ₽
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>{ad.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex items-center gap-1"><MapPin size={12} />{ad.city}</span>
          {ad.condition && (
            <span style={{ color: CONDITION_COLOR(ad.condition), fontWeight: 600 }}>{ad.condition}</span>
          )}
        </div>
      </button>
    </div>
  );
}

/* ===================== Categories ===================== */

const CATEGORIES: { icon: typeof Car; name: string; count: string }[] = [
  { icon: Plane, name: "Авиация", count: "180+" },
  { icon: Car, name: "Автомодели", count: "320+" },
  { icon: Ship, name: "Судомодели", count: "95+" },
  { icon: TrainFront, name: "Железные дороги", count: "60+" },
  { icon: Cpu, name: "Двигатели", count: "140+" },
  { icon: Radio, name: "Аппаратура", count: "110+" },
  { icon: Package, name: "Запчасти", count: "500+" },
  { icon: Wrench, name: "Инструменты", count: "130+" },
];

function CategoriesSection() {
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>Категории</Eyebrow>
      <Title>Всё, что движется и летает</Title>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {CATEGORIES.map(({ icon: Icon, name, count }) => (
          <Link key={name} to="/ads" className="group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5"
            style={cardStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
          >
            <div className="grid shrink-0 place-items-center transition-colors group-hover:bg-[var(--accent)] group-hover:text-white"
              style={{ width: 42, height: 42, borderRadius: "var(--r-card-sm)", background: "var(--background-elevated)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{name}</div>
              <div className="text-xs" style={{ color: "var(--foreground-50)" }}>{count} объявлений</div>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ===================== 3 steps timeline ===================== */

const STEPS: { icon: typeof Compass; title: string; desc: string }[] = [
  { icon: Compass, title: "Выберите направление", desc: "Авиация, авто, суда, железные дороги — отметьте, что вам близко." },
  { icon: Search, title: "Найдите модель или деталь", desc: "Объявления, проверенные продавцы, избранное и безопасная сделка." },
  { icon: Users2, title: "Общайтесь и показывайте сборки", desc: "Лента, сообщества и мессенджер — весь моделизм в одном месте." },
];

function StepsTimeline() {
  return (
    <Section bg="var(--background)" id="how">
      <Eyebrow>Как это работает</Eyebrow>
      <Title>Три шага до сообщества</Title>

      <div className="relative mt-12">
        {/* connecting line (desktop) */}
        <div aria-hidden className="absolute left-0 right-0 top-[26px] hidden md:block" style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--border) 12%, var(--border) 88%, transparent)" }} />
        <motion.ol
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14 } } }}
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
          className="grid gap-8 md:grid-cols-3 md:gap-6"
        >
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <motion.li
              key={title}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
              className="relative flex flex-col"
            >
              <div className="mb-5 flex items-center gap-3 md:flex-col md:items-start">
                {/* node — reserves space for future model animation */}
                <div className="relative grid place-items-center" style={{ width: 54, height: 54, borderRadius: "var(--r-pill)", background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-button)", zIndex: 1 }}>
                  <Icon size={24} />
                  <span className="absolute -right-1 -top-1 grid place-items-center rounded-full text-[11px] font-bold"
                    style={{ width: 22, height: 22, background: "var(--background)", color: "var(--accent)", border: "2px solid var(--accent)" }}>
                    {i + 1}
                  </span>
                </div>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--foreground)", letterSpacing: "-0.01em" }}>{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground-70)", maxWidth: 320 }}>{desc}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </Section>
  );
}

/* ===================== Pricing ===================== */

const PLANS: { name: string; price: string; period: string; features: string[]; accent?: boolean }[] = [
  { name: "Старт", price: "0 ₽", period: "пробный период", features: ["Лента и чаты", "Просмотр объявлений", "До 3 объявлений"] },
  { name: "Месяц", price: "от 99 ₽", period: "в месяц", features: ["Все возможности", "Безлимитные публикации", "Приоритет в ленте"], accent: true },
  { name: "Год", price: "от 990 ₽", period: "в год · выгодно", features: ["Экономия до 30%", "Бесплатные объявления", "Приоритетная поддержка"] },
];

function PricingSection() {
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>Тарифы</Eyebrow>
      <Title>Простая подписка</Title>
      <p className="mt-3 max-w-[540px]" style={mutedP}>Базовые возможности бесплатны. Подписка снимает ограничения.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className="relative flex flex-col p-7"
            style={{ ...cardStyle, borderColor: p.accent ? "var(--border-accent)" : "var(--border)", boxShadow: p.accent ? "var(--shadow-card-hover)" : "var(--shadow-xs)" }}
          >
            {p.accent && (
              <span className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Рекомендуем</span>
            )}
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{p.name}</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{p.price}</span>
              <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{p.period}</span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--foreground-70)" }}>
                  <Check size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /><span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex-1" />
            <Link to="/subscription" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--r-pill)] text-sm font-semibold transition-opacity hover:opacity-90"
              style={p.accent ? { background: "var(--accent)", color: "#fff" } : { background: "var(--background-elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >Подробнее <ArrowRight size={15} /></Link>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================== Why choose (value cards) ===================== */

const VALUES: { icon: typeof Sparkles; title: string; desc: string }[] = [
  { icon: Sparkles, title: "Только моделизм", desc: "Никакого шума — лента и объявления строго по теме." },
  { icon: Users2, title: "Живое сообщество", desc: "Клубы, эксперты и продавцы с рейтингом и историей сделок." },
  { icon: Boxes, title: "Всё в одном месте", desc: "Купить, продать, обсудить и договориться — без внешних сервисов." },
  { icon: MessageSquare, title: "Прямое общение", desc: "Встроенный мессенджер с продавцами и клубами." },
];

function WhyChoose() {
  return (
    <Section bg="var(--background)">
      <Eyebrow>Почему МоДелизМ</Eyebrow>
      <Title>Почему моделисты выбирают нас</Title>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex flex-col p-6" style={cardStyle}>
            <div className="grid place-items-center" style={{ width: 44, height: 44, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon size={20} />
            </div>
            <h3 className="mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================== FAQ ===================== */

const FAQ: { q: string; a: string }[] = [
  { q: "Нужно ли регистрироваться, чтобы смотреть?", a: "Нет. Объявления, сообщества и каналы можно смотреть без регистрации. Аккаунт нужен, чтобы публиковать и писать сообщения." },
  { q: "Сколько стоит участие?", a: "Базовое использование бесплатно. Подписка от 99 ₽ в месяц снимает ограничения и открывает расширенные возможности." },
  { q: "Как разместить объявление?", a: "После входа откройте раздел «Объявления» и нажмите «Создать». Заполните форму — модерация занимает до суток." },
  { q: "Можно ли пользоваться с телефона?", a: "Да. Интерфейс адаптирован под мобильные — отдельное приложение не требуется." },
  { q: "Какие категории есть?", a: "Авиация, автомодели, судомодели, железные дороги, двигатели, аппаратура, запчасти и инструменты." },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>Вопросы</Eyebrow>
      <Title>Часто спрашивают</Title>
      <div className="mx-auto mt-9 max-w-[820px] space-y-2.5">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" style={{ color: "var(--foreground)" }}>
                <span className="text-[15px] font-semibold">{item.q}</span>
                <span className="grid shrink-0 place-items-center transition-transform"
                  style={{ width: 28, height: 28, borderRadius: 8, background: "var(--background-surface)", border: "1px solid var(--border)", transform: isOpen ? "rotate(45deg)" : "none", color: "var(--foreground-70)" }}>
                  <Plus size={14} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
                    <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{item.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ===================== Footer ===================== */

const FOOTER_COLS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "МоДелизМ",
    links: [
      { label: "О нас", to: "/info/about" },
      { label: "О компании", to: "/info/company" },
      { label: "Партнёрам", to: "/info/partners" },
      { label: "Размещение рекламы", to: "/info/advertising" },
    ],
  },
  {
    title: "Документы",
    links: [
      { label: "Пользовательское соглашение", to: "/legal/rules" },
      { label: "Политика конфиденциальности", to: "/legal/privacy" },
      { label: "Compliance", to: "/info/compliance" },
      { label: "Обработка персональных данных", to: "/info/consent" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { label: "Ответы на вопросы", to: "/help" },
      { label: "Служба поддержки", to: "/info/support" },
      { label: "Оставить отзыв", to: "/info/feedback" },
      { label: "Обратная связь", to: "/info/feedback" },
    ],
  },
];

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}>
      <div className="mx-auto grid gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] md:px-8" style={{ maxWidth: 1240 }}>
        <div>
          <Logo size={30} />
          <p className="mt-4 max-w-[260px] text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>
            Маркетплейс, лента и сообщество для моделистов. Моделизм — это жизнь, остальное детали.
          </p>
          <p className="mt-4 text-xs" style={{ color: "var(--foreground-30)" }}>© {new Date().getFullYear()} МоДелизМ</p>
        </div>

        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{col.title}</div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm transition-colors" style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* contacts */}
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Контакты</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li><a href="https://t.me/modelizm" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Telegram: @modelizm</a></li>
            <li>Пн–Вс, 10:00–20:00 МСК</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/* ===================== shared helpers ===================== */

function Section({ children, bg, id }: { children: React.ReactNode; bg: string; id?: string }) {
  return (
    <section id={id} style={{ background: bg, padding: "72px 0" }}>
      <div className="mx-auto max-w-[1240px] px-4 md:px-8">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>{children}</div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px, 3.6vw, 42px)", letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--foreground)" }}>{children}</h2>
  );
}

const mutedP: React.CSSProperties = { fontSize: 15, color: "var(--foreground-70)", lineHeight: 1.6 };

const cardStyle: React.CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--shadow-xs)",
};
