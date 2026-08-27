import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ApiError } from "@/lib/api/client";
import { fetchRulePage, fetchRulesHub } from "@/lib/api/rules";
import { RulesDocumentView, rulesJsonLd } from "@/components/legal/RulesDocumentView";
import i18n from "@/lib/i18n";

const SITE_ORIGIN = "https://modelizmclub.ru";

export const Route = createFileRoute("/rules/$slug")({
  loader: async ({ params }) => {
    try {
      const [page, hub] = await Promise.all([fetchRulePage(params.slug), fetchRulesHub()]);
      return { page, hub };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData, params }) => {
    const page = loaderData?.page;
    const title = page ? `${page.seo_title || page.title} — ${i18n.t("common.appName")}` : "Правила Моделизма";
    const description = page?.seo_description || page?.summary || undefined;
    return {
      meta: [
        { title },
        ...(description ? [{ name: "description" as const, content: description }] : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_ORIGIN}/rules/${params.slug}` }],
    };
  },
  component: RuleDocumentPage,
});

function RuleDocumentPage() {
  const { page, hub } = Route.useLoaderData();
  const jsonLd = rulesJsonLd(page, `/rules/${page.slug}`);

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header
        className="mx-auto flex h-[64px] max-w-[1100px] items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link to="/">
          <Logo size={28} />
        </Link>
        <Link
          to="/rules"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--foreground-70)" }}
        >
          <ArrowLeft size={15} /> Все правила
        </Link>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-10">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-[12.5px]" style={{ color: "var(--foreground-50)" }} aria-label="Хлебные крошки">
          <Link to="/" className="rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)]">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <Link to="/rules" className="rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)]">
            Правила
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <span aria-current="page" className="px-1.5 py-0.5 font-semibold" style={{ color: "var(--foreground)" }}>
            {page.title}
          </span>
        </nav>
        <RulesDocumentView page={page} hub={hub} />
      </main>
    </div>
  );
}
