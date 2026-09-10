import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

export const Route = createFileRoute("/how-it-works")({
  errorComponent: RouteErrorState,
  loader: () => loadPublishedLegalPage("how-it-works"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.info.metaTitle"),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
