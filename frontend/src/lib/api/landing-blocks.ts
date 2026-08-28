import { api } from "./client";

export interface LandingCardPublic {
  id: number;
  title: string;
  description: string | null;
  icon: string;
  icon_url?: string | null;
  link_url: string | null;
  post_category_id: number | null;
  listings_count: number;
}

export interface LandingSectionPublic {
  slug: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  media_url?: string | null;
  cards: LandingCardPublic[];
}

export interface LandingBlocksPublic {
  sections: LandingSectionPublic[];
}

let inflight: Promise<LandingBlocksPublic> | null = null;
let cached: LandingBlocksPublic | null = null;

export function seedLandingBlocks(data: LandingBlocksPublic): void {
  cached = data;
}

export function getCachedLandingBlocks(): LandingBlocksPublic | null {
  return cached;
}

export async function fetchLandingBlocks(): Promise<LandingBlocksPublic> {
  if (cached) return cached;
  try {
    const { startPublicBootstrap } = await import("./bootstrap");
    const boot = await startPublicBootstrap();
    if (boot?.landing_blocks) {
      cached = boot.landing_blocks;
      return cached;
    }
  } catch {
    /* dedicated endpoint below */
  }
  if (inflight) return inflight;
  inflight = api<{ data: LandingBlocksPublic }>("/public/landing-blocks", { auth: false })
    .then((res) => {
      cached = res.data ?? { sections: [] };
      return cached;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function sectionBySlug(data: LandingBlocksPublic, slug: string): LandingSectionPublic | undefined {
  return data.sections.find((s) => s.slug === slug);
}
