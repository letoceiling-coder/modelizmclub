import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Настройки сообщества</SheetTitle>
          <SheetDescription>
            Название, описание, оформление и другие параметры сообщества.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 pb-8">
          <CommunityManagePanel
            community={community}
            Icon={Icon}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
