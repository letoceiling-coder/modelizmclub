import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/refund")({
  loader: () => loadPublishedLegalPage("refund"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: RefundPage,
});

function RefundPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
