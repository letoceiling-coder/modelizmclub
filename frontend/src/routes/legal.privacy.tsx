import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({ meta: [{ title: i18n.t("pages.legal.privacyMetaTitle") }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[760px] px-[16px] py-[40px]" style={{ color: "var(--foreground)" }}>
      <Link to="/" style={{ color: "var(--accent)", fontSize: 13 }}>← {t("pages.homeLink")}</Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, marginTop: 16 }}>
        {t("pages.legal.privacyTitle")}
      </h1>
      <p style={{ color: "var(--foreground-50)", marginTop: 8, fontSize: 14 }}>
        {t("pages.legal.privacyDemo")}
      </p>

      <section className="mt-[28px] space-y-[20px]" style={{ fontSize: 15, lineHeight: 1.7 }}>
        <Block title={t("pages.legal.privacy1Title")} text={t("pages.legal.privacy1Text")} />
        <Block title={t("pages.legal.privacy2Title")} text={t("pages.legal.privacy2Text")} />
        <Block title={t("pages.legal.privacy3Title")} text={t("pages.legal.privacy3Text")} />
        <Block title={t("pages.legal.privacy4Title")} text={t("pages.legal.privacy4Text")} />
        <Block title={t("pages.legal.privacy5Title")} text={t("pages.legal.privacy5Text")} />
        <Block
          title={t("pages.legal.privacy6Title")}
          text={<>{t("pages.legal.privacy6Text")} <a href="mailto:privacy@modelizm.club" style={{ color: "var(--accent)" }}>privacy@modelizm.club</a></>}
        />
      </section>
    </main>
  );
}

function Block({ title, text }: { title: string; text: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
      <p style={{ color: "var(--foreground-70)", marginTop: 4 }}>{text}</p>
    </div>
  );
}
