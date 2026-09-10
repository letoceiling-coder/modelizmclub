import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

export const Route = createFileRoute("/refund")({
  errorComponent: RouteErrorState,
  loader: () => loadPublishedLegalPage("refund"),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: RefundPage,
});

function RefundPage() {
  return <LegalDocumentPage page={Route.useLoaderData()} />;
}
