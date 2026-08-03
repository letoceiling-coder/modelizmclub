/**
 * English translations for P11 i18n keys (embedded admin components).
 * Run after sync-i18n to replace RU fallbacks with English for new namespaces.
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

/** Deep-merge English overlay; overwrites leaf strings in overlay. */
const patch = {
  pages: {
    adminBanners: {
      defaultCta: "Learn more",
      placements: { events: "Feed — top slider", feed: "Feed — inline ads" },
      kinds: { event: "Event", news: "News", promo: "Promo" },
      scheduleStatus: { hidden: "Hidden", test: "Test display", scheduled: "Scheduled", ended: "Ended", active: "Active" },
      carousel: {
        title: "Feed slider",
        hint: "Block above the post feed. Slide rotation, display limit, and view stats are configured here.",
        saved: "Slider settings saved",
        saveFailed: "Could not save slider settings",
      },
      toast: {
        loadFailed: "Could not load banners",
        bannerSaved: "Banner saved",
        deleteConfirm: "Delete this banner?",
      },
      list: { empty: "No banners yet — add the first one above." },
    },
    adminLandingBlocks: {
      sections: { ecosystem: "What's in MoDelizM", directions: "Everything that moves and flies" },
      cardSaved: "Card saved",
      cardSaveFailed: "Could not save card",
      cardDeleted: "Card deleted",
      cardAdded: "Card added",
      newCardTitle: "New card",
      loadFailed: "Could not load home page blocks",
      dragHint: "Drag cards by ⋮⋮ to reorder",
      sectionSaved: "Block headings saved",
      sectionSaveFailed: "Could not save block",
    },
    adminLandingIcon: {
      customIcon: "Custom icon",
      pickHint: "Click to pick or upload",
      removeUploaded: "Remove uploaded icon",
      searchPlaceholder: "Search icon…",
      empty: "Nothing found",
      uploading: "Uploading…",
      uploadButton: "Upload PNG / SVG / WebP (up to 2 MB)",
      invalidType: "Upload PNG, SVG or WebP",
      tooLarge: "Icon must be 2 MB or less",
      uploaded: "Icon uploaded",
      uploadFailed: "Could not upload icon",
      photoEditorTitle: "Edit icon",
    },
    adminFeedGuestAccess: {
      title: "Guest access on /feed",
      subtitle: "Control access for signed-out users: feed clicks, menu, and URL navigation.",
      denyBehavior: "When access is denied",
      showPopup: "Show popup",
      redirectSubscription: "Redirect to /subscription",
      popupTitle: "Popup title",
      popupPrimaryCta: "Subscribe button",
      popupDescription: "Popup body",
      guestAllowed: "Available to guests",
      denyModes: { inherit: "Default", popup: "Popup", redirect: "Redirect" },
      loadFailed: "Could not load access rules",
      saved: "Access rules saved",
      saveFailed: "Could not save",
      saving: "Saving…",
      save: "Save access rules",
    },
    adminFooterContacts: {
      title: "Footer contacts",
      hint: "Empty fields are hidden on the site. Social links appear only when a URL is set.",
      loadFailed: "Could not load footer contacts",
      saved: "Footer contacts saved",
      saveFailed: "Could not save contacts",
      saving: "Saving…",
      save: "Save contacts",
      fields: { email: "Email", phone: "Phone", hours: "Business hours", social: "Social networks" },
      placeholders: { email: "support@modelizmclub.ru", phone: "8 800 000-00-00", hours: "Mon–Sun, 10:00–20:00 MSK" },
    },
    adminMedia: {
      title: "Media manager",
      subtitle: "Upload and pick images (PNG, JPEG, WebP, SVG). Files tagged as icons can be added to the icon library in Design System.",
      loadFailed: "Could not load media files",
      loadMediaFailed: "Could not load media",
      empty: "No files yet. Upload PNG, SVG or photos via Upload files.",
      pickerEmpty: "No files. Upload PNG or SVG to the media manager.",
      uploadFiles: "Upload files",
      uploading: "Uploading…",
      allPurposes: "All purposes",
      allFormats: "All formats",
      formats: { image: "Images", png: "PNG", jpeg: "JPEG", webp: "WebP", svg: "SVG" },
      searchPlaceholder: "Search by name…",
      uploadAs: "Upload as: {{purpose}}",
      copyUrl: "Copy URL",
      urlCopied: "URL copied",
      photoEditorTitle: "Edit image",
      pickerDefaultTitle: "Pick from media manager",
      pickFailed: "Could not select file",
      back: "Back",
      forward: "Forward",
      pageSummary: "{{page}} / {{lastPage}} · {{total}} total",
      purposes: { icon: "Icons", banner: "Banners", cover: "Covers", post: "Posts", listing: "Listings", avatar: "Avatars" },
    },
    adminIcons: {
      title: "Site icons",
      preview: {
        landingCard: "Home page card",
        valueBlock: "«Why modelers choose us» block",
        faqQuestion: "FAQ question",
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
console.log("Patched en.ts with P11 translations (partial overlay — run sync-i18n next)");
