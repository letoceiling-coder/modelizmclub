import type { LucideIcon } from "lucide-react";
import { EntitySettingsSheet } from "@/components/entity/EntitySettingsSheet";
import { CommunityManagePanel } from "@/components/communities/CommunityManagePanel";
import type { Community } from "@/lib/mock";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: Community;
  Icon: LucideIcon;
  onUpdated: (community: Community) => void;
  onDeleted: () => void;
}

export function CommunitySettingsSheet({
  open,
  onOpenChange,
  community,
  Icon,
  onUpdated,
  onDeleted,
}: Props) {
  return (
    <EntitySettingsSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Настройки сообщества"
      description="Название, описание, оформление и другие параметры сообщества."
    >
      <CommunityManagePanel
        community={community}
        Icon={Icon}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </EntitySettingsSheet>
  );
}
