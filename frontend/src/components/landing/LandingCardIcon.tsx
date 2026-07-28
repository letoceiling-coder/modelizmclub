import { LandingCardIconSlot } from "@/components/ui/Icon";

interface Props {
  cardId?: string | number | null;
  icon?: string | null;
  iconUrl?: string | null;
  size?: number;
  className?: string;
  imgClassName?: string;
}

/** Renders a landing card icon — slot override, then custom upload, then Lucide. */
export function LandingCardIcon({ cardId, icon, iconUrl, size = 20, className, imgClassName }: Props) {
  return (
    <LandingCardIconSlot
      cardId={cardId}
      icon={icon}
      iconUrl={iconUrl}
      size={size}
      className={className}
      imgClassName={imgClassName}
    />
  );
}
