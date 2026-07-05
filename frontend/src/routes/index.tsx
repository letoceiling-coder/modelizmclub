import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ChevronDown, Plus, Check,
  Newspaper, Megaphone, Users2, Radio, MessageSquare, Heart, MoreVertical,
  MapPin, Search, Compass, Sparkles, ImageOff, CalendarDays,
  Car, Plane, Ship, TrainFront, Cpu, Wrench, Package, Boxes,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { ads as mockAds } from "@/lib/mock";
import { isDemoMode } from "@/lib/demo-mode";
import cover from "@/assets/cover-modelizm.jpg";
import { SOCIAL_LINKS } from "@/lib/footer-links";

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

const NAV_LINKS: { to: string; key: "ads" | "communities" | "channels" | "how" | "subscription" }[] = [
  { to: "/ads", key: "ads" },
  { to: "/communities", key: "communities" },
  { to: "/channels", key: "channels" },
  { to: "#how", key: "how" },
  { to: "/subscription", key: "subscription" },
];

function TopNav() {
  const { t } = useTranslation();
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
          <Logo size={40} />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) =>
            l.to.startsWith("#") ? (
              <a key={l.key} href={l.to} className="text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{t("landing.nav." + l.key)}</a>
            ) : (
              <Link key={l.key} to={l.to} className="text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{t("landing.nav." + l.key)}</Link>
            ),
          )}
        </nav>

        {/* right controls */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to={enter.login} className="hidden rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition-colors sm:inline-flex"
            style={{ color: "var(--foreground-70)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >{t("landing.nav.login")}</Link>
          <Link to={enter.register} className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-button)" }}
          >
            {enter.demo ? t("landing.nav.demo") : t("landing.nav.register")}
            <ArrowRight size={15} />
          </Link>

          <button
            type="button"
            aria-label={t("landing.nav.menu")}
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
              <div className="px-1 pb-1"><LanguageSwitcher /></div>
              {NAV_LINKS.map((l) =>
                l.to.startsWith("#") ? (
                  <a key={l.key} href={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("landing.nav." + l.key)}</a>
                ) : (
                  <Link key={l.key} to={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("landing.nav." + l.key)}</Link>
                ),
              )}
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
  const { t } = useTranslation();
  const enter = useEnter();
  const navigate = useNavigate();
  const [videoError, setVideoError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

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
        {/* dark overlay — fixed dark color at the bottom, independent of theme
            (var(--background) turned white in light theme and washed out the video) */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, rgba(9,11,20,0.92) 100%)" }}
        />
      </div>


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
                {t("landing.hero.brand")}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-4"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.4vw, 26px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}
              >
                {t("landing.hero.tagline")}
              </motion.p>

              <motion.p
                variants={fadeUp}
                className="mt-4"
                style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(235,238,248,0.86)", maxWidth: 560, lineHeight: 1.55 }}
              >
                {t("landing.hero.subtitle")}
              </motion.p>

              <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={() => navigate({ to: "/ads" })} style={ctaPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover, #4f6ae6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <Search size={18} /> {t("landing.hero.ctaBrowse")}
                </button>
                <button onClick={() => navigate({ to: enter.register })} style={ctaGhost}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  {enter.demo ? t("landing.nav.demo") : t("landing.nav.register")} <ArrowRight size={18} />
                </button>
              </motion.div>

              {/* stats */}
              <motion.div variants={fadeUp} className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { n: "1 200+", key: "modelers" as const },
                  { n: "45+", key: "communities" as const },
                  { n: "8", key: "categories" as const },
                ].map((s) => (
                  <div key={s.key}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#fff", letterSpacing: "-0.02em" }}>{s.n}</div>
                    <div style={{ fontSize: 12, color: "rgba(235,238,248,0.7)", marginTop: 2, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("landing.hero.stats." + s.key)}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* scroll hint */}
      <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 sm:flex" style={{ color: "rgba(235,238,248,0.6)" }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{t("landing.hero.scroll")}</span>
        <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown size={20} />
        </motion.div>
      </div>
    </section>
  );
}


const ctaPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
  height: 54, padding: "0 28px", borderRadius: "var(--r-pill)",
  background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 16, fontWeight: 700,
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

const QUICK: { icon: typeof Newspaper; to: string; key: "ads" | "feed" | "communities" | "channels" | "messenger" | "events" }[] = [
  { icon: Megaphone, to: "/ads", key: "ads" },
  { icon: Newspaper, to: "/feed", key: "feed" },
  { icon: Users2, to: "/communities", key: "communities" },
  { icon: Radio, to: "/channels", key: "channels" },
  { icon: MessageSquare, to: "/messenger", key: "messenger" },
  { icon: CalendarDays, to: "/feed", key: "events" },
];

function QuickSections() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.quick.eyebrow")}</Eyebrow>
      <Title>{t("landing.quick.title")}</Title>
      <p className="mt-3 max-w-[560px]" style={mutedP}>
        {t("landing.quick.subtitle")}
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK.map(({ icon: Icon, to, key }) => (
          <Link key={key} to={to} className="group flex flex-col p-6 transition-all hover:-translate-y-1"
            style={cardStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
          >
            <div className="grid place-items-center" style={{ width: 46, height: 46, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon size={22} />
            </div>
            <h3 className="mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{t("landing.quick.items." + key + ".title")}</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t("landing.quick.items." + key + ".desc")}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>
              {t("landing.quick.open")} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
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
  const { t } = useTranslation();
  const items = mockAds.slice(0, 10);
  return (
    <Section bg="var(--background)">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>{t("landing.listings.eyebrow")}</Eyebrow>
          <Title>{t("landing.listings.title")}</Title>
        </div>
        <Link to="/ads" className="hidden shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] px-4 py-2.5 text-sm font-semibold sm:inline-flex"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >{t("landing.listings.all")} <ArrowRight size={15} /></Link>
      </div>

      {/* mobile: horizontal scroll (no page overflow); desktop: dense 4-up grid,
          5-up on very wide screens. Compact cards, more items visible. */}
      <div className="-mx-4 mt-8 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 2xl:grid-cols-5"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((ad) => (
          <LandingListingCard key={ad.id} ad={ad} />
        ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link to="/ads" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >{t("landing.listings.all")} <ArrowRight size={15} /></Link>
      </div>
    </Section>
  );
}

function LandingListingCard({ ad }: { ad: (typeof mockAds)[number] }) {
  const { t } = useTranslation();
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
      className="relative flex min-w-[200px] shrink-0 snap-start flex-col overflow-hidden sm:min-w-0"
      style={cardStyle}
      onMouseLeave={() => { setMenuOpen(false); setHovIdx(0); }}
    >
      {/* photo */}
      <button
        onClick={() => navigate({ to: "/ads/$id", params: { id: ad.id } })}
        className="relative block h-[150px] w-full overflow-hidden"
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
            <span style={{ fontSize: 11, color: "var(--foreground-30)" }}>{t("landing.listings.photoSoon")}</span>
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
        aria-label={fav ? t("landing.card.favRemove") : t("landing.card.favAdd")}
        onClick={() => setFav((v) => !v)}
        className="absolute right-3 top-3 grid place-items-center transition-transform hover:scale-110"
        style={{ width: 32, height: 32, borderRadius: "var(--r-pill)", background: "var(--background-elevated)", border: "1px solid var(--border)", color: fav ? "#e53935" : "var(--foreground-50)" }}
      >
        <Heart size={16} fill={fav ? "currentColor" : "none"} />
      </button>

      {/* three-dots menu */}
      <div className="absolute left-3 top-3">
        <button
          aria-label={t("landing.card.adMenu")}
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
            {(["hide", "notInterested", "report"] as const).map((k) => (
              <button key={k} onClick={() => setMenuOpen(false)}
                className="block w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover,var(--background-surface))]"
                style={{ color: "var(--foreground)" }}
              >{t("landing.card." + k)}</button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <button onClick={() => navigate({ to: "/ads/$id", params: { id: ad.id } })} className="flex flex-1 flex-col p-3 text-left">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--accent)", letterSpacing: "-0.01em" }}>
          {ad.price.toLocaleString("ru-RU")} ₽
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug" style={{ color: "var(--foreground)" }}>{ad.title}</div>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[11px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex items-center gap-1"><MapPin size={11} />{ad.city}</span>
          {ad.condition && (
            <span style={{ color: CONDITION_COLOR(ad.condition), fontWeight: 600 }}>{ad.condition}</span>
          )}
        </div>
      </button>
    </div>
  );
}

/* ===================== Categories ===================== */

const CATEGORIES: { icon: typeof Car; key: "aviation" | "cars" | "ships" | "railways" | "engines" | "radio" | "parts" | "tools"; count: string }[] = [
  { icon: Plane, key: "aviation", count: "180+" },
  { icon: Car, key: "cars", count: "320+" },
  { icon: Ship, key: "ships", count: "95+" },
  { icon: TrainFront, key: "railways", count: "60+" },
  { icon: Cpu, key: "engines", count: "140+" },
  { icon: Radio, key: "radio", count: "110+" },
  { icon: Package, key: "parts", count: "500+" },
  { icon: Wrench, key: "tools", count: "130+" },
];

function CategoriesSection() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.categories.eyebrow")}</Eyebrow>
      <Title>{t("landing.categories.title")}</Title>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {CATEGORIES.map(({ icon: Icon, key, count }) => (
          <Link key={key} to="/ads" className="group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5"
            style={cardStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
          >
            <div className="grid shrink-0 place-items-center transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]"
              style={{ width: 42, height: 42, borderRadius: "var(--r-card-sm)", background: "var(--background-elevated)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t("landing.categories.items." + key)}</div>
              <div className="text-xs" style={{ color: "var(--foreground-50)" }}>{count} {t("landing.categories.countSuffix")}</div>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ===================== 3 steps timeline ===================== */

const STEPS: { icon: typeof Compass; key: "direction" | "find" | "share" }[] = [
  { icon: Compass, key: "direction" },
  { icon: Search, key: "find" },
  { icon: Users2, key: "share" },
];

function StepsTimeline() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background)" id="how">
      <Eyebrow>{t("landing.steps.eyebrow")}</Eyebrow>
      <Title>{t("landing.steps.title")}</Title>

      <div className="relative mt-12">
        {/* connecting line (desktop) */}
        <div aria-hidden className="absolute left-0 right-0 top-[26px] hidden md:block" style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--border) 12%, var(--border) 88%, transparent)" }} />
        <motion.ol
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14 } } }}
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
          className="grid gap-8 md:grid-cols-3 md:gap-6"
        >
          {STEPS.map(({ icon: Icon, key }, i) => (
            <motion.li
              key={key}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
              className="relative flex flex-col"
            >
              <div className="mb-5 flex items-center gap-3 md:flex-col md:items-start">
                {/* node — reserves space for future model animation */}
                <div className="relative grid place-items-center" style={{ width: 54, height: 54, borderRadius: "var(--r-pill)", background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "var(--shadow-button)", zIndex: 1 }}>
                  <Icon size={24} />
                  <span className="absolute -right-1 -top-1 grid place-items-center rounded-full text-[11px] font-bold"
                    style={{ width: 22, height: 22, background: "var(--background)", color: "var(--accent)", border: "2px solid var(--accent)" }}>
                    {i + 1}
                  </span>
                </div>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--foreground)", letterSpacing: "-0.01em" }}>{t("landing.steps.items." + key + ".title")}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground-70)", maxWidth: 320 }}>{t("landing.steps.items." + key + ".desc")}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </Section>
  );
}

/* ===================== Pricing ===================== */

const PLANS: { key: "start" | "month" | "year"; accent?: boolean }[] = [
  { key: "start" },
  { key: "month", accent: true },
  { key: "year" },
];

function PricingSection() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.pricing.eyebrow")}</Eyebrow>
      <Title>{t("landing.pricing.title")}</Title>
      <p className="mt-3 max-w-[540px]" style={mutedP}>{t("landing.pricing.subtitle")}</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.key} className="relative flex flex-col p-7"
            style={{ ...cardStyle, borderColor: p.accent ? "var(--border-accent)" : "var(--border)", boxShadow: p.accent ? "var(--shadow-card-hover)" : "var(--shadow-xs)" }}
          >
            {p.accent && (
              <span className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{t("landing.pricing.recommended")}</span>
            )}
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{t("landing.pricing.plans." + p.key + ".name")}</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{t("landing.pricing.plans." + p.key + ".price")}</span>
              <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("landing.pricing.plans." + p.key + ".period")}</span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {(t("landing.pricing.plans." + p.key + ".features", { returnObjects: true }) as string[]).map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--foreground-70)" }}>
                  <Check size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} /><span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex-1" />
            <Link to="/subscription" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--r-pill)] text-sm font-semibold transition-opacity hover:opacity-90"
              style={p.accent ? { background: "var(--accent)", color: "var(--accent-foreground)" } : { background: "var(--background-elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >{t("landing.pricing.more")} <ArrowRight size={15} /></Link>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================== Why choose (value cards) ===================== */

const VALUES: { icon: typeof Sparkles; key: "focus" | "community" | "allInOne" | "direct" }[] = [
  { icon: Sparkles, key: "focus" },
  { icon: Users2, key: "community" },
  { icon: Boxes, key: "allInOne" },
  { icon: MessageSquare, key: "direct" },
];

function WhyChoose() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background)">
      <Eyebrow>{t("landing.values.eyebrow")}</Eyebrow>
      <Title>{t("landing.values.title")}</Title>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map(({ icon: Icon, key }) => (
          <div key={key} className="flex flex-col p-6" style={cardStyle}>
            <div className="grid place-items-center" style={{ width: 44, height: 44, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon size={20} />
            </div>
            <h3 className="mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>{t("landing.values.items." + key + ".title")}</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t("landing.values.items." + key + ".desc")}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ===================== FAQ ===================== */

function FaqSection() {
  const { t } = useTranslation();
  const items = t("landing.faq.items", { returnObjects: true }) as { q: string; a: string }[];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.faq.eyebrow")}</Eyebrow>
      <Title>{t("landing.faq.title")}</Title>
      <div className="mx-auto mt-9 max-w-[820px] space-y-2.5">
        {items.map((item, i) => {
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

const FOOTER_COLS: { key: "brand" | "docs" | "support"; links: { to: string; labelKey: string }[] }[] = [
  {
    key: "brand",
    links: [
      { to: "/info/about", labelKey: "about" },
      { to: "/info/company", labelKey: "company" },
      { to: "/info/partners", labelKey: "partners" },
      { to: "/info/advertising", labelKey: "advertising" },
    ],
  },
  {
    key: "docs",
    links: [
      { to: "/legal/rules", labelKey: "rules" },
      { to: "/legal/privacy", labelKey: "privacy" },
      { to: "/info/compliance", labelKey: "compliance" },
      { to: "/info/consent", labelKey: "consent" },
    ],
  },
  {
    key: "support",
    links: [
      { to: "/help", labelKey: "faq" },
      { to: "/info/support", labelKey: "support" },
      { to: "/info/feedback", labelKey: "feedback" },
      { to: "/info/feedback", labelKey: "contact" },
    ],
  },
];

function Footer() {
  const { t } = useTranslation();
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}>
      <div className="mx-auto grid gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] md:px-8" style={{ maxWidth: 1240 }}>
        <div>
          <Logo size={30} />
          <p className="mt-4 max-w-[260px] text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>
            {t("landing.footer.tagline")}
          </p>
          <p className="mt-4 text-xs" style={{ color: "var(--foreground-30)" }}>© {new Date().getFullYear()} {t("landing.hero.brand")}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--foreground-50)" }}>{t("landing.footer.theme")}</span>
            <ThemeToggle size={32} />
          </div>
        </div>

        {FOOTER_COLS.map((col) => (
          <div key={col.key}>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t("landing.footer.cols." + col.key + ".title")}</div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.labelKey}>
                  <Link to={l.to} className="text-sm transition-colors" style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >{t("landing.footer.cols." + col.key + ".links." + l.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* contacts */}
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t("landing.footer.contacts")}</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li>{t("landing.footer.hours")}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <span
                key={s.label}
                title={t("landing.footer.soon")}
                className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold"
                style={{
                  background: "var(--background-surface)",
                  color: "var(--foreground-50)",
                  border: "1px solid var(--border)",
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
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
