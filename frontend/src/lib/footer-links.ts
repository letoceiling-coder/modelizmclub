export interface FooterLink {
  labelKey: string;
  to: string;
}

export interface FooterSocial {
  label: string;
  href: string | null;
}

export const SUPPORT_LINKS: FooterLink[] = [
  { labelKey: "components.footerLinks.helpFaq", to: "/help" },
  { labelKey: "components.footerLinks.writeSupport", to: "/info/support" },
  { labelKey: "components.footerLinks.leaveFeedback", to: "/info/feedback" },
];

export const COMPANY_LINKS: FooterLink[] = [
  { labelKey: "components.footerLinks.aboutCompany", to: "/info/company" },
  { labelKey: "components.footerLinks.advertising", to: "/info/advertising" },
  { labelKey: "components.footerLinks.contacts", to: "/info/contacts" },
];

export const DOCS_LINKS: FooterLink[] = [
  { labelKey: "components.footerLinks.rules", to: "/legal/rules" },
  { labelKey: "components.footerLinks.howItWorks", to: "/how-it-works" },
  { labelKey: "components.footerLinks.payment", to: "/payment" },
  { labelKey: "components.footerLinks.refund", to: "/refund" },
  { labelKey: "components.footerLinks.security", to: "/info/security" },
];

// href: null — no confirmed real account. Rendered as a disabled/TODO chip,
// never a live link (MAX/VK unconfirmed; no other social links anywhere).
export const SOCIAL_LINKS: FooterSocial[] = [
  { label: "MAX", href: null },
  { label: "VK", href: null },
];

export const FOOTER_COLUMNS: { titleKey: string; links: FooterLink[] }[] = [
  { titleKey: "components.footerLinks.supportTitle", links: SUPPORT_LINKS },
  { titleKey: "components.footerLinks.companyTitle", links: COMPANY_LINKS },
  { titleKey: "components.footerLinks.docsTitle", links: DOCS_LINKS },
];
