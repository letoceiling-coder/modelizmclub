import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

export const Route = createFileRoute("/payment")({
  errorComponent: RouteErrorState,
  loader: () => loadPublishedLegalPage("payment"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: PaymentPage,
});

function PaymentPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
