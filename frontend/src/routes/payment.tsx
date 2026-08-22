import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/payment")({
  loader: () => loadPublishedLegalPage("payment"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: PaymentPage,
});

function PaymentPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
