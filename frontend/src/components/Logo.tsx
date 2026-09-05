import wordmarkWebp from "@/assets/logo-modelizm-wordmark.webp";
import { useSiteBranding } from "@/lib/hooks/useSiteBranding";

/**
 * Запасной PNG лежит в public/, а не рядом с webp в src/assets.
 *
 * Импортированные картинки попадают в граф сборки, и Start кладёт на них
 * preload в head. Импортируй мы обе, каждая страница тянула бы и webp, и
 * png — и запасной вариант, который никто не откроет, стоил бы столько же,
 * сколько основной. Из public его запросит только браузер без поддержки
 * webp: <img> внутри <picture> не загружается, пока подходит <source>.
 */
const WORDMARK_PNG = "/brand/logo-wordmark.png";

export function Logo({
  size,
  showText = false,
  variant = "header",
}: {
  size?: number;
  showText?: boolean;
  variant?: "header" | "footer";
}) {
  const branding = useSiteBranding();
  const height = size ?? (variant === "footer" ? branding.footer_size : branding.header_size);
  // Логотип из настроек сайта приходит одним файлом и без пары форматов —
  // тогда <picture> не нужен, показываем как есть.
  const branded =
    variant === "footer"
      ? (branding.footer_logo_url ?? branding.logo_url ?? null)
      : (branding.logo_url ?? null);

  const img = (
    <img
      src={branded ?? WORDMARK_PNG}
      width={Math.round((height * 1600) / 514)}
      // Шапка — первый экран на каждой странице. С lazy браузер откладывал
      // логотип до вычисления вёрстки, хотя он есть в исходном HTML.
      loading="eager"
      decoding="async"
      alt={branding.site_name ?? "МоДелизМ"}
      height={height}
      className="object-contain block"
      style={{ height, width: "auto", maxWidth: "100%" }}
    />
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="logo-plate inline-flex min-w-0 items-center justify-center">
        {branded ? (
          img
        ) : (
          <picture>
            <source srcSet={wordmarkWebp} type="image/webp" />
            {img}
          </picture>
        )}
      </span>
      {showText && (
        <span
          className="font-display text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--accent)" }}
        >
          Форум
        </span>
      )}
    </div>
  );
}
