import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { OperatorContacts } from "@/components/legal/OperatorContacts";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

export const Route = createFileRoute("/legal/$slug")({
  errorComponent: RouteErrorState,
  loader: ({ params }) => loadPublishedLegalPage(params.slug),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.legal.metaTitle"),
  component: LegalPage,
});

function LegalPage() {
  const { slug } = Route.useParams();
  return (
    <LegalDocumentPage
      page={Route.useLoaderData()}
      afterContent={slug === "contacts" ? <OperatorContacts /> : null}
    />
  );
}
