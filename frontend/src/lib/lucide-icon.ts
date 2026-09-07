import { useSyncExternalStore } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  Box,
  Boxes,
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
 * names the category seeds use.
 *
 * Сюда же — имена из вычисляемых дефолтов, а не только из литералов таблицы
 * слотов: `lib/api/categories.ts` и `icon-slots.ts` подставляют `Boxes`
 * категории без своей иконки. Такое имя есть в lucide, но его не было здесь,
 * и каждая загрузка /feed добирала ради него всю библиотеку — 115 КБ по
 * проводу. Замер 07.09. Importing them by name keeps Rollup's
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
  Boxes,
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

/** Имена, которые промахнулись мимо REGISTRY и ждут проверки по списку. */
const wanted = new Set<string>();
let names: Set<string> | null = null;
let namesPending: Promise<void> | null = null;

/** `EllipsisVertical` → `ellipsis-vertical`, `Users2` → `users-2`. */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

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

/**
 * Тянет библиотеку, только если хоть одно из запрошенных имён в ней есть.
 *
 * Библиотека весит 115 КБ по проводу. Имя, которого в lucide нет, стоило
 * ровно столько же и всё равно оставляло `Box` — см. комментарий к
 * `lucideNamesModule` в vite.config.ts. Список имён на порядок легче
 * (6,8 КБ brotli) и грузится только при первом промахе.
 */
function loadNamesThenIcon(): void {
  if (!names) {
    if (namesPending) return;
    namesPending = import("virtual:lucide-names")
      .then((mod) => {
        names = new Set(mod.NAMES);
        loadNamesThenIcon();
      })
      .catch(() => {
        // Список не доехал — не выдумываем, оставляем заглушку.
        namesPending = null;
      });
    return;
  }
  for (const name of wanted) {
    if (names.has(toKebabCase(name))) {
      loadFullLucide();
      return;
    }
  }
}

function requestLazyIcon(...candidates: string[]): void {
  if (full || pending) return;
  for (const name of candidates) wanted.add(name);
  loadNamesThenIcon();
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

/**
 * `fallback` — что рисовать, пока имя не разрешилось или не разрешится вовсе.
 * По умолчанию нейтральная коробка; вызывающий может передать свою заглушку,
 * если на его экране принята другая (у списка подкатегорий это `Hash`).
 */
export function resolveLucideIcon(name?: string | null, fallback: LucideIcon = Box): LucideIcon {
  if (!name) return fallback;
  const direct = REGISTRY[name];
  if (direct) return direct;
  const normalized = toPascalCase(name);
  const known = REGISTRY[normalized];
  if (known) return known;

  const lazy = full?.[name] ?? full?.[normalized];
  if (lazy) return lazy;

  if (typeof window !== "undefined") requestLazyIcon(name, normalized);
  return fallback;
}
