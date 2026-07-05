import * as Icons from "lucide-react";
import { Box, type LucideIcon } from "lucide-react";

export function resolveLucideIcon(name?: string | null): LucideIcon {
  if (!name) return Box;
  const icon = (Icons as unknown as Record<string, LucideIcon | undefined>)[name];
  return icon ?? Box;
}
