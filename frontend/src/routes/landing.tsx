import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User, Briefcase, Car, Plane, Ship, Crosshair, Cpu, Battery, Radio, Bike, Wrench, Check,
  ArrowRight, Crown, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { firstHundredStats } from "@/lib/mock";
import { showcaseImages } from "@/lib/showcase-images";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: tStatic("root.metaTitle") },
      { name: "description", content: tStatic("landing.metaDescription") },
      { property: "og:title", content: tStatic("landing.ogTitle") },
      { property: "og:description", content: tStatic("landing.ogDescription") },
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

const CATEGORY_DEFS = [
  { icon: Car, nameKey: "landing.catRcCars", countKey: "landing.catMembers320" },
  { icon: Plane, nameKey: "landing.catPlanes", countKey: "landing.catMembers180" },
  { icon: Ship, nameKey: "landing.catShips", countKey: "landing.catMembers95" },
  { icon: Crosshair, nameKey: "landing.catDrones", countKey: "landing.catMembers240" },
  { icon: Cpu, nameKey: "landing.catElectronics", countKey: "landing.catMembers150" },
  { icon: Battery, nameKey: "landing.catBatteries", countKey: "landing.catMembers85" },
  { icon: Radio, nameKey: "landing.catRadio", countKey: "landing.catMembers110" },
  { icon: Bike, nameKey: "landing.catScooters", countKey: "landing.catMembers70" },
  { icon: Wrench, nameKey: "landing.catParts", countKey: "landing.catMembers200" },
] as const;

const HOBBYIST_FEATURE_KEYS = [
  "landing.hobbyistF1",
  "landing.hobbyistF2",
  "landing.hobbyistF3",
  "landing.hobbyistF4",
  "landing.hobbyistF5",
] as const;

const PRO_FEATURE_KEYS = [
  "landing.proF1",
  "landing.proF2",
  "landing.proF3",
  "landing.proF4",
  "landing.proF5",
] as const;

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
  const { t } = useTranslation();
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
        >{t("index.heroLogin")}</Link>
        <Btn to="/register" variant="orange" arrow>{t("nav.register")}</Btn>
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
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
            <Sparkles size={12} />{t("landing.heroEyebrow")}</Eyebrow>
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
            {t("landing.heroTitleBefore")}{" "}
            <span
              style={{
                background: T.gradOrange,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("landing.heroTitleHighlight")}
            </span>
            {t("landing.heroTitleAfter")}
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
            {t("landing.heroSubtitle")}
          </p>

          <div className="mt-[36px] flex flex-wrap gap-[12px]">
            <Btn to="/register" variant="orange" size="lg" arrow>{t("landing.heroJoin")}</Btn>
            <Btn to="/communities" variant="outline" size="lg">{t("landing.heroViewCommunities")}</Btn>
          </div>

          <div className="mt-[48px] grid grid-cols-3 gap-[16px] sm:flex sm:gap-[56px]">
            {[
              { n: "1 200+", l: t("landing.statModelers") },
              { n: "45+", l: t("landing.statCommunities") },
              { n: "9", l: t("landing.statCategories") },
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

function ShowcaseSection() {
  const { t } = useTranslation();
  return (
    <section style={{ padding: "64px 20px", background: T.surfaceAlt }}>
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>{t("landing.catalogLabel")}</SectionLabel>
          <SectionTitle>{t("landing.catalogTitle")}</SectionTitle>
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
  const { t } = useTranslation();
  const taken = Math.max(0, Math.min(firstHundredStats.total, firstHundredStats.taken));
  const total = firstHundredStats.total;
  const pct = Math.round((taken / total) * 100);
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
              <Sparkles size={12} /> {t("landing.launchBadge")}
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
              <Crown size={12} />{t("components.firstHundredBadge")}</span>
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
            {t("landing.firstHundredTitle")}
          </h2>
          <p style={{ fontSize: 15, maxWidth: 620, opacity: 0.92, lineHeight: 1.5, fontWeight: 500 }}>
            {t("landing.firstHundredDesc")}
          </p>
          <div className="grid gap-[10px]" style={{ maxWidth: 560 }}>
            <div className="flex items-end justify-between gap-[12px]">
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28 }}>
                {t("landing.occupied", { taken, total })}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                {t("landing.spotsLeft", { left, word: left === 1 ? t("common.spot") : t("common.spots") })}
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
              {t("landing.getYearFree")}
            </Btn>
            <Btn to="/login" variant="light">
              {t("landing.alreadyWithUs")}
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
  const { t } = useTranslation();
  const hobbyistFeatures = HOBBYIST_FEATURE_KEYS.map((k) => t(k));
  const proFeatures = PRO_FEATURE_KEYS.map((k) => t(k));
  return (
    <section style={{ padding: "96px 20px", background: T.surfaceAlt }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="text-center">
          <SectionLabel>{t("landing.featuresLabel")}</SectionLabel>
          <SectionTitle>{t("landing.featuresTitle")}</SectionTitle>
          <p
            className="mx-auto mt-[14px]"
            style={{ color: T.textMuted, maxWidth: 540, fontSize: 16, fontWeight: 500 }}
          >
            {t("landing.featuresSubtitle")}
          </p>
        </div>
        <div className="mt-[48px] grid grid-cols-1 gap-[20px] md:grid-cols-2">
          <TrackCard
            icon={User}
            title={t("landing.hobbyistTitle")}
            description={t("landing.hobbyistDesc")}
            features={hobbyistFeatures}
            cta={t("landing.hobbyistCta")}
            ctaVariant="outline"
          />
          <TrackCard
            icon={Briefcase}
            title={t("landing.proTitle")}
            description={t("landing.proDesc")}
            features={proFeatures}
            cta={t("landing.proCta")}
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
  const { t } = useTranslation();
  return (
    <section style={{ padding: "96px 20px", background: T.surface }}>
      <div className="mx-auto" style={{ maxWidth: 1240 }}>
        <div className="text-center">
          <SectionLabel>{t("nav.categories")}</SectionLabel>
          <SectionTitle>{t("landing.categoriesTitle")}</SectionTitle>
          <p
            className="mx-auto mt-[14px]"
            style={{ color: T.textMuted, maxWidth: 520, fontSize: 16, fontWeight: 500 }}
          >
            {t("landing.categoriesSubtitle")}
          </p>
        </div>

        <div className="mt-[48px] grid grid-cols-2 gap-[14px] md:grid-cols-3">
          {CATEGORY_DEFS.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.nameKey}
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
                    {t(c.nameKey)}
                  </div>
                  <div style={{ marginTop: 2, color: T.textMuted, fontSize: 13, fontWeight: 500 }}>
                    {t(c.countKey)}
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
  const { t } = useTranslation();
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
          {t("landing.proofTitle")}
        </h2>
        <p
          className="mx-auto mt-[14px]"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: 540, fontSize: 16, fontWeight: 500 }}
        >
          {t("landing.proofSubtitle")}
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
            {t("landing.createAccountFree")}
          </Btn>
          <Btn to="/login" variant="outline" size="lg">
            <span style={{ color: "#fff" }}>{t("index.heroLogin")}</span>
          </Btn>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
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
          <p style={{ marginTop: 16, fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{t("landing.footerCopyright")}</p>
        </div>
        <FooterCol
          title={t("landing.footerPlatform")}
          links={[
            { to: "/", label: t("nav.feed") },
            { to: "/communities", label: t("nav.communities") },
            { to: "/ads", label: t("nav.ads") },
            { to: "/subscription", label: t("nav.subscription") },
          ]}
        />
        <FooterCol
          title={t("nav.categories")}
          links={[
            { to: "/categories", label: t("landing.allCategories") },
            { to: "/categories", label: t("landing.catRcCars") },
            { to: "/categories", label: t("landing.catPlanes") },
            { to: "/categories", label: t("landing.catDrones") },
          ]}
        />
        <FooterCol
          title={t("landing.footerContacts")}
          links={[
            { to: "/login", label: t("landing.navLogin") },
            { to: "/register", label: t("nav.register") },
          ]}
        />
      </div>
      <div
        className="px-[20px] pb-[32px] pt-[16px] text-center"
        style={{ color: T.textMuted, fontSize: 12, fontWeight: 500 }}
      >{t("landing.footerTagline")}</div>
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
