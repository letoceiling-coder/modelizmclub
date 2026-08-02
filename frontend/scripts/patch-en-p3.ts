/**
 * English translations for P3 i18n keys (channels, messenger chat header, admin reviews).
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/i18n/locales/en.ts";

const patch = {
  components: {
    channelBranding: {
      demoLocalOnly: "In demo mode, branding is saved locally only",
      fileProcessFailed: "Could not process the file",
      avatarUpdated: "Channel avatar updated",
      avatarUploadFailed: "Could not upload avatar",
      avatarRemoved: "Avatar removed",
      avatarRemoveFailed: "Could not remove avatar",
      bannerUpdated: "Channel cover updated",
      bannerUploadFailed: "Could not upload cover",
      bannerRemoved: "Cover removed",
      bannerRemoveFailed: "Could not remove cover",
      avatarLabel: "Avatar",
      bannerLabel: "Cover",
      bannerNotUploaded: "No cover uploaded",
      changeAvatar: "Change avatar",
      changeBanner: "Change cover",
      uploading: "Uploading…",
      avatarHint: "JPG, PNG, WEBP · up to 5 MB · 480×480",
      bannerHint: "JPG, PNG, WEBP · up to 10 MB · 1400×400",
      avatarHintShort: "Avatar: JPG, PNG, WEBP · up to 5 MB · recommended 480×480",
      bannerHintShort: "JPG, PNG, WEBP · up to 10 MB · recommended 1400×400",
      avatarEditorTitle: "Channel avatar",
      bannerEditorTitle: "Channel cover",
      changeBannerAria: "Change cover",
      changeAvatarAria: "Change avatar",
    },
    channelManage: {
      otherDirection: "Other",
      nameRequired: "Enter a channel name",
      themeRequired: "Enter a channel topic",
      savedDemo: "Changes saved (demo)",
      saved: "Channel settings saved",
      saveFailed: "Could not save settings",
      sectionBranding: "Branding",
      sectionMain: "General",
      sectionDanger: "Danger zone",
      nameLabel: "Name",
      descriptionLabel: "Description",
      themeLabel: "Topic",
      selectDirection: "Select a category",
      customThemeLabel: "Specify topic",
      customThemePlaceholder: "e.g. Display models",
      channelTypeLabel: "Channel type",
      officialTypeLocked: "Type: {{type}} (official channel, cannot be changed)",
      publicNotice: "Channels are public: everyone can see them. Privacy settings are not available yet.",
      saving: "Saving…",
      saveChanges: "Save changes",
      deleteWarning: "Deletion is permanent: the channel disappears from the catalog and subscribers lose access to all posts.",
      settingsTitle: "Channel settings",
      settingsDesc: "Name, description, branding and other channel options.",
      deleteTitle: "Delete channel?",
      deleteDesc: "This cannot be undone. The channel will disappear and subscribers will lose access to all posts. Type the name to confirm",
      deleteCompact: "Delete",
      deleteChannel: "Delete channel",
      cancel: "Cancel",
      deleting: "Deleting…",
      deleteForever: "Delete permanently",
      deleted: "Channel deleted",
      deleteFailed: "Could not delete channel",
    },
    chatHeader: {
      searchAria: "Search messages",
      callBusy: "Call already in progress",
      userBlocked: "User is blocked",
      unblockToCall: "Unblock to place a call",
      callAria: "Call {{name}}",
      menuAria: "Chat menu",
      info: "Info",
      groupCall: "Group call",
      searchInChat: "Search in chat",
      archive: "Archive",
      report: "Report",
      muteEnabled: "Notifications enabled",
      muteEnabledDesc: "You will receive notifications from {{name}} again",
      muteDisabled: "Notifications muted",
      muteDisabledDesc: "Chat with {{name}} will no longer send notifications",
      restored: "Chat restored",
      restoredDesc: "The conversation is back in your active list",
      archived: "Chat archived",
      archivedDesc: "The chat was moved to archive. You can find it in the archived list.",
      unpinned: "Chat unpinned",
      unpinFailed: "Could not unpin chat",
      pinned: "Chat pinned",
      pinnedDesc: "It is now at the top of the list",
      pinFailed: "Could not pin chat",
      clearConfirm: "Clear chat history with {{name}}? This cannot be undone.",
      clearFailed: "Could not clear history",
      historyCleared: "History cleared",
      deleteConfirm: "Delete chat with {{name}}? The conversation will disappear from the list.",
      deleteFailed: "Could not delete chat",
      chatDeleted: "Chat deleted",
      unblockFailed: "Could not unblock",
      blockFailed: "Could not block",
      userUnblocked: "{{name}} unblocked",
      userUnblockedDesc: "You can exchange messages again",
      userBlockedToast: "{{name}} blocked",
      userBlockedDesc: "You will no longer receive messages from this user; they were removed from your friends",
    },
  },
  pages: {
    reviews: {
      categoryReviews: "{{name}}",
      editPoster: "Edit cover",
      editPhoto: "Edit photo",
    },
    adminReviews: {
      title: "Reviews",
      uploadLink: "+ Upload review",
      searchPlaceholder: "Search by title…",
      allStatuses: "All statuses",
      statusPublished: "Published",
      statusProcessing: "Under moderation",
      statusScheduled: "Scheduled",
      statusRejected: "Rejected",
      refresh: "Refresh",
      colTitle: "Title",
      colAuthor: "Author",
      colCategory: "Category",
      colStatus: "Status",
      colViews: "Views",
      colActions: "Actions",
      loading: "Loading…",
      empty: "No reviews",
      scheduledAt: "Publish at: {{date}}",
      approve: "Approve",
      preview: "Preview",
      onSite: "On site",
      promo: "Promo",
      delete: "Delete",
      previewDialog: "Review preview",
      close: "Close",
      videoUnavailable: "Video unavailable",
      approveAndPublish: "Approve and publish",
      publish: "Publish",
      statusPublishedBadge: "Published",
      statusProcessingBadge: "Under moderation",
      statusRejectedBadge: "Rejected",
      statusScheduledBadge: "Scheduled",
      loadFailed: "Could not load reviews",
      approveFailed: "Could not approve",
      statusUpdateFailed: "Could not update status",
      updateFailed: "Could not update",
      deleteFailed: "Could not delete",
      approved: "Review published",
      statusUpdated: "Status updated",
      deleted: "Review deleted",
      deleteConfirm: "Delete this review?",
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
console.log("Patched en.ts with P3 translations");
