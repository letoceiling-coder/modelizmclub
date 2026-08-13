import { useQuery } from "@tanstack/react-query";
import { fetchFooterLinks, type FooterLinksGrouped } from "@/lib/api/legal";
import { DOCS_LINKS, SUPPORT_LINKS, type FooterLink } from "@/lib/footer-links";

const FALLBACK: FooterLinksGrouped = {
  legal: DOCS_LINKS.map((l, i) => ({
    id: i + 1,
    label: l.labelKey,
    target_type: "internal" as const,
    target_value: l.to,
    sort: i * 10,
  })),
  info: SUPPORT_LINKS.slice(1).map((l, i) => ({
    id: 100 + i,
    label: l.labelKey,
    target_type: "internal" as const,
    target_value: l.to,
    sort: i * 10,
  })),
};

export function useFooterLinksApi() {
  return useQuery({
    queryKey: ["footer-links"],
    queryFn: fetchFooterLinks,
    staleTime: 5 * 60_000,
    placeholderData: FALLBACK,
  });
}

export function resolveFooterHref(link: { target_type: string; target_value: string }): string {
  if (link.target_type === "external") return link.target_value;
  return link.target_value.startsWith("/") ? link.target_value : `/${link.target_value}`;
}

/** Label from API is plain Russian; fallback keys start with "components." */
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

export type { FooterLink };
