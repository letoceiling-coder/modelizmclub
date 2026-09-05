import { useTranslation } from "react-i18next";
import { EntitySettingsSheet } from "@/components/entity/EntitySettingsSheet";
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
    <EntitySettingsSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("components.channelManage.settingsTitle")}
      description={t("components.channelManage.settingsDesc")}
    >
      <ChannelManagePanel channel={channel} onUpdated={onUpdated} onDeleted={onDeleted} />
    </EntitySettingsSheet>
  );
}
