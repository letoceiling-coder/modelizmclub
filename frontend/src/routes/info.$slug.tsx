import { createFileRoute } from "@tanstack/react-router";
import {
  LegalDocumentPage,
  legalDocumentHead,
  loadPublishedLegalPage,
} from "@/components/legal/LegalDocumentPage";
import { FeedbackForm } from "@/components/feedback/FeedbackDialog";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

export const Route = createFileRoute("/info/$slug")({
  loader: ({ params }) => loadPublishedLegalPage(params.slug),
  head: ({ loaderData }) => legalDocumentHead(loaderData, "pages.info.metaTitle"),
  component: InfoPage,
});

function InfoFeedback() {
  const { isGuest, requireLogin } = useGuestAccess();
  if (isGuest) {
    return (
      <button
        type="button"
        onClick={() => requireLogin(() => undefined)}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--accent)" }}
      >
        Войти и написать
      </button>
    );
  }
  return <FeedbackForm />;
}

function InfoPage() {
  const { slug } = Route.useParams();
  return (
    <LegalDocumentPage
      page={Route.useLoaderData()}
      afterContent={
        slug === "feedback" ? (
          <div className="mt-10 rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
            <h2 className="mb-3 text-lg font-semibold">Написать нам</h2>
            <InfoFeedback />
          </div>
        ) : null
      }
    />
  );
}
