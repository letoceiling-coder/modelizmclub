import { useEffect, useState } from "react";
import { fetchFooterContacts } from "@/lib/api/site";
import type { FooterContacts } from "@/lib/footer-contacts";

let cached: FooterContacts | null = null;
let inflight: Promise<FooterContacts> | null = null;

export function seedFooterContacts(data: FooterContacts): void {
  cached = data;
}

export function useFooterContacts(): FooterContacts | null {
  const [contacts, setContacts] = useState<FooterContacts | null>(cached);

  useEffect(() => {
    if (cached) {
      setContacts(cached);
      return;
    }
    if (!inflight) {
      inflight = (async () => {
        try {
          const { startPublicBootstrap } = await import("@/lib/api/bootstrap");
          const boot = await startPublicBootstrap();
          if (boot?.footer_contacts) {
            cached = boot.footer_contacts;
            return cached;
          }
        } catch {
          /* dedicated endpoint below */
        }
        const data = await fetchFooterContacts();
        cached = data;
        return data;
      })().finally(() => {
        inflight = null;
      });
    }
    void inflight.then((data) => setContacts(data)).catch(() => setContacts({}));
  }, []);

  return contacts;
}

/** Call after admin saves footer contacts to refresh cached value. */
export function invalidateFooterContactsCache(): void {
  cached = null;
  inflight = null;
}
