/**
 * English translations for P7 i18n keys (admin common, content, analytics, settings).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminCommon: {
      searchPlaceholder: "Search by title…",
      allStatuses: "All statuses",
      loading: "Loading…",
      close: "Close",
      colTitle: "Title",
      colAuthor: "Author",
      colCategory: "Category",
      colStatus: "Status",
      colActions: "Actions",
      statusPublished: "Published",
      statusPendingModeration: "In moderation",
      statusRevision: "Needs revision",
      statusRejected: "Rejected",
      statusDraft: "Draft",
      statusHidden: "Hidden",
      statusArchived: "Archived",
      actionApprove: "Approve",
      actionPreview: "Preview",
      actionDelete: "Delete",
      approveAndPublish: "Approve and publish",
      reject: "Reject",
      statusUpdated: "Status updated",
      statusUpdateFailed: "Could not update status",
      deleted: "Deleted",
      deleteFailed: "Could not delete",
    },
    adminContent: {
      title: "Posts",
      empty: "No posts",
      loadFailed: "Could not load posts",
      deleteConfirm: "Delete this post?",
      previewDialog: "Post preview",
      noMedia: "No media attached",
    },
    adminAnalytics: {
      title: "Analytics",
      statPlans: "Active plans",
      statPromocodes: "Active promo codes",
      chartPlaceholder: "Chart will be available after analytics is connected",
      charts: {
        dauMau: "DAU / MAU",
        revenue: "Revenue by month",
        listings: "Listings: created / sold",
        topCategories: "Top categories by activity",
        subscription: "Subscription conversion",
        geo: "User geography",
      },
    },
    adminSettings: {
      title: "Settings",
      platformTitle: "Platform system settings",
      loadFailed: "Could not load settings",
      saved: "Settings saved",
      saveFailed: "Could not save settings",
      save: "Save",
      saving: "Saving…",
      empty: "No settings yet",
      systemManaged: "is managed by the system",
      groups: {
        feature: "Features",
        general: "General",
        marketing: "Marketing",
        moderation: "Moderation",
        design: "Design",
        footer: "Footer",
        feed: "Feed",
        features: "Features",
      },
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
console.log("Patched en.ts with P7 translations");
