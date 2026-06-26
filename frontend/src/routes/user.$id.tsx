import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { userById, users } from "@/lib/mock";
import { ProfileView } from "./profile";

export const Route = createFileRoute("/user/$id")({
  head: ({ params }) => {
    const u = userById(params.id);
    return {
      meta: [{
        title: tStatic("user.metaTitle", { name: u?.name ?? tStatic("user.metaFallback") }),
      }],
    };
  },
  component: UserPage,
});

function UserPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return (
      <AppLayout rightColumn={false}>
        <div className="flex flex-col items-center justify-center py-[120px] text-center">
          <div className="font-display text-[24px] font-bold" style={{ color: "var(--foreground)" }}>{t("user.notFound")}</div>
          <Link to="/friends" className="mt-[16px] inline-flex font-semibold" style={{ height: 40, padding: "0 20px", borderRadius: 10, background: "var(--accent)", color: "white", fontSize: 14, alignItems: "center" }}>{t("user.backToFriends")}</Link>
        </div>
      </AppLayout>
    );
  }
  return <ProfileView user={user} isOwn={false} />;
}
