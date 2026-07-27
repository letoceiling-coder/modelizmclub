import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LifeBuoy, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";

import i18n from "@/lib/i18n";

const SLUG_KEYS: Record<string, { title: string; desc: string }> = {
  about: { title: "aboutTitle", desc: "aboutDesc" },
  company: { title: "companyTitle", desc: "companyDesc" },
  partners: { title: "partnersTitle", desc: "partnersDesc" },
  advertising: { title: "advertisingTitle", desc: "advertisingDesc" },
  compliance: { title: "complianceTitle", desc: "complianceDesc" },
  consent: { title: "consentTitle", desc: "consentDesc" },
  support: { title: "supportTitle", desc: "supportDesc" },
  feedback: { title: "feedbackTitle", desc: "feedbackDesc" },
  contacts: { title: "contactsTitle", desc: "contactsDesc" },
  security: { title: "securityTitle", desc: "securityDesc" },
};

export const Route = createFileRoute("/info/$slug")({
  head: () => ({ meta: [{ title: i18n.t("pages.info.metaTitle") }] }),
  component: InfoPage,
});

function InfoPage() {
  const { t } = useTranslation();
  const { slug } = useParams({ from: "/info/$slug" });
  const keys = SLUG_KEYS[slug];
  const title = keys ? t(`pages.info.${keys.title}`) : t("pages.info.fallbackTitle");
  const desc = keys ? t(`pages.info.${keys.desc}`) : t("pages.info.fallbackDesc");

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}>
      <header className="mx-auto flex h-[64px] max-w-[900px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <Link to="/"><Logo size={28} /></Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--foreground-70)" }}>
          <ArrowLeft size={15} /> {t("pages.info.backHome")}
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-16">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
          <FileText size={13} /> {t("pages.info.badge")}
        </div>
        <h1 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--foreground-70)", maxWidth: 560 }}>
          {desc}
        </p>

        <div className="mt-8 flex items-center gap-2 rounded-[var(--r-card)] p-4"
          style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}>
          <span className="grid place-items-center rounded-full" style={{ width: 36, height: 36, background: "var(--accent-soft)", color: "var(--accent)" }}>
            <LifeBuoy size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold">{t("pages.info.preparingTitle")}</div>
            <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.info.preparingDesc")}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/help" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}>
            <LifeBuoy size={15} /> {t("pages.info.writeSupport")}
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-5 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <ArrowLeft size={15} /> {t("pages.info.returnHome")}
          </Link>
        </div>
      </main>
    </div>
  );
}
