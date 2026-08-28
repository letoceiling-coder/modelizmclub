import { useEffect, useState } from "react";
import { fetchSiteBranding, type SiteBranding } from "@/lib/api/site";

const DEFAULT: SiteBranding = { header_size: 48, footer_size: 36 };

let cache: SiteBranding | null = null;
let inflight: Promise<SiteBranding> | null = null;

export function invalidateSiteBrandingCache(): void {
  cache = null;
  inflight = null;
}

export function seedSiteBranding(data: SiteBranding): void {
  cache = data;
}

function loadBranding(): Promise<SiteBranding> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { startPublicBootstrap } = await import("@/lib/api/bootstrap");
      const boot = await startPublicBootstrap();
      if (boot?.branding) {
        cache = boot.branding;
        return cache;
      }
    } catch {
      /* dedicated endpoint below */
    }
    const data = await fetchSiteBranding();
    cache = data;
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useSiteBranding(): SiteBranding {
  const [data, setData] = useState<SiteBranding>(cache ?? DEFAULT);

  useEffect(() => {
    if (cache) return;
    let active = true;
    void loadBranding().then((branding) => {
      if (active) setData(branding);
    });
    return () => {
      active = false;
    };
  }, []);

  return data;
}
