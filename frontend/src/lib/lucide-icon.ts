import { useSyncExternalStore } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  Box,
  Camera,
  Car,
  Clapperboard,
  ClipboardList,
  Compass,
  Cpu,
  Crown,
  Focus,
  Gift,
  Globe,
  Hammer,
  Heart,
  HeartHandshake,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  Newspaper,
  Package,
  Plane,
  Plus,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Star,
  Target,
  Truck,
  User,
  UserPlus,
  Users,
  Users2,
  Video,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons that ship in the entry chunk: every `defaultLucide` from
 * `lib/icon-slots`, every entry of the admin landing picker, and the icon
 * names the category seeds use. Importing them by name keeps Rollup's
 * tree-shaking intact — a namespace import (`import * as Icons`) pulled all
 * ~1600 Lucide icons into the first-load bundle instead.
 *
 * Anything outside this set (an icon an admin stored directly in the DB)
 * resolves through the lazily loaded full library, see `loadFullLucide`.
 */
const REGISTRY: Record<string, LucideIcon> = {
  Award,
  Bell,
  BookOpen,
  Bot,
  Box,
  Camera,
  Car,
  Clapperboard,
  ClipboardList,
  Compass,
  Cpu,
  Crown,
  Focus,
  Gift,
  Globe,
  Hammer,
  Heart,
  HeartHandshake,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  Newspaper,
  Package,
  Plane,
  Plus,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Star,
  Target,
  Truck,
  User,
  UserPlus,
  Users,
  Users2,
  Video,
  Wallet,
  Wrench,
  Zap,
};

function toPascalCase(name: string): string {
  return name.includes("-")
    ? name
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join("")
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// --- lazy tail of the icon set -------------------------------------------

let full: Record<string, LucideIcon> | null = null;
let pending: Promise<void> | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function loadFullLucide(): void {
  if (full || pending) return;
  pending = import("lucide-react")
    .then((mod) => {
      full = mod as unknown as Record<string, LucideIcon>;
      revision += 1;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Stay on the Box placeholder; a later render retries the fetch.
      pending = null;
    });
}

/** `useSyncExternalStore` pair so a component repaints once the tail lands. */
export function subscribeLucide(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLucideRevision(): number {
  return revision;
}

/** SSR renders the statically bundled icons only — no lazy tail on the server. */
export function getLucideServerRevision(): number {
  return 0;
}

/**
 * Subscribes the calling component to the lazy icon tail so an icon that was
 * not bundled statically swaps in as soon as its chunk arrives.
 */
export function useLucideTail(): void {
  useSyncExternalStore(subscribeLucide, getLucideRevision, getLucideServerRevision);
}

export function resolveLucideIcon(name?: string | null): LucideIcon {
  if (!name) return Box;
  const direct = REGISTRY[name];
  if (direct) return direct;
  const normalized = toPascalCase(name);
  const known = REGISTRY[normalized];
  if (known) return known;

  const lazy = full?.[name] ?? full?.[normalized];
  if (lazy) return lazy;

  if (typeof window !== "undefined") loadFullLucide();
  return Box;
}
