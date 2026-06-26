import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: tStatic("admin.metaTitle") }] }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4" style={{ height: 48, borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <Logo size={28} showText={false} />
          <span className="text-[13px] font-semibold">{t("nav.admin")}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--foreground-70)" }}>
            <Home size={14} />{t("admin.backToSite")}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[640px] flex-col items-center gap-4 px-6 py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <LayoutDashboard size={28} />
        </div>
        <h1 className="font-display text-[24px] font-bold">{t("admin.dashboard")}</h1>
        <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("common.comingSoon", { label: t("nav.admin") })}
        </p>
        <p className="text-[13px]" style={{ color: "var(--foreground-30)" }}>
          Admin API is not wired yet. Use the public site and /diag for API health checks.
        </p>
      </main>
    </div>
  );
}
