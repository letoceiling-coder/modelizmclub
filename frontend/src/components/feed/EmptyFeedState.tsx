import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyFeedState({ icon, title, description, ctaLabel, onCta }: Props) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={ctaLabel && onCta ? { label: ctaLabel, onClick: onCta } : undefined}
    />
  );
}
