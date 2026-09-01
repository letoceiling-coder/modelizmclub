/** External share destinations used by post, listing and community share menus. */

export type ShareTarget = {
  id: "telegram" | "whatsapp" | "vk";
  label: string;
  href: (url: string, title?: string) => string;
};

export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: "telegram",
    label: "Telegram",
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}${title ? `&text=${encodeURIComponent(title)}` : ""}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(title ? `${title} ${url}` : url)}`,
  },
  {
    id: "vk",
    label: "VK",
    href: (url, title) =>
      `https://vk.com/share.php?url=${encodeURIComponent(url)}${title ? `&title=${encodeURIComponent(title)}` : ""}`,
  },
];

export function openShareTarget(href: string): void {
  if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer");
}
