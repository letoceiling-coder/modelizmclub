// frontend/src/components/ui/Icon.tsx
// <Icon slot> — единая точка рендера иконки для переопределяемого слота.
// Если для слота опубликован (или в превью-черновике) кастомный SVG — инлайнит
// его в currentColor под цветом токена; иначе рендерит дефолтную lucide-иконку.
// Fallback на lucide гарантирован всегда.
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { useIconOverride } from "@/lib/icon-overrides";
import { ICON_SLOTS, tokenCssVar, categorySlotKey, type TokenKey } from "@/lib/icon-slots";

const SLOT_BY_KEY: Record<string, (typeof ICON_SLOTS)[number]> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, (typeof ICON_SLOTS)[number]>,
);

function InlineSvg({ svg, token, className, size }: { svg: string; token: TokenKey; className?: string; size?: number }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        color: tokenCssVar(token),
        width: size ?? undefined,
        height: size ?? undefined,
      }}
      // Разметка уже санитизирована сервером и повторно проверена isSafeSvgMarkup
      // перед этим рендером (см. вызывающие места). Инлайн нужен, чтобы SVG
      // наследовал currentColor от токена.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function LucideFallback({ lucideName, token, className, size }: { lucideName: string; token: TokenKey; className?: string; size?: number }) {
  const LucideIcon = resolveLucideIcon(lucideName);
  return <LucideIcon className={className} style={{ color: tokenCssVar(token) }} size={size} />;
}

export function Icon({ slot, className, size }: { slot: string; className?: string; size?: number }) {
  const override = useIconOverride(slot);
  const def = SLOT_BY_KEY[slot];
  const defaultLucide = def?.defaultLucide ?? "Box";
  const defaultToken: TokenKey = def?.defaultToken ?? "foreground";

  if (override && isSafeSvgMarkup(override.svg)) {
    return <InlineSvg svg={override.svg} token={override.token} className={className} size={size} />;
  }
  return <LucideFallback lucideName={defaultLucide} token={defaultToken} className={className} size={size} />;
}

// Иконка категории — динамический слот "category:<id>". Дефолт — lucide по имени
// из category.icon (текущее поведение resolveLucideIcon).
export function CategoryIcon({
  categoryId, name, className, size,
}: { categoryId: string | number; name?: string | null; className?: string; size?: number }) {
  const override = useIconOverride(categorySlotKey(categoryId));
  if (override && isSafeSvgMarkup(override.svg)) {
    return <InlineSvg svg={override.svg} token={override.token} className={className} size={size} />;
  }
  const LucideIcon = resolveLucideIcon(name);
  return <LucideIcon className={className} size={size} />;
}
