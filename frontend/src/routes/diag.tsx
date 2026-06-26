import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { categories, communities, ads } from "@/lib/mock";
import { getAllChannels, type Channel } from "@/lib/channels";
import { ExternalLink, CheckCircle2, Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/diag")({
  head: () => ({ meta: [{ title: tStatic("diag.metaTitle") }] }),
  component: DiagPage,
});

interface Group {
  title: string;
  links: { label: string; to: string; params?: Record<string, string> }[];
}

function DiagPage() {
  const { t } = useTranslation();
  const channels: Channel[] = getAllChannels();

  const groups: Group[] = [
    {
      title: t("diag.groupMain"),
      links: [
        { label: t("diag.linkHome"), to: "/" },
        { label: "/landing", to: "/landing" },
        { label: t("diag.linkFeed"), to: "/feed" },
        { label: t("diag.linkCommunities"), to: "/communities" },
        { label: t("diag.linkChannels"), to: "/channels" },
        { label: t("diag.linkMessenger"), to: "/messenger" },
        { label: t("diag.linkAds"), to: "/ads" },
        { label: t("diag.linkAdsNew"), to: "/ads/new" },
        { label: t("diag.linkFriends"), to: "/friends" },
        { label: t("diag.linkProfile"), to: "/profile" },
        { label: t("diag.linkSubscription"), to: "/subscription" },
        { label: t("diag.linkHelp"), to: "/help" },
        { label: t("diag.linkAdmin"), to: "/admin" },
        { label: t("diag.linkCategories"), to: "/categories" },
      ],
    },
    {
      title: t("diag.groupAuth"),
      links: [
        { label: "/login", to: "/login" },
        { label: "/register", to: "/register" },
        { label: "/recover", to: "/recover" },
        { label: "/onboarding", to: "/onboarding" },
      ],
    },
    {
      title: t("diag.groupCategories", { n: categories.length }),
      links: categories.flatMap((c) => [
        { label: `📂 ${c.name}`, to: "/categories/$id", params: { id: c.id } },
        ...c.subcategories.map((s) => ({
          label: `   └ # ${s.name}`,
          to: "/categories/$id/$subId",
          params: { id: c.id, subId: s.id },
        })),
      ]),
    },
    {
      title: t("diag.groupChannels", { n: channels.length }),
      links: channels.map((ch) => ({
        label: `📡 ${ch.name}`,
        to: "/channel/$id",
        params: { id: ch.id },
      })),
    },
    {
      title: t("diag.groupCommunities", { n: communities.length }),
      links: communities.slice(0, 12).map((g) => ({
        label: `👥 ${g.name}`,
        to: "/communities/$id",
        params: { id: g.id },
      })),
    },
    {
      title: t("diag.groupAds", { n: ads.length }),
      links: ads.slice(0, 8).map((a) => ({
        label: `🏷 ${a.title}`,
        to: "/ads/$id",
        params: { id: a.id },
      })),
    },
    {
      title: t("diag.group404"),
      links: [
        { label: "/not-a-real-page", to: "/not-a-real-page" },
        { label: "/categories/nope", to: "/categories/nope" },
        { label: "/channel/nope", to: "/channel/nope" },
      ],
    },
  ];

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-4">
        <header className="flex items-start gap-3 rounded-xl border bg-card p-4">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-primary">
            <MapIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold">{t("diag.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("diag.subtitle")}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {t("diag.linksCount", { n: groups.reduce((s, g) => s + g.links.length, 0) })}
              </span>
            </div>
          </div>
        </header>

        {groups.map((g) => (
          <section key={g.title} className="overflow-hidden rounded-xl border bg-card">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{g.title}</h2>
            <ul className="divide-y">
              {g.links.map((l, i) => (
                <li key={i}>
                  <Link
                    to={l.to as never}
                    params={l.params as never}
                    className="flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span className="truncate">{l.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {l.to}
                        {l.params ? " " + JSON.stringify(l.params) : ""}
                      </code>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
