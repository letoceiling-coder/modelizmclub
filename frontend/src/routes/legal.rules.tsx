import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/legal/rules")({
  head: () => ({ meta: [{ title: i18n.t("pages.legal.rulesMetaTitle") }, { name: "description", content: i18n.t("pages.legal.rulesMetaDescription") }] }),
  component: RulesPage,
});

function RulesPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>← {t("pages.homeLink")}</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>
        {t("pages.legal.rulesTitle")}
      </h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>
        {t("pages.legal.rulesSubtitle")}
      </p>

      <section className="mt-[28px] space-y-[18px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        <Rule n="1" title={t("pages.legal.rule1Title")} text={t("pages.legal.rule1Text")} />
        <Rule n="2" title={t("pages.legal.rule2Title")} text={t("pages.legal.rule2Text")} />
        <Rule n="3" title={t("pages.legal.rule3Title")} text={t("pages.legal.rule3Text")} />
        <Rule n="4" title={t("pages.legal.rule4Title")} text={t("pages.legal.rule4Text")} />
        <Rule n="5" title={t("pages.legal.rule5Title")} text={t("pages.legal.rule5Text")} />
        <Rule n="6" title={t("pages.legal.rule6Title")} text={t("pages.legal.rule6Text")} />
      </section>

      <p className="mt-[32px]" style={{ color: "var(--foreground-50)", fontSize: 13 }}>
        {t("pages.legal.questions")} <a href="mailto:support@modelizm.club" style={{ color: "var(--accent)" }}>support@modelizm.club</a>
      </p>
    </main>
  );
}

function Rule({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex gap-[14px]">
      <span
        className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full font-semibold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13 }}
      >
        {n}
      </span>
      <div>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
        <p style={{ color: "var(--foreground-70)", marginTop: 2 }}>{text}</p>
      </div>
    </div>
  );
}
