/**
 * English translations for P10 i18n keys (admin monetization, categories, notifications, audit, applications).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminCommon: {
      add: "Add",
      saved: "Saved",
      save: "Save",
      all: "All",
    },
    adminMonetization: {
      title: "Monetization",
      placementTitle: "Listing placement",
      placementHint: "Default price when a category has no custom price. Category prices — in Categories → Listings.",
      basePriceLabel: "Base price, ₽",
      tariffsTitle: "Plan management",
      freeListingsLabel: "Free listings / month",
      discountLabel: "Placement discount, %",
      savePlans: "Save plans",
      plansSaved: "Plans saved",
      plansSaveFailed: "Could not save plans",
      placementPriceSaved: "Default placement price saved",
      placementPriceSaveFailed: "Could not save price",
    },
    adminPromocodes: {
      title: "Promo codes",
      create: "Create promo code",
      submit: "Create",
      fieldCode: "Name",
      fieldType: "Type",
      typePercent: "Percent",
      typeFixed: "Fixed amount (kopecks)",
      typeFree: "Free",
      fieldDiscount: "Discount, %",
      fieldExpires: "Valid until",
      fieldLimit: "Usage limit",
      notifyAll: "Send all users a notification with the promo code",
      notifyUserIds: "Or user IDs (comma-separated)",
      notifyTitle: "Notification title",
      notifyBody: "Notification body",
      notifyTitlePlaceholder: "Listing placement promo",
      notifyBodyPlaceholder: "Use the code when posting a listing",
      searchPlaceholder: "Search by code…",
      filters: { all: "All", active: "Active", expired: "Expired" },
      columns: { code: "Code", discount: "Discount", used: "Used", expires: "Expires", status: "Status" },
      statusActive: "Active",
      statusExpired: "Expired",
      empty: "Nothing found",
      errCode: "Enter a name",
      errExpires: "Set expiry date",
      errDiscount: "Discount must be 1–100%",
      errLimit: "Limit must be greater than 0",
      created: "Promo code created",
      createdWithNotify: "Promo code created. Notifications sent: {{count}}",
      createFailed: "Could not create promo code",
      deleted: "Promo code deleted",
      deleteFailed: "Could not delete promo code",
    },
    adminFeedBanners: { title: "Ad block" },
    adminLanding: {
      title: "Home page",
      subtitle: "Blocks «What's in MoDelizM» and «Everything that moves and flies»: titles, cards, icons and links. Drag cards to reorder.",
    },
    adminCategories: {
      title: "Categories",
      kinds: { post: "Posts", community: "Communities", listing: "Listings", video: "Reviews" },
      loadFailed: "Could not load categories",
      empty: "No categories yet",
      hidden: "(hidden)",
      priceRegular: "₽ regular",
      priceSubscriber: "₽ subscriber",
      promptName: "Category name",
      promptSlug: "Slug (Latin)",
      promptSubName: "Subcategory in «{{name}}»",
      promptEditName: "Name",
      promptEditSlug: "Slug",
      added: "Category added",
      addFailed: "Could not create category (slug may be taken)",
      subAdded: "Subcategory added",
      subAddFailed: "Could not create subcategory",
      updateFailed: "Could not update category",
      pricesSaved: "Prices saved",
      pricesSaveFailed: "Could not save prices",
      deleteConfirm: "Delete «{{name}}»?",
      deleteFailed: "Could not delete category",
    },
    adminNotifications: {
      title: "Notifications",
      broadcastTitle: "In-app broadcast",
      broadcastHint: "All active users will receive the notification in the bell icon and on the Notifications page.",
      fieldTitle: "Title *",
      fieldBody: "Body",
      fieldLink: "In-app link",
      titlePlaceholder: "e.g. New event this weekend",
      bodyPlaceholder: "Details (optional)",
      linkPlaceholder: "/feed",
      errTitle: "Enter a title",
      confirmSend: "Send notification to all active users?",
      sent: "Sent to recipients: {{count}}",
      sendFailed: "Could not send broadcast",
      sending: "Sending…",
      sendAll: "Send to all",
    },
    adminAuditLog: {
      title: "Change history",
      allUsers: "All users",
      allActions: "All actions",
      empty: "No entries.",
      noDiff: "No change data.",
      columns: { who: "Who", when: "When", action: "Action", entity: "Entity" },
      prev: "← Back",
      next: "Forward →",
      page: "Page {{page}} of {{last}}",
    },
    adminApplications: {
      title: "Creation requests",
      empty: "No requests",
      filters: { pending: "New", approved: "Approved", rejected: "Rejected" },
      kinds: { channel: "Channel", community: "Community" },
    },
  },
};

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const merged = deepMerge(en as unknown as Record<string, unknown>, patch);

function toTs(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[\n" + obj.map((v) => pad + "  " + toTs(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  const lines = Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
    const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    return `${pad}  ${key}: ${toTs(v, indent + 1)}`;
  });
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}

writeFileSync(
  "src/lib/i18n/locales/en.ts",
  `import type { TranslationSchema } from "./ru";\n\nexport const en: TranslationSchema = ${toTs(merged)};\n`,
);
console.log("Patched en.ts with P10 translations");
