import * as Icons from "lucide-react";
import { Box, type LucideIcon } from "lucide-react";

export function resolveLucideIcon(name?: string | null): LucideIcon {
  if (!name) return Box;
  const direct = (Icons as unknown as Record<string, LucideIcon | undefined>)[name];
  if (direct) return direct;
  const normalized = name.includes("-")
    ? name
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join("")
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return (Icons as unknown as Record<string, LucideIcon | undefined>)[normalized] ?? Box;
}
