import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { fetchLegalPage } from "@/lib/api/legal";
import { ApiError } from "@/lib/api/client";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/info/$slug")({
  loader: async ({ params }) => {
    try {
      return await fetchLegalPage(params.slug);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} — ${i18n.t("common.appName")}` : i18n.t("pages.info.metaTitle") }],
  }),
  component: InfoPage,
});

function InfoPage() {
  const { t } = useTranslation();
  const page = Route.useLoaderData();

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}>
      <header className="mx-auto flex h-[64px] max-w-[900px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <Link to="/"><Logo size={28} /></Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--foreground-70)" }}>
          <ArrowLeft size={15} /> {t("pages.info.backHome")}
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-12">
        <h1
          className="mb-8"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {page.title}
        </h1>
        <article
          className="legal-document prose prose-sm max-w-none dark:prose-invert"
          style={{ color: "var(--foreground-80)", lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: page.content_html }}
        />
      </main>
    </div>
  );
}
