import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChannelManagePanel } from "@/components/channels/ChannelManagePanel";
import type { Channel } from "@/lib/channels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  onUpdated: (channel: Channel) => void;
  onDeleted: () => void;
}

export function ChannelSettingsSheet({ open, onOpenChange, channel, onUpdated, onDeleted }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Настройки канала</SheetTitle>
          <SheetDescription>
            Название, описание, оформление и другие параметры канала.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 pb-8">
          <ChannelManagePanel
            channel={channel}
            onUpdated={(updated) => onUpdated(updated)}
            onDeleted={onDeleted}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
