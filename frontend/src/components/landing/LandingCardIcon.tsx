import { resolveLucideIcon } from "@/lib/lucide-icon";

interface Props {
  icon?: string | null;
  iconUrl?: string | null;
  size?: number;
  className?: string;
  imgClassName?: string;
}

/** Renders a landing card icon — custom upload takes priority over Lucide name. */
export function LandingCardIcon({ icon, iconUrl, size = 20, className, imgClassName }: Props) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={imgClassName ?? className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  const Icon = resolveLucideIcon(icon);
  return <Icon size={size} className={className} />;
}
