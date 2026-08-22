import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/legal/$slug")({
  loader: ({ params }) => loadPublishedLegalPage(params.slug),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: LegalPage,
});

function LegalPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
