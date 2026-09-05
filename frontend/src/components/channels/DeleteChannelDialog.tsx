import { useTranslation } from "react-i18next";
import { EntityDeleteDialog } from "@/components/entity/EntityDeleteDialog";
import { deleteChannel } from "@/lib/channels";

interface Props {
  slug: string;
  name: string;
  onDeleted: () => void;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function DeleteChannelDialog({
  slug,
  name,
  onDeleted,
  compact,
  open,
  onOpenChange,
  hideTrigger,
}: Props) {
  const { t } = useTranslation();

  return (
    <EntityDeleteDialog
      name={name}
      compact={compact}
      open={open}
      onOpenChange={onOpenChange}
      hideTrigger={hideTrigger}
      onDeleted={onDeleted}
      remove={(confirmation) => deleteChannel(slug, confirmation)}
      labels={{
        trigger: t("components.channelManage.deleteChannel"),
        triggerCompact: t("components.channelManage.deleteCompact"),
        title: t("components.channelManage.deleteTitle"),
        description: t("components.channelManage.deleteDesc"),
        cancel: t("components.channelManage.cancel"),
        confirm: t("components.channelManage.deleteForever"),
        busy: t("components.channelManage.deleting"),
        done: t("components.channelManage.deleted"),
        failed: t("components.channelManage.deleteFailed"),
      }}
    />
  );
}
