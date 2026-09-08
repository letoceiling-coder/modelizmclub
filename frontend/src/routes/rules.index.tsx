import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { fetchRulesHub } from "@/lib/api/rules";
import { formatRevisionDate } from "@/components/legal/RulesDocumentView";
import i18n from "@/lib/i18n";

const SITE_ORIGIN = "https://modelizmclub.ru";
const META_DESCRIPTION =
  "Правила платформы Моделизм: условия пользования, размещение объявлений, оферта на платные услуги и безопасная сделка.";

export const Route = createFileRoute("/rules/")({
  loader: () => fetchRulesHub(),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title
          ? `${loaderData.title} — ${i18n.t("common.appName")}`
          : "Правила Моделизма",
      },
      { name: "description", content: META_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/rules` }],
  }),
  component: RulesHubPage,
});

function RulesHubPage() {
  const hub = Route.useLoaderData();
  const revision = formatRevisionDate(hub.published_at);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hub.title,
    description: META_DESCRIPTION,
    url: `${SITE_ORIGIN}/rules`,
    hasPart: hub.documents.map((d) => ({
      "@type": "LegalDocument",
      name: d.title,
      url: `${SITE_ORIGIN}${d.href}`,
    })),
    publisher: {
      "@type": "Organization",
      name: "ООО «МОДЕЛИЗМ»",
      url: SITE_ORIGIN,
    },
  };

  return (
    <div
      style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100dvh" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header
        className="mx-auto flex h-[64px] max-w-[960px] items-center justify-between px-4"
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
          <ArrowLeft size={15} /> На главную
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-12">
        <nav
          className="mb-6 flex items-center gap-1 text-[12.5px]"
          style={{ color: "var(--foreground-50)" }}
          aria-label="Хлебные крошки"
        >
          <Link to="/" className="rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)]">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <span
            aria-current="page"
            className="px-1.5 py-0.5 font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Правила
          </span>
        </nav>

        <h1
          className="font-display font-extrabold"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          {hub.title}
        </h1>
        <p
          className="mt-4 max-w-[62ch] text-[15px] leading-relaxed"
          style={{ color: "var(--foreground-70)" }}
        >
          {hub.intro}
        </p>

        {(hub.groups ?? []).map((group) => (
          <section key={group.key} className="mt-10">
            <h2 className="text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
              {group.title}
            </h2>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--foreground-60)" }}>
              {group.description}
            </p>
            <ul className="mt-3 grid gap-2">
              {group.items.map((item) => {
                const card = (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="text-[15px] font-semibold"
                        style={{
                          color:
                            item.state === "ready" ? "var(--foreground)" : "var(--foreground-50)",
                        }}
                      >
                        {item.title}
                        {item.state === "planned" && (
                          <span
                            className="ml-2 align-middle text-[11px] font-medium uppercase tracking-wide"
                            style={{ color: "var(--foreground-40)" }}
                          >
                            готовится
                          </span>
                        )}
                      </div>
                      {item.summary && (
                        <p
                          className="mt-1 text-[13px] leading-snug"
                          style={{ color: "var(--foreground-60)" }}
                        >
                          {item.summary}
                        </p>
                      )}
                      {item.published_at && (
                        <p className="mt-1 text-[12px]" style={{ color: "var(--foreground-40)" }}>
                          Редакция от {formatRevisionDate(item.published_at)}
                        </p>
                      )}
                    </div>
                    {item.state === "ready" && (
                      <ChevronRight
                        className="mt-1 h-4 w-4 shrink-0"
                        style={{ color: "var(--foreground-40)" }}
                      />
                    )}
                  </div>
                );

                return (
                  <li key={item.title}>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="block rounded-[var(--r-card)] border p-4 transition-colors hover:bg-[var(--background-surface)]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {card}
                      </a>
                    ) : (
                      /*
                        Ссылки нет нарочно: документ ещё пишется. Пустая ссылка
                        уводит в 404 и читается как поломка сайта, а строка
                        «готовится» говорит правду.
                      */
                      <div
                        className="block rounded-[var(--r-card)] border border-dashed p-4"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {card}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/*
          Плоский список — запасной путь, а не мёртвая разметка: он рисуется,
          только если бэкенд почему-то не прислал раскладку по группам.
          Оставлять хаб пустым в этом случае нельзя — на него ссылается подвал
          каждой страницы.
        */}
        <ul className={(hub.groups?.length ?? 0) > 0 ? "hidden" : "mt-8 grid gap-3"}>
          {hub.documents.map((doc) => (
            <li key={doc.slug}>
              <Link
                to="/rules/$slug"
                params={{ slug: doc.slug }}
                className="block rounded-[var(--r-card)] border p-4 transition-colors hover:bg-[var(--background-surface)]"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className="text-[16px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {doc.title}
                    </div>
                    {doc.summary && (
                      <p
                        className="mt-1 text-[13px] leading-snug"
                        style={{ color: "var(--foreground-60)" }}
                      >
                        {doc.summary}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0"
                    style={{ color: "var(--foreground-40)" }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {revision
            ? `Редакция от ${revision}. Предыдущие редакции не применяются.`
            : "Предыдущие редакции не применяются."}
        </p>
      </main>
    </div>
  );
}
