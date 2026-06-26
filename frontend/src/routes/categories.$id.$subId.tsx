import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/categories/$id/$subId")({
  head: () => ({ meta: [{ title: tStatic("categories.metaTitle") }] }),
  component: SubcategoryPage,
});

function SubcategoryPage() {
  const { t } = useTranslation();
  const { id, subId } = Route.useParams();
  return (
    <AppLayout>
      <div className="py-20 text-center">
        <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("categories.subcategoryEmpty")}</p>
        <Link to="/categories/$id" params={{ id }} className="mt-4 inline-block font-semibold" style={{ color: "var(--accent)" }}>
          {t("common.back")}
        </Link>
      </div>
    </AppLayout>
  );
}
