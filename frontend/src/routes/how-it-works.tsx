import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/how-it-works")({
  loader: () => loadPublishedLegalPage("how-it-works"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.info.metaTitle"),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
