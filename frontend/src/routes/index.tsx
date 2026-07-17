import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, ChevronDown, Plus,
  Newspaper, Megaphone, Users2, Radio, MessageSquare, Heart, MoreVertical,
  MapPin, Search, Compass, ImageOff, Clapperboard,
  Target, HeartHandshake, LayoutGrid, Send,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher, LANGS } from "@/components/messenger/LanguageSwitcher";
import { setLocale } from "@/lib/i18n";
import { isDemoMode } from "@/lib/demo-mode";
import { ensureSession } from "@/lib/auth/session";
import { GUEST_USER, actions, selectors, useStore } from "@/lib/store";
import { fetchPopularListings, addFavoriteListing, removeFavoriteListing } from "@/lib/api/listings";
import { getToken } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import { fetchPostCategories } from "@/lib/api/categories";
import { fetchLandingStats, formatLandingStat } from "@/lib/api/landing";
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { PlanTermSelector } from "@/components/subscription/PlanTermSelector";
import type { Ad, Category } from "@/lib/mock";
import cover from "@/assets/cover-modelizm.jpg";
import { SOCIAL_LINKS } from "@/lib/footer-links";
import { blueprintGridOnDark, blueprintGridOnLight, blueprintGridSize } from "@/lib/brand-pattern";

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

function TopNav() {
  const { t, i18n } = useTranslation();
  const enter = useEnter();
  const me = useStore(selectors.currentUser);
  const [sessionReady, setSessionReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void ensureSession().finally(() => setSessionReady(true));
  }, []);

  const loggedIn = sessionReady && me.id !== GUEST_USER.id;
  const navLinks: Array<
    | { kind: "route"; to: "/ads" | "/communities" | "/channels" | "/subscription"; label: string }
    | { kind: "hash"; href: "#how"; label: string }
  > = [
    { kind: "route", to: "/ads", label: t("landing.nav.ads") },
    { kind: "route", to: "/communities", label: t("landing.nav.communities") },
    { kind: "route", to: "/channels", label: t("landing.nav.channels") },
    { kind: "hash", href: "#how", label: t("landing.nav.how") },
    { kind: "route", to: "/subscription", label: t("landing.nav.subscription") },
  ];

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

        {/* desktop nav — nowrap keeps header width stable across locales */}
        <nav className="landing-nav hidden items-center gap-5 lg:flex">
          {navLinks.map((l) =>
            l.kind === "hash" ? (
              <a key={l.label} href={l.href} className="landing-nav-link text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{l.label}</a>
            ) : (
              <Link key={l.label} to={l.to} className="landing-nav-link text-sm font-medium transition-colors" style={navLinkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-70)")}
              >{l.label}</Link>
            ),
          )}
        </nav>

        {/* right controls */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {loggedIn ? (
            <>
              {me.isAdmin && (
                <Link
                  to="/admin"
                  className="hidden rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition-colors sm:inline-flex"
                  style={{ color: "var(--foreground-70)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {t("nav.admin")}
                </Link>
              )}
              <Link
                to="/feed"
                className="inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--r-pill)] px-[14px] text-[13px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 sm:h-[40px] sm:px-[18px] sm:text-sm"
                style={{ background: "var(--accent)", boxShadow: "var(--shadow-button)" }}
              >
                {t("landing.nav.cabinet")}
                <ArrowRight size={15} className="hidden shrink-0 sm:block" />
              </Link>
            </>
          ) : (
            <>
              <Link to={enter.login} className="landing-nav-cta-secondary hidden rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold transition-colors sm:inline-flex"
                style={{ color: "var(--foreground-70)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >{t("landing.nav.login")}</Link>
              <Link to={enter.register} className="landing-nav-cta-primary inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--r-pill)] px-[14px] text-[13px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 sm:h-[40px] sm:min-w-[12.5rem] sm:px-[18px] sm:text-sm"
                style={{ background: "var(--accent)", boxShadow: "var(--shadow-button)" }}
              >
                {enter.demo ? t("landing.nav.demo") : t("landing.nav.register")}
                <ArrowRight size={15} className="hidden shrink-0 sm:block" />
              </Link>
            </>
          )}

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
              {navLinks.map((l) =>
                l.kind === "hash" ? (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={(e) => {
                      // Closing the menu (height: auto -> 0) and the native
                      // hash jump would otherwise fire in the same tick — the
                      // jump lands correctly, then the collapse animation
                      // shifts the whole page under it, missing the target.
                      // Close first, scroll manually once the sheet has
                      // finished collapsing (matches its ~300ms default
                      // Framer Motion transition).
                      e.preventDefault();
                      setMenuOpen(false);
                      const href = l.href;
                      setTimeout(() => {
                        document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 320);
                    }}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} to={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>{l.label}</Link>
                ),
              )}
              <div className="my-1 h-px sm:hidden" style={{ background: "var(--border)" }} />
              <Link to={enter.login} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold sm:hidden" style={{ color: "var(--foreground)" }}>{t("landing.nav.login")}</Link>
              {/* theme — mobile-only entry point, since ThemeToggle itself is
                  hidden below lg everywhere except here (alwaysVisible) and
                  the footer; both read/write the same ThemeProvider state,
                  so toggling here or in the footer stays in sync. */}
              <div className="mt-1 flex items-center justify-between px-3 py-1.5 lg:hidden">
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("landing.footer.theme")}</span>
                <ThemeToggle size={32} alwaysVisible />
              </div>
              {/* language — quiet inline chips, at the bottom (mobile only; sm+ has it in the header) */}
              <div className="mt-1 flex items-center gap-1.5 px-3 pt-1 sm:hidden">
                {LANGS.map((l) => {
                  const active = i18n.language === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => { setLocale(l.code); setMenuOpen(false); }}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium"
                      style={{
                        background: active ? "var(--background-surface)" : "transparent",
                        color: active ? "var(--foreground)" : "var(--foreground-60)",
                        border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{l.flag}</span>
                      {l.code.toUpperCase()}
                    </button>
                  );
                })}
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
  const { t } = useTranslation();
  const enter = useEnter();
  const navigate = useNavigate();
  const [videoError, setVideoError] = useState(false);
  const [ready, setReady] = useState(false);
  // Respect "reduce motion": the hero entrance runs on mount, and under
  // reduced motion the variant never reaches "visible" — leaving the whole
  // above-the-fold hero (title/CTA/stats) invisible. Start it visible instead.
  const reduce = useReducedMotion();
  const [stats, setStats] = useState({ users: 0, communities: 0, listing_categories: 0 });
  // Weak-network guard: the hero video is ~6 MB. On small screens, Save-Data,
  // or slow connections we skip it entirely and show the lightweight poster —
  // critical for regional mobile users. Only load video on capable connections.
  const [allowVideo, setAllowVideo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchLandingStats()
      .then((data) => { if (alive) setStats(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = conn?.saveData === true;
    const slow = !!conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType);
    const bigScreen = window.matchMedia("(min-width: 768px)").matches;
    setAllowVideo(bigScreen && !saveData && !slow);
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
        {videoError || !allowVideo ? (
          <img src={cover} alt={t("landing.hero.videoAlt")} className="h-full w-full object-cover" />
        ) : (
          <video
            poster={cover}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            onError={() => setVideoError(true)}
            className="h-full w-full object-cover"
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        )}
        {/* dark overlay — fixed dark color at the bottom, independent of theme
            (var(--background) turned white in light theme and washed out the video).
            Blueprint grid layered on top (first background = topmost) as the
            brand's one decorative motif — modelism assembly drawings, not
            generic SaaS decor. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, rgba(9,11,20,0.92) 100%)",
          }}
        />
      </div>


      {/* content */}
      <div className="relative z-10 mx-auto flex max-w-[1240px] flex-col items-start justify-center px-4 md:px-8" style={{ minHeight: "min(88vh, 760px)" }}>
        <AnimatePresence>
          {ready && (
            <motion.div variants={stagger} initial={reduce ? "visible" : "hidden"} animate="visible" className="w-full max-w-[720px] py-20">
              <motion.h1
                variants={fadeUp}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(44px, 8vw, 92px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.035em",
                  fontWeight: 800,
                  color: "#ffffff",
                  textShadow: "0 4px 30px rgba(0,0,0,0.45)",
                }}
              >
                {t("landing.hero.brand")}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="landing-hero-tagline mt-4"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.4vw, 26px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}
              >
                {t("landing.hero.tagline")}
              </motion.p>

              <motion.p
                variants={fadeUp}
                className="landing-hero-subtitle mt-4"
                style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(235,238,248,0.86)", maxWidth: 560, lineHeight: 1.55 }}
              >
                {t("landing.hero.subtitle")}
              </motion.p>

              <motion.div variants={fadeUp} className="landing-hero-ctas mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={() => navigate({ to: "/ads" })} style={ctaPrimary}
                  className="landing-hero-cta h-[48px] px-[22px] text-[15px] sm:h-[54px] sm:px-[28px] sm:text-[16px]"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover, #4f6ae6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <Search size={18} /> {t("landing.hero.ctaBrowse")}
                </button>
                <button onClick={() => navigate({ to: enter.register })} style={ctaGhost}
                  className="landing-hero-cta h-[48px] px-[22px] text-[15px] sm:h-[54px] sm:px-[28px] sm:text-[16px]"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  {enter.demo ? t("landing.nav.demo") : t("landing.nav.register")} <ArrowRight size={18} className="hidden shrink-0 sm:block" />
                </button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { n: formatLandingStat(stats.users), l: t("landing.hero.stats.modelers") },
                  { n: formatLandingStat(stats.communities), l: t("landing.hero.stats.communities") },
                  { n: String(stats.listing_categories || 0), l: t("landing.hero.stats.categories") },
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "#fff", letterSpacing: "-0.025em" }}>{s.n}</div>
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
  borderRadius: "var(--r-pill)",
  background: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 700,
  border: "none", cursor: "pointer", boxShadow: "var(--shadow-button)", transition: "background 180ms",
};
const ctaGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
  borderRadius: "var(--r-pill)",
  background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700,
  border: "2px solid rgba(255,255,255,0.28)", cursor: "pointer", backdropFilter: "blur(8px)", transition: "background 180ms",
};
const ctaText: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: 54, padding: "0 20px", borderRadius: "var(--r-pill)",
  background: "transparent", color: "#fff", fontSize: 16, fontWeight: 600,
  border: "none", cursor: "pointer",
};

/* ===================== Quick sections ("Что есть в МоДелизМ") ===================== */

const QUICK_KEYS = [
  { icon: Megaphone, key: "ads", to: "/ads" },
  { icon: Newspaper, key: "feed", to: "/feed" },
  { icon: Users2, key: "communities", to: "/communities" },
  { icon: Radio, key: "channels", to: "/channels" },
  { icon: MessageSquare, key: "messenger", to: "/messenger" },
  { icon: Clapperboard, key: "reviews", to: "/reviews" },
] as const;

function QuickSections() {
  const { t } = useTranslation();
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.quick.eyebrow")}</Eyebrow>
      <Title>{t("landing.quick.title")}</Title>
      <p className="landing-section-lead mt-3 max-w-[560px]" style={mutedP}>
        {t("landing.quick.subtitle")}
      </p>
      <div className="mt-10 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_KEYS.filter((q) => q.key !== "communities" || communitiesEnabled).map(({ icon: Icon, key, to }) => (
          <Link
            key={key}
            to={to}
            className="group landing-tap-card landing-tap-card--lift flex h-full flex-col p-6"
            style={cardStyle}
          >
            <div className="grid place-items-center" style={{ width: 46, height: 46, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon size={22} />
            </div>
            <h3 className="landing-quick-title mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>{t(`landing.quick.items.${key}.title`)}</h3>
            <p className="landing-quick-desc mt-1.5 flex-1 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t(`landing.quick.items.${key}.desc`)}</p>
            <span className="landing-tap-card-arrow mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>
              {t("landing.quick.open")} <ArrowRight size={14} />
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

/* Landing "Популярные объявления" always shows exactly this many cards, so the
 * grid never renders a short/ragged final row. 12 divides evenly into the grid's
 * column counts at every breakpoint (3 / 4 / 6), so all rows are full.
 * We fetch up to 12 real listings ("popular" is already a global selection —
 * no direction/date narrowing to widen); if the whole catalog has fewer than 12,
 * the remaining slots are backfilled with a "Разместить объявление" CTA card. */
const POPULAR_SLOTS = 12;

function PopularListings() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPopularListings(POPULAR_SLOTS)
      .then((list) => { if (alive) setItems(list.slice(0, POPULAR_SLOTS)); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const priceLocale = i18n.language === "ru" ? "ru-RU" : i18n.language === "zh" ? "zh-CN" : "en-US";
  const placeholderCount = Math.max(0, POPULAR_SLOTS - items.length);

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

      <div className="-mx-4 mt-8 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 2xl:grid-cols-6"
      >
        {loading ? (
          <p className="col-span-full text-sm" style={{ color: "var(--foreground-50)" }}>{t("landing.listings.loading")}</p>
        ) : (
          <>
            {items.map((ad) => (
              <LandingListingCard key={ad.id} ad={ad} priceLocale={priceLocale} />
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <ListingCtaPlaceholder key={`listing-cta-${i}`} label={t("landing.listings.postCta")} />
            ))}
          </>
        )}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link to="/ads" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >{t("landing.listings.all")} <ArrowRight size={15} /></Link>
      </div>
    </Section>
  );
}

/** Backfill card for the popular-listings grid: a real, tappable CTA to post an
 *  ad, shown when the catalog has fewer than POPULAR_SLOTS listings. Keeps the
 *  grid always full (never a ragged final row) while staying honest — it's an
 *  action, not a fake listing. */
function ListingCtaPlaceholder({ label }: { label: string }) {
  return (
    <Link
      to="/ads/new"
      className="group landing-tap-card landing-tap-card--lift flex w-[80vw] max-w-[300px] shrink-0 snap-start flex-col items-center justify-center gap-2 overflow-hidden p-6 text-center sm:w-auto sm:max-w-none"
      style={{ ...cardStyle, borderStyle: "dashed" }}
    >
      <div className="grid place-items-center" style={{ width: 46, height: 46, borderRadius: "var(--r-pill)", background: "var(--accent-soft)", color: "var(--accent)" }}>
        <Plus size={22} />
      </div>
      <span className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{label}</span>
    </Link>
  );
}

function LandingListingCard({ ad, priceLocale }: { ad: Ad; priceLocale: string }) {
  const { t } = useTranslation();
  const fav = useStore(selectors.isAdFavorite(ad.id));
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
      className="relative flex w-[80vw] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden sm:w-auto sm:max-w-none"
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
        onClick={async () => {
          if (!getToken() && !isDemoMode()) {
            toast.info("Войдите, чтобы добавить в избранное");
            navigate({ to: "/login" });
            return;
          }
          const next = !fav;
          actions.toggleFavoriteAd(ad.id);
          if (!isDemoMode()) {
            try {
              if (next) await addFavoriteListing(ad.id);
              else await removeFavoriteListing(ad.id);
            } catch {
              actions.toggleFavoriteAd(ad.id);
              toast.error("Не удалось обновить избранное", { id: "favorite-toggle" });
              return;
            }
          }
          toast.success(next ? "В избранное" : "Убрано из избранного", { id: "favorite-toggle" });
        }}
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
            {[t("landing.card.hide"), t("landing.card.notInterested"), t("landing.card.report")].map((label) => (
              <button key={label} onClick={() => {
                setMenuOpen(false);
                if (!getToken() && !isDemoMode()) {
                  toast.info("Войдите, чтобы выполнить это действие");
                  navigate({ to: "/login" });
                  return;
                }
                toast(`${label}: будет доступно позже`);
              }}
                className="block w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover,var(--background-surface))]"
                style={{ color: "var(--foreground)" }}
              >{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <button onClick={() => navigate({ to: "/ads/$id", params: { id: ad.id } })} className="flex flex-1 flex-col p-3 text-left">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--accent)", letterSpacing: "-0.01em" }}>
          {ad.price.toLocaleString(priceLocale)} ₽
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

const STEP_KEYS = ["direction", "find", "share"] as const;
const STEP_ICONS = [Compass, Search, Users2] as const;

function CategoriesSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Single source of truth: fetchPostCategories() is the same call (and
    // same module-level cache) FeedRightRail uses on /feed for its
    // "Направления" list — so the landing and /feed are guaranteed to show
    // identical names/order, not two independently-fetched lists that can
    // drift apart (fetchListingCategories hits a different backend endpoint,
    // /categories/listings vs /categories/posts, with its own cache).
    fetchPostCategories()
      .then((list) => { if (alive) setCategories(list); })
      .catch(() => { if (alive) setCategories([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.categories.eyebrow")}</Eyebrow>
      <Title>{t("landing.categories.title")}</Title>
      {loading ? (
        <p className="mt-10 text-sm" style={{ color: "var(--foreground-50)" }}>{t("landing.categories.loading")}</p>
      ) : categories.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--foreground-50)" }}>{t("landing.categories.empty")}</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => {
            const Icon = resolveLucideIcon(cat.icon);
            const count = cat.listingsCount ?? cat.members ?? 0;
            return (
              // Same destination as the /feed «Направления» right-rail item —
              // the category page (/categories/$id), not a filtered feed — so
              // both entry points land in one place for logged-in users. Guests
              // are sent to auth first, matching the landing's gate pattern
              // (popular-listings card actions).
              <Link key={cat.id} to="/categories/$id" params={{ id: cat.id }}
                className="group landing-tap-card landing-tap-card--lift-sm flex items-center gap-[10px] p-3 sm:gap-3 sm:p-4"
                style={cardStyle}
              >
                <div className="grid h-[36px] w-[36px] shrink-0 place-items-center transition-colors group-hover:bg-[var(--neutral-700)] group-hover:text-[var(--neutral-50)] sm:h-[42px] sm:w-[42px]"
                  style={{ borderRadius: "var(--r-card-sm)", background: "var(--background-elevated)", color: "var(--foreground-70)", border: "1px solid var(--border)" }}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0">
                  {/* hyphens:auto (with lang=ru on <html>) lets long single-word
                      names like "Радиоаппаратура"/"Робототехника" break at a
                      real syllable with a hyphen instead of an ugly mid-word
                      split — break-words alone forced a raw character-level
                      break with no hyphen. */}
                  <div
                    className="text-[13px] font-semibold leading-tight sm:text-sm"
                    style={{ color: "var(--foreground)", hyphens: "auto", overflowWrap: "break-word" }}
                    lang="ru"
                  >
                    {cat.name}
                  </div>
                  <div className="mt-[2px] text-xs" style={{ color: "var(--foreground-50)" }}>{count} {t("landing.categories.countSuffix")}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/* ===================== 3 steps timeline ===================== */

function StepsTimeline() {
  const { t } = useTranslation();
  // Same reduced-motion issue as the hero: framer-motion doesn't reliably
  // resolve a whileInView transition to its end state under reduced motion
  // (observed stuck mid-fade, e.g. opacity ~0.26). Start at the "visible"
  // variant directly so the content is correct even if the scroll-triggered
  // animation never completes.
  const reduce = useReducedMotion();
  return (
    <Section bg="var(--background)" id="how">
      <Eyebrow>{t("landing.steps.eyebrow")}</Eyebrow>
      <Title>{t("landing.steps.title")}</Title>
      <div className="relative mt-12">
        <div aria-hidden className="absolute left-0 right-0 top-[26px] hidden md:block" style={{ height: 2, background: "linear-gradient(90deg, transparent, var(--border) 12%, var(--border) 88%, transparent)" }} />
        <motion.ol variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14 } } }} initial={reduce ? "visible" : "hidden"} whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="grid gap-8 md:grid-cols-3 md:gap-6">
          {STEP_KEYS.map((key, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <motion.li key={key} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }} className="relative flex flex-col">
                <div className="mb-5 flex items-center gap-3 md:flex-col md:items-start">
                  <div className="relative grid place-items-center" style={{ width: 54, height: 54, borderRadius: "var(--r-pill)", background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "var(--shadow-button)", zIndex: 1 }}>
                    <Icon size={24} />
                    <span className="absolute -right-1 -top-1 grid place-items-center rounded-full text-[11px] font-bold" style={{ width: 22, height: 22, background: "var(--background)", color: "var(--accent)", border: "2px solid var(--accent)" }}>{i + 1}</span>
                  </div>
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--foreground)", letterSpacing: "-0.01em" }}>{t(`landing.steps.items.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground-70)", maxWidth: 320 }}>{t(`landing.steps.items.${key}.desc`)}</p>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </Section>
  );
}

function PricingSection() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background-surface)">
      <Eyebrow>{t("landing.pricing.eyebrow")}</Eyebrow>
      <Title>{t("landing.pricing.title")}</Title>
      <p className="mt-3 max-w-[540px]" style={mutedP}>{t("landing.pricing.subtitle")}</p>
      {/* Mobile keeps the narrow single-card width (max-w-[420px]); desktop
          widens to fit PlanTermSelector's 3-column open-cards layout
          (~230px card x3 + 16px gaps x2). */}
      <div className="mx-auto mt-10 max-w-[420px] md:max-w-[760px]">
        <PlanTermSelector
          renderCta={() => (
            <Link
              to="/subscription"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--r-pill)] text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {t("landing.pricing.more")} <ArrowRight size={15} />
            </Link>
          )}
        />
      </div>
    </Section>
  );
}

const VALUE_KEYS = ["focus", "community", "allInOne", "direct"] as const;
// Distinct, topical icons per value (P1d.17): niche focus, community,
// everything-in-one, direct deals — instead of near-generic repeats.
const VALUE_ICONS = [Target, HeartHandshake, LayoutGrid, Send] as const;

function WhyChoose() {
  const { t } = useTranslation();
  return (
    <Section bg="var(--background)">
      <Eyebrow>{t("landing.values.eyebrow")}</Eyebrow>
      <Title>{t("landing.values.title")}</Title>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_KEYS.map((key, i) => {
          const Icon = VALUE_ICONS[i];
          return (
            <div
              key={key}
              className="flex flex-col p-6"
              style={
                // Micro-asymmetry, deliberately singular: only the first of
                // these four cards breaks the grid's perfect alignment — a
                // living accent, not a site-wide pattern (per the brief:
                // "1-2 accents, not a style"). Marketing content only, well
                // clear of catalog/cards/cart/forms/admin.
                i === 0 ? { ...cardStyle, transform: "rotate(-1.2deg)" } : cardStyle
              }
            >
              <div className="grid place-items-center" style={{ width: 44, height: 44, borderRadius: "var(--r-card-sm)", background: "var(--accent-soft)", color: "var(--accent)" }}>
                <Icon size={20} />
              </div>
              <h3 className="mt-4" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>{t(`landing.values.items.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t(`landing.values.items.${key}.desc`)}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ===================== FAQ ===================== */

function FaqSection() {
  const { t } = useTranslation();
  const items = t("landing.faq.items", { returnObjects: true }) as { q: string; a: string }[];
  const [open, setOpen] = useState<number | null>(null);
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

const FOOTER_COL_KEYS = ["brand", "docs", "support"] as const;
const FOOTER_LINK_KEYS = {
  brand: ["about", "company", "partners", "advertising"],
  docs: ["rules", "privacy", "compliance", "consent"],
  support: ["faq", "support", "feedback", "contact"],
} as const;
const FOOTER_LINK_TO: Record<string, string> = {
  about: "/info/about", company: "/info/company", partners: "/info/partners", advertising: "/info/advertising",
  rules: "/legal/rules", privacy: "/legal/privacy", compliance: "/info/compliance", consent: "/info/consent",
  faq: "/help", support: "/info/support", feedback: "/info/feedback", contact: "/info/feedback",
};

function Footer() {
  const { t } = useTranslation();
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}>
      <div className="mx-auto grid gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] md:px-8" style={{ maxWidth: 1240 }}>
        <div>
          <Logo size={30} />
          <p className="mt-4 max-w-[260px] text-sm leading-relaxed" style={{ color: "var(--foreground-70)" }}>{t("landing.footer.tagline")}</p>
          <p className="mt-4 text-xs" style={{ color: "var(--foreground-30)" }}>© {new Date().getFullYear()} {t("common.appName")}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--foreground-50)" }}>{t("landing.footer.theme")}</span>
            <ThemeToggle size={32} alwaysVisible />
          </div>
        </div>

        {FOOTER_COL_KEYS.map((colKey) => (
          <div key={colKey}>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t(`landing.footer.cols.${colKey}.title`)}</div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {FOOTER_LINK_KEYS[colKey].map((linkKey) => (
                <li key={linkKey}>
                  <Link to={FOOTER_LINK_TO[linkKey]} className="text-sm transition-colors" style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-700)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >{t(`landing.footer.cols.${colKey}.links.${linkKey}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t("landing.footer.contacts")}</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li>{t("landing.footer.hours")}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <span key={s.label} title={t("landing.footer.soon")} className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold"
                style={{ background: "var(--background-surface)", color: "var(--foreground-50)", border: "1px solid var(--border)" }}
              >{s.label}</span>
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
    <section
      id={id}
      style={{
        // Blueprint grid over the flat section color — background-color is
        // always the bottommost layer, so the pattern just needs its own
        // background-image on top. Same brand motif as the hero.
        backgroundColor: bg,
        backgroundImage: blueprintGridOnLight,
        backgroundSize: blueprintGridSize,
        padding: "72px 0",
        // Anchor targets (e.g. #how) must clear the sticky 64px header —
        // without this, a hash jump lands the section flush with the
        // viewport top, right under the overlapping header.
        ...(id ? { scrollMarginTop: "calc(64px + var(--safe-top, 0px))" } : {}),
      }}
    >
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
    <h2 className="mt-3" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px, 3.6vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--foreground)" }}>{children}</h2>
  );
}

const mutedP: React.CSSProperties = { fontSize: 15, color: "var(--foreground-70)", lineHeight: 1.6 };

const cardStyle: React.CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--shadow-xs)",
};
