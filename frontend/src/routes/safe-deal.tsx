import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";

const META_DESCRIPTION =
  "Регламент услуги «Безопасная сделка» ООО «МОДЕЛИЗМ»: холдирование оплаты, доставка СДЭК, подтверждение получения и споры.";

export const Route = createFileRoute("/safe-deal")({
  loader: () => loadPublishedLegalPage("safe-deal"),
  head: ({ loaderData }) => ({
    ...legalDocumentHead(loaderData, "pages.legal.safeDealMetaTitle", META_DESCRIPTION),
    links: [{ rel: "canonical", href: "https://modelizmclub.ru/safe-deal" }],
  }),
  component: SafeDealRulesPage,
});

function SafeDealRulesPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
