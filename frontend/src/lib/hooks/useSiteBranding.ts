import { useEffect, useState } from "react";
import { fetchSiteBranding, type SiteBranding } from "@/lib/api/site";

const DEFAULT: SiteBranding = { header_size: 48, footer_size: 36 };

let cache: SiteBranding | null = null;
let inflight: Promise<SiteBranding> | null = null;

export function invalidateSiteBrandingCache(): void {
  cache = null;
  inflight = null;
}

function loadBranding(): Promise<SiteBranding> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetchSiteBranding()
    .then((data) => {
      cache = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSiteBranding(): SiteBranding {
  const [data, setData] = useState<SiteBranding>(cache ?? DEFAULT);

  useEffect(() => {
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
