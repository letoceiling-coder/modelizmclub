/**
 * English translations for P6 i18n keys (admin dashboard, review bulk/media).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminDashboard: {
      title: "Dashboard",
      statUsers: "Total users",
      statCommunities: "Communities",
      statBanners: "Active banners",
      statPosts: "Posts",
      statModeration: "In moderation",
      statReports: "Reports",
      registrationsChart: "Registrations over 30 days",
      recentActions: "Recent actions",
      days: {
        mon: "Mon",
        tue: "Tue",
        wed: "Wed",
        thu: "Thu",
        fri: "Fri",
        sat: "Sat",
        sun: "Sun",
      },
    },
    adminReviews: {
      selectedCount: "Selected: {{count}}",
      selectAll: "Select all reviews",
      selectRow: "Select “{{title}}”",
      bulkApprove: "Approve",
      bulkPublish: "Publish",
      bulkReject: "Reject",
      bulkDelete: "Delete",
      bulkClear: "Clear selection",
      bulkDeleteConfirm: "Delete selected reviews?",
      bulkDeleteDesc: "{{count}} review(s) will be deleted. This cannot be undone.",
      bulkApproveSuccess: "Approved reviews: {{count}}",
      bulkStatusSuccess: "Updated reviews: {{count}}",
      bulkDeleteSuccess: "Deleted reviews: {{count}}",
      bulkPartialFail: "Succeeded: {{ok}}, failed: {{failed}}",
      bulkFailed: "Bulk action failed",
      mediaCheckTitle: "Media check",
      mediaVideoOk: "Video: OK",
      mediaVideoMissing: "Video: missing",
      mediaPosterOk: "Cover: OK",
      mediaPosterMissing: "Cover: missing",
      previewStats: "Views {{views}} · {{duration}} · ♥ {{likes}} · 💬 {{comments}}",
      hideReview: "Hide from site",
      replaceMedia: "Replace media",
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
console.log("Patched en.ts with P6 translations");
