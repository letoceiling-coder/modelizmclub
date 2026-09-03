// frontend/src/components/ui/Icon.tsx
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { useIconOverride } from "@/lib/icon-overrides";
import { ICON_SLOTS, tokenCssVar, categorySlotKey, landingCardSlotKey, getIconSlot, type TokenKey } from "@/lib/icon-slots";
import { cn } from "@/lib/utils";

export { IconBox, type IconBoxSize, type IconBoxVariant } from "@/components/ui/IconBox";

const SLOT_BY_KEY: Record<string, (typeof ICON_SLOTS)[number]> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, (typeof ICON_SLOTS)[number]>,
);

const FILL_CLASS = "icon-box__content";

function InlineSvg({ svg, color, className, size, fill }: { svg: string; color?: string; className?: string; size?: number; fill?: boolean }) {
  return (
    <span
      className={cn(fill && FILL_CLASS, className)}
      aria-hidden
      style={{
        display: "inline-flex",
        color,
        width: fill ? undefined : size ?? undefined,
        height: fill ? undefined : size ?? undefined,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function PngIcon({ url, className, size, fill }: { url: string; className?: string; size?: number; fill?: boolean }) {
  return (
    <img
      src={url}
      width={size ?? 24}
      height={size ?? 24}
      loading="lazy"
      decoding="async"
      alt=""
      aria-hidden
      className={cn(fill && FILL_CLASS, className)}
      style={
        fill
          ? { objectFit: "contain", display: "block" }
          : { width: size ?? 22, height: size ?? 22, objectFit: "contain", display: "block" }
      }
    />
  );
}

function LucideFallback({ lucideName, color, className, size, strokeWidth, fill }: { lucideName: string; color?: string; className?: string; size?: number; strokeWidth?: number; fill?: boolean }) {
  const LucideIcon = resolveLucideIcon(lucideName);
  if (fill) {
    return <LucideIcon className={cn(FILL_CLASS, className)} style={color ? { color } : undefined} strokeWidth={strokeWidth} />;
  }
  return <LucideIcon className={className} style={color ? { color } : undefined} size={size} strokeWidth={strokeWidth} />;
}

function renderOverride(
  override: { format?: string; svg?: string; url?: string; token: TokenKey },
  opts: { className?: string; size?: number; inheritColor?: boolean; fill?: boolean },
) {
  if ((override.format === "png" || (!override.svg && override.url)) && override.url) {
    return <PngIcon url={override.url} className={opts.className} size={opts.size} fill={opts.fill} />;
  }
  if (override.svg && isSafeSvgMarkup(override.svg)) {
    const color = opts.inheritColor ? undefined : tokenCssVar(override.token);
    return <InlineSvg svg={override.svg} color={color} className={opts.className} size={opts.size} fill={opts.fill} />;
  }
  return null;
}

export function Icon({
  slot, className, size, strokeWidth, inheritColor, fill,
}: { slot: string; className?: string; size?: number; strokeWidth?: number; inheritColor?: boolean; fill?: boolean }) {
  const override = useIconOverride(slot);
  const def = SLOT_BY_KEY[slot] ?? getIconSlot(slot);
  const defaultLucide = def?.defaultLucide ?? "Box";
  const defaultToken: TokenKey = def?.defaultToken ?? "foreground";

  if (override) {
    const rendered = renderOverride(override, { className, size, inheritColor, fill });
    if (rendered) return rendered;
  }
  const color = inheritColor ? undefined : tokenCssVar(defaultToken);
  return <LucideFallback lucideName={defaultLucide} color={color} className={className} size={size} strokeWidth={strokeWidth} fill={fill} />;
}

export function CategoryIcon({
  categoryId, name, iconImageUrl, className, size, fill,
}: { categoryId: string | number; name?: string | null; iconImageUrl?: string | null; className?: string; size?: number; fill?: boolean }) {
  const override = useIconOverride(categorySlotKey(categoryId));
  if (override) {
    const rendered = renderOverride(override, { className, size, fill });
    if (rendered) return rendered;
  }
  if (iconImageUrl) {
    return <PngIcon url={iconImageUrl} className={className} size={size} fill={fill} />;
  }
  const LucideIcon = resolveLucideIcon(name);
  if (fill) {
    return <LucideIcon className={cn(FILL_CLASS, className)} />;
  }
  return <LucideIcon className={className} size={size} />;
}

/** Landing card icon with slot override support. */
export function LandingCardIconSlot({
  cardId, icon, iconUrl, size = 20, className, imgClassName, fill,
}: {
  cardId?: string | number | null;
  icon?: string | null;
  iconUrl?: string | null;
  size?: number;
  className?: string;
  imgClassName?: string;
  fill?: boolean;
}) {
  const slotKey = cardId != null ? landingCardSlotKey(cardId) : "__landing_none__";
  const override = useIconOverride(slotKey);

  if (cardId != null && override) {
    const rendered = renderOverride(override, { className: imgClassName ?? className, size, fill });
    if (rendered) return rendered;
  }
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        width={size ?? 24}
        height={size ?? 24}
        loading="lazy"
        decoding="async"
        alt=""
        className={cn(fill && FILL_CLASS, imgClassName ?? className)}
        style={fill ? { objectFit: "contain" } : { width: size, height: size, objectFit: "contain" }}
      />
    );
  }
  const LucideIcon = resolveLucideIcon(icon);
  if (fill) {
    return <LucideIcon className={cn(FILL_CLASS, className)} />;
  }
  return <LucideIcon size={size} className={className} />;
}
