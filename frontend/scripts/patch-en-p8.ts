/**
 * English translations for P8 i18n keys (admin users, ads, design system, common extensions).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminCommon: {
      cancel: "Cancel",
      colSeller: "Seller",
      colPrice: "Price",
      colName: "Name",
      colEmail: "Email",
      colCity: "City",
      colSubscription: "Subscription",
      colRole: "Role",
      statusUnpublished: "Unpublished",
      statusSold: "Sold",
      statusExpired: "Expired",
      statusAwaitingPayment: "Awaiting payment",
      actionPublish: "Publish",
      actionViewEdit: "View and edit",
      bulkPartialFail: "Succeeded: {{ok}}, failed: {{failed}}",
      bulkFailed: "Bulk action failed",
      selectedCount: "Selected: {{count}}",
      bulkClear: "Clear selection",
      bulkDelete: "Delete",
      bulkDeleting: "Deleting…",
    },
    adminUsers: {
      title: "Users",
      searchPlaceholder: "Search by name or email…",
      allRoles: "All roles",
      roleUser: "User",
      roleSubscriber: "Subscriber",
      roleModerator: "Moderator",
      roleAdmin: "Super admin",
      roleUserShort: "User",
      subscriptionActive: "Subscription",
      statusActive: "Active",
      statusBlocked: "Blocked",
      statusPending: "Pending",
      cannotChangeOwnRole: "You cannot change your own role",
      roleUpdated: "Role updated",
      roleAdminAssigned: "Assigned super admin",
      roleChangeFailed: "Could not change role",
      userBlocked: "User blocked",
      userUnblocked: "User unblocked",
      statusChangeFailed: "Could not change status",
      changeRoleTitle: "Change role",
      previewToast: "Preview: {{name}}",
    },
    adminAds: {
      title: "Listings",
      empty: "No listings",
      loadFailed: "Could not load listings",
      deleteConfirm: "Delete this listing?",
      selectAll: "Select all listings",
      selectRow: "Select «{{title}}»",
      bulkUnpublish: "Unpublish",
      bulkToModeration: "Send to moderation",
      bulkStatusSuccess: "Updated listings: {{count}}",
      bulkDeleteSuccess: "Deleted listings: {{count}}",
      bulkDeleteConfirm: "Delete selected listings?",
      bulkDeleteDesc: "{{count}} listings will be deleted. This cannot be undone.",
    },
    adminDesignSystem: {
      title: "Design system / Primary color",
      subtitle: "Choose one of two brand accent presets. Updates CSS variables globally and persists in localStorage. Does not affect logic or data.",
      uiKitLink: "UI Kit 2.0 preview →",
      themeMode: "Theme mode",
      reset: "Reset",
      brandColor: "Brand primary color",
      advancedMode: "Advanced mode (debug) — custom RGB color",
      pickAccentAria: "Pick accent color",
      debugHint: "Debug only. The main flow is the two brand presets above.",
      previewTitle: "Component preview",
      iconsHint: "Site icon management is in",
      iconsLink: "Site icons",
      presetActive: "Active",
      presetPrimary: "Primary",
      presetMakePrimary: "Set as primary",
      presetButton: "Button",
      presetTab: "Active tab",
      preview: {
        buttons: "Buttons",
        btnPrimary: "Primary",
        btnSoft: "Soft",
        btnOutline: "Outline",
        badges: "Badges",
        badgeNew: "New",
        badgeActive: "Active",
        badgeReview: "In review",
        badgeRejected: "Rejected",
        badgeInfo: "Info",
        alerts: "Alerts",
        alertSaved: "Changes saved",
        alertHint: "Hint for the user",
        alertError: "An error occurred",
        card: "Card",
        cardTitle: "Card title",
        cardDesc: "Short description with emphasis on details.",
        cardMore: "Learn more →",
        inputs: "Input fields",
        inputFocus: "Active (focus)",
        inputMessage: "Message",
        upload: "File upload",
        uploadHint: "Drag a file or",
        uploadChoose: "browse",
        loginForm: "Sign-in form",
        login: "Login",
        password: "Password",
        signIn: "Sign in",
        signUp: "Create account",
        nav: "Navigation",
        navHome: "Home",
        navFeed: "Feed",
        navChannels: "Channels",
        navMessages: "Messages",
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
console.log("Patched en.ts with P8 translations");
