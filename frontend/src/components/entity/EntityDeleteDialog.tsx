import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export interface DeleteDialogLabels {
  trigger: string;
  triggerCompact: string;
  title: string;
  /** Текст перед названием, которое надо ввести. Само название дописывается жирным. */
  description: ReactNode;
  cancel: string;
  confirm: string;
  busy: string;
  done: string;
  failed: string;
}

interface Props {
  name: string;
  /** Удаление: свой адрес API у сообщества и у канала. */
  remove: (confirmation: string) => Promise<unknown>;
  onDeleted: () => void;
  labels: DeleteDialogLabels;
  compact?: boolean;
  /** Управляемый режим — окно открывает меню «Ещё», а не своя кнопка. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

/**
 * Подтверждение удаления вводом названия.
 *
 * Пара отличалась вызовом API и подписями; всё остальное — вплоть до
 * `rgba(0,0,0,0.55)` на подложке и `rgb(220,38,38)` на кнопке — совпадало
 * посимвольно. Управляемый режим был только у канала: он тут сохранён и
 * доступен обоим, потому что «своя кнопка» — частный случай, а не другой
 * компонент.
 */
export function EntityDeleteDialog({
  name,
  remove,
  onDeleted,
  labels,
  compact,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = confirmName.trim() === name;

  const submit = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await remove(confirmName.trim());
      toast.success(labels.done);
      setOpen(false);
      setConfirmName("");
      onDeleted();
    } catch {
      toast.error(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    if (hideTrigger) return null;
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
        {compact ? labels.triggerCompact : labels.trigger}
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
          {labels.title}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          {labels.description}{" "}
          <span className="font-semibold" style={{ color: "var(--foreground)" }}>
            {name}
          </span>
          .
        </p>
        <input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={name}
          className="mt-4 h-11 w-full rounded-[10px] border px-3 text-[14px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--background-surface)",
            color: "var(--foreground)",
          }}
          autoFocus
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canDelete || busy}
            onClick={() => void submit()}
            style={{ background: "rgb(220,38,38)", color: "#fff" }}
          >
            {busy ? labels.busy : labels.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
