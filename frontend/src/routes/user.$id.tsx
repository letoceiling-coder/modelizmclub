import { createFileRoute } from "@tanstack/react-router";
import { tStatic } from "@/lib/i18n";
import { ProfileView } from "./profile";

export const Route = createFileRoute("/user/$id")({
  head: () => ({ meta: [{ title: tStatic("user.metaFallback") }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { id } = Route.useParams();
  return <ProfileView slug={id} isOwn={false} />;
}
