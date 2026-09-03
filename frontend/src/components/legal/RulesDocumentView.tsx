import { Link } from "@tanstack/react-router";
import type { RulePageData, RuleSection, RulesHubData } from "@/lib/api/rules";
import { formatDate } from "@/lib/format/date";

const SITE_ORIGIN = "https://modelizmclub.ru";

export function formatRevisionDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, "absolute");
}

export function rulesJsonLd(page: RulePageData, pathname: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LegalDocument",
        name: page.title,
        description: page.seo_description || page.summary || undefined,
        url: `${SITE_ORIGIN}${pathname}`,
        dateModified: page.published_at || undefined,
        inLanguage: "ru-RU",
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "ООО «МОДЕЛИЗМ»",
        url: SITE_ORIGIN,
        email: "modelizmclub@mail.ru",
        telephone: "+7-989-808-98-88",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Краснодар",
          addressCountry: "RU",
        },
      },
    ],
  };
}

function SectionBlock({ section }: { section: RuleSection }) {
  if (section.type === "intro") {
    return (
      <div
        className="legal-document mb-8 text-[15px] leading-relaxed"
        style={{ color: "var(--foreground-80)" }}
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    );
  }

  if (section.type === "requisites") {
    return (
      <section className="mt-10 rounded-[var(--r-card)] border p-5" style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}>
        {section.title && (
          <h2 className="mb-3 font-display text-[18px] font-bold" style={{ color: "var(--foreground)" }}>
            {section.title}
          </h2>
        )}
        <div
          className="legal-document text-[14px] leading-relaxed"
          style={{ color: "var(--foreground-80)" }}
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      </section>
    );
  }

  if (section.type === "footer_note") {
    return (
      <footer
        className="legal-document mt-10 border-t pt-5 text-[13px]"
        style={{ borderColor: "var(--border)", color: "var(--foreground-50)" }}
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    );
  }

  return (
    <section className="mt-8">
      {section.title && (
        <h2 className="mb-3 font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
          {section.title}
        </h2>
      )}
      <div
        className="legal-document text-[15px] leading-relaxed"
        style={{ color: "var(--foreground-80)" }}
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    </section>
  );
}

export function RulesDocumentNav({
  hub,
  currentSlug,
}: {
  hub: RulesHubData;
  currentSlug?: string;
}) {
  return (
    <>
      <div className="mb-4 md:hidden">
        <label className="sr-only" htmlFor="rules-nav">
          Документы раздела
        </label>
        <select
          id="rules-nav"
          className="w-full rounded-[var(--r-control)] border px-3 py-2 text-[14px]"
          style={{ borderColor: "var(--border)", background: "var(--background-elevated)", color: "var(--foreground)" }}
          value={currentSlug ?? ""}
          onChange={(e) => {
            const slug = e.target.value;
            window.location.href = slug ? `/rules/${slug}` : "/rules";
          }}
        >
          <option value="">Все правила</option>
          {hub.documents.map((doc) => (
            <option key={doc.slug} value={doc.slug}>
              {doc.title}
            </option>
          ))}
        </select>
      </div>

      <nav className="hidden md:block" aria-label="Документы раздела Правила">
        <Link
          to="/rules"
          className="mb-3 block text-[13px] font-semibold"
          style={{ color: "var(--accent)" }}
        >
          ← Все правила
        </Link>
        <ul className="flex flex-col gap-1">
          {hub.documents.map((doc) => {
            const active = doc.slug === currentSlug;
            return (
              <li key={doc.slug}>
                <Link
                  to="/rules/$slug"
                  params={{ slug: doc.slug }}
                  className="block rounded-[var(--r-control)] px-3 py-2 text-[13px] leading-snug"
                  style={{
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--foreground)" : "var(--foreground-70)",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {doc.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function RulesDocumentView({
  page,
  hub,
}: {
  page: RulePageData;
  hub: RulesHubData;
}) {
  const revision = formatRevisionDate(page.published_at);

  return (
    <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
      <RulesDocumentNav hub={hub} currentSlug={page.slug} />
      <article>
        <h1
          className="font-display font-extrabold"
          style={{
            fontSize: "clamp(26px, 4vw, 38px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.12,
            color: "var(--foreground)",
          }}
        >
          {page.title}
        </h1>
        {revision && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Редакция от {revision}
          </p>
        )}
        {page.sections.map((section, i) => (
          <SectionBlock key={`${section.type}-${i}-${section.position}`} section={section} />
        ))}
      </article>
    </div>
  );
}
