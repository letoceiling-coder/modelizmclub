// frontend/src/components/ui/Icon.tsx
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { useIconOverride } from "@/lib/icon-overrides";
import { ICON_SLOTS, tokenCssVar, categorySlotKey, type TokenKey } from "@/lib/icon-slots";

const SLOT_BY_KEY: Record<string, (typeof ICON_SLOTS)[number]> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, (typeof ICON_SLOTS)[number]>,
);

function InlineSvg({ svg, color, className, size }: { svg: string; color?: string; className?: string; size?: number }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        color,
        width: size ?? undefined,
        height: size ?? undefined,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function PngIcon({ url, className, size }: { url: string; className?: string; size?: number }) {
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      className={className}
      style={{ width: size ?? 22, height: size ?? 22, objectFit: "contain", display: "block" }}
    />
  );
}

function LucideFallback({ lucideName, color, className, size, strokeWidth }: { lucideName: string; color?: string; className?: string; size?: number; strokeWidth?: number }) {
  const LucideIcon = resolveLucideIcon(lucideName);
  return <LucideIcon className={className} style={color ? { color } : undefined} size={size} strokeWidth={strokeWidth} />;
}

function renderOverride(
  override: { format?: string; svg?: string; url?: string; token: TokenKey },
  opts: { className?: string; size?: number; inheritColor?: boolean },
) {
  if ((override.format === "png" || (!override.svg && override.url)) && override.url) {
    return <PngIcon url={override.url} className={opts.className} size={opts.size} />;
  }
  if (override.svg && isSafeSvgMarkup(override.svg)) {
    const color = opts.inheritColor ? undefined : tokenCssVar(override.token);
    return <InlineSvg svg={override.svg} color={color} className={opts.className} size={opts.size} />;
  }
  return null;
}

export function Icon({
  slot, className, size, strokeWidth, inheritColor,
}: { slot: string; className?: string; size?: number; strokeWidth?: number; inheritColor?: boolean }) {
  const override = useIconOverride(slot);
  const def = SLOT_BY_KEY[slot];
  const defaultLucide = def?.defaultLucide ?? "Box";
  const defaultToken: TokenKey = def?.defaultToken ?? "foreground";

  if (override) {
    const rendered = renderOverride(override, { className, size, inheritColor });
    if (rendered) return rendered;
  }
  const color = inheritColor ? undefined : tokenCssVar(defaultToken);
  return <LucideFallback lucideName={defaultLucide} color={color} className={className} size={size} strokeWidth={strokeWidth} />;
}

export function CategoryIcon({
  categoryId, name, className, size,
}: { categoryId: string | number; name?: string | null; className?: string; size?: number }) {
  const override = useIconOverride(categorySlotKey(categoryId));
  if (override) {
    const rendered = renderOverride(override, { className, size });
    if (rendered) return rendered;
  }
  const LucideIcon = resolveLucideIcon(name);
  return <LucideIcon className={className} size={size} />;
}
