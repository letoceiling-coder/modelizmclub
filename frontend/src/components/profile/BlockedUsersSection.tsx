import { Ban, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { userById } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function BlockedUsersSection() {
  const dialogMetaMap = useStore((s) => s.dialogMeta);
  const dialogs = useStore(selectors.dialogsList);

  const blocked = dialogs.filter((d) => dialogMetaMap[d.id]?.blocked);

  if (blocked.length === 0) {
    return <EmptyState icon={Ban} title="Никто не заблокирован" variant="compact" />;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {blocked.map((d) => {
        const u = userById(d.userId);
        return (
          <div
            key={d.id}
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
              onClick={() => {
                actions.setDialogMeta(d.id, { blocked: false });
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
