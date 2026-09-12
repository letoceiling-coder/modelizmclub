import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Ban, ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { userById } from "@/lib/user-registry";
import { useStore, actions } from "@/lib/store";
import { fetchBlockedUsers, unblockUser } from "@/lib/api/social";
import { isDemoMode } from "@/lib/demo-mode";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/load-failed";
import { Button } from "@/components/ui/button";
import { reportReadFailure } from "@/lib/errors/handle";

export function BlockedUsersSection() {
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  /*
   * Числовые идентификаторы из ответа сервера. Снятие блокировки идёт по ним
   * (`DELETE /users/{id}/block`), а в хранилище лежат только строковые: если
   * запись в реестре пользователей не завелась, `userById` отдаёт заглушку без
   * `numericId`. До 12.09 в этом случае запрос молча не отправлялся, а тост
   * «разблокирован» показывался — блокировка оставалась на сервере и
   * возвращалась после перезагрузки.
   */
  const [numericIds, setNumericIds] = useState<Record<string, number>>({});
  // Отказ загрузки отделён от пустого списка: «Никто не заблокирован» — ответ
  // сервера, а не то, что он не ответил.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (isDemoMode()) return;
    fetchBlockedUsers()
      .then((users) => {
        setNumericIds((prev) => {
          const next = { ...prev };
          for (const u of users) if (u.numericId) next[u.id] = u.numericId;
          return next;
        });
        users.forEach((u) => {
          if (!blockedUserIds.includes(u.id)) actions.blockUser(u.id);
        });
        setLoadFailed(false);
      })
      .catch((e) => {
        setLoadFailed(true);
        reportReadFailure(e, "чёрный список");
      });
  }, [reloadTick]);

  if (loadFailed && blockedUserIds.length === 0) {
    return <LoadFailed icon={Ban} onRetry={() => setReloadTick((n) => n + 1)} />;
  }

  if (blockedUserIds.length === 0) {
    return <EmptyState icon={Ban} title="Никто не заблокирован" variant="compact" />;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {blockedUserIds.map((id) => {
        const u = userById(id);
        return (
          <div
            key={id}
            className="flex items-center gap-[12px] rounded-[12px] border px-[14px] py-[10px]"
            style={{ borderColor: "var(--border)" }}
          >
            <UserAvatar src={u.avatar} name={u.name} size={40} />
            <div
              className="min-w-0 flex-1 truncate text-[14px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {u.name}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!isDemoMode()) {
                  const numericId = u.numericId ?? numericIds[id];
                  if (!numericId) {
                    // Спросить сервер нечем — значит и снимать нечего.
                    toast.error("Не удалось разблокировать: сервер не ответил, кто это");
                    return;
                  }
                  try {
                    await unblockUser(numericId);
                  } catch {
                    toast.error("Не удалось разблокировать");
                    return;
                  }
                }
                actions.unblockUser(id);
                toast.success(`${u.name} разблокирован`);
              }}
            >
              <ShieldOff size={14} className="mr-[6px]" /> Разблокировать
            </Button>
          </div>
        );
      })}
    </div>
  );
}
