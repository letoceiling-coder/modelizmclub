export interface FooterContactSocial {
  label: string;
  url: string;
}

export interface FooterContacts {
  email?: string;
  phone?: string;
  hours?: string;
  social?: FooterContactSocial[];
}

export interface FooterContactsDraft {
  email: string;
  phone: string;
  hours: string;
  social: FooterContactSocial[];
}

export const EMPTY_FOOTER_CONTACTS_DRAFT: FooterContactsDraft = {
  email: "",
  phone: "",
  hours: "",
  social: [
    { label: "VK", url: "" },
    { label: "MAX", url: "" },
    { label: "Telegram", url: "" },
  ],
};

export function footerContactsFromDraft(draft: FooterContactsDraft): FooterContacts {
  const data: FooterContacts = {};
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const hours = draft.hours.trim();
  if (email) data.email = email;
  if (phone) data.phone = phone;
  if (hours) data.hours = hours;
  const social = draft.social
    .map((s) => ({ label: s.label.trim(), url: s.url.trim() }))
    .filter((s) => s.label && s.url);
  if (social.length > 0) data.social = social;
  return data;
}

export function footerContactsToDraft(raw: FooterContacts | null | undefined): FooterContactsDraft {
  const draft = structuredClone(EMPTY_FOOTER_CONTACTS_DRAFT);
  if (!raw) return draft;
  draft.email = raw.email ?? "";
  draft.phone = raw.phone ?? "";
  draft.hours = raw.hours ?? "";
  for (const row of raw.social ?? []) {
    const idx = draft.social.findIndex((s) => s.label.toLowerCase() === row.label.toLowerCase());
    if (idx >= 0) draft.social[idx] = { label: draft.social[idx].label, url: row.url };
    else draft.social.push({ label: row.label, url: row.url });
  }
  return draft;
}

export function phoneTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `tel:+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+7${digits}`;
  return digits ? `tel:+${digits}` : `tel:${phone}`;
}

export function hasFooterContacts(data: FooterContacts | null | undefined): boolean {
  if (!data) return false;
  return Boolean(data.email || data.phone || data.hours || (data.social?.length ?? 0) > 0);
}
