import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("components.channelManage.settingsTitle")}</SheetTitle>
          <SheetDescription>
            {t("components.channelManage.settingsDesc")}
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
