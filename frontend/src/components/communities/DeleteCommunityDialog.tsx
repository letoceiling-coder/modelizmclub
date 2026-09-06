import { EntityDeleteDialog } from "@/components/entity/EntityDeleteDialog";
import { deleteCommunity } from "@/lib/api/communities";

interface Props {
  slug: string;
  name: string;
  onDeleted: () => void;
  compact?: boolean;
}

export function DeleteCommunityDialog({ slug, name, onDeleted, compact }: Props) {
  return (
    <EntityDeleteDialog
      name={name}
      compact={compact}
      onDeleted={onDeleted}
      remove={(confirmation) => deleteCommunity(slug, confirmation)}
      labels={{
        trigger: "Удалить сообщество",
        triggerCompact: "Удалить",
        title: "Удалить сообщество?",
        description:
          "Это действие необратимо. Сообщество исчезнет из поиска и списков. Чтобы подтвердить, введите название",
        cancel: "Отмена",
        confirm: "Удалить навсегда",
        busy: "Удаляем…",
        done: "Сообщество удалено",
        failed: "Не удалось удалить сообщество",
      }}
    />
  );
}
