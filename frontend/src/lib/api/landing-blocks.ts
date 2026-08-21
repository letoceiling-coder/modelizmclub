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

export async function fetchLandingBlocks(): Promise<LandingBlocksPublic> {
  if (inflight) return inflight;
  inflight = api<{ data: LandingBlocksPublic }>("/public/landing-blocks", { auth: false })
    .then((res) => res.data ?? { sections: [] })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function sectionBySlug(data: LandingBlocksPublic, slug: string): LandingSectionPublic | undefined {
  return data.sections.find((s) => s.slug === slug);
}
