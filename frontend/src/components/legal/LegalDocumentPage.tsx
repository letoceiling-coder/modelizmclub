import { Link, notFound, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { fetchLegalPage, type LegalPageData } from "@/lib/api/legal";
import { ApiError } from "@/lib/api/client";
import i18n from "@/lib/i18n";

const SITE_ORIGIN = "https://modelizmclub.ru";

export async function loadPublishedLegalPage(slug: string): Promise<LegalPageData> {
  try {
    return await fetchLegalPage(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw notFound();
    throw e;
  }
}

export function excerptFromHtml(html: string, max = 160): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function legalDocumentHead(
  loaderData: LegalPageData | undefined,
  fallbackKey: string,
  fallbackDescription?: string,
): { meta: { title?: string; name?: string; content?: string }[] } {
  const title = loaderData
    ? `${loaderData.title} — ${i18n.t("common.appName")}`
    : i18n.t(fallbackKey);
  const description = loaderData?.meta_description
    || fallbackDescription
    || (loaderData ? excerptFromHtml(loaderData.content_html) : undefined);

  const meta: { title?: string; name?: string; content?: string }[] = [{ title }];
  if (description) {
    meta.push({ name: "description", content: description });
  }
  return { meta };
}

export function LegalDocumentPage({ page }: { page: LegalPageData }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const description = page.meta_description || excerptFromHtml(page.content_html);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description,
    url: `${SITE_ORIGIN}${pathname}`,
    dateModified: page.published_at || undefined,
    inLanguage: "ru-RU",
    isPartOf: { "@type": "WebSite", name: "МоДелизМ", url: SITE_ORIGIN },
    publisher: {
      "@type": "Organization",
      name: "ООО «МОДЕЛИЗМ»",
      url: SITE_ORIGIN,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE_ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: page.title, item: `${SITE_ORIGIN}${pathname}` },
      ],
    },
  };

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header
        className="mx-auto flex h-[64px] max-w-[900px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link to="/">
          <Logo size={28} />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--foreground-70)" }}
        >
          <ArrowLeft size={15} /> {t("pages.info.backHome")}
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-12">
        <nav
          aria-label="Хлебные крошки"
          className="mb-6 flex items-center gap-1 text-[12.5px]"
          style={{ color: "var(--foreground-50)" }}
        >
          <Link to="/" className="rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)] hover:text-[var(--foreground-70)]">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <span aria-current="page" className="rounded-md px-1.5 py-0.5" style={{ color: "var(--foreground)", fontWeight: 600 }}>
            {page.title}
          </span>
        </nav>
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
          style={{ color: "var(--foreground-80)", lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: page.content_html }}
        />
      </main>
    </div>
  );
}
