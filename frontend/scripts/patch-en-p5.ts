/**
 * English translations for P5 i18n keys (admin shell, review metadata columns).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminShell: {
      metaTitle: "Admin panel — Modelizm",
      headerTitle: "Admin panel",
      toSite: "Back to site",
      checkingAccess: "Checking access…",
      forbiddenTitle: "Access denied",
      forbiddenDesc: "The admin panel is available only to super administrators (admin role).",
      forbiddenSignedIn: "You are signed in as {{name}}. Your account does not have super admin rights — contact an existing administrator or sign in with another account.",
      loginOther: "Sign in with another account",
      backHome: "Back to home",
      nav: {
        dashboard: "Dashboard",
        users: "Users",
        content: "Content",
        ads: "Listings",
        delivery: "Delivery",
        moderation: "Moderation",
        applications: "Applications",
        monetization: "Monetization",
        feedBanners: "Feed banner",
        feedGuestAccess: "Guest /feed access",
        landingBlocks: "Landing page",
        icons: "Site icons",
        categories: "Categories",
        reviews: "Reviews",
        notifications: "Notifications",
        analytics: "Analytics",
        feedback: "Feedback",
        design: "Design System",
        media: "Media",
        settings: "Settings",
        auditLog: "Change history",
      },
    },
    adminReviews: {
      colDuration: "Duration",
      colEngagement: "Engagement",
      colPublished: "Published",
      engagementSummary: "♥ {{likes}} · 💬 {{comments}}",
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
console.log("Patched en.ts with P5 translations");
