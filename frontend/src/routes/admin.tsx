import { createFileRoute } from "@tanstack/react-router";
import i18n from "@/lib/i18n";

export type Section =
  | "dashboard"
  | "users"
  | "content"
  | "ads"
  | "moderation"
  | "delivery"
  | "monetization"
  | "feedBanners"
  | "feedGuestAccess"
  | "notificationPolicy"
  | "landingBlocks"
  | "categories"
  | "reviews"
  | "reviewCategories"
  | "notifications"
  | "analytics"
  | "design"
  | "icons"
  | "media"
  | "feedback"
  | "settings"
  | "auditLog"
  | "applications"
  | "legalPages"
  | "rulesPages"
  | "footerLinks";

// The component lives in admin.lazy.tsx (createLazyFileRoute) so the whole
// admin panel — 20+ sections — ships as its own chunk and never touches the
// bundle for logged-out / non-admin pages like /feed.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: i18n.t("pages.adminShell.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>): { section?: Section } => ({
    section: typeof search.section === "string" ? (search.section as Section) : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { requireAdmin } = await import("@/lib/auth/requireAdmin");
    await requireAdmin(location);
  },
});
