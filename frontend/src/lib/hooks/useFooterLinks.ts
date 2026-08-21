import { useQuery } from "@tanstack/react-query";
import { fetchFooterLinks, type FooterLinksGrouped } from "@/lib/api/legal";
import type { FooterLink } from "@/lib/footer-links";

export function useFooterLinksApi() {
  return useQuery({
    queryKey: ["footer-links"],
    queryFn: fetchFooterLinks,
    staleTime: 5 * 60_000,
  });
}

export function resolveFooterHref(link: { target_type: string; target_value: string }): string {
  if (link.target_type === "external") return link.target_value;
  return link.target_value.startsWith("/") ? link.target_value : `/${link.target_value}`;
}

export function footerLinkLabel(label: string, t: (k: string) => string): string {
  return label.startsWith("components.") ? t(label) : label;
}

export function groupTitle(group: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    legal: "components.footerLinks.docsTitle",
    info: "components.footerLinks.supportTitle",
    contacts: "components.footerLinks.contacts",
  };
  return t(map[group] ?? "components.footerLinks.docsTitle");
}

export type { FooterLink, FooterLinksGrouped };
