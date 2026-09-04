import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCommunity } from "@/lib/api/communities";
import { toast } from "@/lib/toast";

interface Props {
  slug: string;
  name: string;
  onDeleted: () => void;
  compact?: boolean;
}

export function DeleteCommunityDialog({ slug, name, onDeleted, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = confirmName.trim() === name;

  const submit = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await deleteCommunity(slug, confirmName.trim());
      toast.success("Сообщество удалено");
      setOpen(false);
      setConfirmName("");
      onDeleted();
    } catch {
      toast.error("Не удалось удалить сообщество");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "sm" : "default"}
        className={compact ? "gap-1.5 text-[13px]" : "gap-2 rounded-[12px]"}
        style={
          compact
            ? { color: "var(--danger, #dc2626)" }
            : { borderColor: "rgba(239,68,68,0.35)", color: "rgb(185,28,28)" }
        }
        onClick={() => setOpen(true)}
      >
        <Trash2 size={compact ? 14 : 16} />
        {compact ? "Удалить" : "Удалить сообщество"}
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !busy && setOpen(false)}
    >
      <div
        className="w-full max-w-[480px] rounded-t-[20px] p-5 sm:rounded-[16px]"
        style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="font-display text-[18px] font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Удалить сообщество?
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          Это действие необратимо. Сообщество исчезнет из поиска и списков. Чтобы подтвердить,
          введите название{" "}
          <span className="font-semibold" style={{ color: "var(--foreground)" }}>
            {name}
          </span>
          .
        </p>
        <input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={name}
          className="mt-4 h-11 w-full rounded-[10px] border px-3 text-[14px] outline-none"
          style={{
            borderColor: "var(--border)",
            background: "var(--background-surface)",
            color: "var(--foreground)",
          }}
          autoFocus
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!canDelete || busy}
            onClick={() => void submit()}
            style={{ background: "rgb(220,38,38)", color: "#fff" }}
          >
            {busy ? "Удаляем…" : "Удалить навсегда"}
          </Button>
        </div>
      </div>
    </div>
  );
}
