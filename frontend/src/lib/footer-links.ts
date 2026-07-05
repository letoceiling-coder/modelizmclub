export interface FooterLink {
  label: string;
  to: string;
}

export interface FooterSocial {
  label: string;
  href: string | null;
}

export const SUPPORT_LINKS: FooterLink[] = [
  { label: "Помощь и FAQ", to: "/help" },
  { label: "Написать в поддержку", to: "/info/support" },
  { label: "Оставить отзыв", to: "/info/feedback" },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: "О компании", to: "/info/company" },
  { label: "Реклама", to: "/info/advertising" },
  { label: "Контакты", to: "/info/contacts" },
];

export const DOCS_LINKS: FooterLink[] = [
  { label: "Правила", to: "/legal/rules" },
  { label: "Безопасность", to: "/info/security" },
];

// href: null — no confirmed real account. Rendered as a disabled/TODO chip,
// never a live link (MAX/VK unconfirmed; no other social links anywhere).
export const SOCIAL_LINKS: FooterSocial[] = [
  { label: "MAX", href: null },
  { label: "VK", href: null },
];
