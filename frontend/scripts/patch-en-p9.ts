/**
 * English translations for P9 i18n keys (admin delivery, moderation, feedback, settings).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  pages: {
    adminDelivery: {
      title: "Shipments (CDEK / Yandex)",
      loadStatsFailed: "Could not load delivery stats",
      loadShipmentsFailed: "Could not load shipments",
      noteSaved: "Note saved",
      noteSaveFailed: "Could not save note",
      statShipments: "Shipments",
      statRevenue: "Delivery total",
      statErrors: "Errors (7 days)",
      statAvgDays: "Average time",
      daysShort: "d",
      byProviders: "By provider:",
      allProviders: "All providers",
      providers: { cdek: "CDEK", yandex: "Yandex" },
      colListing: "Listing",
      colProvider: "Provider",
      colStatus: "Status",
      colTrack: "Tracking",
      colCost: "Cost",
      colCreated: "Created",
      empty: "No shipments yet",
      details: "Details",
      detailProvider: "Provider:",
      detailStatus: "Status:",
      detailTrack: "Tracking:",
      detailExternalId: "External ID:",
      adminNote: "Admin note",
      adminNotePlaceholder: "Internal note about this shipment…",
      savingNote: "Saving…",
      saveNote: "Save note",
      status: {
        draft: "Draft",
        quoted: "Quoted",
        awaiting_seller: "Awaiting seller",
        creating: "Creating",
        created: "Created",
        accepted: "Accepted",
        in_transit: "In transit",
        at_pickup: "At pickup point",
        delivered: "Delivered",
        cancelled: "Cancelled",
        error: "Error",
      },
    },
    adminModeration: {
      title: "Moderation",
      approved: "Approved",
      rejected: "Rejected",
      actionFailed: "Could not complete action",
      postsTitle: "Posts in moderation ({{count}})",
      channelPostsTitle: "Channel posts in moderation ({{count}})",
      communitiesTitle: "Communities in moderation ({{count}})",
      emptyPosts: "No posts in moderation",
      emptyChannelPosts: "No channel posts in moderation",
      emptyCommunities: "No communities in moderation",
      cardApprove: "Approve",
      cardReject: "Reject",
      cardOpen: "Open",
      cardOpenToast: "Open details",
      reportsTitle: "User reports",
      reportsLoadFailed: "Could not load reports",
      reportStatusUpdated: "Report status updated",
      reportStatusFailed: "Could not update status",
      noReports: "No reports",
      reportFrom: "From: {{name}}{{email}}",
      openProfile: "open profile",
      takeReview: "Take for review",
      markResolved: "Resolved",
      markDismissed: "No action",
      markRejected: "Reject",
      filters: { all: "All", pending: "New", reviewing: "In review", resolved: "Resolved", rejected: "Rejected", dismissed: "No action" },
      reportStatus: { pending: "New", reviewing: "In review", resolved: "Resolved", rejected: "Rejected", dismissed: "No action" },
      reportTargets: { user: "User", message: "Message", conversation: "Chat", post: "Post", listing: "Listing", comment: "Comment", video: "Review" },
    },
    adminFeedback: {
      title: "Feedback book",
      loadFailed: "Could not load feedback",
      empty: "No feedback yet",
      noSubject: "No subject",
      statusFailed: "Could not update status",
      markRead: "Mark read",
      markResolved: "Resolved",
      backToNew: "Back to new",
      filters: { all: "All", new: "New", read: "Read", resolved: "Resolved" },
      status: { new: "New", read: "Read", resolved: "Resolved" },
    },
    adminSettings: {
      demoModeToast: "In demo mode the setting is not saved on the server",
      demoModeFlagToast: "In demo mode the flag is saved locally only, without a real server",
      saveSettingFailed: "Could not save setting",
      featureCards: {
        demoFlags: {
          title: "Feature flags (demo)",
          subtitle: "Local flags for this browser only. The Communities section and other public toggles below are saved on the server and apply to all users.",
          reviews: "Show Reviews section",
        },
        communities: {
          title: "Communities section",
          subtitle: "The only visibility toggle for the section. Saved on the server and immediately shows or hides Communities in the menu for all users and devices.",
          toggle: "Show Communities section to all users",
          enabled: "Communities section enabled for everyone",
          disabled: "Communities section disabled for everyone",
        },
        market: {
          title: "Market button",
          subtitle: "Saved on the server — enables/disables the button for all users immediately, without a frontend deploy.",
          toggle: "Show Market button",
          enabled: "Market button enabled for everyone",
          disabled: "Market button disabled for everyone",
        },
        escrow: {
          title: "Secure deal badge",
          subtitle: "Saved on the server — shows the Secure deal / escrow badge on listings for everyone immediately. Enable only when YooKassa Secure deal is live on the backend.",
          toggle: "Show Secure deal badge",
          enabled: "Secure deal badge enabled for everyone",
          disabled: "Secure deal badge disabled for everyone",
        },
        listingPayment: {
          title: "Paid listing placement",
          subtitle: "Saved on the server. When enabled, listing publication requires placement payment (or free quota via subscription / promo code).",
          toggle: "Require payment for listing placement",
          enabled: "Paid listing placement enabled",
          disabled: "Listings publish for free",
        },
        feedAutoPublish: {
          title: "Feed auto-publish",
          subtitle: "Saved on the server. Off — new feed and channel posts go to moderation (recommended). On — published immediately without manual review.",
          toggle: "Publish feed posts immediately",
          enabled: "Feed publishes immediately without moderation",
          disabled: "Feed posts go to moderation",
        },
      },
      settingMeta: {
        feature_communities_enabled: { label: "Show Communities section to all users", hint: "The only section toggle — managed by the card above, not localStorage" },
        feature_market_enabled: { label: "Market button" },
        feature_escrow_enabled: { label: "Secure deal badge" },
        feature_feed_auto_publish: { label: "Feed auto-publish" },
        feature_listing_payment_enabled: { label: "Paid listing placement" },
        icon_overrides: { label: "Icons" },
        footer_contacts: { label: "Footer contacts" },
        site_name: { label: "Site name", fields: { ru: "Name (Russian)", en: "Name (English)" } },
        first_hundred_stats: { label: "First hundred counter", fields: { taken: "Seats taken", total: "Total seats" } },
        moderation_auto_publish: { label: "Auto-publish listings", hint: "Publish listings immediately without manual moderation" },
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
console.log("Patched en.ts with P9 translations");
