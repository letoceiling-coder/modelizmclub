import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/rules")({
  head: () => ({
    meta: [
      { title: tStatic("legal.rulesMetaTitle") },
      { name: "description", content: tStatic("legal.rulesMetaDescription") },
    ],
  }),
  component: RulesPage,
});

const RULES = [
  { n: "1", titleKey: "legal.rule1Title", textKey: "legal.rule1Text" },
  { n: "2", titleKey: "legal.rule2Title", textKey: "legal.rule2Text" },
  { n: "3", titleKey: "legal.rule3Title", textKey: "legal.rule3Text" },
  { n: "4", titleKey: "legal.rule4Title", textKey: "legal.rule4Text" },
  { n: "5", titleKey: "legal.rule5Title", textKey: "legal.rule5Text" },
  { n: "6", titleKey: "admin.moderation", textKey: "legal.ruleFooter" },
] as const;

function RulesPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>{t("legal.rulesBack")}</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>{t("legal.rulesTitle")}</h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>{t("legal.rulesIntro")}</p>

      <section className="mt-[28px] space-y-[18px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        {RULES.map((r) => (
          <Rule key={r.n} n={r.n} title={t(r.titleKey)}>{t(r.textKey)}</Rule>
        ))}
      </section>

      <p className="mt-[32px]" style={{ color: "var(--foreground-50)", fontSize: 13 }}>{t("legal.rulesContact")}<a href="mailto:support@modelizm.club" style={{ color: "var(--accent)" }}>support@modelizm.club</a>
      </p>
    </main>
  );
}

function Rule({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
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
        <p style={{ color: "var(--foreground-70)", marginTop: 2 }}>{children}</p>
      </div>
    </div>
  );
}
