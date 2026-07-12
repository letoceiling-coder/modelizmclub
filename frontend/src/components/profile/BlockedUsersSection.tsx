import { useEffect } from "react";
import { Ban, ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { userById } from "@/lib/mock";
import { useStore, actions } from "@/lib/store";
import { fetchBlockedUsers, unblockUser } from "@/lib/api/social";
import { isDemoMode } from "@/lib/demo-mode";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function BlockedUsersSection() {
  const blockedUserIds = useStore((s) => s.blockedUserIds);

  useEffect(() => {
    if (isDemoMode()) return;
    fetchBlockedUsers()
      .then((users) => {
        users.forEach((u) => {
          if (!blockedUserIds.includes(u.id)) actions.blockUser(u.id);
        });
      })
      .catch(() => {});
  }, []);

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
            <img src={u.avatar} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {u.name}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!isDemoMode() && u.numericId) {
                  try { await unblockUser(u.numericId); } catch { toast.error("Не удалось разблокировать"); return; }
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
