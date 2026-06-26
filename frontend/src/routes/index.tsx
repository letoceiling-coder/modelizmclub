import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, ArrowRight, UserPlus, LogIn, ChevronDown,
  Newspaper, MessageSquare, Megaphone, Users2, Compass, Check, Plus,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import cover from "@/assets/cover-modelizm.jpg";
import { ROUTE_SEARCH } from "@/lib/route-search";

const VIDEO_URL = "";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: tStatic("root.metaTitle") },
      { name: "description", content: tStatic("index.metaDescription") },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { t } = useTranslation();
  return (
    <div className="relative w-full" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <ZeroBlock />
      <BridgeDivider />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FaqSection />
      <FooterSection />
    </div>
  );
}

/* ===================== ZeroBlock (DO NOT REDESIGN) ===================== */

function ZeroBlock() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [videoError, setVideoError] = useState(!VIDEO_URL);

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (videoRef.current && !videoError) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [videoError]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else v.play().catch(() => {});
    setIsPlaying(!isPlaying);
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  }

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "100dvh" }}>
      <div className="absolute inset-0 z-0">
        {videoError ? (
          <>
            <img src={cover} alt={t("index.coverAlt")} className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(26,26,30,0.55) 0%, rgba(26,26,30,0.75) 60%, var(--bg-primary) 100%)" }} />
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              src={VIDEO_URL}
              poster={cover}
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setVideoLoaded(true)}
              onError={() => setVideoError(true)}
              className={`h-full w-full object-cover transition-opacity duration-1000 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(26,26,30,0.45) 0%, rgba(26,26,30,0.70) 65%, var(--bg-primary) 100%)" }} />
          </>
        )}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="absolute top-0 right-0 z-20 flex items-center gap-[12px] p-[24px]">
        <ThemeToggle />
      </div>

      {!videoError && (
        <div className="absolute bottom-[24px] right-[24px] z-20 hidden sm:flex gap-[8px]">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? t("index.pause") : t("index.play")}
            className="grid place-items-center"
            style={{ width: 40, height: 40, borderRadius: "var(--r-pill)", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(8px)" }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={toggleMute}
            aria-label={isMuted ? t("index.unmute") : t("index.mute")}
            className="grid place-items-center"
            style={{ width: 40, height: 40, borderRadius: "var(--r-pill)", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(8px)" }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center px-[24px] text-center" style={{ minHeight: "100dvh" }}>
        <AnimatePresence>
          {showContent && (
            <motion.div
              key="hero"
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="flex w-full max-w-[820px] flex-col items-center"
            >
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-[8px]"
                style={{
                  background: "rgba(229, 57, 53, 0.12)",
                  border: "1px solid rgba(229, 57, 53, 0.30)",
                  color: "#ef5350",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: "var(--r-pill)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ef5350" }} />{t("index.heroBadge")}</motion.div>

              <motion.h1
                variants={fadeUp}
                className="mt-[24px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 8vw, 96px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.04em",
                  fontWeight: 900,
                  color: "#ffffff",
                  textShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}
              >
                МоДелизМ
                <br />
                <span style={{ color: "#e53935" }}>{t("common.forum")}</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-[24px]"
                style={{
                  fontSize: "clamp(16px, 2vw, 20px)",
                  color: "rgba(240,240,240,0.85)",
                  maxWidth: 560,
                  lineHeight: 1.5,
                  textShadow: "0 2px 12px rgba(0,0,0,0.4)",
                }}
              >
                {t("index.heroSubtitle")}
              </motion.p>

              <motion.div variants={fadeUp} className="mt-[40px] flex flex-col sm:flex-row items-stretch sm:items-center gap-[12px] w-full sm:w-auto">
                <button
                  onClick={() => navigate({ to: "/register", search: ROUTE_SEARCH.register })}
                  className="flex items-center justify-center gap-[10px] active:scale-[0.97] transition-all"
                  style={{
                    padding: "0 32px",
                    height: 56,
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent)",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: "var(--shadow-glow-accent)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <UserPlus size={18} />{t("auth.submitRegister")}<ArrowRight size={18} />
                </button>

                <button
                  onClick={() => navigate({ to: "/login" })}
                  className="flex items-center justify-center gap-[10px] active:scale-[0.97] transition-all"
                  style={{
                    padding: "0 32px",
                    height: 56,
                    borderRadius: "var(--r-pill)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    border: "2px solid rgba(255,255,255,0.25)",
                    cursor: "pointer",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                >
                  <LogIn size={18} />{t("index.heroLogin")}</button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-[48px] flex items-center justify-center gap-[24px] sm:gap-[48px] flex-wrap">
                {[
                  { value: "5 000+", labelKey: "index.statModelers" as const },
                  { value: "12", labelKey: "index.statCategories" as const },
                  { value: "24/7", labelKey: "index.statAccess" as const },
                ].map((s) => (
                  <div key={s.labelKey} className="flex flex-col items-center">
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(240,240,240,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                      {t(s.labelKey)}
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="absolute bottom-[24px] left-1/2 z-10 hidden sm:flex -translate-x-1/2 flex-col items-center gap-[6px]"
          style={{ color: "rgba(240,240,240,0.6)" }}
        >
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--font-mono)" }}>{t("index.heroLearnMore")}</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown size={20} />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}

/* ===================== Shared motion ===================== */

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="mx-auto max-w-[720px] text-center"
    >
      <motion.div
        variants={fadeInUp}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 600,
        }}
      >
        {eyebrow}
      </motion.div>
      <motion.h2
        variants={fadeInUp}
        className="mt-[12px]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 4vw, 44px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          fontWeight: 800,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeInUp}
          className="mt-[14px]"
          style={{ fontSize: 15, color: "var(--text-secondary, var(--foreground-70))", lineHeight: 1.6 }}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

/* ===================== Bridge between Hero and Features ===================== */

function BridgeDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 80,
        background: "linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary, #1e1e22) 100%)",
      }}
    />
  );
}

/* ===================== Block 1. Возможности ===================== */

const FEATURE_DEFS = [
  { icon: Newspaper, titleKey: "index.featureFeedTitle", textKey: "index.featureFeedText" },
  { icon: MessageSquare, titleKey: "index.featureChatTitle", textKey: "index.featureChatText" },
  { icon: Megaphone, titleKey: "index.featureAdsTitle", textKey: "index.featureAdsText" },
  { icon: Users2, titleKey: "index.featureCommTitle", textKey: "index.featureCommText" },
] as const;

function FeaturesSection() {
  const { t } = useTranslation();
  return (
    <section
      id="features"
      className="px-[20px] py-[80px] sm:py-[112px]"
      style={{ background: "var(--bg-secondary, #1e1e22)" }}
    >
      <div className="mx-auto max-w-[1180px]">
        <SectionHeader
          eyebrow={t("index.featuresEyebrow")}
          title={t("index.featuresTitle")}
          description={t("index.featuresDesc")}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-[48px] grid gap-[16px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURE_DEFS.map(({ icon: Icon, titleKey, textKey }) => (
            <motion.div
              key={titleKey}
              variants={fadeInUp}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col p-[24px]"
              style={{
                background: "var(--bg-tertiary, #26262b)",
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                borderRadius: 18,
                boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 28px -20px rgba(0,0,0,0.55)",
              }}
            >
              <div
                className="grid place-items-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(229, 57, 53, 0.12)",
                  border: "1px solid rgba(229, 57, 53, 0.25)",
                  color: "var(--accent)",
                }}
              >
                <Icon size={20} />
              </div>
              <h3
                className="mt-[18px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--text-primary)",
                }}
              >
                {t(titleKey)}
              </h3>
              <p
                className="mt-[8px]"
                style={{ fontSize: 14, lineHeight: 1.55, color: "var(--foreground-70, rgba(240,240,240,0.7))" }}
              >
                {t(textKey)}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ===================== Block 2. Как это работает ===================== */

const STEP_DEFS = [
  { n: "01", icon: UserPlus, titleKey: "nav.register", textKey: "index.howRegisterText" },
  { n: "02", icon: Compass, titleKey: "index.howInterests", textKey: "index.howInterestsText" },
  { n: "03", icon: MessageSquare, titleKey: "index.howTalk", textKey: "index.howTalkText" },
] as const;

function HowItWorksSection() {
  const { t } = useTranslation();
  return (
    <section
      id="how"
      className="px-[20px] py-[80px] sm:py-[112px]"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="mx-auto max-w-[1180px]">
        <SectionHeader
          eyebrow={t("index.howEyebrow")}
          title={t("index.howTitle")}
          description={t("index.howDesc")}
        />

        <motion.ol
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-[48px] grid gap-[16px] sm:gap-[20px] grid-cols-1 md:grid-cols-3 relative"
        >
          {STEP_DEFS.map(({ n, icon: Icon, titleKey, textKey }, i) => (
            <motion.li
              key={n}
              variants={fadeInUp}
              className="relative flex flex-col p-[28px]"
              style={{
                background: "var(--bg-secondary, #1e1e22)",
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                borderRadius: 18,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.16em",
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  {t("index.howStep", { n })}
                </span>
                <div
                  className="grid place-items-center"
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    color: "var(--text-primary)",
                  }}
                >
                  <Icon size={18} />
                </div>
              </div>
              <h3
                className="mt-[20px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--text-primary)",
                }}
              >
                {t(titleKey)}
              </h3>
              <p
                className="mt-[8px]"
                style={{ fontSize: 14, lineHeight: 1.55, color: "var(--foreground-70, rgba(240,240,240,0.7))" }}
              >
                {t(textKey)}
              </p>
              {i < STEP_DEFS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -right-[10px] -translate-y-1/2"
                  style={{
                    width: 20, height: 1,
                    background: "linear-gradient(90deg, var(--border, rgba(255,255,255,0.15)), transparent)",
                  }}
                />
              )}
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

/* ===================== Block 3. Тарифы ===================== */

const PLAN_DEFS = [
  {
    nameKey: "index.planStart" as const,
    price: "0 ₽",
    periodKey: "index.periodTrial" as const,
    featureKeys: ["index.planStartF1", "index.planStartF2", "index.planStartF3"] as const,
    accent: false,
  },
  {
    nameKey: "index.planMonth" as const,
    priceKey: "index.priceFrom99" as const,
    periodKey: "index.periodMonth" as const,
    featureKeys: ["index.planMonthF1", "index.planMonthF2", "index.planMonthF3"] as const,
    accent: true,
  },
  {
    nameKey: "index.planYear" as const,
    priceKey: "index.priceFrom990" as const,
    periodKey: "index.periodYear" as const,
    featureKeys: ["index.planYearF1", "index.planYearF2", "index.planYearF3"] as const,
    accent: false,
  },
];

function PricingSection() {
  const { t } = useTranslation();
  return (
    <section
      id="pricing"
      className="px-[20px] py-[80px] sm:py-[112px]"
      style={{ background: "var(--bg-secondary, #1e1e22)" }}
    >
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow={t("index.pricingEyebrow")}
          title={t("index.pricingTitle")}
          description={t("index.pricingDesc")}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-[48px] grid gap-[16px] grid-cols-1 md:grid-cols-3"
        >
          {PLAN_DEFS.map((p) => (
            <motion.div
              key={p.nameKey}
              variants={fadeInUp}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col p-[28px]"
              style={{
                background: "var(--bg-tertiary, #26262b)",
                border: p.accent
                  ? "1px solid rgba(229, 57, 53, 0.45)"
                  : "1px solid var(--border, rgba(255,255,255,0.08))",
                borderRadius: 20,
                boxShadow: p.accent
                  ? "0 0 0 1px rgba(229, 57, 53, 0.18), 0 18px 40px -24px rgba(229, 57, 53, 0.4)"
                  : "0 12px 28px -20px rgba(0,0,0,0.55)",
                position: "relative",
              }}
            >
              {p.accent && (
                <span
                  style={{
                    position: "absolute", top: 14, right: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10, letterSpacing: "0.14em",
                    padding: "4px 10px", borderRadius: 999,
                    background: "rgba(229, 57, 53, 0.15)",
                    color: "var(--accent)",
                    border: "1px solid rgba(229, 57, 53, 0.35)",
                    fontWeight: 700, textTransform: "uppercase",
                  }}
                >
                  {t("index.pricingRecommended")}
                </span>
              )}
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18, fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {t(p.nameKey)}
              </div>
              <div className="mt-[12px] flex items-baseline gap-[8px]">
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 32, fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: "var(--text-primary)",
                  }}
                >
                  {"priceKey" in p && p.priceKey ? t(p.priceKey) : "price" in p ? p.price : ""}
                </span>
                <span style={{ fontSize: 13, color: "var(--foreground-50, rgba(240,240,240,0.55))" }}>
                  {t(p.periodKey)}
                </span>
              </div>
              <ul className="mt-[20px] space-y-[10px]">
                {p.featureKeys.map((fk) => (
                  <li key={fk} className="flex items-start gap-[10px]" style={{ fontSize: 14, color: "var(--foreground-70, rgba(240,240,240,0.7))" }}>
                    <Check size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                    <span>{t(fk)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex-1" />
              <Link
                to="/subscription"
                search={ROUTE_SEARCH.subscription}
                className="mt-[24px] inline-flex items-center justify-center gap-[8px] transition-colors"
                style={{
                  height: 44,
                  borderRadius: "var(--r-pill)",
                  background: p.accent ? "var(--accent)" : "rgba(255,255,255,0.06)",
                  color: p.accent ? "#fff" : "var(--text-primary)",
                  border: p.accent ? "none" : "1px solid var(--border, rgba(255,255,255,0.12))",
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {t("index.pricingDetails")}
                <ArrowRight size={16} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ===================== Block 4. FAQ ===================== */

const FAQ_DEFS = [
  { qKey: "index.faqQ1", aKey: "index.faqA1" },
  { qKey: "index.faqQ2", aKey: "index.faqA2" },
  { qKey: "index.faqQ3", aKey: "index.faqA3" },
  { qKey: "index.faqQ4", aKey: "index.faqA4" },
  { qKey: "index.faqQ5", aKey: "index.faqA5" },
  { qKey: "index.faqQ6", aKey: "index.faqA6" },
] as const;

function FaqSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="px-[20px] py-[80px] sm:py-[112px]"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="mx-auto max-w-[820px]">
        <SectionHeader
          eyebrow={t("index.faqEyebrow")}
          title={t("index.faqTitle")}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-[40px] space-y-[10px]"
        >
          {FAQ_DEFS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.qKey}
                variants={fadeInUp}
                style={{
                  background: "var(--bg-secondary, #1e1e22)",
                  border: "1px solid var(--border, rgba(255,255,255,0.08))",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-[12px] px-[20px] py-[18px] text-left transition-colors"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" }}>
                    {t(item.qKey)}
                  </span>
                  <span
                    className="grid shrink-0 place-items-center transition-transform"
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border, rgba(255,255,255,0.08))",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                      transition: "transform 200ms ease",
                      color: "var(--foreground-70, rgba(240,240,240,0.7))",
                    }}
                  >
                    <Plus size={14} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="px-[20px] pb-[20px]"
                        style={{ fontSize: 14, lineHeight: 1.6, color: "var(--foreground-70, rgba(240,240,240,0.72))" }}
                      >
                        {t(item.aKey)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ===================== Block 5. Футер ===================== */

function FooterSection() {
  const { t } = useTranslation();
  return (
    <footer
      className="px-[20px] pt-[56px] pb-[40px]"
      style={{
        background: "var(--bg-secondary, #1e1e22)",
        borderTop: "1px solid var(--border, rgba(255,255,255,0.08))",
      }}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-[32px] sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            <Logo size={32} />
            <p
              className="mt-[12px] max-w-[420px]"
              style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground-70, rgba(240,240,240,0.65))" }}
            >
              {t("index.footerDesc")}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-[24px] gap-y-[10px] sm:justify-end">
            <Link to="/legal/rules" style={footerLink}>{t("index.footerRules")}</Link>
            <Link to="/help" style={footerLink}>{t("index.footerSupport")}</Link>
            <Link to="/help" style={footerLink}>{t("index.footerContacts")}</Link>
            <Link to="/subscription" search={ROUTE_SEARCH.subscription} style={footerLink}>{t("nav.subscription")}</Link>
          </nav>
        </div>

        <div
          className="mt-[32px] flex flex-col items-start justify-between gap-[8px] pt-[20px] sm:flex-row sm:items-center"
          style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.06))" }}
        >
          <span style={{ fontSize: 12, color: "var(--foreground-50, rgba(240,240,240,0.5))" }}>
            {t("index.footerCopyright", { year: new Date().getFullYear() })}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--foreground-50, rgba(240,240,240,0.45))",
            }}
          >{t("index.footerMotto")}</span>
        </div>
      </div>
    </footer>
  );
}

const footerLink: React.CSSProperties = {
  fontSize: 13,
  color: "var(--foreground-70, rgba(240,240,240,0.72))",
  fontWeight: 500,
};
