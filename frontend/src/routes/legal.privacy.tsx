import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: tStatic("legal.privacyMetaTitle") },
      { name: "description", content: tStatic("legal.privacyMetaDescription") },
    ],
  }),
  component: PrivacyPage,
});

const BLOCKS = [
  { titleKey: "legal.privacy1Title", textKey: "legal.privacy1Text" },
  { titleKey: "legal.privacy2Title", textKey: "legal.privacy2Text" },
  { titleKey: "legal.privacy3Title", textKey: "legal.privacy3Text" },
  { titleKey: "legal.privacy4Title", textKey: "legal.privacy4Text" },
  { titleKey: "legal.privacy5Title", textKey: "legal.privacy5Text" },
] as const;

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>{t("legal.rulesBack")}</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>{t("legal.privacyTitle")}</h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>{t("legal.privacyDemoNote")}</p>

      <section className="mt-[28px] space-y-[20px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        {BLOCKS.map((b) => (
          <Block key={b.titleKey} title={t(b.titleKey)}>{t(b.textKey)}</Block>
        ))}
        <Block title={t("legal.privacy6Title")}>
          {t("legal.privacy6Text")}{" "}
          <a href="mailto:privacy@modelizm.club" style={{ color: "var(--accent)" }}>privacy@modelizm.club</a>
        </Block>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
      <p style={{ color: "var(--foreground-70)", marginTop: 4 }}>{children}</p>
    </div>
  );
}
