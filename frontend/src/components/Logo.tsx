import wordmark from "@/assets/logo-modelizm-wordmark.png";
import { useSiteBranding } from "@/lib/hooks/useSiteBranding";

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
  const src =
    variant === "footer"
      ? (branding.footer_logo_url ?? branding.logo_url ?? wordmark)
      : (branding.logo_url ?? wordmark);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="logo-plate inline-flex min-w-0 items-center justify-center">
        <img
          src={src}
          width={Math.round(height * 1600 / 514)}
          loading="lazy"
          decoding="async"
          alt={branding.site_name ?? "МоДелизМ"}
          height={height}
          className="object-contain block"
          style={{ height, width: "auto", maxWidth: "100%" }}
        />
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
