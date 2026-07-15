// frontend/src/components/ui/Icon.tsx
// <Icon slot> — единая точка рендера иконки для переопределяемого слота.
// Если для слота опубликован (или в превью-черновике) кастомный SVG — инлайнит
// его; иначе рендерит дефолтную lucide-иконку. Fallback на lucide гарантирован.
//
// Цвет:
//  - по умолчанию берётся из токена слота (для standalone-иконок разделов);
//  - inheritColor=true → цвет НЕ задаётся, иконка наследует currentColor от
//    родителя (нужно для навигации, где активный/неактивный пункт красит иконку
//    сам через state; форсирование токена сломало бы активное состояние).
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { isSafeSvgMarkup } from "@/lib/safe-svg";
import { useIconOverride } from "@/lib/icon-overrides";
import { ICON_SLOTS, tokenCssVar, categorySlotKey, type TokenKey } from "@/lib/icon-slots";

const SLOT_BY_KEY: Record<string, (typeof ICON_SLOTS)[number]> = ICON_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s; return acc; },
  {} as Record<string, (typeof ICON_SLOTS)[number]>,
);

// color === undefined → наследовать currentColor (не задавать color вовсе).
function InlineSvg({ svg, color, className, size }: { svg: string; color?: string; className?: string; size?: number }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        color, // undefined → CSS inherit (currentColor источник для fill/stroke SVG)
        width: size ?? undefined,
        height: size ?? undefined,
      }}
      // Разметка уже санитизирована сервером и повторно проверена isSafeSvgMarkup
      // перед этим рендером (см. вызывающие места).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function LucideFallback({ lucideName, color, className, size, strokeWidth }: { lucideName: string; color?: string; className?: string; size?: number; strokeWidth?: number }) {
  const LucideIcon = resolveLucideIcon(lucideName);
  return <LucideIcon className={className} style={color ? { color } : undefined} size={size} strokeWidth={strokeWidth} />;
}

export function Icon({
  slot, className, size, strokeWidth, inheritColor,
}: { slot: string; className?: string; size?: number; strokeWidth?: number; inheritColor?: boolean }) {
  const override = useIconOverride(slot);
  const def = SLOT_BY_KEY[slot];
  const defaultLucide = def?.defaultLucide ?? "Box";
  const defaultToken: TokenKey = def?.defaultToken ?? "foreground";

  if (override && isSafeSvgMarkup(override.svg)) {
    // inheritColor: цвет от родителя (navigation state); иначе — токен override.
    const color = inheritColor ? undefined : tokenCssVar(override.token);
    return <InlineSvg svg={override.svg} color={color} className={className} size={size} />;
  }
  const color = inheritColor ? undefined : tokenCssVar(defaultToken);
  return <LucideFallback lucideName={defaultLucide} color={color} className={className} size={size} strokeWidth={strokeWidth} />;
}

// Иконка категории — динамический слот "category:<id>". Дефолт — lucide по имени
// из category.icon (текущее поведение resolveLucideIcon). Override красится
// токеном (иконки категорий — standalone, не наследуют state-цвет как навигация).
export function CategoryIcon({
  categoryId, name, className, size,
}: { categoryId: string | number; name?: string | null; className?: string; size?: number }) {
  const override = useIconOverride(categorySlotKey(categoryId));
  if (override && isSafeSvgMarkup(override.svg)) {
    return <InlineSvg svg={override.svg} color={tokenCssVar(override.token)} className={className} size={size} />;
  }
  const LucideIcon = resolveLucideIcon(name);
  return <LucideIcon className={className} size={size} />;
}
